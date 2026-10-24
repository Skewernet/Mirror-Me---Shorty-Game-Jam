import * as T from "three";
import { mergeGeometries } from "../vendor/BufferGeometryUtils.js";
import { BLOOD_RECIPES, createBloodAtlas, bloodMaterial, bloodPatchGeometry } from "./blood-writing.mjs";

// All clues imply water, a routine and passing time. None gives the clock
// solution, names the bathroom mirror or issues a next-objective command.
export const HALL_BLOOD_MARKS = Object.freeze([
  { x: .637, y: 1.43, z: 4.96, w: 1.48, h: .63, yaw: -Math.PI / 2, tile: 10 },
  { x: -.637, y: 1.53, z: 3.39, w: 1.15, h: .62, yaw: Math.PI / 2, tile: 13 },
  { x: 3.82, y: 1.39, z: -.637, w: 1.63, h: .65, tile: 9 },
  { x: 4.45, y: 1.34, z: .637, w: 1.47, h: .57, yaw: Math.PI, tile: 11 },
  { x: 8.55, y: 1.49, z: -.637, w: .73, h: .69, tile: 12 },
].map(mark => Object.freeze(mark)));

export function createHallBlood(parent) {
  const root = new T.Group(); root.name = "The hallway's half-remembered evening";
  parent.add(root);
  const atlas = createBloodAtlas(), material = bloodMaterial(atlas);
  const parts = HALL_BLOOD_MARKS.map(bloodPatchGeometry);
  const mesh = new T.Mesh(mergeGeometries(parts), material);
  for (const geometry of parts) geometry.dispose();
  mesh.name = "Hall blood — water, waiting and turning hands";
  mesh.castShadow = false; mesh.receiveShadow = true; mesh.userData.hallBlood = true;
  root.add(mesh); root.visible = false;
  return {
    root, mesh, atlas, markings: HALL_BLOOD_MARKS,
    animate(state) { root.visible = state.stage >= 2; },
    reset() { root.visible = false; },
    snapshot: () => ({ visible: root.visible, count: HALL_BLOOD_MARKS.length,
      phrases: HALL_BLOOD_MARKS.map(mark => BLOOD_RECIPES[mark.tile].text) }),
  };
}
