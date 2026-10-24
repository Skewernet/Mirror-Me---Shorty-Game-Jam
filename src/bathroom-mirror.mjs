import * as T from "three";
import { Reflector } from "../vendor/Reflector.js";
import { singleBounce } from "./reflection.mjs";

// Authored finger paths, not a font/decal. Coordinates are fractions of the
// glass, with small changes in pressure and overlapping starts/ends.
export const TIME_STROKES = [
  [[.22,.39],[.18,.38],[.15,.43],[.145,.52],[.17,.60],[.21,.61],[.24,.56],[.245,.46],[.22,.39]],
  [[.29,.40],[.34,.385],[.375,.42],[.37,.46],[.33,.485]],
  [[.33,.485],[.375,.49],[.385,.54],[.36,.60],[.305,.61],[.28,.58]],
  [[.455,.46],[.456,.467]], [[.453,.56],[.452,.567]],
  [[.53,.435],[.57,.393],[.565,.60]],
  [[.635,.40],[.745,.395],[.713,.46],[.68,.53],[.66,.61]],
];

export function fingerWipeCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 768;
  const g = canvas.getContext("2d");
  g.fillStyle = "black";
  g.fillRect(0, 0, canvas.width, canvas.height);
  // The house's existing clue is seen backward: 03:17 written on the other
  // side. Keep that puzzle, but wipe moisture away rather than printing ink.
  g.translate(canvas.width, 0);
  g.scale(-1, 1);
  g.lineCap = g.lineJoin = "round";
  for (const [strokeIndex, points] of TIME_STROKES.entries()) {
    const p = points.map(([x, y]) => [x * canvas.width, y * canvas.height]);
    for (let j = 1; j < p.length; j++) {
      g.strokeStyle = "rgb(249,249,249)";
      g.lineWidth = 12.5 + Math.sin(j * 2.7 + strokeIndex) * 2.4;
      g.beginPath();
      g.moveTo(...p[j - 1]);
      // Catmull-Rom tangents keep a finger's continuous curved gesture instead
      // of connecting the authored samples with angular digital segments.
      const before = p[Math.max(0, j - 2)], start = p[j - 1];
      const end = p[j], after = p[Math.min(p.length - 1, j + 1)];
      g.bezierCurveTo(
        start[0] + (end[0] - before[0]) / 6,
        start[1] + (end[1] - before[1]) / 6,
        end[0] - (after[0] - start[0]) / 6,
        end[1] - (after[1] - start[1]) / 6,
        ...end,
      );
      g.stroke();
    }
  }
  return canvas;
}

