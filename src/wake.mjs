import * as T from "three";
import { createFigure } from "./figure.mjs";
import { FigureRig } from "./figure-motion.mjs";

// A single reception room beyond the real front entrance. Its ordinary daylight
// and a place already reserved for Mara form the ending, rather than a corridor
// into another level.
export function buildWake(b, m, surfaces, photos) {
  const { box, cylinder, sphere, group, contact } = b;
  const wake = group();
  wake.name = "The reception";
  wake.userData.wake = true;
  const bounds = {
    minX: -2.7,
    maxX: 2.7,
    minZ: 7.56,
    maxZ: 12.4,
    ceiling: 2.7,
  };
  const entry = { x: 0, z: 7.56, width: 0.92, triggerZ: 8.35 };
  const colliders = [],
    chairs = [],
    lights = [];
  const tag = (material) => {
    material.userData.wake = true;
    return material;
  };
  const plain = (color, roughness = 0.85, metalness = 0) =>
    tag(
      new T.MeshStandardMaterial({
        color,
        roughness,
        metalness,
        envMapIntensity: 0.06,
      }),
    );
  const wall = tag(surfaces.material("plaster", 2.1, 1.4, 0xeeeae2));
  wall.normalScale.set(0.35, 0.35);
  const ceiling = tag(surfaces.material("plaster", 2.8, 2.4, 0xeeeae2));
  ceiling.normalScale.set(0.18, 0.18);
  const floor = tag(surfaces.material("wood", 2.9, 2.6, 0xb3a38b));
  const painted = tag(surfaces.material("panel", 1, 1, 0xcac8bc));
  const wood = tag(surfaces.material("wood", 1, 1, 0x8b7358));
  const darkWood = tag(surfaces.material("wood", 1, 1, 0x67594b));
  const upholstery = tag(surfaces.material("linen", 1, 1, 0xb5b8ab));
  const paper = plain(0xe9e3d5),
    metal = plain(0x999e98, 0.43, 0.48),
    leaf = plain(0x7c8d70),
    petal = plain(0xe5e3da, 0.64);
  const addSolid = (mesh) => {
    const collider = b.solid(mesh);
    colliders.push(collider);
    return collider;
  };
  function slab(w, h, d, x, y, z, material, parent = wake, round = 0) {
    return box(w, h, d, x, y, z, material, false, parent, round);
  }
  function wallBox(w, d, x, z) {
    const object = slab(w, 2.7, d, x, 1.35, z, wall);
    addSolid(object);
    slab(w + 0.012, 0.1, d + 0.012, x, 0.055, z, painted);
    slab(w + 0.012, 0.065, d + 0.012, x, 2.655, z, painted);
    return object;
  }
  slab(5.52, 0.13, 4.98, 0, -0.071, 9.98, floor);
  const ceilingMesh = slab(5.52, 0.11, 4.98, 0, 2.755, 9.98, ceiling);
  ceilingMesh.castShadow = false;
  wallBox(0.12, 4.96, -2.76, 9.98);
  wallBox(0.12, 4.96, 2.76, 9.98);
  wallBox(5.52, 0.12, 0, 12.46);
  wallBox(2.24, 0.12, -1.64, 7.56);
  wallBox(2.24, 0.12, 1.64, 7.56);
  // The lintel sits above the old front-door frame; the threshold remains clear.
  slab(1.04, 0.56, 0.12, 0, 2.42, 7.56, wall);

  function window(x, z) {
    const frame = group(x, 1.94, z, Math.PI, wake);
    slab(1.1, 1.17, 0.065, 0, 0, 0, painted, frame, 0.008);
    const glass = plain(0xe2e9e7, 0.76);
    glass.emissive.set(0xdbe6e5);
    glass.emissiveIntensity = 0.48;
    const pane = slab(0.98, 1.03, 0.018, 0, 0, 0.045, glass, frame);
    pane.castShadow = false;
    for (const sx of [-1, 0, 1])
      slab(0.025, 1.05, 0.035, sx * 0.49, 0, 0.062, painted, frame);
    for (const sy of [-1, 0, 1])
      slab(1.0, 0.025, 0.035, 0, sy * 0.515, 0.062, painted, frame);
    slab(1.19, 0.045, 0.19, 0, -0.62, 0.075, painted, frame, 0.005);
    // A narrow cloth blind hangs unevenly; the glass still reads as daylight.
    const blind = tag(surfaces.material("linen", 1.2, 0.7, 0xe1ded4));
    slab(1.04, 0.14, 0.025, 0, 0.44, 0.1, blind, frame, 0.003);
    return frame;
  }
  window(-1.72, 12.365);
  window(1.72, 12.365);

  function chair(x, z, rotation, style) {
    const parent = group(x, 0, z, rotation, wake),
      chairWood = style === 1 ? darkWood : style === 2 ? painted : wood;
    const seat = slab(
      0.44,
      0.054,
      0.44,
      0,
      0.455,
      0,
      style === 1 ? upholstery : chairWood,
      parent,
      0.018,
    );
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        if (style === 1)
          cylinder(
            0.012,
            0.012,
            0.435,
            sx * 0.18,
            0.218,
            sz * 0.18,
            metal,
            parent,
            12,
          );
        else {
          const leg = cylinder(
            0.017,
            0.023,
            0.44,
            sx * 0.17,
            0.22,
            sz * 0.17,
            chairWood,
            parent,
            16,
          );
          leg.rotation.z = sx * 0.028;
        }
      }
    if (style === 1) {
      for (const sx of [-1, 1])
        cylinder(0.012, 0.012, 0.48, sx * 0.18, 0.72, 0.18, metal, parent, 12);
      slab(0.42, 0.28, 0.045, 0, 0.81, 0.19, upholstery, parent, 0.026);
    } else {
      for (const sx of [-1, 1])
        cylinder(
          0.019,
          0.019,
          0.47,
          sx * 0.17,
          0.72,
          0.18,
          chairWood,
          parent,
          16,
        );
      if (style === 2)
        slab(0.39, 0.29, 0.035, 0, 0.82, 0.19, chairWood, parent, 0.013);
      else {
        for (const sx of [-1, 0, 1])
          cylinder(
            0.009,
            0.009,
            0.32,
            sx * 0.105,
            0.77,
            0.19,
            chairWood,
            parent,
            12,
          );
        slab(0.43, 0.055, 0.042, 0, 0.975, 0.19, chairWood, parent, 0.012);
      }
    }
    const proxy = slab(0.47, 0.99, 0.49, 0, 0.495, 0.02, m.invisible, parent);
    addSolid(proxy);
    contact(0.67, 0.7, x, z, 0.44, wake);
    const result = { group: parent, seat, style };
    chairs.push(result);
    return result;
  }
  chair(-1.62, 8.96, Math.PI + 0.14, 0);
  chair(-1.47, 10.31, Math.PI - 0.08, 1);
  chair(1.67, 8.8, Math.PI - 0.18, 2);
  chair(1.62, 9.65, Math.PI + 0.04, 0);
  const reserved = chair(1.25, 10.56, Math.PI - 0.1, 1);
  const reservedMap = cardTexture(["RESERVED", "MARA"], [38, 80]);
  const reservedMaterial = tag(
    new T.MeshStandardMaterial({
      map: reservedMap,
      roughness: 0.96,
      side: T.DoubleSide,
      envMapIntensity: 0.06,
    }),
  );
  // On the outside of the chair back, facing the entrance, not the portrait.
  slab(0.335, 0.195, 0.004, 0, 0.83, 0.218, reservedMaterial, reserved.group);
  reserved.group.name = "A place for Mara";

  // The reception is full of people wearing the face Mara established in the
  // glass. Real skin, hair, hands and cloth replace anonymous sculpted forms.
  // Preparing after preload keeps construction of the house independent from
  // the character download, and the entire cast stays under the hidden wake.
  const mourners = [];
  const mournerSeats = [chairs[0], chairs[1], chairs[3]];
  const lace = veilTexture();
  let prepared = false;
  for (const seat of mournerSeats)
    addSolid(slab(0.49, 1.42, 0.82, 0, 0.71, -0.2, m.invisible, seat.group));

  function prepare() {
    if (prepared) return true;
    for (const [index, seat] of mournerSeats.entries()) {
      const figure = createFigure({}, 0);
      figure.resetPose();
      figure.setUnease(0);
      figure.body.name = "A daughter at the reception";
      seat.group.add(figure.body);
      const visual = figure.body.children[0];
      const rig = new FigureRig(figure.body, visual);
      figure.body.traverse((object) => {
        object.userData.wake = true;
        if (!object.isMesh) return;
        for (const material of Array.isArray(object.material)
          ? object.material
          : [object.material]) {
          material.userData.wake = true;
          material.envMapIntensity = 0.045;
          if (/Clothes/.test(material.name)) {
            const previous = material.onBeforeCompile;
            material.onBeforeCompile = function (shader, renderer) {
              previous.call(this, shader, renderer);
              shader.fragmentShader = shader.fragmentShader.replace(
                "#include <map_fragment>",
                `#include <map_fragment>
                float mourningCloth=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
                diffuseColor.rgb=vec3(mourningCloth)*vec3(.31,.32,.30);`,
              );
            };
            material.customProgramCacheKey = () => "wake-mourning-clothes-v1";
            material.color.set(0xffffff);
            material.roughness = 0.94;
          }
          if (/Skin/.test(material.name)) {
            material.color.set(0xd8d1c6);
            material.roughness = 0.74;
          }
          if (/Eyes/.test(material.name)) {
            material.color.set(0xc4c3b8);
            material.roughness = 0.44;
          }
        }
      });
      const headRest = rig.restPoint("head");
      const veilMaterial = tag(
        new T.MeshStandardMaterial({
          color: 0x272a25,
          alphaMap: lace,
          transparent: true,
          opacity: 0.62,
          side: T.DoubleSide,
          roughness: 0.96,
          envMapIntensity: 0.025,
          depthWrite: false,
          forceSinglePass: true,
        }),
      );
      const veil = new T.Mesh(veilGeometry(1.74 - headRest.y), veilMaterial);
      veil.name = "A black mourning veil";
      veil.castShadow = false;
      veil.receiveShadow = true;
      figure.body.add(veil);
      const lapMaterial = tag(surfaces.material("linen", 1.3, 1.8, 0x74786e));
      lapMaterial.side = T.DoubleSide;
      const lap = new T.Mesh(lapGeometry(), lapMaterial);
      lap.name = "Folded linen across the knees";
      lap.castShadow = lap.receiveShadow = true;
      figure.body.add(lap);
      const head = rig.joint("head").bone;
      const skin = visual.getObjectByName("Mara_Skin");
      const mourner = {
        body: figure.body,
        head,
        figure,
        rig,
        veil,
        lap,
        skin,
        seat,
        index,
        turned: false,
        headRest: rig.joint("head").bodyQuaternion.clone(),
        hands: new Map(
          rig.sides.map((side) => [side.side, lapHandOrientation(rig, side)]),
        ),
        yaw: 0,
        progress: 0,
      };
      mourners.push(mourner);
      poseMourner(mourner, 0, 0);
    }
    prepared = true;
    for (const light of lights)
      if (light.castShadow) light.shadow.needsUpdate = true;
    return true;
  }

  const aimPosition = new T.Vector3(),
    bodyQuaternion = new T.Quaternion(),
    headQuaternion = new T.Quaternion();
  function poseMourner(mourner, progress, rise) {
    const { rig, body, index } = mourner;
    rig.reset();
    // Pelvis height follows the measured hip rather than compressing the whole
    // body. Two-bone IK lays each shoe on the floor and each hand on the lap.
    const pelvisDrop = 0.555 - rig.restPoint("thigh_l").y;
    rig.offset("pelvis", new T.Vector3(0, pelvisDrop + rise * 0.016, 0));
    const torso = T.MathUtils.clamp(mourner.yaw * 0.44, -1.13, 1.13);
    rig.rotate("spine_01", -0.035, torso * 0.32, 0);
    rig.rotate("spine_03", -0.012, torso * 0.68, (index - 1) * 0.008);
    for (const side of rig.sides) {
      const suffix = side.side;
      const ankle = rig.bodyPoint(
        new T.Vector3(side.hip.x * 0.88, side.ankle.y, -0.39),
      );
      const kneePole = rig.bodyPoint(
        new T.Vector3(side.hip.x * 0.95, 0.53, -0.9),
      );
      rig.solveLimb(
        `thigh_${suffix}`,
        `calf_${suffix}`,
        `foot_${suffix}`,
        ankle,
        kneePole,
        side.upperLeg,
        side.lowerLeg,
      );
      rig.setWorldQuaternion(
        `foot_${suffix}`,
        rig.bodyQuaternion(rig.joint(`foot_${suffix}`).bodyQuaternion),
      );
      const sign = Math.sign(side.shoulder.x) || (suffix === "l" ? -1 : 1);
      const wrist = rig.bodyPoint(
        new T.Vector3(sign * 0.105, 0.65, -0.31 + index * 0.008),
      );
      const elbowPole = rig.bodyPoint(new T.Vector3(sign * 0.29, 0.72, -0.1));
      rig.solveLimb(
        `upperarm_${suffix}`,
        `lowerarm_${suffix}`,
        `hand_${suffix}`,
        wrist,
        elbowPole,
        side.upperArm,
        side.lowerArm,
      );
      rig.setWorldQuaternion(
        `hand_${suffix}`,
        rig.bodyQuaternion(mourner.hands.get(suffix)),
      );
      for (const finger of ["index", "middle", "ring", "pinky"])
        for (let segment = 1; segment <= 3; segment++)
          rig.rotate(`${finger}_0${segment}_${suffix}`, -0.08 * segment, 0, 0);
    }
    rig.rotate("neck_01", 0.035, mourner.yaw * 0.12, 0);
    rig.rotate(
      "head",
      0.035,
      T.MathUtils.clamp(mourner.yaw - torso - mourner.yaw * 0.12, -1.55, 1.55),
      progress * (index % 2 ? -0.025 : 0.02),
    );
    const jaw = mourner.skin.morphTargetDictionary?.Mara_Jaw_Open;
    if (jaw !== undefined)
      mourner.skin.morphTargetInfluences[jaw] = rise * 0.22;
    rig.update();
    mourner.head.getWorldPosition(aimPosition);
    mourner.veil.position.copy(body.worldToLocal(aimPosition));
    body.getWorldQuaternion(bodyQuaternion).invert();
    mourner.head.getWorldQuaternion(headQuaternion);
    mourner.veil.quaternion
      .copy(bodyQuaternion)
      .multiply(headQuaternion)
      .multiply(mourner.headRest.clone().invert());
    mourner.lap.position.y = rise * 0.016;
    mourner.progress = progress;
  }

  function table(x, z, w, d, h, material = wood) {
    const parent = group(x, 0, z, 0, wake);
    slab(w, 0.052, d, 0, h, 0, material, parent, 0.012);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        cylinder(
          0.023,
          0.03,
          h,
          sx * (w / 2 - 0.065),
          h / 2,
          sz * (d / 2 - 0.065),
          material,
          parent,
          16,
        );
    addSolid(slab(w, h, d, 0, h / 2, 0, m.invisible, parent));
    contact(w * 1.2, d * 1.3, x, z, 0.48, wake);
    return parent;
  }
  const portraitTable = table(0, 11.94, 1.52, 0.55, 0.8, darkWood);
  const cloth = tag(surfaces.material("linen", 1.5, 0.8, 0xe5dfd3));
  slab(1.3, 0.008, 0.52, 0, 0.832, 0, cloth, portraitTable);
  for (const sx of [-1, 1])
    slab(0.012, 0.2, 0.52, sx * 0.647, 0.735, 0, cloth, portraitTable);
  const portrait = group(0, 1.3, 12.04, Math.PI, wake);
  slab(0.62, 0.75, 0.043, 0, 0, 0, darkWood, portrait, 0.006);
  slab(0.555, 0.685, 0.012, 0, 0, 0.029, plain(0xb9af97, 0.48, 0.55), portrait);
  slab(
    0.51,
    0.64,
    0.006,
    0,
    0,
    0.04,
    tag(
      new T.MeshStandardMaterial({
        map: photos[0],
        roughness: 0.76,
        envMapIntensity: 0.06,
      }),
    ),
    portrait,
  );
  const caption = tag(
    new T.MeshStandardMaterial({
      map: cardTexture(["EVELYN VALE", "Loved. Remembered."], [43, 28]),
      roughness: 0.98,
      envMapIntensity: 0.06,
    }),
  );
  const captionCard = slab(0.32, 0.15, 0.004, 0.47, 0.91, 11.73, caption);
  captionCard.rotation.x = -0.3;
  // A small mixed bunch, with real stems rather than a large decorative prop.
  const vase = plain(0xd5d7cf, 0.3);
  b.lathe(
    [
      [0.07, 0],
      [0.075, 0.03],
      [0.065, 0.15],
      [0.045, 0.21],
      [0.042, 0.22],
    ],
    -0.49,
    0.842,
    11.95,
    vase,
    wake,
  );
  for (let i = 0; i < 5; i++) {
    const x = -0.49 + Math.sin(i * 2.3) * 0.065,
      z = 11.95 + Math.cos(i * 1.9) * 0.048,
      y = 1.2 + (i % 3) * 0.055;
    const stem = cylinder(
      0.003,
      0.003,
      y - 0.99,
      x,
      (y + 0.99) / 2,
      z,
      leaf,
      wake,
      8,
    );
    stem.rotation.z = (i - 2) * 0.045;
    sphere(0.024, 0.018, 0.024, x, y, z, plain(0xa9aa84), wake);
    for (let p = 0; p < 5; p++) {
      const angle = (p / 5) * Math.PI * 2;
      const object = sphere(
        0.032,
        0.011,
        0.018,
        x + Math.cos(angle) * 0.027,
        y + 0.006,
        z + Math.sin(angle) * 0.027,
        petal,
        wake,
      );
      object.rotation.y = -angle;
    }
  }
  // Everyday hospitality makes the unoccupied chairs more uncomfortable.
  const tea = table(-2.32, 10.4, 0.54, 1.45, 0.76, painted);
  const urn = plain(0x9da3a0, 0.38, 0.68);
  cylinder(0.115, 0.12, 0.31, 0, 0.945, 0.31, urn, tea, 32);
  cylinder(0.13, 0.13, 0.025, 0, 1.11, 0.31, metal, tea, 32);
  slab(0.08, 0.025, 0.055, 0.12, 0.88, 0.31, darkWood, tea, 0.008);
  for (let i = 0; i < 4; i++) {
    const x = (i % 2) * 0.14 - 0.09,
      z = Math.floor(i / 2) * 0.14 - 0.42;
    cylinder(0.033, 0.026, 0.075, x, 0.825, z, paper, tea, 20);
    cylinder(0.026, 0.026, 0.002, x, 0.863, z, darkWood, tea, 20);
  }
  const book = slab(0.22, 0.022, 0.3, 0, 0.804, -0.06, paper, tea, 0.006);
  const bookTitle = tag(
    new T.MeshStandardMaterial({
      map: cardTexture(["IN MEMORY", "Please leave your name"], [42, 25]),
      roughness: 1,
      envMapIntensity: 0.06,
    }),
  );
  const bookPage = slab(0.2, 0.003, 0.27, 0, 0.818, -0.06, bookTitle, tea);
  bookPage.rotation.y = -0.06;
  const pen = slab(
    0.006,
    0.006,
    0.15,
    0.17,
    0.798,
    -0.12,
    darkWood,
    tea,
    0.002,
  );
  pen.rotation.y = 0.3;

  function point(color, strength, range, x, y, z) {
    const light = new T.PointLight(color, strength, range, 2);
    light.position.set(x, y, z);
    light.userData.base = strength;
    light.userData.wake = true;
    wake.add(light);
    lights.push(light);
    return light;
  }
  function daylight(x, shadowed = false) {
    const light = new T.SpotLight(0xe0e9ec, 15, 6.8, 1.0, 0.96, 2);
    light.position.set(x, 2.17, 12.22);
    light.target.position.set(0, 0.85, 9.25);
    wake.add(light, light.target);
    light.userData.base = 15;
    light.userData.wake = true;
    lights.push(light);
    if (shadowed) {
      light.castShadow = true;
      light.shadow.mapSize.set(1024, 1024);
      light.shadow.autoUpdate = false;
      light.shadow.needsUpdate = true;
      light.shadow.bias = -0.0002;
      light.shadow.normalBias = 0.015;
      light.shadow.camera.near = 0.1;
      light.shadow.camera.far = 6.8;
    }
    return light;
  }
  daylight(-1.72, true);
  daylight(1.72);
  point(0xf1eee5, 11, 7, -0.7, 2.35, 9.1);
  point(0xe3e9e8, 4.5, 4.5, 0, 2.02, 11.25);
  let active = false,
    startedAt = null,
    sequenceTime = 0;
  function animate(_time, state) {
    const next = !!(
      state.frontOpen ||
      state.wakeEntered ||
      state.ended ||
      startedAt !== null
    );
    wake.visible = next;
    if (next && !active)
      for (const light of lights)
        if (light.castShadow) light.shadow.needsUpdate = true;
    active = next;
  }
  function begin(time, _player) {
    if (startedAt !== null) return false;
    prepare();
    startedAt = time;
    sequenceTime = 0;
    wake.visible = true;
    return true;
  }
  const headPosition = new T.Vector3();
  function update(time, dt, state, player) {
    animate(time, state);
    if (startedAt === null) return { elapsed: 0, done: false };
    sequenceTime = Math.max(0, time - startedAt);
    for (const mourner of mourners) {
      const progress = T.MathUtils.smoothstep(
        sequenceTime,
        7 + mourner.index * 1.1,
        12 + mourner.index * 1.1,
      );
      mourner.head.getWorldPosition(headPosition);
      const facing = Math.atan2(
        -(player.x - headPosition.x),
        -(player.z - headPosition.z),
      );
      const offset = Math.atan2(
        Math.sin(facing - mourner.seat.group.rotation.y),
        Math.cos(facing - mourner.seat.group.rotation.y),
      );
      const yaw = T.MathUtils.clamp(offset, -2.98, 2.98) * progress;
      mourner.yaw = T.MathUtils.damp(mourner.yaw, yaw, 2.2, Math.max(0, dt));
      const rise = T.MathUtils.smoothstep(
        sequenceTime,
        15 + mourner.index * 0.5,
        19,
      );
      poseMourner(mourner, progress, rise);
      mourner.turned = progress > 0.95;
    }
    if (sequenceTime > 7 && sequenceTime < 19)
      for (const light of lights)
        if (light.castShadow) light.shadow.needsUpdate = true;
    return { elapsed: sequenceTime, done: sequenceTime >= 20 };
  }
  function reset() {
    active = false;
    startedAt = null;
    sequenceTime = 0;
    wake.visible = false;
    for (const mourner of mourners) {
      mourner.yaw = 0;
      poseMourner(mourner, 0, 0);
      mourner.turned = false;
    }
  }
  wake.traverse((object) => {
    object.userData.wake = true;
  });
  reset();
  return {
    group: wake,
    lights,
    colliders,
    chairs,
    portrait,
    reserved,
    mourners,
    portraitTable,
    bounds,
    entry,
    animate,
    prepare,
    begin,
    update,
    snapshot: () => ({
      active,
      startedAt,
      elapsed: sequenceTime,
      mourners: prepared ? mourners.length : mournerSeats.length,
      prepared,
      turned: mourners.filter((mourner) => mourner.turned).length,
    }),
    reset,
  };
}

