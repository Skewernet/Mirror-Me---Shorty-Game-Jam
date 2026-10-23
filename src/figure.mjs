import * as T from "three";
import { GLTFLoader } from "../vendor/GLTFLoader.js";
import { clone as cloneSkeleton } from "../vendor/SkeletonUtils.js";

let template;
let loading;
let skinVariants;

// One bundled, licensed asset; the reflection, apparition and replacement share
// geometry and textures, but each owns its skeleton, materials and pose controls.
export function preloadCharacterAssets() {
  if (loading) return loading;
  loading = new GLTFLoader()
    .loadAsync(new URL("../assets/character/mara.glb", import.meta.url).href)
    .then((gltf) => {
      template = gltf.scene;
      const skin = template.getObjectByName("Mara_Skin");
      if (!skin?.isSkinnedMesh || !template.getObjectByName("head"))
        throw new Error(
          "Mara's character asset is missing its skin or head rig.",
        );
      skinVariants = createSkinVariants(skin.material.map);
      return template;
    });
  return loading;
}

export function createFigure(_house, layer = 1) {
  if (!template)
    throw new Error(
      "Call await preloadCharacterAssets() before creating Mara.",
    );
  const body = new T.Group();
  body.name = "Mara Vale";
  body.userData.characterAsset =
    "MakeHuman / MPFB CC0 — assets/character/README.md";
  const visual = cloneSkeleton(template);
  // MakeHuman faces Blender -Y; glTF converts this to +Z. The game's forward
  // convention is -Z, so rotate only this inner asset, preserving body.rotation.
  visual.rotation.y = Math.PI;
  body.add(visual);
  const materials = new Map();
  body.traverse((object) => {
    object.layers.set(layer);
    if (!object.isMesh) return;
    object.castShadow = object.receiveShadow = true;
    object.frustumCulled = false; // Limb motion may leave a glTF rest-pose bound.
    const ownMaterial = (material) => {
      const own = material.clone();
      materials.set(own.name, own);
      // Alpha-tested strands receive light and occlude one another without the
      // order-dependent transparency artifacts of overlapping hair shells.
      own.transparent = false;
      own.depthWrite = true;
      own.envMapIntensity = 0.08;
      own.alphaTest = /Eyes/.test(own.name)
        ? 0.1
        : /Hair|Brows|Lashes/.test(own.name)
          ? 0.35
          : 0;
      own.side = /Hair|Brows|Lashes/.test(own.name)
        ? T.DoubleSide
        : T.FrontSide;
      if (/Clothes|Shoes/.test(own.name)) own.roughness = 0.84;
      if (/Hair/.test(own.name)) own.roughness = 0.7;
      own.needsUpdate = true;
      return own;
    };
    object.material = Array.isArray(object.material)
      ? object.material.map(ownMaterial)
      : ownMaterial(object.material);
    if (/Hair|Brows|Lashes/.test(object.material.name)) {
      object.customDepthMaterial = new T.MeshDepthMaterial({
        depthPacking: T.RGBADepthPacking,
        map: object.material.map,
        alphaTest: 0.35,
        side: T.DoubleSide,
      });
    }
  });
  const bones = new Map();
  visual.traverse((object) => {
    if (object.isBone)
      bones.set(object.name, { object, rest: object.quaternion.clone() });
  });
  // Controls start at zero and apply offsets relative to the exported rest pose.
  // Euler callbacks also apply writes made AFTER animate(), as the mirror's
  // independent movement and reaching-hand encounter do.
  function control(name, boneName) {
    const proxy = new T.Object3D();
    proxy.name = name;
    const joint = bones.get(boneName);
    if (!joint) throw new Error(`Mara's rig is missing ${boneName}.`);
    const delta = new T.Quaternion();
    const syncObjectQuaternion = proxy.rotation._onChangeCallback;
    proxy.rotation._onChange(() => {
      syncObjectQuaternion();
      delta.setFromEuler(proxy.rotation);
      joint.object.quaternion.copy(joint.rest).multiply(delta);
    });
    return proxy;
  }
  const head = control("Mara head aim", "head");
  const arms = [
    control("Mara left arm", "upperarm_l"),
    control("Mara right arm", "upperarm_r"),
  ];
  const legs = [
    control("Mara left leg", "thigh_l"),
    control("Mara right leg", "thigh_r"),
  ];
  const calves = [
    control("Mara left knee", "calf_l"),
    control("Mara right knee", "calf_r"),
  ];
  const chest = control("Mara breath", "spine_03");
  let unease = -1;
  function setUnease(level) {
    const next = Math.max(0, Math.min(2, Math.floor(level)));
    if (next === unease) return;
    unease = next;
    const skin = materials.get("Mara_Skin_Material");
    skin.map = skinVariants[next];
    skin.color.set(next === 2 ? 0xc2d0c7 : next === 1 ? 0xe0e1d9 : 0xf1e3d7);
    skin.roughness = next === 2 ? 0.75 : 0.64;
    skin.needsUpdate = true;
    const eyes = materials.get("Mara_Eyes_Material");
    eyes.color.set(next === 2 ? 0xc8c5b9 : 0xffffff);
    eyes.roughness = next === 2 ? 0.32 : 0.18;
    body.userData.unease = next;
  }
  function animate(time, speed = 0, frozen = false) {
    const walking = frozen ? 0 : Math.min(Math.abs(speed) / 2, 1);
    const phase = time * 7.1;
    for (let side = 0; side < 2; side++) {
      const stride = Math.sin(phase + side * Math.PI);
      arms[side].rotation.x = stride * 0.2 * walking;
      arms[side].rotation.z = (side ? -1 : 1) * 0.012;
      legs[side].rotation.x = -stride * 0.27 * walking;
      calves[side].rotation.x = Math.max(0, stride) * 0.24 * walking;
    }
    chest.rotation.x = frozen ? 0 : Math.sin(time * 1.15) * 0.006;
    visual.position.y = frozen
      ? 0
      : Math.abs(Math.sin(phase)) * 0.009 * walking;
  }
  setUnease(0);
  return {
    body,
    head,
    arms,
    legs,
    animate,
    setUnease,
    identity: "Mara Vale",
    rig: { bones: bones.size, source: "assets/character/mara.glb" },
  };
}

