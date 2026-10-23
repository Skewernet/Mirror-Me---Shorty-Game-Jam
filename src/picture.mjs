import * as T from "three";

// One beauty render with a depth attachment, followed by a small presentation pass.
// The room mirror keeps its own optically correct render; no scene-wide blur or DOF.
export class Picture {
  constructor(renderer, camera) {
    this.renderer = renderer;
    this.camera = camera;
    this.contactShadows = true;
    this.quality = 1080;
    const webgl2 = renderer.capabilities.isWebGL2;
    this.maxSamples = webgl2 ? renderer.capabilities.maxSamples : 0;
    this.hdr = webgl2 && renderer.extensions.has("EXT_color_buffer_float");
    const depthSupported =
      webgl2 || renderer.extensions.has("WEBGL_depth_texture");
    const derivativesSupported =
      webgl2 || renderer.extensions.has("OES_standard_derivatives");
    this.ambientOcclusionSupported = depthSupported && derivativesSupported;
    this.target = new T.WebGLRenderTarget(1, 1, {
      minFilter: T.LinearFilter,
      magFilter: T.LinearFilter,
      // Older integrated/browser contexts can still use the presentation pass.
      type: this.hdr ? T.HalfFloatType : T.UnsignedByteType,
      depthBuffer: true,
    });
    this.target.texture.colorSpace = T.LinearSRGBColorSpace;
    if (depthSupported)
      this.target.depthTexture = new T.DepthTexture(1, 1, T.UnsignedIntType);
    this.scene = new T.Scene();
    this.view = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.uniforms = {
      image: { value: this.target.texture },
      depth: { value: this.target.depthTexture || this.target.texture },
      texel: { value: new T.Vector2(1, 1) },
      inverseProjection: { value: camera.projectionMatrixInverse },
      projection: { value: camera.projectionMatrix },
      exposure: { value: renderer.toneMappingExposure },
      aoEnabled: { value: 1 },
      edgeAAEnabled: { value: 1 },
    };
    const kernel = [];
    for (let i = 0; i < 12; i++) {
      const angle = i * 2.399963,
        z = (i + 0.5) / 12;
      const length = 0.15 + 0.85 * ((i + 1) / 12) ** 2;
      kernel.push(
        new T.Vector3(
          Math.cos(angle) * Math.sqrt(1 - z * z),
          Math.sin(angle) * Math.sqrt(1 - z * z),
          z,
        ).multiplyScalar(length),
      );
    }
    this.uniforms.samples = { value: kernel };
    const material = new T.ShaderMaterial({
      uniforms: this.uniforms,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      extensions: { derivatives: !webgl2 && derivativesSupported },
      defines: this.ambientOcclusionSupported ? { CONTACT_AO: 1 } : {},
      vertexShader: `varying vec2 uvScreen;
        void main(){uvScreen=uv;gl_Position=vec4(position.xy,0.,1.);}`,
      fragmentShader: `
        precision highp float;
        varying vec2 uvScreen;
        uniform sampler2D image, depth;
        uniform vec2 texel;
        uniform mat4 inverseProjection, projection;
        uniform vec3 samples[12];
        uniform float exposure, aoEnabled, edgeAAEnabled;
        vec3 positionAt(vec2 uv){
          float d=texture2D(depth,uv).r;
          vec4 p=inverseProjection*vec4(uv*2.-1.,d*2.-1.,1.);
          return p.xyz/p.w;
        }
        float luminance(vec3 c){return dot(c,vec3(.299,.587,.114));}
        vec3 tone(vec3 c){
          c*=exposure;
          return clamp((c*(2.51*c+.03))/(c*(2.43*c+.59)+.14),0.,1.);
        }
        void main(){
          vec2 uv=uvScreen;
          vec3 center=texture2D(image,uv).rgb;
          vec3 color=center;
          // WebGL2 uses actual coverage samples. The performance/WebGL1 path
          // keeps a small directional AA filter without blurring the full image.
          if(edgeAAEnabled>.5){
            vec3 nw=texture2D(image,uv+texel*vec2(-1.,-1.)).rgb;
            vec3 ne=texture2D(image,uv+texel*vec2(1.,-1.)).rgb;
            vec3 sw=texture2D(image,uv+texel*vec2(-1.,1.)).rgb;
            vec3 se=texture2D(image,uv+texel*vec2(1.,1.)).rgb;
            float a=luminance(nw),b=luminance(ne),c=luminance(sw),d=luminance(se);
            vec2 dir=vec2(-((a+b)-(c+d)),(a+c)-(b+d));
            dir=clamp(dir/(min(abs(dir.x),abs(dir.y))+max((a+b+c+d)*.03125,.0078)),-4.,4.)*texel;
            vec3 smoothColor=.5*(texture2D(image,uv+dir/6.).rgb+texture2D(image,uv-dir/6.).rgb);
            float edge=max(max(a,b),max(c,d))-min(min(a,b),min(c,d));
            color=mix(center,smoothColor,clamp(edge*2.,0.,.65));
          }
          float occlusion=0.;
          #ifdef CONTACT_AO
          if(aoEnabled>.5 && texture2D(depth,uv).r<.9999){
            vec3 p=positionAt(uv);
            vec3 n=normalize(cross(dFdx(p),dFdy(p)));
            if(dot(n,-p)<0.) n=-n;
            // Screen-stable interleaved rotation distributes the small hemisphere kernel.
            float noise=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
            vec3 randomVector=vec3(cos(noise*6.28318),sin(noise*6.28318),0.);
            vec3 tangent=normalize(randomVector-n*dot(randomVector,n));
            mat3 basis=mat3(tangent,cross(n,tangent),n);
            for(int i=0;i<12;i++){
              vec3 candidate=p+basis*samples[i]*.36;
              vec4 offset=projection*vec4(candidate,1.);
              vec2 sampleUV=offset.xy/offset.w*.5+.5;
              if(sampleUV.x>0. && sampleUV.x<1. && sampleUV.y>0. && sampleUV.y<1.){
                float surfaceZ=positionAt(sampleUV).z;
                float range=smoothstep(0.,1.,.36/(abs(p.z-surfaceZ)+.001));
                occlusion+=step(candidate.z+.018,surfaceZ)*range;
              }
            }
          }
          #endif
          color*=1.-min(.42,occlusion/12.*.58);
          // Restrained film response: warm mids, cool shadows, no crushed black threshold.
          color=mix(vec3(luminance(color)),color,.93);
          color*=mix(vec3(.94,.985,1.035),vec3(1.025,1.005,.975),smoothstep(.03,.8,luminance(color)));
          color=tone(color);
          color=mix(color*12.92,1.055*pow(color,vec3(1./2.4))-.055,step(vec3(.0031308),color));
          gl_FragColor=vec4(color,1.);
        }`,
    });
    const quad = new T.Mesh(new T.PlaneGeometry(2, 2), material);
    quad.frustumCulled = false;
    this.scene.add(quad);
  }
  resize(width, height, quality) {
    this.quality = quality;
    const samples = Math.min(
      this.maxSamples,
      quality >= 1440 ? 4 : quality >= 1080 ? 2 : 0,
    );
    if (samples !== this.target.samples) {
      this.target.samples = samples;
      this.target.dispose();
    }
    this.uniforms.edgeAAEnabled.value = samples ? 0 : 1;
    this.target.setSize(width, height);
    this.uniforms.texel.value.set(1 / width, 1 / height);
  }
  render(scene, camera) {
    this.uniforms.exposure.value = this.renderer.toneMappingExposure;
    this.uniforms.aoEnabled.value =
      this.ambientOcclusionSupported &&
      this.contactShadows &&
      this.quality >= 720
        ? 1
        : 0;
    const destination = this.renderer.getRenderTarget();
    try {
      this.renderer.setRenderTarget(this.target);
      this.renderer.render(scene, camera);
      this.stats = { ...this.renderer.info.render };
      this.renderer.setRenderTarget(destination);
      this.renderer.render(this.scene, this.view);
    } finally {
      this.renderer.setRenderTarget(destination);
    }
  }
}
