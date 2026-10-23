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