function createSkinVariants(source) {
  const image = source.image;
  const width = image.width,
    height = image.height;
  const maps = [source];
  // Author the deviations in the original MakeHuman UV atlas: its frontal face
  // island lies rotated 90 degrees on the right. Each clone keeps the same face,
  // with tired eye sockets first and a restrained dried tear/split lip later.
  for (let level = 1; level <= 2; level++) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    context.scale(width, height);
    for (const y of [0.478, 0.564]) {
      context.save();
      context.translate(0.842, y);
      context.scale(0.016, 0.025);
      const bruise = context.createRadialGradient(0, 0, 0.12, 0, 0, 1);
      bruise.addColorStop(0, level === 2 ? "#352d3090" : "#4a39404a");
      bruise.addColorStop(1, "#4a394000");
      context.fillStyle = bruise;
      context.fillRect(-1, -1, 2, 2);
      context.restore();
    }
    if (level === 2) {
      context.strokeStyle = "#542321c9";
      context.lineCap = "round";
      context.lineWidth = 0.0032;
      context.beginPath();
      context.moveTo(0.851, 0.566);
      context.bezierCurveTo(0.863, 0.568, 0.873, 0.563, 0.886, 0.57);
      context.bezierCurveTo(0.896, 0.574, 0.905, 0.57, 0.914, 0.573);
      context.stroke();
      context.lineWidth = 0.0026;
      context.beginPath();
      context.moveTo(0.851, 0.478);
      context.bezierCurveTo(0.863, 0.48, 0.872, 0.475, 0.883, 0.48);
      context.lineTo(0.896, 0.483);
      context.stroke();
      context.strokeStyle = "#682a2499";
      context.lineWidth = 0.0015;
      context.beginPath();
      context.moveTo(0.853, 0.569);
      context.bezierCurveTo(0.874, 0.575, 0.895, 0.567, 0.91, 0.575);
      context.stroke();
      context.strokeStyle = "#572723bd";
      context.lineWidth = 0.0022;
      context.beginPath();
      context.moveTo(0.915, 0.518);
      context.lineTo(0.928, 0.521);
      context.stroke();
    }
    const texture = source.clone();
    // Texture.clone shares its Source. Own this canvas so changing the damaged
    // map cannot overwrite the healthy map on every instance.
    texture.source = new T.Source(canvas);
    texture.needsUpdate = true;
    maps.push(texture);
  }
  return maps;
}
