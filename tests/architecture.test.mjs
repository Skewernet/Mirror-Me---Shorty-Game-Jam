import test from "node:test";
import assert from "node:assert/strict";
import { BoxGeometry, Mesh, MeshBasicMaterial, Vector3, Group } from "../vendor/three.module.js";
import { alignArchitectureUV } from "../src/architecture-uv.mjs";

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≈ ${b}`);
const slab = (w, d, x, z) => {
  const mesh = new Mesh(new BoxGeometry(w, 0.13, d), new MeshBasicMaterial());
  mesh.position.set(x, -0.065, z);
  return alignArchitectureUV(mesh);
};
const vertices = (mesh, normalAxis, sign) => {
  const { position, normal, uv } = mesh.geometry.attributes;
  return Array.from({ length: position.count }, (_, i) => i)
    .filter(i => normal.getComponent(i, normalAxis) === sign)
    .map(i => ({
      point: new Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld),
      u: uv.getX(i), v: uv.getY(i),
    }));
};

test("hall floor joints and every PBR UV share the same phase across adjacent slabs", () => {
  const first = slab(1.4, 8.26, 0, 3.43);
  const second = slab(8.56, 1.4, 4.98, 0);
  const a = vertices(first, 1, 1).find(v => Math.abs(v.point.x - 0.7) < 1e-6 && Math.abs(v.point.z + 0.7) < 1e-6);
  const b = vertices(second, 1, 1).find(v => Math.abs(v.point.x - 0.7) < 1e-6 && Math.abs(v.point.z + 0.7) < 1e-6);
  assert.ok(a && b);
  near(a.u, b.u); near(a.v, b.v);
  for (const mesh of [first, second]) for (const v of vertices(mesh, 1, 1)) {
    near(v.point.y, 0);
    near(v.u * 1.8, v.point.x);
    near(v.v * -1.8, v.point.z);
  }
});

test("wall headers and neighboring panels retain house-space texture scale and origin", () => {
  for (const [w, h, x, y] of [[1.1, 2.32, 0.55, 1.16], [1, 0.24, 1.6, 2.2], [2.7, 2.32, 3.45, 1.16]]) {
    const mesh = new Mesh(new BoxGeometry(w, h, 0.12), new MeshBasicMaterial());
    mesh.position.set(x, y, -0.7);
    alignArchitectureUV(mesh);
    for (const v of vertices(mesh, 2, 1)) {
      near(v.u * 1.8, v.point.x);
      near(v.v * 1.8, v.point.y);
    }
  }
});

test("architectural UV projection respects rotated parents without mutating cached prop geometry", () => {
  const cached = new BoxGeometry(1, 2, 0.12);
  const before = [...cached.attributes.uv.array];
  const prop = new Mesh(cached, new MeshBasicMaterial());
  const frame = new Mesh(cached, prop.material);
  const group = new Group();
  group.position.set(3, 0, 2);
  group.rotation.y = Math.PI / 2;
  group.add(frame);
  alignArchitectureUV(frame);
  assert.notEqual(frame.geometry, cached);
  assert.equal(prop.geometry, cached);
  assert.deepEqual([...cached.attributes.uv.array], before);
  for (const v of vertices(frame, 2, 1)) {
    near(v.u * 1.8, -v.point.z);
    near(v.v * 1.8, v.point.y);
  }
});
