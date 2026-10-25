import * as T from "three";
import { createFigure } from "./figure.mjs";
import { FigureRig } from "./figure-motion.mjs";
import { createFuneralScare } from "./funeral-scare.mjs";
import { createEvelyn } from "./evelyn.mjs";
import { alignArchitectureUV } from "./architecture-uv.mjs";
import { BLACKOUT_ENVIRONMENT, FUNERAL_BLACKOUT, funeralBlackoutAt } from "./crawler-flicker.mjs";
import { FuneralApproach } from "./funeral-approach.mjs";

export const FUNERAL_RADIO = Object.freeze({ x: 1.04, y: 1.04, z: 11.92 });

// A furnished funeral parlor beyond the real front entrance. A clear central
// aisle ends at Evelyn's open casket; several chairs remain visibly unoccupied.
// Scorched plaster, damp timber and exhausted practicals preserve the house's
// tactile materials while making its final remembered room feel corrupted.
export function buildWake(b, m, surfaces, photos) {
  const { box, cylinder, sphere, group, contact } = b;
  const wake = group();
  wake.name = "Vale funeral parlor";
  wake.userData.wake = true;
  const bounds = {
    minX: -4.0,
    maxX: 4.0,
    minZ: 7.56,
    maxZ: 17.2,
    ceiling: 3.1,
  };
  const entry = { x: 0, z: 7.56, width: 0.92, triggerZ: 8.35 };
  const colliders = [],
    chairs = [],
    lights = [];
  const approach = new FuneralApproach(bounds, colliders);
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
  const wall = tag(surfaces.material("plaster", 1, 1, 0xb0a38e));
  wall.map = funeralDecayTexture();
  wall.name = "Smoke and damp in the funeral plaster";
  wall.normalScale.set(0.35, 0.35);
  const ceiling = tag(surfaces.material("plaster", 1, 1, 0x857d6a));
  ceiling.normalScale.set(0.18, 0.18);
  const floor = tag(surfaces.material("floor", 1, 1, 0x5a463d));
  const painted = tag(surfaces.material("panel", 1, 1, 0x362e2a));
  const wood = tag(surfaces.material("wood", 1, 1, 0x594037));
  const darkWood = tag(surfaces.material("wood", 1, 1, 0x352a28));
  const upholstery = tag(surfaces.material("linen", 1, 1, 0x362d31));
  const paper = plain(0xe9e3d5),
    metal = plain(0x777267, 0.58, 0.48),
    leaf = plain(0x3c4436),
    petal = plain(0x87796c, 0.84);
  const addSolid = (mesh) => {
    const collider = b.solid(mesh);
    colliders.push(collider);
    return collider;
  };
  function slab(w, h, d, x, y, z, material, parent = wake, round = 0) {
    return box(w, h, d, x, y, z, material, false, parent, round);
  }
  function wallBox(w, d, x, z) {
    const object = alignArchitectureUV(slab(w, bounds.ceiling, d, x, bounds.ceiling / 2, z, wall));
    addSolid(object);
    // Continuous dark timber dado and fitted skirting, not pale institutional walls.
    alignArchitectureUV(slab(w + .018, .85, d + .018, x, .425, z, painted));
    alignArchitectureUV(slab(w + .028, .045, d + .028, x, .86, z, darkWood));
    alignArchitectureUV(slab(w + .03, .10, d + .03, x, .05, z, darkWood));
    alignArchitectureUV(slab(w + .03, .075, d + .03, x, bounds.ceiling - .045, z, darkWood));
    return object;
  }
  alignArchitectureUV(slab(8.12, .13, 9.76, 0, -.065, 12.38, floor));
  const ceilingMesh = alignArchitectureUV(slab(8.12, .11, 9.76, 0, 3.155, 12.38, ceiling));
  ceilingMesh.castShadow = false;
  wallBox(.12, 9.76, -4.06, 12.38);
  wallBox(.12, 9.76, 4.06, 12.38);
  wallBox(8.12, .12, 0, 17.26);
  wallBox(3.54, .12, -2.29, 7.56);
  wallBox(3.54, .12, 2.29, 7.56);
  slab(1.04, 1.02, .12, 0, 2.59, 7.56, wall);

  function window(x, z) {
    const frame = group(x, 1.94, z, Math.PI, wake);
    slab(1.1, 1.17, 0.065, 0, 0, 0, painted, frame, 0.008);
    const glass = plain(0x777c70, 0.86);
    glass.emissive.set(0x666e61);
    glass.emissiveIntensity = 0.10;
    const pane = slab(0.98, 1.03, 0.018, 0, 0, 0.045, glass, frame);
    pane.castShadow = false;
    for (const sx of [-1, 0, 1])
      slab(0.025, 1.05, 0.035, sx * 0.49, 0, 0.062, painted, frame);
    for (const sy of [-1, 0, 1])
      slab(1.0, 0.025, 0.035, 0, sy * 0.515, 0.062, painted, frame);
    slab(1.19, 0.045, 0.19, 0, -0.62, 0.075, painted, frame, 0.005);
    // Stained cloth interrupts the weak exterior glow behind the casket.
    const blind = tag(surfaces.material("linen", 1.2, 0.7, 0x9b9280));
    slab(1.04, 0.14, 0.025, 0, 0.44, 0.1, blind, frame, 0.003);
    return frame;
  }
  window(-2.7, 17.165);
  window(2.7, 17.165);
  const drape = tag(surfaces.material("fabric", 1.2, 2, 0x3b161b));
  drape.side = T.DoubleSide;
  for (const centre of [-2.7, 2.7]) {
    for (const side of [-1, 1]) {
      const geometry = new T.PlaneGeometry(.61, 2.38, 20, 20);
      const positions = geometry.attributes.position;
      for (let i = 0; i < positions.count; i++)
        positions.setZ(i, Math.sin(positions.getX(i) * 42) * .025);
      geometry.computeVertexNormals();
      const curtain = new T.Mesh(geometry, drape);
      curtain.name = "Heavy funeral-parlor drape";
      curtain.position.set(centre + side * .76, 1.43, 17.10);
      curtain.rotation.y = Math.PI;
      wake.add(curtain);
    }
    const rail = cylinder(.018, .018, 2.16, centre, 2.68, 17.09, metal, wake, 16);
    rail.rotation.z = Math.PI / 2;
  }

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
  for (const z of [9.35, 11.05, 12.75]) {
    for (const x of [-2.45, -1.63, 1.63, 2.45])
      chair(x, z, Math.PI, 1);
  }
  const reserved = chairs[6];
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
  const mournerSeats = [chairs[0], chairs[5], chairs[11]];
  mournerSeats.forEach(seat => { seat.occupied = true; });
  const lace = veilTexture();
  let prepared = false;
  let funeralScare = null;
  let casketMother = null;
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
    prepareCasketMother();
    funeralScare = createFuneralScare(wake, bounds, colliders);
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
  const portraitTable = table(-2.2, 15.85, 1.10, .55, .8, darkWood);
  // A separate, visible source for the final report. It never shares the
  // kitchen radio's weather loop or switch state.
  const radioTable = table(1.12, 11.98, 0.72, 0.48, 0.8, darkWood);
  const funeralRadio = group(
    FUNERAL_RADIO.x,
    0.84,
    FUNERAL_RADIO.z,
    Math.PI,
    wake,
  );
  funeralRadio.name = "The funeral-room news radio";
  const radioCase = tag(surfaces.material("wood", 0.75, 0.45, 0x5b3929));
  const bakelite = plain(0x282723, 0.37);
  const grille = tag(surfaces.material("linen", 2.1, 1.6, 0x5b5948));
  slab(0.58, 0.33, 0.23, 0, 0.165, 0, radioCase, funeralRadio, 0.025);
  slab(0.52, 0.27, 0.012, 0, 0.165, 0.122, bakelite, funeralRadio, 0.012);
  slab(0.285, 0.205, 0.008, -0.095, 0.165, 0.132, grille, funeralRadio, 0.008);
  const dial = plain(0xd8c79c, 0.5);
  dial.emissive.set(0xb7864a);
  dial.emissiveIntensity = 0.19;
  slab(0.17, 0.07, 0.009, 0.157, 0.23, 0.134, dial, funeralRadio, 0.004);
  for (let tick = 0; tick < 13; tick++)
    slab(
      0.002,
      tick % 3 === 0 ? 0.035 : 0.018,
      0.001,
      0.083 + tick * 0.012,
      0.232,
      0.14,
      bakelite,
      funeralRadio,
    );
  slab(0.002, 0.049, 0.002, 0.158, 0.23, 0.143, plain(0x974128), funeralRadio);
  for (const x of [0.105, 0.205]) {
    const knob = cylinder(
      0.023,
      0.023,
      0.018,
      x,
      0.105,
      0.144,
      bakelite,
      funeralRadio,
      20,
    );
    knob.rotation.x = Math.PI / 2;
    slab(0.002, 0.012, 0.001, x, 0.113, 0.154, dial, funeralRadio);
  }
  const radioLamp = plain(0x8c9271, 0.45);
  radioLamp.emissive.set(0xa8ba76);
  radioLamp.emissiveIntensity = 0.8;
  sphere(0.006, 0.006, 0.004, 0.248, 0.23, 0.143, radioLamp, funeralRadio);
  for (const x of [-0.21, 0.21])
    slab(0.043, 0.012, 0.12, x, 0.003, 0, bakelite, funeralRadio, 0.003);
  const cloth = tag(surfaces.material("linen", 1.5, 0.8, 0xb4aa95));
  slab(1.3, 0.008, 0.52, 0, 0.832, 0, cloth, portraitTable);
  for (const sx of [-1, 1])
    slab(0.012, 0.2, 0.52, sx * 0.647, 0.735, 0, cloth, portraitTable);
  const portrait = group(-2.2, 1.3, 15.96, Math.PI, wake);
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
  const captionCard = slab(0.32, 0.15, 0.004, -1.83, 0.91, 15.65, caption);
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
    -2.57,
    0.842,
    15.85,
    vase,
    wake,
  );
  for (let i = 0; i < 5; i++) {
    const x = -2.57 + Math.sin(i * 2.3) * 0.065,
      z = 15.85 + Math.cos(i * 1.9) * 0.048,
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
  // A real open casket replaces the old portrait-table focal point. The
  // remembered body is the separately authored Evelyn asset, never Mara.
  const casket = group(0, 0, 15.65, 0, wake);
  casket.name = "Evelyn's open walnut casket";
  const casketWood = tag(surfaces.material("wood", 1.6, .7, 0x38221e));
  casketWood.roughness = .52;
  const casketLining = tag(surfaces.material("linen", 1.5, 1, 0xc3b8a4));
  casketLining.roughness = .66;
  const fittings = plain(0x84704d, .48, .72);
  const outline = [[-1.17,-.28],[-.82,-.45],[.63,-.45],[1.17,-.31],[1.17,.31],[.63,.45],[-.82,.45],[-1.17,.28]];
  const shell = new T.Shape();
  outline.forEach(([x,z], i) => i ? shell.lineTo(x,z) : shell.moveTo(x,z));
  shell.closePath();
  const interior = new T.Path();
  [...outline].reverse().forEach(([x,z],i) => i ? interior.lineTo(x*.94,z*.84) : interior.moveTo(x*.94,z*.84));
  interior.closePath();
  shell.holes.push(interior);
  const shellGeometry = new T.ExtrudeGeometry(shell, { depth:.31, bevelEnabled:true, bevelSize:.013, bevelThickness:.012, bevelSegments:2, steps:1 });
  shellGeometry.rotateX(-Math.PI/2);
  const casing = new T.Mesh(shellGeometry, casketWood);
  casing.position.y = .70;
  casing.castShadow = casing.receiveShadow = true;
  casket.add(casing);
  slab(2.16, .07, .69, 0, .72, 0, casketWood, casket, .025);
  slab(2.06, .065, .64, -.015, .805, 0, casketLining, casket, .045);
  slab(.43, .095, .57, .72, .865, 0, casketLining, casket, .04);
  for (const x of [-.76,.76]) {
    slab(.12, .58, .55, x, .35, 0, darkWood, casket, .012);
    slab(.17, .08, .90, x, .075, 0, darkWood, casket, .018);
  }
  for (const side of [-1,1]) for (const x of [-.69,0,.69]) {
    slab(.27, .055, .025, x, .855, side*.459, fittings, casket, .012);
    const handle = new T.Mesh(new T.TorusGeometry(.075,.008,8,20,Math.PI), fittings);
    handle.position.set(x,.84,side*.474);
    handle.rotation.z = Math.PI;
    if (side < 0) handle.rotation.y = Math.PI;
    casket.add(handle);
  }
  const lid = group(0,1.025,.44,0,casket);
  slab(2.25,.07,.83,0,0,-.42,casketWood,lid,.03);
  slab(2.10,.032,.68,0,-.055,-.42,casketLining,lid,.025);
  lid.rotation.x = 2.0;
  addSolid(slab(2.48,1.85,1.62,0,.925,.19,m.invisible,casket));

  function prepareCasketMother() {
    if (casketMother) return;
    casketMother = createEvelyn({ wounded:false });
    const body = casketMother.body;
    body.name = "Evelyn resting in the casket";
    casket.add(body);
    body.position.set(-.81,.935,0);
    body.rotation.set(Math.PI/2,Math.PI/2,0,"YXZ");
    casketMother.resetPose?.();
    const rig = casketMother.rig;
    if (rig) {
      rig.reset();
      for (const side of rig.sides) {
        const sign = Math.sign(side.shoulder.x) || (side.side === "l" ? -1 : 1);
        const target = rig.bodyPoint(new T.Vector3(sign*.13,sign < 0 ? 1.06 : 1.02,sign < 0 ? -.19 : -.17));
        const pole = rig.bodyPoint(new T.Vector3(sign*.44,.97,-.12));
        rig.solveLimb(`upperarm_${side.side}`,`lowerarm_${side.side}`,`hand_${side.side}`,target,pole,side.upperArm,side.lowerArm);
        // Lay the palms into the abdomen and direct the fingers gently across
        // it, rather than retaining the standing rig's arbitrary wrist roll.
        const wrist = rig.restPoint(`hand_${side.side}`);
        const forward = rig.restPoint(`middle_01_${side.side}`).sub(wrist).normalize();
        const across = rig.restPoint(`index_01_${side.side}`).sub(rig.restPoint(`pinky_01_${side.side}`));
        across.addScaledVector(forward,-across.dot(forward)).normalize();
        const bind = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(across,forward.clone().cross(across),forward));
        const desiredForward = new T.Vector3(-sign,-.10,0).normalize();
        const desiredAcross = new T.Vector3(-sign*.10,1,0).normalize();
        const desired = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(desiredAcross,desiredForward.clone().cross(desiredAcross),desiredForward));
        desired.multiply(bind.invert()).multiply(rig.joint(`hand_${side.side}`).bodyQuaternion);
        rig.setWorldQuaternion(`hand_${side.side}`,rig.bodyQuaternion(desired));
        for (const finger of ["index","middle","ring","pinky"])
          for (let segment=1; segment<=3; segment++)
            rig.rotate(`${finger}_0${segment}_${side.side}`,-.025*segment,0,0);
      }
      rig.update();
    }
    casketMother.setMouthOpen?.(0);
    casketMother.setEyesClosed?.(true);
    body.traverse(object => {
      object.userData.wake = true;
      if (object.isMesh) { object.castShadow = false; object.receiveShadow = true; }
    });
  }

  // Everyday hospitality makes the unoccupied chairs more uncomfortable.
  const tea = table(-3.62, 13.15, 0.54, 1.45, 0.76, painted);
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
  function casketLight() {
    const light = new T.SpotLight(0xf2d4ab, 27, 9.5, .86, .85, 2);
    light.position.set(-.9, 2.85, 14.45);
    light.target.position.set(.4, .98, 15.65);
    wake.add(light, light.target);
    light.userData.base = 27;
    light.userData.wake = true;
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.autoUpdate = false;
    light.shadow.needsUpdate = true;
    light.shadow.bias = -.0002;
    light.shadow.normalBias = .015;
    light.shadow.camera.near = .1;
    light.shadow.camera.far = 9.5;
    lights.push(light);
  }
  casketLight();
  point(0xd4c2a2, 6.2, 9, 0, 2.8, 11.7);
  // The broad room fill has a visible period pendant rather than an
  // unexplained bright patch on the ceiling.
  cylinder(.13,.13,.04,0,3.06,11.7,darkWood,wake,24);
  cylinder(.008,.008,.25,0,2.91,11.7,metal,wake,12);
  b.lathe([[.23,0],[.225,.03],[.08,.23],[.06,.25]],0,2.61,11.7,plain(0x95846a,.86),wake);
  const pendantBulb = new T.Mesh(new T.SphereGeometry(.045,16,12), new T.MeshBasicMaterial({color:0xc6b58d}));
  pendantBulb.position.set(0,2.70,11.7);
  wake.add(pendantBulb);
  for (const side of [-1, 1]) for (const z of [9.65, 14.0]) {
    const x = side * 3.89;
    slab(.045, .28, .17, x, 1.85, z, darkWood);
    sphere(.06, .085, .06, x - side * .10, 1.95, z, plain(0xb49b78));
    point(z > 12 ? 0xc3a1a0 : 0xd5c39a, 4.4, 4.6, x - side * .16, 1.95, z);
  }
  const fixtureMaterials = new Map();
  wake.traverse(object => {
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material || fixtureMaterials.has(material)) continue;
      if (material.isMeshBasicMaterial && material.opacity > 0 ||
          material.emissive?.getHex() > 0 && material.emissiveIntensity > 0) {
        material.userData.wakeElectricalFixture = true;
        fixtureMaterials.set(material, {
          color: material.color.clone(), emissive: material.emissiveIntensity,
          selfLit: material.isMeshBasicMaterial,
        });
      }
    }
  });
  let active = false,
    startedAt = null,
    reportAt = null,
    sequenceTime = 0,
    blackoutStartedAt = null,
    blackoutEnabled = true,
    blackoutStopped = false,
    blackoutAge = 0,
    blackoutIndex = -1,
    blackoutMultiplier = 1;
  const blackoutEvents = [], blackoutRelays = new Set();
  function applyBlackout(multiplier) {
    blackoutMultiplier = multiplier;
    for (const light of lights) light.intensity = light.userData.base * multiplier;
    for (const [material, original] of fixtureMaterials) {
      material.color.copy(original.color);
      if (original.selfLit) material.color.multiplyScalar(multiplier);
      if (original.emissive !== undefined) material.emissiveIntensity = original.emissive * multiplier;
    }
  }
  function blackoutLighting() {
    return blackoutMultiplier === 0
      ? { lightSource: "all", lightMultiplier: 0, ...BLACKOUT_ENVIRONMENT }
      : { lightSource: null, lightMultiplier: 1 };
  }
  function setBlackoutEnabled(enabled) {
    blackoutEnabled = Boolean(enabled);
    if (!blackoutEnabled) {
      blackoutEvents.length = 0;
      blackoutIndex = -1;
      applyBlackout(1);
    }
  }
  function beginBlackout(time, { flashes = true } = {}) {
    if (blackoutStartedAt !== null || !Number.isFinite(time)) return false;
    blackoutStartedAt = time;
    blackoutAge = 0;
    blackoutStopped = false;
    setBlackoutEnabled(flashes);
    return true;
  }
  function updateBlackout(time) {
    blackoutAge = blackoutStartedAt === null ? 0 : Math.max(0, time - blackoutStartedAt);
    if (blackoutStartedAt === null || blackoutStopped || !blackoutEnabled) {
      applyBlackout(1);
      return;
    }
    const sample = funeralBlackoutAt(blackoutAge);
    const relay = (index, edge) => {
      const key = edge + ":" + index;
      if (blackoutRelays.has(key)) return;
      blackoutRelays.add(key);
      blackoutEvents.push({ id: "light-relay", edge,
        x: index % 2 ? 3.65 : -3.65, y: 1.5, z: index === 2 ? 14 : 9.65,
        encounter: "funeral-blackout" });
    };
    if (sample.index >= 0 && sample.index !== blackoutIndex) relay(sample.index, "off");
    else if (sample.index < 0 && blackoutIndex >= 0) relay(blackoutIndex, "on");
    blackoutIndex = sample.index;
    applyBlackout(sample.lightMultiplier);
  }
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
  function begin(time, player) {
    if (startedAt !== null) return false;
    prepare();
    startedAt = time;
    sequenceTime = 0;
    wake.visible = true;
    approach.begin(time, player);
    return true;
  }
  const headPosition = new T.Vector3();
  function beginReport(time) {
    if (reportAt !== null) return false;
    reportAt = time;
    return true;
  }
  function update(time, dt, state, player) {
    animate(time, state);
    updateBlackout(time);
    if (startedAt === null) return { elapsed: 0, done: false };
    sequenceTime = Math.max(0, time - startedAt);
    const reportTime = reportAt === null ? 0 : Math.max(0, time - reportAt);
    for (const mourner of mourners) {
      const progress = T.MathUtils.smoothstep(
        reportTime,
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
        reportTime,
        15 + mourner.index * 0.5,
        19,
      );
      poseMourner(mourner, progress, rise);
      mourner.turned = progress > 0.95;
    }
    if (reportTime > 7 && reportTime < 19)
      for (const light of lights)
        if (light.castShadow) light.shadow.needsUpdate = true;
    // The controller waits for the complete news report and final voice; this
    // room never ends a long report on an unrelated animation timer.
    funeralScare?.update(time);
    return { elapsed: sequenceTime };
  }
  function reset() {
    active = false;
    startedAt = null;
    reportAt = null;
    sequenceTime = 0;
    blackoutStartedAt = null;
    blackoutStopped = false;
    blackoutEnabled = true;
    blackoutAge = 0;
    blackoutIndex = -1;
    blackoutEvents.length = 0;
    blackoutRelays.clear();
    applyBlackout(1);
    wake.visible = false;
    funeralScare?.reset();
    approach.reset();
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
    ambientProfile: Object.freeze({ skyColor: 0xb4b7a6, groundColor: 0x342127, intensity: .20 }),
    group: wake,
    lights,
    colliders,
    chairs,
    portrait,
    reserved,
    mourners,
    portraitTable,
    casket,
    get casketBody() { return casketMother?.body; },
    funeralRadio,
    radioTable,
    bounds,
    entry,
    animate,
    prepare,
    begin,
    beginReport,
    approachCamera: time => approach.update(time),
    beginBlackout,
    setBlackoutEnabled,
    blackoutLighting,
    drainEvents: () => blackoutEvents.splice(0),
    beginAttack(time, player, options) {
      prepare();
      approach.release();
      blackoutStopped = true;
      blackoutIndex = -1;
      blackoutEvents.length = 0;
      applyBlackout(1);
      return funeralScare.begin(time, player, options);
    },
    attackCamera: time => funeralScare?.camera(time) || { active: false, done: false, fade: 0 },
    reduceAttack: time => funeralScare?.reduce(time) || false,
    get attackBody() { return funeralScare?.body; },
    update,
    snapshot: () => ({
      active,
      startedAt,
      reportAt,
      elapsed: sequenceTime,
      blackout: { startedAt: blackoutStartedAt, enabled: blackoutEnabled, age: blackoutAge,
        active: blackoutStartedAt !== null && !blackoutStopped && blackoutEnabled && blackoutAge < FUNERAL_BLACKOUT.duration,
        lightMultiplier: blackoutMultiplier, duration: FUNERAL_BLACKOUT.duration },
      mourners: prepared ? mourners.length : mournerSeats.length,
      prepared,
      turned: mourners.filter((mourner) => mourner.turned).length,
      radioPosition: { ...FUNERAL_RADIO },
      roomArea: (bounds.maxX - bounds.minX) * (bounds.maxZ - bounds.minZ),
      emptyChairs: chairs.filter(seat => !seat.occupied).length,
      casket: { visible: wake.visible, prepared: Boolean(casketMother), cleanMother: Boolean(casketMother), position: casket.position.toArray() },
      approach: approach.snapshot(),
      attack: funeralScare?.snapshot() || { active: false, phase: "idle", visible: false },
    }),
    reset,
  };
}

