import * as T from "three";
import { mergeGeometries } from "../vendor/BufferGeometryUtils.js";
import { createReachingArms, UNRAVELING_ARMS } from "./unraveling-arms.mjs";
import { CEILING_HEIGHT } from "./layout.mjs";

const smooth = T.MathUtils.smoothstep;
const FLICKER_ZONES = ["bathroom", "utility"];
const FLICKER_CUTS = {
  bathroom: [[.12, .24], [.36, .61], [.71, .82], [1.3, 1.49], [1.58, 1.78]],
  utility: [[.3, .49], [.68, .75], [.91, 1.16], [1.45, 1.55]],
};

// These details never change the physical building. They occupy room margins,
// wall planes or the ceiling, leaving the established capsule route intact.
export const UNRAVELING_HANDS = UNRAVELING_ARMS;

// Sparse, different failures rather than a synchronized whole-house strobe.
// The ordinary failed-fuse fill remains untouched by these practical outages.
export function unravelingFlickerAt(time, zone) {
  const period = zone === "bathroom" ? 17.7 : 21.3;
  const phase = ((time + (zone === "bathroom" ? 2.8 : 9.1)) % period + period) % period;
  for (const [a, b] of FLICKER_CUTS[zone] || FLICKER_CUTS.utility)
    if (phase >= a && phase < b) return 0;
  return 1;
}

