import * as T from "three";
import { GLTFLoader } from "../vendor/GLTFLoader.js";
import { clone as cloneSkeleton } from "../vendor/SkeletonUtils.js";
import { FigureRig, FigureGait, CreatureGait } from "./figure-motion.mjs";

// Read-only interpolation palettes avoid allocating Colors for every animated
// figure while retaining the existing per-call material repaint behavior.
const MIRROR_SKIN = new T.Color(0xc4b2ab), CREATURE_SKIN = new T.Color(0x626b62);
const MIRROR_EYES = new T.Color(0xb5c0b2), CREATURE_EYES = new T.Color(0x020204);
const MIRROR_CLOTH = new T.Color(0x292b27), CREATURE_CLOTH = new T.Color(0x151916);
const SHADED_MATERIALS = ["Mara_Clothes_Material", "Mara_Shoes_Material", "Mara_Hair_Material"];

let template;
let loading;
let skinVariants;
let mouthMask;
const MIRROR_FINGERS = ["index", "middle", "ring", "pinky"];
const MIRROR_FINGER_CURL = [0, -.10, -.24, -.16];
const MIRROR_SIDES = ["l", "r"];

// One bundled, licensed asset; the reflection, intruders and wake mourners share
// geometry and textures, but each owns its skeleton, materials and pose controls.
export function preloadCharacterAssets() {
  if (loading) return loading;
  loading = Promise.all([
    new GLTFLoader().loadAsync(
      new URL("../assets/character/mara.glb", import.meta.url).href,
    ),
    new T.TextureLoader().loadAsync(
      new URL("../assets/character/inside-mouth-mask.jpg", import.meta.url)
        .href,
    ),
  ]).then(([gltf, oralMask]) => {
    mouthMask = oralMask;
    mouthMask.flipY = false;
    mouthMask.colorSpace = T.NoColorSpace;
    template = gltf.scene;
    const skin = template.getObjectByName("Mara_Skin");
    if (!skin?.isSkinnedMesh || !template.getObjectByName("head"))
      throw new Error(
        "Mara's character asset is missing its skin or head rig.",
      );
    skinVariants = createSkinVariants(skin.material.map);
    addHollowFaceMorph(skin);
    addMirrorStrainMorph(skin);
    addRecessedEyeMorph(template.getObjectByName("Mara_Eyes"));
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
  const horrorUniform = { value: 0 };
  const evidenceUniform = { value: 0 };
  body.traverse((object) => {
    object.layers.set(layer);
    if (!object.isMesh) return;
    if (
      object.isSkinnedMesh &&
      /Mara_(Skin|Clothes)/.test(object.name) &&
      !object.geometry.getAttribute("maraBloodWeight")
    ) {
      // The skin weights locate palms/forearms in every pose without guessing
      // at UV islands. Geometry can share this fixed mask; colour is per figure.
      const indices = object.geometry.getAttribute("skinIndex"),
        weights = object.geometry.getAttribute("skinWeight");
      const boneMask = object.skeleton.bones.map((bone) =>
        /^(hand_|(?:index|middle|ring|pinky|thumb)_)/.test(bone.name)
          ? 1
          : /^lowerarm_/.test(bone.name)
            ? 0.58
            : 0,
      );
      const mask = new Float32Array(indices.count);
      for (let i = 0; i < indices.count; i++) {
        const ids = [
          indices.getX(i),
          indices.getY(i),
          indices.getZ(i),
          indices.getW(i),
        ];
        const values = [
          weights.getX(i),
          weights.getY(i),
          weights.getZ(i),
          weights.getW(i),
        ];
        for (let component = 0; component < 4; component++)
          mask[i] += (boneMask[ids[component]] || 0) * values[component];
      }
      object.geometry.setAttribute(
        "maraBloodWeight",
        new T.BufferAttribute(mask, 1),
      );
    }
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
      if (/Skin/.test(own.name)) {
        own.onBeforeCompile = (shader) => {
          shader.uniforms.maraHorror = horrorUniform;
          shader.uniforms.maraMouthMask = { value: mouthMask };
          shader.fragmentShader =
            "uniform float maraHorror;\nuniform sampler2D maraMouthMask;\n" +
            shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <map_fragment>",
            "#include <map_fragment>\nfloat oralMask = texture2D(maraMouthMask, vMapUv).r;\nfloat pallor = dot(diffuseColor.rgb, vec3(.2126,.7152,.0722));\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(pallor)*vec3(.78,.86,.82), maraHorror*.9);\nvec2 eyeUv1=(vMapUv-vec2(.842,.478))/vec2(.013,.020);\nvec2 eyeUv2=(vMapUv-vec2(.842,.564))/vec2(.013,.020);\nfloat orbit=clamp(exp(-dot(eyeUv1,eyeUv1)*1.6)+exp(-dot(eyeUv2,eyeUv2)*1.6),0.,1.);\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(.006),orbit*maraHorror*.92);\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(.0015), oralMask * smoothstep(.18, .7, maraHorror));",
          );
        };
        own.customProgramCacheKey = () => "mara-oral-depth-v1";
      }
      if (/Skin|Clothes/.test(own.name)) {
        const previousCompile = own.onBeforeCompile,
          previousKey = own.customProgramCacheKey();
        own.onBeforeCompile = (shader, renderer) => {
          previousCompile.call(own, shader, renderer);
          shader.uniforms.maraEvidenceBlood = evidenceUniform;
          shader.vertexShader =
            "attribute float maraBloodWeight;\nvarying float vMaraBloodWeight;\nvarying vec3 vMaraEvidenceRest;\n" +
            shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace(
            "#include <begin_vertex>",
            "#include <begin_vertex>\nvMaraBloodWeight=maraBloodWeight;\nvMaraEvidenceRest=position;",
          );
          shader.fragmentShader =
            "uniform float maraEvidenceBlood;\nvarying float vMaraBloodWeight;\nvarying vec3 vMaraEvidenceRest;\n" +
            shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <map_fragment>",
            `#include <map_fragment>
            float evidenceSmear=sin(vMaraEvidenceRest.y*91.+sin(vMaraEvidenceRest.z*41.)*2.4+vMaraEvidenceRest.x*37.);
            float evidenceBreak=sin(vMaraEvidenceRest.x*171.+vMaraEvidenceRest.z*143.)*.27;
            float evidenceCoverage=maraEvidenceBlood*smoothstep(.08,.65,vMaraBloodWeight)*(.68+.32*smoothstep(-.7,.8,evidenceSmear+evidenceBreak));
            vec3 evidenceRed=mix(vec3(.038,.0015,.001),vec3(.125,.004,.002),smoothstep(-1.,1.,evidenceSmear));
            diffuseColor.rgb=mix(diffuseColor.rgb,evidenceRed,evidenceCoverage);`,
          );
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <roughnessmap_fragment>",
            "#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.28,evidenceCoverage*.75);",
          );
        };
        own.customProgramCacheKey = () =>
          previousKey + "|mara-evidence-blood-v1";
      }
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
  const rig = new FigureRig(body, visual);
  const gait = new FigureGait(rig);
  const creatureGait = new CreatureGait(rig);
  const controls = [];
  let applyingControls = true;
  function control(name, boneName) {
    const proxy = new T.Object3D();
    proxy.name = name;
    const joint = rig.joint(boneName);
    const state = { proxy, joint, base: joint.bone.quaternion.clone() };
    const delta = new T.Quaternion(), local = new T.Quaternion();
    const inverseBind = joint.bodyQuaternion.clone().invert();
    state.apply = () => {
      delta.setFromEuler(proxy.rotation);
      local.copy(inverseBind).multiply(delta).multiply(joint.bodyQuaternion);
      joint.bone.quaternion.copy(state.base).multiply(local).normalize();
      joint.bone.updateMatrixWorld(true);
    };
    const syncObjectQuaternion = proxy.rotation._onChangeCallback;
    proxy.rotation._onChange(() => {
      syncObjectQuaternion();
      if (applyingControls) state.apply();
    });
    controls.push(state);
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
  const limbControls = [...arms, ...legs];
  function captureControls(propagate = false) {
    if (propagate) rig.update();
    for (const state of controls) state.base.copy(state.joint.bone.quaternion);
    // The underlying gait/distortion has already propagated its matrices.
    // Identity controls do not change that pose; nonzero controls propagate
    // their own descendants inside apply(), without a second full-rig walk.
    for (const state of controls) {
      const rotation = state.proxy.rotation;
      if (rotation.x || rotation.y || rotation.z) state.apply();
    }
  }
  let unease = -1;
  let horror = 0;
  let mirrorHorror = true;
  let baseline = null;
  let poseCache = null;
  let horrorOptions = {};
  let creatureMode = null;
  let foldPose = null;
  let foldStarted = 0;
  const mesh = visual.getObjectByName("Mara_Skin");
  const eyeMesh = visual.getObjectByName("Mara_Eyes");
  const colors = new Map(
    [...materials].map(([name, material]) => [name, material.color.clone()]),
  );
  function snapshot() {
    if (!poseCache)
      poseCache = {
        visualPosition: new T.Vector3(),
        visualQuaternion: new T.Quaternion(),
        visualScale: new T.Vector3(),
        joints: [...rig.joints.values()].map(() => [
          new T.Vector3(),
          new T.Quaternion(),
          new T.Vector3(),
        ]),
      };
    poseCache.visualPosition.copy(visual.position);
    poseCache.visualQuaternion.copy(visual.quaternion);
    poseCache.visualScale.copy(visual.scale);
    let index = 0;
    for (const { bone } of rig.joints.values()) {
      const values = poseCache.joints[index++];
      values[0].copy(bone.position);
      values[1].copy(bone.quaternion);
      values[2].copy(bone.scale);
    }
    return poseCache;
  }
  function restore(pose) {
    visual.position.copy(pose.visualPosition);
    visual.quaternion.copy(pose.visualQuaternion);
    visual.scale.copy(pose.visualScale);
    let i = 0;
    for (const { bone } of rig.joints.values()) {
      const values = pose.joints[i++];
      bone.position.copy(values[0]);
      bone.quaternion.copy(values[1]);
      bone.scale.copy(values[2]);
    }
    rig.update();
  }
  function applyMaterials() {
    const skin = materials.get("Mara_Skin_Material");
    skin.map = skinVariants[Math.max(0, unease)];
    skin.color
      .set(unease >= 2 ? 0xc2d0c7 : unease === 1 ? 0xe0e1d9 : 0xf1e3d7)
      .lerp(mirrorHorror ? MIRROR_SKIN : CREATURE_SKIN, horror * (mirrorHorror ? 0.58 : 0.86));
    skin.roughness = T.MathUtils.lerp(unease >= 2 ? 0.75 : 0.64, mirrorHorror ? 0.73 : 0.94, horror);
    const eyes = materials.get("Mara_Eyes_Material");
    eyes.color
      .set(unease >= 2 ? 0xc8c5b9 : 0xffffff)
      .lerp(mirrorHorror ? MIRROR_EYES : CREATURE_EYES, T.MathUtils.smoothstep(horror, 0.25, 0.75));
    eyes.roughness = T.MathUtils.lerp(0.18, mirrorHorror ? 0.2 : 0.5, horror);
    for (const name of SHADED_MATERIALS) {
      const material = materials.get(name);
      material.color
        .copy(colors.get(name))
        .lerp(mirrorHorror ? MIRROR_CLOTH : CREATURE_CLOTH, horror * (mirrorHorror ? 0.78 : 0.97));
      material.roughness = T.MathUtils.lerp(
        /Hair/.test(name) ? 0.7 : 0.84,
        mirrorHorror ? (/Hair/.test(name) ? .72 : .89) : 0.96,
        horror,
      );
    }
    horrorUniform.value = horror;
    body.userData.unease = unease;
    body.userData.horror = horror;
  }
  function morph(name, amount, target = mesh) {
    const index = target.morphTargetDictionary?.[name];
    if (index !== undefined) target.morphTargetInfluences[index] = amount;
  }
  function distortCreature(level, time, options = {}) {
    morph("Mara_Mirror_Strain", 0);
    if (level < 0.0001) {
      morph("Mara_Jaw_Open", 0);
      morph("Mara_Hollow", 0);
      morph("Mara_Recessed", 0, eyeMesh);
      return;
    }
    const strength = T.MathUtils.smoothstep(level, 0.2, 1);
    const still = options.still === true;
    const pulse = still ? 0 : Math.sin(time * 1.7) * 0.035;
    morph("Mara_Jaw_Open", strength * (0.85 + pulse));
    morph("Mara_Hollow", strength);
    morph("Mara_Recessed", strength, eyeMesh);
    rig.offset("neck_01", new T.Vector3(0, strength * 0.032, 0));
    rig.rotate(
      "spine_03",
      -strength * 0.045,
      strength * 0.045,
      -strength * 0.035,
    );
    rig.rotate("head", strength * 0.03, pulse * 0.2, strength * 0.1);
    for (const [i, suffix] of ["l", "r"].entries()) {
      rig
        .joint(`lowerarm_${suffix}`)
        .bone.position.multiplyScalar(1 + strength * (i ? 0.16 : 0.25));
      rig
        .joint(`hand_${suffix}`)
        .bone.position.multiplyScalar(1 + strength * (i ? 0.25 : 0.38));
      for (const finger of ["index", "middle", "ring", "pinky", "thumb"])
        for (let segment = 1; segment <= 3; segment++) {
          const joint = rig.joint(`${finger}_0${segment}_${suffix}`);
          if (segment > 1)
            joint.bone.position.multiplyScalar(
              1 + strength * (finger === "thumb" ? 0.35 : 0.75),
            );
          if (segment === 3) joint.bone.scale.y *= 1 + strength * 0.6;
          rig.rotate(
            `${finger}_0${segment}_${suffix}`,
            strength * -0.1 * segment,
            0,
            0,
          );
        }
    }
    rig.update();
  }
  // The glass retains Mara's measured anatomy. The disobedience lives in a
  // strained, unequal face and a held human posture, rather than scaled limbs.
  // This path never changes the director's separately authored creature pose.
  function distort(level, time, options = {}) {
    const strength = T.MathUtils.smoothstep(level, 0.2, 1);
    const still = options.still === true || options.held === true;
    const breath = still ? 0 : Math.sin(time * .67) * .004;
    morph("Mara_Jaw_Open", strength * (.14 + breath));
    morph("Mara_Hollow", strength * .88);
    morph("Mara_Mirror_Strain", strength);
    // Leave the iris visible: an unblinking human eye reads more clearly than
    // the old fully buried black spheres. The unequal lid is in the skin morph.
    morph("Mara_Recessed", strength * .13, eyeMesh);
    if (strength < .0001) return;
    rig.rotate("spine_03", -strength * .026, strength * .034, -strength * .025);
    rig.rotate("neck_01", strength * .014, -strength * .026, strength * .065);
    rig.rotate("head", strength * -.018, 0, strength * -.025);
    for (const suffix of MIRROR_SIDES) {
      const side = suffix === "l" ? 1 : -1;
      for (const finger of MIRROR_FINGERS)
        for (let segment = 1; segment <= 3; segment++)
          rig.rotate(`${finger}_0${segment}_${suffix}`,
            strength * MIRROR_FINGER_CURL[segment], 0,
            segment === 1 ? side * strength * .015 : 0);
    }
    rig.update();
  }
  function setUnease(level) {
    const next = Math.max(0, Math.min(2, Math.floor(level)));
    if (next === unease) return;
    unease = next;
    applyMaterials();
  }
  function setHorror(level, time = 0, options = {}) {
    horror = T.MathUtils.clamp(level, 0, 1);
    horrorOptions = options;
    mirrorHorror = true;
    if (baseline) restore(baseline);
    else rig.reset();
    distort(horror, time, options);
    applyMaterials();
    captureControls();
  }
  function animate(time, speed = 0, frozen = false, options = {}) {
    applyingControls = false;
    for (const control of limbControls) control.rotation.set(0, 0, 0);
    applyingControls = true;
    rig.reset();
    const diagnostic = gait.update(time, speed, frozen, options);
    baseline = snapshot();
    distort(horror, time, { ...horrorOptions, still: frozen });
    captureControls();
    body.userData.gait = diagnostic;
    body.userData.pose = frozen
      ? "held"
      : gait.weight > 0.1
        ? "walking"
        : "standing";
  }
  function resetMotion(options = {}) {
    gait.reset(options);
    creatureGait.reset();
  }
  function resetPose() {
    applyingControls = false;
    for (const { proxy } of controls) proxy.rotation.set(0, 0, 0);
    applyingControls = true;
    rig.reset();
    gait.reset();
    creatureGait.reset();
    baseline = snapshot();
    horror = 0;
    mirrorHorror = true;
    evidenceUniform.value = 0;
    body.userData.evidenceBlood = 0;
    unease = 0;
    horrorOptions = {};
    creatureMode = null;
    foldPose = null;
    morph("Mara_Jaw_Open", 0);
    morph("Mara_Hollow", 0);
    morph("Mara_Mirror_Strain", 0);
    morph("Mara_Recessed", 0, eyeMesh);
    applyMaterials();
    captureControls();
    body.userData.pose = "standing";
  }
  function setEvidenceBlood(level = 0) {
    evidenceUniform.value = T.MathUtils.clamp(
      Number.isFinite(level) ? level : 0,
      0,
      1,
    );
    body.userData.evidenceBlood = evidenceUniform.value;
  }
  function setCreaturePose(time, progress = 0, options = {}) {
    const mode = options.mode || "crawl";
    if (creatureMode === "twisted" && mode === "crawl") {
      // Folding takes a breath. Never exchange an upright skeleton for a low
      // one in a single frame as the apparition starts to withdraw.
      foldPose = {
        position: visual.position.clone(),
        quaternion: visual.quaternion.clone(),
        joints: [...rig.joints.values()].map(({ bone }) => [
          bone.position.clone(),
          bone.quaternion.clone(),
          bone.scale.clone(),
        ]),
      };
      foldStarted = time;
    } else if (mode !== creatureMode) foldPose = null;
    creatureMode = mode;
    applyingControls = false;
    for (const { proxy } of controls) proxy.rotation.set(0, 0, 0);
    applyingControls = true;
    rig.reset();
    horror = T.MathUtils.clamp(options.intensity ?? 1, 0, 1);
    mirrorHorror = options.reflection === true;
    baseline = snapshot();
    if (mirrorHorror) distort(horror, time, options);
    else distortCreature(horror, time, options);
    const cycle = Number.isFinite(options.distance)
      ? options.distance / 0.82
      : progress * 2.2;
    if (mode === "twisted" && mirrorHorror) {
      // A body turning away while the face stays behind. Distribute the turn
      // through the torso and neck; retain actual arm and finger lengths.
      rig.rotate("spine_01", -.055, .38, .022);
      rig.rotate("spine_03", .035, .52, -.052);
      rig.rotate("neck_01", .025, .68, .11);
      rig.rotate("head", -.045, 1.16, -.075);
      rig.rotate("upperarm_l", -.14, .035, -.08);
      rig.rotate("lowerarm_l", -.22, 0, .035);
      rig.rotate("upperarm_r", -.09, -.025, .10);
      rig.rotate("lowerarm_r", -.28, 0, -.02);
      rig.update();
    } else if (mode === "twisted") {
      rig.offset("pelvis", new T.Vector3(0, -0.1, 0));
      rig.rotate("spine_01", -0.22, 0.2, 0.15);
      rig.rotate("spine_03", 0.1, -0.13, -0.2);
      rig.rotate("neck_01", 0.12, 0.32, 0.22);
      rig.rotate("head", -0.13, 2.75 + Math.sin(time * 0.8) * 0.045, 0.4);
      rig.rotate("upperarm_l", -0.72, 0.1, -0.2);
      rig.rotate("lowerarm_l", -1.6, 0, 0.25);
      rig.rotate("upperarm_r", 0.42, 0, 0.18);
      rig.rotate("lowerarm_r", -0.8, 0, 0);
      for (const side of rig.sides) {
        const target = rig.bodyPoint(side.ankle);
        const pole = rig
          .point(`thigh_${side.side}`)
          .add(rig.bodyVector(new T.Vector3(0, 0, -0.6)));
        rig.solveLimb(
          `thigh_${side.side}`,
          `calf_${side.side}`,
          `foot_${side.side}`,
          target,
          pole,
          side.upperLeg,
          side.lowerLeg,
        );
        rig.setWorldQuaternion(
          `foot_${side.side}`,
          rig.bodyQuaternion(rig.joint(`foot_${side.side}`).bodyQuaternion),
        );
      }
    } else {
      const crawlPhase = cycle * Math.PI * 2;
      rig.offset(
        "pelvis",
        new T.Vector3(0, -0.51 + Math.sin(crawlPhase * 2) * 0.007, 0.12),
      );
      rig.rotate("pelvis", -1.34, 0, Math.sin(crawlPhase) * 0.022);
      rig.rotate("spine_01", -0.08, 0, -Math.sin(crawlPhase) * 0.018);
      rig.rotate("neck_01", 1.32, 0, 0.08);
      rig.rotate("head", 0.04, Math.sin(time * 0.45) * 0.05, -0.12);
      rig.update();
      const diagnostic = creatureGait.update(time, {
        ...options,
        mode,
        distance: options.distance ?? progress * 0.82,
      });
      body.userData.creatureGait = diagnostic;
      if (mode === "ceiling") {
        visual.quaternion.premultiply(
          new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), Math.PI),
        );
        // The director places the body .08m below the ceiling. Counter that
        // clearance inside the asset so the inverted fingertips grip the roof.
        visual.position.y = options.ceilingClearance ?? 0.075;
        rig.update();
      }
    }
    if (foldPose && mode === "crawl") {
      const blend = T.MathUtils.smoothstep(time - foldStarted, 0, 0.55);
      visual.position.lerpVectors(foldPose.position, visual.position, blend);
      visual.quaternion.slerp(foldPose.quaternion, 1 - blend);
      let index = 0;
      for (const { bone } of rig.joints.values()) {
        const [position, quaternion, scale] = foldPose.joints[index++];
        bone.position.lerpVectors(position, bone.position, blend);
        bone.quaternion.slerp(quaternion, 1 - blend);
        bone.scale.lerpVectors(scale, bone.scale, blend);
      }
      if (blend === 1) foldPose = null;
      rig.update();
    }
    if (!mirrorHorror)
      morph("Mara_Jaw_Open", horror * (0.93 + Math.sin(time * 1.3) * 0.05));
    baseline = snapshot();
    applyMaterials();
    // Creature contact solving writes fingertip bind quaternions directly.
    // Those edits need one propagation before the control layer is captured.
    captureControls(true);
    body.userData.pose = mode;
    body.userData.creatureProgress = progress;
  }
  setUnease(0);
  resetPose();
  const rigInfo = {
    bones: rig.joints.size,
    source: "assets/character/mara.glb",
  };
  Object.defineProperty(rigInfo, "gait", { value: gait });
  return {
    body,
    head,
    arms,
    legs,
    animate,
    setUnease,
    setHorror,
    setEvidenceBlood,
    setCreaturePose,
    resetMotion,
    resetPose,
    identity: "Mara Vale",
    anatomy: rig,
    rig: rigInfo,
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

function addHollowFaceMorph(skin) {
  const geometry = skin.geometry;
  const positions = geometry.attributes.position;
  const sourceNormals = geometry.attributes.normal;
  const deltas = new Float32Array(positions.count * 3);
  const deformed = new Float32Array(positions.array);
  const soft = (value, a, b) => T.MathUtils.smoothstep(value, a, b);
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i),
      y = positions.getY(i),
      z = positions.getZ(i);
    const face =
      soft(y, 1.47, 1.54) *
      (1 - soft(Math.abs(x), 0.095, 0.14)) *
      soft(z, 0.025, 0.09);
    if (face < 0.0001) continue;
    const sockets = Math.exp(
      -(((Math.abs(x) - 0.032) / 0.023) ** 2 + ((y - 1.622) / 0.019) ** 2),
    );
    const cheeks = Math.exp(
      -(((Math.abs(x) - 0.06) / 0.024) ** 2 + ((y - 1.575) / 0.035) ** 2),
    );
    const brow = Math.exp(
      -(((Math.abs(x) - 0.035) / 0.029) ** 2 + ((y - 1.648) / 0.016) ** 2),
    );
    const dx = -x * 0.19 * cheeks * face;
    const dy =
      ((y - 1.61) * 0.04 + brow * 0.003) * face * (1 - soft(y, 1.66, 1.7));
    const dz = (-0.026 * sockets - 0.017 * cheeks + 0.004 * brow) * face;
    deltas.set([dx, dy, dz], i * 3);
    deformed[i * 3] += dx;
    deformed[i * 3 + 1] += dy;
    deformed[i * 3 + 2] += dz;
  }
  const normalGeometry = geometry.clone();
  normalGeometry.morphAttributes = {};
  normalGeometry.setAttribute("position", new T.BufferAttribute(deformed, 3));
  normalGeometry.computeVertexNormals();
  const normalDeltas = new Float32Array(sourceNormals.count * 3);
  for (let i = 0; i < normalDeltas.length; i++)
    normalDeltas[i] =
      normalGeometry.attributes.normal.array[i] - sourceNormals.array[i];
  normalGeometry.dispose();
  geometry.morphAttributes.position ||= [];
  geometry.morphAttributes.normal ||= [];
  const index = geometry.morphAttributes.position.length;
  const positionMorph = new T.BufferAttribute(deltas, 3);
  positionMorph.name = "Mara_Hollow";
  geometry.morphAttributes.position.push(positionMorph);
  geometry.morphAttributes.normal.push(new T.BufferAttribute(normalDeltas, 3));
  geometry.morphTargetsRelative = true;
  skin.morphTargetDictionary ||= {};
  skin.morphTargetInfluences ||= [];
  skin.morphTargetDictionary.Mara_Hollow = index;
  skin.morphTargetInfluences[index] = 0;
}