function cardTexture(lines, sizes) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 384;
  const context = canvas.getContext("2d");
  context.fillStyle = "#e8e2d5";
  context.fillRect(0, 0, 768, 384);
  context.strokeStyle = "#b6b0a3";
  context.lineWidth = 2;
  context.strokeRect(17, 17, 734, 350);
  context.fillStyle = "#464943";
  context.textAlign = "center";
  context.textBaseline = "middle";
  lines.forEach((line, i) => {
    context.font = `${sizes[i] || 36}px Georgia`;
    context.fillText(line, 384, 133 + i * 112);
  });
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  return texture;
}

// Original sheer mourning cloth. A stable translucent base survives distance
// filtering, while finer strands remain visible when the player approaches.
function veilTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const g = canvas.getContext("2d");
  g.fillStyle = "#777";
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "#bbb";
  g.lineWidth = 1.8;
  for (let i = -256; i <= 512; i += 12) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 256, 256);
    g.stroke();
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i - 256, 256);
    g.stroke();
  }
  g.fillStyle = "#bbb";
  for (let y = 0; y < 256; y += 24)
    for (let x = 0; x < 256; x += 24) {
      g.beginPath();
      g.ellipse(x + (y % 48 ? 12 : 0), y, 1.3, 2.2, 0, 0, Math.PI * 2);
      g.fill();
    }
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.NoColorSpace;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(4, 2.4);
  texture.minFilter = T.LinearMipmapLinearFilter;
  texture.magFilter = T.LinearFilter;
  texture.anisotropy = 4;
  return texture;
}
// Frame the hands from measured finger roots so both palms rest on the cloth,
// rather than inheriting the forearm roll from the standing bind pose.
function lapHandOrientation(rig, side) {
  const wrist = rig.restPoint(`hand_${side.side}`);
  const forward = rig
    .restPoint(`middle_01_${side.side}`)
    .sub(wrist)
    .normalize();
  const across = rig
    .restPoint(`index_01_${side.side}`)
    .sub(rig.restPoint(`pinky_01_${side.side}`));
  across.addScaledVector(forward, -across.dot(forward)).normalize();
  const bind = new T.Quaternion().setFromRotationMatrix(
    new T.Matrix4().makeBasis(across, forward.clone().cross(across), forward),
  );
  const targetForward = new T.Vector3(0, -0.15, -1).normalize();
  const targetAcross = new T.Vector3(-Math.sign(side.shoulder.x), 0, 0);
  const target = new T.Quaternion().setFromRotationMatrix(
    new T.Matrix4().makeBasis(
      targetAcross,
      targetForward.clone().cross(targetAcross),
      targetForward,
    ),
  );
  return target
    .multiply(bind.invert())
    .multiply(rig.joint(`hand_${side.side}`).bodyQuaternion);
}
function veilGeometry(crown) {
  const columns = 72,
    rows = 48,
    positions = [],
    uv = [],
    indices = [];
  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    const cap = T.MathUtils.smoothstep(t, 0, 0.15);
    const radius =
      (0.145 + 0.055 * T.MathUtils.smoothstep(t, 0.3, 1)) * Math.sqrt(cap);
    for (let column = 0; column <= columns; column++) {
      const angle = (column / columns) * Math.PI * 2;
      const fold = Math.sin(angle * 19 + t * 4) * 0.005 * Math.sqrt(t);
      const y = crown + 0.022 - t * 0.39;
      positions.push(
        Math.sin(angle) * (radius + fold),
        y,
        Math.cos(angle) * (radius * 1.06 + fold) - 0.014,
      );
      uv.push(column / columns, t);
      if (row < rows && column < columns) {
        const a = row * (columns + 1) + column,
          b = a + columns + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
function lapGeometry() {
  const geometry = new T.PlaneGeometry(0.49, 0.59, 30, 36),
    p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      t = (0.295 - p.getY(i)) / 0.59;
    const drop = T.MathUtils.smoothstep(t, 0.43, 1);
    const fold =
      (Math.sin(x * 63 + t * 3) * 0.008 + Math.cos(x * 29 - t * 7) * 0.005) *
      (0.4 + drop * 0.6);
    p.setXYZ(
      i,
      x * (1 - drop * 0.05),
      0.605 - drop * 0.51 + fold,
      -0.025 - t * 0.57,
    );
  }
  geometry.computeVertexNormals();
  return geometry;
}