export function createHouseUnraveling(scene, materials) {
  const group = new T.Group();
  group.name = "The house coming apart — final old-house pass";
  group.visible = false;
  scene.add(group);
  const dressing = new T.Group();
  dressing.name = "Abandoned room debris and old cordon";
  group.add(dressing);
  const hands = new T.Group();
  hands.name = "Hands in the plaster";
  hands.visible = false;
  group.add(hands);
  const batches = new Map();
  const marks = [];
  const meshBounds = [];
  const wood = materials.wood.clone();
  wood.color.multiplyScalar(.74);
  const paper = materials.paper.clone();
  paper.color.set(0x9b967f);
  const dark = new T.MeshStandardMaterial({ color: 0x181713, roughness: .99, envMapIntensity: .03 });
  const plaster = new T.MeshStandardMaterial({ color: 0x9b9788, roughness: .98, envMapIntensity: .04 });
  const redCloth = new T.MeshStandardMaterial({ color: 0x332d27, roughness: 1, envMapIntensity: .04 });
  const tempMatrix = new T.Matrix4(), tempQuaternion = new T.Quaternion(), tempPosition = new T.Vector3();
  const unitScale = new T.Vector3(1, 1, 1);

  function addBox(size, at, rotation, material) {
    const geometry = new T.BoxGeometry(...size);
    tempQuaternion.setFromEuler(new T.Euler(...rotation));
    tempMatrix.compose(tempPosition.fromArray(at), tempQuaternion, unitScale);
    geometry.applyMatrix4(tempMatrix);
    if (!batches.has(material)) batches.set(material, []);
    batches.get(material).push(geometry);
  }
  function chair(at, yaw, tilt = .95) {
    const matrix = new T.Matrix4().compose(new T.Vector3(...at),
      new T.Quaternion().setFromEuler(new T.Euler(tilt, yaw, .35)), unitScale);
    const parts = [
      [[.45, .045, .43], [0, .46, 0]], [[.43, .47, .035], [0, .76, .19]],
      ...[-1, 1].flatMap(x => [-1, 1].map(z => [[.032, .46, .032], [x * .185, .23, z * .17]])),
    ];
    for (const [size, position] of parts) {
      const geometry = new T.BoxGeometry(...size);
      geometry.translate(...position).applyMatrix4(matrix);
      if (!batches.has(wood)) batches.set(wood, []);
      batches.get(wood).push(geometry);
    }
  }
  // Room margins: nothing is added to a doorway, objective or central aisle.
  chair([-3.65, .23, 4.35], .6);
  chair([3.16, .23, -1.75], -1.2, -.85);
  addBox([.71, .065, .34], [-2.42, .16, 1.21], [.33, .52, -.27], wood);
  addBox([.62, .035, .83], [-2.67, .29, 1.34], [.31, -.18, .4], wood);
  addBox([.63, .027, .39], [8.74, .13, -1.72], [.24, .4, -.15], wood);
  // Split domestic door panels have fallen inside rooms, not across their exits.
  for (const [at, yaw] of [[[-1.20, .48, 3.66], .41], [[3.17, .39, -1.12], -.47], [[8.66, .46, -1.18], -.62]]) {
    for (let i = 0; i < 4; i++)
      addBox([.135, .88 - i * .061, .035], [at[0] + i * .13, at[1] - i * .018, at[2]],
        [.31 + i * .018, yaw, -.22 + i * .045], wood);
  }
  const scattered = [
    [-2.16, 5.91], [-3.53, 6.31], [-3.10, 3.87], [-1.18, 4.18],
    [-2.16, 1.15], [-1.38, 2.62], [3.98, -2.05], [3.77, -3.77],
    [1.23, -1.33], [5.08, -1.31], [8.86, -2.08], [6.09, -4.08],
  ];
  for (let i = 0; i < scattered.length; i++) {
    const [x, z] = scattered[i];
    addBox([.16 + (i % 3) * .02, .025, .23], [x, .018 + (i % 2) * .014, z],
      [.015 * (i % 3), i * 1.73, .025 * (i % 2)], i % 3 === 0 ? redCloth : paper);
    if (i % 3 === 1)
      addBox([.23, .009, .29], [x + .19, .006, z - .13], [0, i * 1.41, 0], paper);
  }
  // Small splinters and plaster under the damage, safely against hall skirting.
  for (let i = 0; i < 17; i++) {
    const x = 2.9 + i * .29, z = i % 2 ? .565 : -.565;
    addBox([.07 + (i % 3) * .025, .015, .032], [x, .009, z], [.1, i * 1.63, .06], i % 3 ? plaster : wood);
  }

  function crack(origin, right, down, scale = 1, seed = 1) {
    const o = new T.Vector3(...origin), u = new T.Vector3(...right), v = new T.Vector3(...down);
    const branches = [
      [[0, 0], [.09, .14], [.055, .31], [.19, .48], [.14, .69], [.28, .92]],
      [[.055, .31], [-.11, .4], [-.18, .58]],
      [[.19, .48], [.32, .55], [.38, .72]],
      [[.14, .69], [-.02, .82], [-.055, .97]],
    ];
    for (const path of branches) {
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1], b = path[i];
        const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
        const width = (.0017 + Math.sin(seed * 4 + i) ** 2 * .0022) * scale;
        const nx = -dy / length * width, ny = dx / length * width;
        for (const [x, y] of [[a[0] + nx, a[1] + ny], [a[0] - nx, a[1] - ny], [b[0] + nx, b[1] + ny],
          [b[0] + nx, b[1] + ny], [a[0] - nx, a[1] - ny], [b[0] - nx, b[1] - ny]]) {
          tempPosition.copy(o).addScaledVector(u, x * scale).addScaledVector(v, y * scale);
          marks.push(tempPosition.x, tempPosition.y, tempPosition.z);
        }
      }
    }
  }
  crack([.636, 2.27, 5.96], [0, 0, -1], [0, -1, 0], 1.1, 2);
  crack([-.636, 2.21, 3.37], [0, 0, 1], [0, -1, 0], .86, 3);
  crack([3.25, 2.25, .636], [1, 0, 0], [0, -1, 0], .85, 4);
  crack([5.45, 2.28, -.636], [1, 0, 0], [0, -1, 0], 1.04, 5);
  crack([7.76, 2.25, .636], [1, 0, 0], [0, -1, 0], .79, 6);
  crack([1.1, CEILING_HEIGHT - .002, -.28], [1, 0, 0], [0, 0, 1], .9, 7);
  crack([4.2, CEILING_HEIGHT - .002, -.41], [1, 0, 0], [0, 0, 1], .82, 8);
  crack([6.47, CEILING_HEIGHT - .002, -.28], [1, 0, 0], [0, 0, 1], .86, 9);
  const crackGeometry = new T.BufferGeometry();
  crackGeometry.setAttribute("position", new T.Float32BufferAttribute(marks, 3));
  crackGeometry.computeVertexNormals();
  dark.side = T.DoubleSide;
  dressing.add(new T.Mesh(crackGeometry, dark));

  // One locally authored atlas, created once. Torn strips sag or lie discarded;
  // the old cordon suggests a memory without spelling out the revelation.
  const canvas = document.createElement("canvas");
  canvas.width = 1024; canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#978a37"; ctx.fillRect(0, 0, 1024, 128);
  ctx.fillStyle = "#272820";
  for (let x = -100; x < 1124; x += 240) {
    ctx.save();ctx.translate(x, 0);ctx.transform(1, 0, -.48, 1, 0, 0);ctx.fillRect(0, 0, 53, 128);ctx.restore();
  }
  ctx.fillStyle = "#a89b46";ctx.fillRect(143, 12, 718, 104);
  ctx.fillStyle = "#29271e";ctx.font = "bold 77px Arial";ctx.textAlign = "center";ctx.textBaseline = "middle";ctx.fillText("CAUTION", 512, 69);
  for (let i = 0; i < 150; i++) {
    ctx.fillStyle = i % 3 ? "#595d3325" : "#d4c98820";
    ctx.fillRect((i * 263) % 1024, (i * 43) % 128, 2 + (i % 7), 1 + (i % 11));
  }
  const tapeTexture = new T.CanvasTexture(canvas); tapeTexture.colorSpace = T.SRGBColorSpace;
  const tapeMaterial = new T.MeshStandardMaterial({ map: tapeTexture, roughness: .9, side: T.DoubleSide, envMapIntensity: .04 });
  const tapeGeometries = [];
  function tape(a, b, sag = 0, roll = 0, reverse = false) {
    const start = new T.Vector3(...a), end = new T.Vector3(...b), axis = end.clone().sub(start).normalize();
    const down = new T.Vector3(0, -1, 0);
    if (Math.abs(axis.dot(down)) > .95) down.set(1, 0, 0);
    down.addScaledVector(axis, -down.dot(axis)).normalize();
    down.applyAxisAngle(axis, roll);
    const positions = [], uvs = [];
    const count = 12;
    for (let i = 0; i <= count; i++) {
      const f = i / count, width = .061 * (i === count ? .67 : 1);
      const edge = i === count || i === 0 ? .009 : Math.sin(i * 2.1) * .0018;
      const centre = start.clone().lerp(end, f).addScaledVector(down, Math.sin(f * Math.PI) * sag);
      for (const side of [-1, 1]) {
        const p = centre.clone().addScaledVector(down, side * width / 2 + edge);
        positions.push(p.x, p.y, p.z); uvs.push((reverse ? 1 - f : f) * (start.distanceTo(end) > 1.15 ? 2 : 1), side === -1 ? 0 : 1);
      }
    }
    const indices = [];
    for (let i = 0; i < count; i++) indices.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 2, i * 2 + 1, i * 2 + 3);
    const geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);geometry.computeVertexNormals();tapeGeometries.push(geometry);
  }
  tape([-.631, 1.57, 5.76], [-.631, 1.08, 6.9], .055, 0, true);
  tape([3.58, 1.33, .631], [4.61, 1.23, .631], .074, 0, true);
  tape([6.38, 1.96, .631], [7.14, 1.39, .631], .043, 0, true);
  tape([-.27, .006, 5.89], [.37, .006, 6.51], .055, Math.PI / 2);
  tape([2.67, .006, -.40], [3.74, .006, -.52], .08, Math.PI / 2);
  tape([5.81, .007, .34], [6.45, .007, .47], .045, Math.PI / 2);
  tape([-2.34, .008, 4.82], [-1.34, .008, 4.34], .07, Math.PI / 2);
  tape([7.92, .007, -1.49], [8.62, .007, -1.21], .025, Math.PI / 2);
  tapeTexture.wrapS = T.RepeatWrapping;
  const tapeMesh = new T.Mesh(mergeGeometries(tapeGeometries), tapeMaterial);
  tapeMesh.name = "Torn abandoned caution tape";dressing.add(tapeMesh);
  for (const g of tapeGeometries) g.dispose();
  for (const [material, geometries] of batches) {
    const mesh = new T.Mesh(mergeGeometries(geometries), material);
    mesh.name = "Scattered household fragments";dressing.add(mesh);
    for (const g of geometries) g.dispose();
  }
  dressing.traverse(object => {
    if (!object.isMesh) return;
    object.castShadow = false; object.receiveShadow = true;
    object.geometry.computeBoundingBox();meshBounds.push(object.geometry.boundingBox.clone());
  });

  let prepared = null, ready = false, active = false, encountered = false, startedAt = null, lastTime = 0;
  let enabled = true, flashes = true;
  const warmupObjects = [...dressing.children];
  const armField = createReachingArms(hands, warmupObjects);
  async function prepare(options = {}) {
    if (!prepared) prepared = armField.prepare(options).then(() => { ready = true; });
    return prepared;
  }
  function update(time, dt, state, player, options = {}) {
    if (time < lastTime) reset();lastTime = time;
    active = state.stage === 5 && !state.inverted && !state.wakeEntered;
    enabled = options.enabled !== false;flashes = options.flashes !== false;
    if (!active) { group.visible = false;hands.visible = false;encountered = false;startedAt = null;return; }
    group.visible = true;
    if (options.encounterSeen) encountered = true;
    if (encountered && enabled && player && player.x > 3.5 && Math.abs(player.z) < .58 && startedAt === null) startedAt = time;
    const approaching = player ? smooth(player.x, 3.6, 8.6) : 0;
    const age = startedAt === null ? -1 : time - startedAt;
    hands.visible = ready && enabled && age >= 0;
    if (hands.visible) armField.update(time, age, player, approaching);
  }
  function applyLighting(time, state, zoneLights) {
    if (!active || !enabled || !flashes || state.stage !== 5) return;
    for (const zone of FLICKER_ZONES)
      for (const light of zoneLights[zone] || []) light.intensity *= unravelingFlickerAt(time, zone);
  }
  function lightingFactor(time, state, zone) {
    return active && enabled && flashes && state.stage === 5 && (zone === "bathroom" || zone === "utility")
      ? unravelingFlickerAt(time, zone) : 1;
  }
  function reset() {
    group.visible = false;hands.visible = false;active = false;encountered = false;startedAt = null;lastTime = 0;
    armField.reset();
  }
  return {
    group, dressing, hands, warmupObjects, prepare, update, applyLighting, lightingFactor, reset,
    snapshot: () => {
      const arms = armField.snapshot();
      return { ready, active, encountered, startedAt, handsVisible: hands.visible,
        handCount: arms.count, handTriangles: arms.triangles, armDraws: arms.draws,
        arms, staticDraws: dressing.children.length,
        staticBounds: meshBounds.map(b => ({ min: b.min.toArray(), max: b.max.toArray() })),
        visible: group.visible, handBounds: arms.armBounds,
      };
    },
  };
}
