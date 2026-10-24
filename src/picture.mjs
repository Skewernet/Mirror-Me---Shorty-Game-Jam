import * as T from "three";

const MAX_AO_SAMPLES = 10;

// One linear beauty image and one presentation pass. Color response, lens
// shading and contact shade share that pass; there is no blur/DOF stack or
// history buffer to smear a mirror clue, a camera turn or a sudden reveal.
export class Picture {
  constructor(renderer, camera) {
    this.renderer = renderer;
    this.camera = camera;
    this.contactShadows = true;
    this.postProcessing = true;
    this.quality = 1080;
    this.stats = { calls: 0, triangles: 0, points: 0, lines: 0 };
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
      aoSampleCount: { value: 6 },
      edgeAAEnabled: { value: 1 },
      postEnabled: { value: 1 },
      highlightGlow: { value: 0 },
      threatAmount: { value: 0 },
      threatTime: { value: 0 },
      threatMotion: { value: 1 },
    };
    this.uniforms.samples = {
      value: Array.from({ length: MAX_AO_SAMPLES }, () => new T.Vector3()),
    };
    this.updateKernel(6);
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
        uniform vec3 samples[${MAX_AO_SAMPLES}];
        uniform float exposure, aoEnabled, aoSampleCount, edgeAAEnabled;
        uniform float postEnabled, highlightGlow, threatAmount, threatTime, threatMotion;
        float screenNoise(vec2 p){return fract(52.9829189*fract(dot(p,vec2(.06711056,.00583715))));}
        vec3 positionAt(vec2 uv){
          float d=texture2D(depth,uv).r;
          vec4 p=inverseProjection*vec4(uv*2.-1.,d*2.-1.,1.);
          return p.xyz/p.w;
        }
        // Only depth is needed for a neighboring surface. Reconstructing a
        // full vec4/matrix product for every AO tap wastes most of its work.
        float viewDepthAt(vec2 uv){
          float z=texture2D(depth,uv).r*2.-1.;
          return (inverseProjection[2][2]*z+inverseProjection[3][2])/
            (inverseProjection[2][3]*z+inverseProjection[3][3]);
        }
        float luminance(vec3 c){return dot(c,vec3(.299,.587,.114));}
        vec3 tone(vec3 c){
          c*=exposure;
          return clamp((c*(2.51*c+.03))/(c*(2.43*c+.59)+.14),0.,1.);
        }
        void main(){
          vec2 uv=uvScreen;
          float threat=postEnabled>.5?clamp(threatAmount,0.,1.):0.;
          // The scene image shivers by only a few pixels. Camera orientation,
          // aiming, physical movement and the crisp DOM HUD are untouched.
          if(threat>.001 && threatMotion>.5){
            float band=floor(uv.y*31.);
            float beat=floor(threatTime*15.);
            float shiver=screenNoise(vec2(band,beat))-.5;
            uv.x+=shiver*texel.x*6.*threat*threat;
            uv.y+=sin(threatTime*19.)*texel.y*.65*threat*threat;
            uv=clamp(uv,texel*.5,vec2(1.)-texel*.5);
          }
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
            vec3 gradient=cross(dFdx(p),dFdy(p));
            vec3 n=gradient/max(length(gradient),.000001);
            if(dot(n,-p)<0.) n=-n;
            // Screen-stable interleaved rotation distributes the small hemisphere kernel.
            float noise=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
            vec3 randomVector=vec3(cos(noise*6.28318),sin(noise*6.28318),0.);
            vec3 tangent=randomVector-n*dot(randomVector,n);
            tangent/=max(length(tangent),.000001);
            mat3 basis=mat3(tangent,cross(n,tangent),n);
            for(int i=0;i<${MAX_AO_SAMPLES};i++){
              if(float(i)>=aoSampleCount) break;
              vec3 candidate=p+basis*samples[i]*.30;
              vec4 offset=projection*vec4(candidate,1.);
              vec2 sampleUV=offset.xy/offset.w*.5+.5;
              if(sampleUV.x>0. && sampleUV.x<1. && sampleUV.y>0. && sampleUV.y<1.){
                float surfaceZ=viewDepthAt(sampleUV);
                float range=smoothstep(0.,1.,.30/(abs(p.z-surfaceZ)+.001));
                occlusion+=step(candidate.z+.018,surfaceZ)*range;
              }
            }
          }
          #endif
          color*=1.-min(.34,occlusion/max(aoSampleCount,1.)*.50);
          if(postEnabled>.5){
            // Only the Detailed profile spends four extra taps on a tiny
            // warm highlight spill. It leaves texture edges and text sharp.
            if(highlightGlow>.5){
              vec2 spread=texel*2.25;
              vec3 glow=max(texture2D(image,uv+spread).rgb-vec3(1.1),vec3(0.));
              glow+=max(texture2D(image,uv-spread).rgb-vec3(1.1),vec3(0.));
              glow+=max(texture2D(image,uv+vec2(spread.x,-spread.y)).rgb-vec3(1.1),vec3(0.));
              glow+=max(texture2D(image,uv+vec2(-spread.x,spread.y)).rgb-vec3(1.1),vec3(0.));
              color+=min(glow,vec3(6.))*vec3(.020,.014,.009);
            }
            float level=luminance(color);
            float shadows=1.-smoothstep(.015,.32,level);
            float highlights=smoothstep(.45,2.2,level);
            color=mix(vec3(level),color,.96-.035*shadows+.015*highlights);
            // Cool, breathable shadows and restrained amber practical light.
            // Skin and blood retain their original photographic hue.
            color*=mix(vec3(.935,.985,1.035),vec3(1.025,1.005,.975),smoothstep(.025,.65,level));
          }
          color=tone(color);
          if(postEnabled>.5){
            // A gentle S response retains zero black and white endpoints.
            color=mix(color,color*color*(3.-2.*color),.09);
            vec2 lens=(uv-.5)*vec2(1.,.85);
            color*=1.-.24*smoothstep(.10,.46,dot(lens,lens));
          }
          if(threat>.001){
            float grey=luminance(color);
            color=mix(color,vec3(grey)*vec3(.95,1.,.96),threat*.27);
            vec2 edge=(uvScreen-.5)*vec2(1.,.85);
            color*=1.-threat*.48*smoothstep(.035,.43,dot(edge,edge));
            // No full-screen flash: bounded fine static, with temporal noise
            // disabled by the player's irregular-light preference.
            float phase=threatMotion>.5?floor(threatTime*12.):0.;
            float grain=screenNoise(gl_FragCoord.xy+vec2(phase*17.,phase*5.))-.5;
            float scan=sin((uvScreen.y/texel.y+phase)*1.2);
            color=clamp(color+grain*threat*.075+scan*threat*.008,0.,1.);
          }
          color=mix(color*12.92,1.055*pow(color,vec3(1./2.4))-.055,step(vec3(.0031308),color));
          gl_FragColor=vec4(color,1.);
        }`,
    });
    const quad = this.quad = new T.Mesh(new T.PlaneGeometry(2, 2), material);
    quad.frustumCulled = false;
    this.scene.add(quad);
  }
  setOptions({ postProcessing = this.postProcessing } = {}) {
    this.postProcessing = Boolean(postProcessing);
  }
  setThreat(amount = 0, time = 0, { enabled = true, flashes = true } = {}) {
    this.uniforms.threatAmount.value = enabled && Number.isFinite(amount)
      ? T.MathUtils.clamp(amount, 0, 1) : 0;
    this.uniforms.threatTime.value = Number.isFinite(time) ? Math.max(0, time) % 600 : 0;
    this.uniforms.threatMotion.value = flashes ? 1 : 0;
  }
  updateKernel(count) {
    this.uniforms.aoSampleCount.value = count;
    for (let i = 0; i < MAX_AO_SAMPLES; i++) {
      const index = Math.min(i, count - 1), angle = index * 2.399963;
      const z = (index + .5) / count;
      const radius = .15 + .85 * ((index + 1) / count) ** 2;
      this.uniforms.samples.value[i].set(
        Math.cos(angle) * Math.sqrt(1 - z * z),
        Math.sin(angle) * Math.sqrt(1 - z * z),
        z,
      ).multiplyScalar(radius);
    }
  }
  async warmup() {
    const destination = this.renderer.getRenderTarget();
    try {
      // setRenderTarget allocates the beauty attachments on this Three version.
      // Compile the presentation against the real screen color-space variant.
      this.renderer.setRenderTarget(this.target);
      this.renderer.setRenderTarget(null);
      await this.renderer.compileAsync(this.scene, this.view);
    } finally {
      this.renderer.setRenderTarget(destination);
    }
  }
  resize(width, height, quality) {
    this.quality = quality;
    const samples = Math.min(
      this.maxSamples,
      quality >= 1440 ? 2 : 0,
    );
    if (samples !== this.target.samples) {
      this.target.samples = samples;
      this.target.dispose();
    }
    this.uniforms.edgeAAEnabled.value = samples ? 0 : 1;
    this.uniforms.highlightGlow.value = quality >= 1440 ? 1 : 0;
    this.updateKernel(quality >= 1440 ? 10 : quality >= 1080 ? 6 : 4);
    this.target.setSize(width, height);
    this.uniforms.texel.value.set(1 / width, 1 / height);
  }
  render(scene, camera) {
    this.uniforms.inverseProjection.value = camera.projectionMatrixInverse;
    this.uniforms.projection.value = camera.projectionMatrix;
    this.uniforms.exposure.value = this.renderer.toneMappingExposure;
    this.uniforms.postEnabled.value = this.postProcessing ? 1 : 0;
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
      Object.assign(this.stats, this.renderer.info.render);
      this.renderer.setRenderTarget(destination);
      this.renderer.render(this.scene, this.view);
    } finally {
      this.renderer.setRenderTarget(destination);
    }
  }
  dispose() {
    this.target.dispose();
    this.quad.geometry.dispose();
    this.quad.material.dispose();
  }
}
