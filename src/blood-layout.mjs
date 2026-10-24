import * as T from "three";
import { mergeGeometries } from "../vendor/BufferGeometryUtils.js";
import { bloodPatchGeometry } from "./blood-writing.mjs";

// Clip an authored attempt, preserving its atlas UVs, to the actual flat
// pieces of a surface. One sentence can continue across adjacent doors and
// their raised rails; neither its corners nor transparent canvas overhang a
// doorway/window. All pieces still merge into the owning surface's batch.
const AXES = { x: [2, 1, 0], y: [0, 2, 1], z: [0, 1, 2] };
const lerp = (a, b, t) => a.map((value, i) => value + (b[i] - value) * t);
function cut(polygon, axis, edge, sign) {
  const output = [];
  if (!polygon.length) return output;
  let previous = polygon.at(-1), previousInside = sign * (previous[axis] - edge) >= -1e-8;
  for (const current of polygon) {
    const inside = sign * (current[axis] - edge) >= -1e-8;
    if (inside !== previousInside) output.push(lerp(previous, current,
      (edge - previous[axis]) / (current[axis] - previous[axis])));
    if (inside) output.push(current);
    previous = current; previousInside = inside;
  }
  return output;
}
export function clippedBloodGeometry(mark) {
  const original = bloodPatchGeometry(mark);
  if (!mark.clipZones?.length) return original;
  const source = original.index ? original.toNonIndexed() : original;
  if (source !== original) original.dispose();
  const [uAxis, vAxis, normalAxis] = AXES[mark.surfaceAxis || "z"];
  const p = source.attributes.position, uv = source.attributes.uv, n = source.attributes.normal;
  const positions = [], normals = [], coordinates = [];
  for (let start = 0; start < p.count; start += 3) {
    const triangle = [0, 1, 2].map(offset => {
      const i = start + offset;
      return [p.getX(i), p.getY(i), p.getZ(i), uv.getX(i), uv.getY(i), n.getX(i), n.getY(i), n.getZ(i)];
    });
    for (const zone of mark.clipZones) {
      let polygon = cut(triangle, uAxis, zone.u0, 1);
      polygon = cut(polygon, uAxis, zone.u1, -1);
      polygon = cut(polygon, vAxis, zone.v0, 1);
      polygon = cut(polygon, vAxis, zone.v1, -1);
      for (let corner = 1; corner < polygon.length - 1; corner++) {
        const face = [polygon[0], polygon[corner], polygon[corner + 1]];
        const a = face[0], b = face[1], c = face[2];
        if (Math.abs((b[uAxis]-a[uAxis])*(c[vAxis]-a[vAxis])-(b[vAxis]-a[vAxis])*(c[uAxis]-a[uAxis])) < 1e-9) continue;
        for (const vertex of face) {
          const point = vertex.slice(0, 3);
          if (zone.plane !== undefined) point[normalAxis] = zone.plane;
          positions.push(...point); coordinates.push(vertex[3], vertex[4]); normals.push(...vertex.slice(5, 8));
        }
      }
    }
  }
  source.dispose();
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new T.Float32BufferAttribute(coordinates, 2));
  geometry.setAttribute("normal", new T.Float32BufferAttribute(normals, 3));
  return geometry;
}
export function mergeBloodPatches(definitions) {
  const parts = definitions.map(clippedBloodGeometry).filter(geometry => {
    if (geometry.attributes.position.count) return true;
    geometry.dispose(); return false;
  });
  if (!parts.length) return null;
  // All clipped parts are nonindexed; unbounded small marks need the same
  // representation before merging into a single draw call.
  const compatible = parts.map(part => part.index ? part.toNonIndexed() : part);
  const result = mergeGeometries(compatible);
  for (let i = 0; i < parts.length; i++) {
    parts[i].dispose(); if (compatible[i] !== parts[i]) compatible[i].dispose();
  }
  return result;
}
export const bloodZone = (u0, u1, v0, v1, plane) => ({ u0, u1, v0, v1, ...(plane === undefined ? {} : { plane }) });