// One original static surface, generated once at construction. Broad damp
// blooms and ceiling soot work under the existing plaster normal/roughness
// maps; this adds no geometry, lights, downloads or per-frame texture work.
function funeralDecayTexture() {
  const size = 512, canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d");
  let seed = 0x71e3;
  const random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 4294967296);
  g.fillStyle = "#aaa394";
  g.fillRect(0, 0, size, size);
  for (let index = 0; index < 95; index++) {
    const x = random() * size, y = random() * size, radius = 16 + random() * 86;
    const damp = g.createRadialGradient(x, y, 0, x, y, radius);
    damp.addColorStop(0, `rgba(47,35,31,${.025 + random() * .11})`);
    damp.addColorStop(1, "rgba(47,35,31,0)");
    g.fillStyle = damp;
    g.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  const soot = g.createLinearGradient(0, 0, 0, 205);
  soot.addColorStop(0, "rgba(24,18,17,.80)");
  soot.addColorStop(.22, "rgba(36,25,23,.46)");
  soot.addColorStop(1, "rgba(36,25,23,0)");
  g.fillStyle = soot;
  g.fillRect(0, 0, size, 205);
  for (let index = 0; index < 57; index++) {
    const x = random() * size, length = 35 + random() * 240, width = 2 + random() * 13;
    const streak = g.createLinearGradient(0, 0, 0, length);
    streak.addColorStop(0, "rgba(47,29,25,.30)");
    streak.addColorStop(1, "rgba(47,29,25,0)");
    g.fillStyle = streak;
    g.fillRect(x, 0, width, length);
  }
  for (let index = 0; index < 19; index++) {
    let x = random() * size, y = random() * 190;
    g.beginPath(); g.moveTo(x, y);
    for (let step = 0, count = 5 + Math.floor(random() * 14); step < count; step++) {
      x += (random() - .5) * 22; y += 5 + random() * 12; g.lineTo(x, y);
    }
    g.strokeStyle = "rgba(34,27,24,.17)"; g.lineWidth = .4 + random() * .5; g.stroke();
  }
  for (let index = 0; index < 3300; index++) {
    g.fillStyle = random() < .5 ? "rgba(24,19,16,.035)" : "rgba(230,218,190,.035)";
    g.fillRect(random() * size, random() * size, 1, 1);
  }
  const texture = new T.CanvasTexture(canvas);
  texture.name = "Original scorched funeral plaster";
  texture.colorSpace = T.SRGBColorSpace;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(.22, 1 / 3.1);
  texture.anisotropy = 4;
  return texture;
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