export function createBathroomMirror(parent) {
  const glass = singleBounce(new Reflector(new T.PlaneGeometry(.94, .75), {
    color: 0x969e98,
    textureWidth: 640,
    textureHeight: 512,
    clipBias: .001,
    multisample: 0,
  }));
  glass.name = "Bathroom glass with surface condensation";
  glass.position.set(2.15, 1.7, .991);
  glass.camera.layers.enable(1);
  glass.castShadow = false;
  glass.receiveShadow = false;
  const wipe = new T.CanvasTexture(fingerWipeCanvas());
  wipe.minFilter = T.LinearMipmapLinearFilter;
  wipe.anisotropy = 4;
  Object.assign(glass.material.uniforms, {
    wipeMap: { value: wipe },
    revealed: { value: 0 },
    reflectionTexel: { value: new T.Vector2(1 / 640, 1 / 512) },
  });
  glass.material.vertexShader = glass.material.vertexShader
    .replace("varying vec4 vUv;", "varying vec4 vUv; varying vec2 glassUV;")
    .replace("void main() {", "void main() { glassUV = uv;");
  glass.material.fragmentShader = glass.material.fragmentShader
    .replace("varying vec4 vUv;", `varying vec4 vUv;
      varying vec2 glassUV;
      uniform sampler2D wipeMap;
      uniform float revealed;
      uniform vec2 reflectionTexel;
      float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p) {
        vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
          mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
      }`)
    .replace("vec4 base = texture2DProj( tDiffuse, vUv );", `
      // Everything is evaluated in the glass's UVs, never screen coordinates.
      vec2 uv=glassUV;
      float cloud=noise(uv*4.7)*.57+noise(uv*13.3+7.)*.28+noise(uv*39.)*.15;
      float density=clamp(.10+cloud*1.05+(1.-uv.y)*.12,0.,.96);
      vec2 edgeNoise=vec2(noise(uv*190.),noise(uv*173.+13.))-.5;
      float wiped=texture2D(wipeMap,uv+edgeNoise*.0022).r*revealed;
      density*=1.-wiped*.985;
      // Coalesced water drains downward in a few long, uneven clear rivulets.
      float column=floor(uv.x*23.);
      float runSeed=hash(vec2(column,19.));
      float runTop=.22+hash(vec2(column,31.))*.68;
      float runLength=.045+hash(vec2(column,47.))*.17;
      float runX=(column+.18+hash(vec2(column,7.))*.64)/23.;
      runX+=sin(uv.y*45.+runSeed*20.)*.0007;
      float run=(1.-smoothstep(.0005,.0019,abs(uv.x-runX)))
        *smoothstep(runTop-runLength,runTop-runLength+.02,uv.y)
        *(1.-smoothstep(runTop-.008,runTop,uv.y))*step(.48,runSeed);
      density*=1.-run*.58;
      // Sparse beads have irregular radii; a few have short gravity trails.
      vec2 cell=vec2(102.,81.);
      vec2 id=floor(uv*cell), local=fract(uv*cell);
      float seed=hash(id), radius=mix(.055,.18,hash(id+9.));
      vec2 beadCenter=vec2(.22+hash(id+2.)*.56,.28+hash(id+4.)*.44);
      vec2 d=local-beadCenter;
      float bead=(1.-smoothstep(radius*.48,radius,length(d)))*step(.77,seed);
      float trail=(1.-smoothstep(.018,.048,abs(d.x+sin(uv.y*380.+seed)*.01)))
        *smoothstep(-.37,-.27,d.y)*(1.-smoothstep(-.02,.04,d.y))*step(.966,seed);
      float water=max(max(bead,trail*.45),run*.32)*(1.-wiped);
      vec2 screen=vUv.xy/vUv.w;
      vec2 distortion=(d*bead*.003+vec2(edgeNoise.x*.00035,trail*.0007))*(1.-wiped);
      vec2 spread=reflectionTexel*(1.3+density*7.5);
      vec3 sharp=texture2D(tDiffuse,screen+distortion).rgb;
      vec3 blurred=sharp*.20;
      blurred+=texture2D(tDiffuse,screen+spread*vec2(1,0)).rgb*.12;
      blurred+=texture2D(tDiffuse,screen-spread*vec2(1,0)).rgb*.12;
      blurred+=texture2D(tDiffuse,screen+spread*vec2(0,1)).rgb*.12;
      blurred+=texture2D(tDiffuse,screen-spread*vec2(0,1)).rgb*.12;
      blurred+=texture2D(tDiffuse,screen+spread).rgb*.08;
      blurred+=texture2D(tDiffuse,screen-spread).rgb*.08;
      blurred+=texture2D(tDiffuse,screen+spread*vec2(1,-1)).rgb*.08;
      blurred+=texture2D(tDiffuse,screen+spread*vec2(-1,1)).rgb*.08;
      vec3 reflected=mix(sharp,blurred,density*.86);
      // Thin milky scattering retains the reflected room through wet glass.
      float roomLight=dot(blurred,vec3(.2126,.7152,.0722));
      vec3 haze=vec3(.80,.88,.81)*(.012+min(sqrt(max(roomLight,0.))*.35,.24));
      reflected=mix(reflected,haze,density*.52);
      reflected+=water*.026;
      vec4 base=vec4(reflected,1.);
    `);
  parent.add(glass);
  return {
    glass,
    setClueVisible(visible) {
      glass.material.uniforms.revealed.value = visible ? 1 : 0;
    },
  };
}
