import test from "node:test";
import assert from "node:assert/strict";
import { moveWithCollision, wishDirection, overlaps } from "../src/physics.mjs";
test("diagonal speed equals straight movement", () => {
  assert.equal(Math.hypot(...Object.values(wishDirection(1, 0, 0.4))), 1);
  assert.ok(
    Math.abs(Math.hypot(...Object.values(wishDirection(1, 1, 0.4))) - 1) <
      1e-10,
  );
});
test("large displacement cannot tunnel through a thin wall", () => {
  const p = { x: 0, z: 0 },
    wall = { minX: 1, maxX: 1.1, minZ: -2, maxZ: 2 };
  moveWithCollision(p, 4, 0, [wall]);
  assert.ok(p.x < 0.79);
  assert.ok(!overlaps(p.x, p.z, wall));
});
test("wall collision preserves movement along its surface", () => {
  const p = { x: 0, z: 0 };
  moveWithCollision(p, 2, 1, [{ minX: 1, maxX: 1.1, minZ: -2, maxZ: 2 }]);
  assert.ok(p.x < 0.79);
  assert.ok(Math.abs(p.z - 1) < 1e-10);
});
test("disabled door collider allows passage", () => {
  const p = { x: 0, z: 0 };
  moveWithCollision(p, 0, 3, [
    { minX: -1, maxX: 1, minZ: 1, maxZ: 1.2, disabled: true },
  ]);
  assert.ok(Math.abs(p.z - 3) < 1e-10);
});
test("contact keeps submillimeter clearance instead of discarding a whole movement step", () => {
  const p = { x: 0, z: 0 };
  moveWithCollision(p, 2, 0, [{ minX: 1, maxX: 1.12, minZ: -2, maxZ: 2 }]);
  assert.ok(p.x <= 0.78 && p.x > 0.7799, `contact x=${p.x}`);
});
test("a shoulder caught by restored geometry can move out immediately without moving deeper inside", () => {
  const wall = { minX: 1, maxX: 1.12, minZ: -2, maxZ: 2 };
  const p = { x: 0.80, z: 0 };
  assert.ok(overlaps(p.x, p.z, wall));
  moveWithCollision(p, 0.01, 0, [wall]);
  assert.equal(p.x, 0.80, "further penetration is blocked");
  moveWithCollision(p, -0.01, 0.02, [wall]);
  assert.ok(p.x < 0.8 && p.z > 0, "held outward movement recovers in its first frame");
  moveWithCollision(p, -0.05, 0, [wall]);
  assert.ok(!overlaps(p.x, p.z, wall));
});
