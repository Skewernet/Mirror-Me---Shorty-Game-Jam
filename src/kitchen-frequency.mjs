import * as T from "three";
import { mergeGeometries } from "../vendor/BufferGeometryUtils.js";
import { BLOOD_RECIPES, createBloodAtlas, bloodMaterial, bloodPatchGeometry } from "./blood-writing.mjs";

export const KITCHEN_FREQUENCY = "93.7";

// Interior planes are measured against the actual walls; cabinet/fridge
// patches are attached to their own parents below, not painted in mid-air.
export const KITCHEN_FREQUENCY_MARKS = Object.freeze([
  { wall: "west", x: .903, y: 1.68, z: -2.24, w: 1.34, h: .59, yaw: Math.PI / 2, tile: 0, primary: true },
  { wall: "west", x: .903, y: 1.98, z: -2.53, w: 2.15, h: .54, yaw: Math.PI / 2, tilt: -.025, tile: 2 },
  { wall: "west", x: .903, y: 1.60, z: -1.18, w: .65, h: .62, yaw: Math.PI / 2, tile: 2 },
  { wall: "west", x: .903, y: 1.50, z: -3.67, w: 1.05, h: .72, yaw: Math.PI / 2, tile: 5 },
  { wall: "east", x: 4.497, y: 1.59, z: -3.34, w: 1.37, h: .65, yaw: -Math.PI / 2, tile: 6 },
  { wall: "east", x: 4.497, y: 1.04, z: -3.36, w: 1.02, h: .29, yaw: -Math.PI / 2, tile: 1 },
  { wall: "east", x: 4.497, y: 2.015, z: -2.88, w: 2.10, h: .47, yaw: -Math.PI / 2, tilt: .025, tile: 15 },
  { wall: "east", x: 4.497, y: 1.43, z: -2.15, w: .76, h: .70, yaw: -Math.PI / 2, tile: 8 },
  { wall: "north", x: 1.74, y: 1.65, z: -4.597, w: .34, h: .30, tile: 0 },
  { wall: "north", x: 3.56, y: 1.38, z: -4.597, w: .30, h: .29, tile: 14 },
  { wall: "west", x: .903, y: 1.08, z: -1.18, w: .62, h: .28, yaw: Math.PI / 2, tile: 1 },
  { wall: "entry", x: 1.38, y: 1.87, z: -.763, w: .70, h: .40, yaw: Math.PI, tile: 1 },
  { wall: "entry", x: 1.40, y: 1.30, z: -.763, w: .77, h: .60, yaw: Math.PI, tile: 15 },
  { wall: "entry", x: 3.46, y: 2.10, z: -.763, w: 1.06, h: .30, yaw: Math.PI, tile: 4 },
  { wall: "entry", x: 3.34, y: 1.49, z: -.763, w: .87, h: .67, yaw: Math.PI, tile: 6 },
].map(mark => Object.freeze(mark)));

function addBatch(parent, definitions, material, name) {
  if (!definitions.length) return null;
  const geometries = definitions.map(bloodPatchGeometry);
  const geometry = mergeGeometries(geometries);
  for (const part of geometries) part.dispose();
  const mesh = new T.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = false; mesh.receiveShadow = true;
  mesh.userData.kitchenBlood = true;
  mesh.userData.stationClue = KITCHEN_FREQUENCY;
  parent.add(mesh);
  return mesh;
}

export function createKitchenFrequency(parent, builders, { fridge, cabinets = [], cupboards = [] } = {}) {
  const root = new T.Group(); root.name = "The kitchen's blood-written ramblings";
  parent.add(root);
  const atlas = createBloodAtlas(), material = bloodMaterial(atlas);
  const roots = [root], markings = [], patches = [];
  const add = (group, definitions, name) => {
    definitions.forEach(mark => patches.push({ ...mark, parent: group, text: BLOOD_RECIPES[mark.tile || 0].text }));
    const mesh = addBatch(group, definitions, material, name);
    if (mesh) markings.push(mesh);
    return mesh;
  };
  const primaryMark = KITCHEN_FREQUENCY_MARKS[0];
  const primary = new T.Mesh(bloodPatchGeometry({ ...primaryMark, x: 0, y: 0, z: 0, yaw: 0 }), material);
  primary.name = "93.7 — the radio-side blood-written clue";
  primary.position.set(primaryMark.x, primaryMark.y, primaryMark.z);
  primary.rotation.y = primaryMark.yaw;
  primary.castShadow = false; primary.receiveShadow = true;
  primary.userData.kitchenBlood = true; primary.userData.stationClue = KITCHEN_FREQUENCY;
  root.add(primary); markings.push(primary);
  patches.push({ ...primaryMark, parent: root, text: KITCHEN_FREQUENCY });
  primary.userData.primary = true;
  builders.target("station-clue", primary, "READ THE BLOOD-WRITTEN STATION", 2.4);
  add(root, KITCHEN_FREQUENCY_MARKS.slice(1), "Kitchen walls — repeated numbers and broken thoughts");
  const external = (surface, name) => {
    const group = new T.Group(); group.name = name; surface.add(group); roots.push(group); return group;
  };
  const cabinetTiles = [0, 14, 7, 1, 6, 14, 8, 0];
  cabinets.forEach((cabinet, index) => {
    const group = external(cabinet, `Blood on base cabinet ${index + 1}`);
    const width = Math.min(.43, (cabinet.userData.cabinetWidth || .72) - .25);
    const definitions = [{ x: 0, y: .43, z: .286, w: width, h: .36, tile: cabinetTiles[index % cabinetTiles.length], surface: "cabinet" }];
    if ([0, 4, 7].includes(index)) definitions.push({ x: 0, y: .947, z: -.025, w: Math.min(.49, width + .05), h: .32, pitch: -Math.PI / 2, tile: index === 0 ? 7 : 1, surface: "worktop" });
    add(group, definitions, `Cabinet/worktop finger writing ${index + 1}`);
  });
  cupboards.forEach((cupboard, index) => {
    const group = external(cupboard, `Blood on wall cupboard ${index + 1}`);
    add(group, [{ x: 0, y: .055, z: .175, w: .49, h: .35, tile: index ? 0 : 3, surface: "cupboard" }], `Wall cupboard rambling ${index + 1}`);
  });
  if (fridge) {
    const group = external(fridge, "Blood on the refrigerator");
    add(group, [
      { x: 0, y: 1.485, z: .350, w: .57, h: .27, tile: 0, surface: "fridge-door" },
      { x: 0, y: .835, z: .350, w: .55, h: .34, tile: 5, surface: "fridge-door" },
      { x: 0, y: .287, z: .350, w: .54, h: .34, tile: 8, surface: "fridge-freezer" },
      { x: .347, y: .96, z: 0, w: .52, h: .71, yaw: Math.PI / 2, tile: 14, surface: "fridge-side" },
    ], "Refrigerator — numbers, rain and a plea to stop");
  }
  const setVisible = value => { for (const group of roots) group.visible = Boolean(value); };
  setVisible(false);
  return {
    root, surfaceRoots: roots, primary, markings, patches, materials: [material], textures: [atlas.texture], atlas,
    setVisible,
    animate(state) { setVisible(state.stage >= 2 && Boolean(state.clockSolved)); },
    reset() { setVisible(false); },
    snapshot: () => ({ visible: root.visible, text: KITCHEN_FREQUENCY,
      count: patches.length, drawMeshes: markings.length, surfaceGroups: roots.length,
      phrases: [...new Set(patches.map(patch => patch.text))],
      primary: new T.Vector3().setFromMatrixPosition(primary.matrixWorld).toArray() }),
  };
}