function addRecessedEyeMorph(eyes) {
  const geometry = eyes.geometry;
  const count = geometry.attributes.position.count;
  const delta = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) delta[i * 3 + 2] = -0.035;
  const attribute = new T.BufferAttribute(delta, 3);
  attribute.name = "Mara_Recessed";
  geometry.morphAttributes.position = [attribute];
  geometry.morphAttributes.normal = [
    new T.BufferAttribute(new Float32Array(count * 3), 3),
  ];
  geometry.morphTargetsRelative = true;
  eyes.morphTargetDictionary = { Mara_Recessed: 0 };
  eyes.morphTargetInfluences = [0];
}


function addMirrorStrainMorph(skin) {
  const geometry = skin.geometry, positions = geometry.attributes.position;
  const sourceNormals = geometry.attributes.normal;
  const delta = new Float32Array(positions.count * 3);
  const deformed = new Float32Array(positions.array);
  const smooth = T.MathUtils.smoothstep;
  const gaussian = (x, y, cx, cy, rx, ry) =>
    Math.exp(-(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2));
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const face = smooth(z, .035, .10) * smooth(y, 1.47, 1.54) *
      (1 - smooth(Math.abs(x), .09, .14));
    if (face < .0001) continue;
    const leftLid = gaussian(x, y, .032, 1.631, .024, .012);
    const rightBrow = gaussian(x, y, -.035, 1.645, .025, .020);
    const cheek = gaussian(x, y, .058, 1.576, .027, .033);
    const lip = gaussian(x, y, -.026, 1.547, .020, .018);
    const jaw = gaussian(x, y, .032, 1.516, .035, .026);
    const dx = (-.004 * cheek - .008 * lip + .003 * jaw) * face;
    const dy = (-.007 * leftLid + .0035 * rightBrow - .005 * lip - .004 * jaw) * face;
    const dz = (-.007 * cheek - .004 * jaw + .002 * lip) * face;
    delta.set([dx, dy, dz], i * 3);
    deformed[i * 3] += dx; deformed[i * 3 + 1] += dy; deformed[i * 3 + 2] += dz;
  }
  const normalGeometry = geometry.clone();
  normalGeometry.morphAttributes = {};
  normalGeometry.setAttribute("position", new T.BufferAttribute(deformed, 3));
  normalGeometry.computeVertexNormals();
  const normals = new Float32Array(sourceNormals.count * 3);
  for (let i = 0; i < normals.length; i++)
    normals[i] = normalGeometry.attributes.normal.array[i] - sourceNormals.array[i];
  normalGeometry.dispose();
  const index = geometry.morphAttributes.position.length;
  const attribute = new T.BufferAttribute(delta, 3); attribute.name = "Mara_Mirror_Strain";
  geometry.morphAttributes.position.push(attribute);
  geometry.morphAttributes.normal.push(new T.BufferAttribute(normals, 3));
  skin.morphTargetDictionary.Mara_Mirror_Strain = index;
  skin.morphTargetInfluences[index] = 0;
}
