import * as T from "three";
import { GLTFLoader } from "../vendor/GLTFLoader.js";
import { clone as cloneSkeleton } from "../vendor/SkeletonUtils.js";
import { FigureRig } from "./figure-motion.mjs";

let template, mouthMask, woundFactory, loading;

// Evelyn is independently built from the licensed elderly morphology, skin,
// skirt/blouse and short curled hair. Mara's asset is never loaded or altered.
export function preloadEvelynAssets() {
  if (loading) return loading;
  loading = Promise.all([
    new GLTFLoader().loadAsync(new URL("../assets/character/evelyn.glb", import.meta.url).href),
    new T.TextureLoader().loadAsync(new URL("../assets/character/inside-mouth-mask.jpg", import.meta.url).href),
    import("./evelyn-wounds.mjs"),
  ]).then(([gltf, mask, wounds]) => {
    template = gltf.scene;
    mouthMask = mask;
    mouthMask.flipY = false;
    mouthMask.colorSpace = T.NoColorSpace;
    woundFactory = wounds.addEvelynWounds;
    if (!template.getObjectByName("Evelyn_Skin")?.isSkinnedMesh || !template.getObjectByName("head"))
      throw new Error("Evelyn's independent character asset has no human skin/rig.");
    return template;
  });
  return loading;
}

export function createEvelyn({ wounded = false } = {}) {
  if (!template) throw new Error("Await preloadEvelynAssets() before creating Evelyn.");
  const body = new T.Group();
  body.name = wounded ? "Evelyn Vale — remembered wounds" : "Evelyn Vale — at rest";
  body.userData.characterIdentity = "Evelyn Vale";
  body.userData.characterAsset = "assets/character/evelyn.glb";
  body.userData.wounded = wounded;
  const visual = cloneSkeleton(template);
  visual.rotation.y = Math.PI;
  body.add(visual);
  const materials = [];
  visual.traverse(object => {
    object.layers.set(0);
    if (!object.isMesh) return;
    object.frustumCulled = false;
    object.castShadow = false;
    object.receiveShadow = true;
    const own = original => {
      const material = original.clone();
      material.transparent = false;
      material.depthWrite = true;
      material.envMapIntensity = .055;
      material.alphaTest = /Hair|Brows|Lashes/.test(material.name) ? .35 : /Eyes/.test(material.name) ? .1 : 0;
      if (/Hair|Brows|Lashes/.test(material.name)) material.side = T.DoubleSide;
      if (/Hair/.test(material.name)) {
        material.roughness = .83;
        material.bumpMap = material.map;
        material.bumpScale = .0011;
        material.onBeforeCompile = shader => {
          shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
            float grayStrand=smoothstep(.78,.96,.5+.5*sin(vMapUv.x*91.+sin(vMapUv.y*7.)*.8));
            float strandValue=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
            diffuseColor.rgb=mix(diffuseColor.rgb,vec3(strandValue)*vec3(1.12,1.10,1.05),grayStrand*.52);`);
        };
        material.customProgramCacheKey = () => "evelyn-short-waved-ash-hair-v1";
      }
      if (/Skin/.test(material.name)) {
        material.roughness = .72;
        material.onBeforeCompile = shader => {
          shader.uniforms.evelynMouth = { value: mouthMask };
          shader.fragmentShader = "uniform sampler2D evelynMouth;\n" + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
            float mouthInterior=texture2D(evelynMouth,vMapUv).r;
            diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.006,.002,.002),mouthInterior);`);
        };
        material.customProgramCacheKey = () => "evelyn-aged-skin-v1";
      }
      if (/Clothes/.test(material.name)) {
        material.roughness = .88;
        material.onBeforeCompile = shader => {
          shader.vertexShader = "varying vec3 vEvelynDress;\n" + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvEvelynDress=position;");
          shader.fragmentShader = "varying vec3 vEvelynDress;\n" + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
            vec3 dressPoint=vEvelynDress;
            float blouse=smoothstep(.76,.88,dressPoint.y);
            float weave=sin(dressPoint.x*1700.)*sin(dressPoint.y*1500.);
            vec2 flowerUV=vec2(dressPoint.x*39.+dressPoint.z*14.,dressPoint.y*37.);
            vec2 cell=floor(flowerUV), f=fract(flowerUV)-.5;
            float seed=fract(sin(dot(cell,vec2(12.9898,78.233)))*43758.5453);
            f-=vec2(sin(seed*17.),cos(seed*13.))*.10;
            float angle=atan(f.y,f.x);
            float petals=.135+.027*cos(angle*5.+seed*3.)+.018*sin(angle*3.-seed*7.);
            float bloom=1.-smoothstep(petals-.065,petals+.055,length(f));
            float centre=1.-smoothstep(.025,.085,length(f));
            vec3 cream=vec3(.65,.57,.45)*(1.+weave*.025);
            vec3 rose=mix(vec3(.37,.20,.20),vec3(.50,.33,.28),seed);
            vec3 floral=mix(cream,rose,bloom*.73);
            floral=mix(floral,vec3(.39,.29,.23),centre*.32);
            float oldTexture=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
            vec3 skirt=vec3(.095,.080,.065)*(.80+oldTexture*.32);
            diffuseColor.rgb=mix(skirt,floral,blouse);`);
        };
        material.customProgramCacheKey = () => "evelyn-original-portrait-floral-dress-v1";
      }
      materials.push(material);
      return material;
    };
    object.material = Array.isArray(object.material) ? object.material.map(own) : own(object.material);
  });
  const rig = new FigureRig(body, visual);
  const skin = visual.getObjectByName("Evelyn_Skin");
  const head = rig.joint("head").bone;
  const setMorph = (name, value) => {
    const index = skin.morphTargetDictionary?.[name];
    if (index !== undefined) skin.morphTargetInfluences[index] = T.MathUtils.clamp(value, 0, 1);
  };
  let wounds = null;
  if (wounded) {
    if (!woundFactory) throw new Error("Evelyn's wound geometry was not prepared.");
    wounds = woundFactory(body, rig);
  }
  return {
    body, visual, rig, head, skin, materials, wounds,
    identity: "Evelyn Vale",
    height: 1.62,
    setMouthOpen(value) { setMorph("Evelyn_Jaw_Open", value); },
    setEyesClosed(value) {
      setMorph("Evelyn_Eye_left_Closed", value ? 1 : 0);
      setMorph("Evelyn_Eye_right_Closed", value ? 1 : 0);
      const lashes = visual.getObjectByName("Evelyn_Lashes");
      if (lashes) lashes.visible = !value;
    },
    resetPose() {
      rig.reset();
      setMorph("Evelyn_Jaw_Open", 0);
      setMorph("Evelyn_Eye_left_Closed", 0);
      setMorph("Evelyn_Eye_right_Closed", 0);
      const lashes = visual.getObjectByName("Evelyn_Lashes");
      if (lashes) lashes.visible = true;
    },
  };
}
