import test from "node:test";
import assert from "node:assert/strict";
import { LookInput } from "../src/look-input.mjs";

const packet = (x, y, timeStamp) => ({ movementX: x, movementY: y, timeStamp });
const total = (values) => values.filter(Boolean).reduce((sum, value) => ({
  x: sum.x + value.x, y: sum.y + value.y,
}), { x: 0, y: 0 });

test("ordinary horizontal and diagonal mouse input keeps its exact displacement", () => {
  const input = new LookInput();
  assert.deepEqual(input.read(packet(12, -7, 10)), { x: 12, y: -7 });
  assert.deepEqual(input.read(packet(-18, 11, 18)), { x: -18, y: 11 });
  assert.deepEqual(input.read(packet(0, 0, 26)), { x: 0, y: 0 });
});

test("a deliberate fast half turn delivered as a normal stream is never angle capped", () => {
  const input = new LookInput(), accepted = [];
  // 1750 counts at default sensitivity is slightly more than 180 degrees.
  for (let i = 0; i < 25; i++) accepted.push(input.read(packet(70, i % 2 ? 1 : -1, 10 + i * 4)));
  assert.deepEqual(total(accepted), { x: 1750, y: -1 });
});

test("a lone 180-degree packet cannot spin the camera before ordinary input resumes", () => {
  const input = new LookInput();
  assert.equal(input.read(packet(1745, 0, 10)), null);
  assert.deepEqual(input.read(packet(4, -2, 18)), { x: 4, y: -2 });
  assert.deepEqual(input.read(packet(5, 1, 26)), { x: 5, y: 1 });
});

test("corroborated high-DPI packets preserve every count instead of imposing a rate cap", () => {
  const input = new LookInput();
  const accepted = [10, 18, 26, 34].map(time => input.read(packet(1000, 0, time)));
  assert.equal(accepted[0], null);
  assert.deepEqual(total(accepted), { x: 4000, y: 0 });
});

test("reciprocal pointer recenter packets cancel without a frame of camera rotation", () => {
  const input = new LookInput();
  assert.equal(input.read(packet(1745, 0, 10)), null);
  assert.equal(input.read(packet(-1745, 0, 18)), null);
  assert.deepEqual(input.read(packet(6, 2, 26)), { x: 6, y: 2 });
});

test("a recenter pair retains its small real net motion", () => {
  const input = new LookInput();
  assert.equal(input.read(packet(1745, 0, 10)), null);
  assert.deepEqual(input.read(packet(-1741, 3, 18)), { x: 4, y: 3 });
});

test("a large reciprocal residual cannot become a second visible camera jerk", () => {
  const input = new LookInput();
  assert.equal(input.read(packet(1745, 0, 10)), null);
  assert.equal(input.read(packet(-1445, 0, 18)), null);
  assert.deepEqual(input.read(packet(4, 2, 26)), { x: 4, y: 2 });
});

test("reciprocal residual tolerance remains small at high sensitivity", () => {
  const input = new LookInput();
  assert.equal(input.read(packet(1745, 0, 10), 4), null);
  assert.equal(input.read(packet(-1735, 0, 18), 4), null);
  assert.deepEqual(input.read(packet(2, 1, 26), 4), { x: 2, y: 1 });
});

test("packet corroboration uses the player's configured sensitivity", () => {
  const slow = new LookInput(), fast = new LookInput();
  assert.deepEqual(slow.read(packet(1000, 0, 10), .2), { x: 1000, y: 0 });
  assert.equal(fast.read(packet(500, 0, 10), 2), null);
  assert.deepEqual(fast.read(packet(5, 0, 18), 2), { x: 5, y: 0 });
});

test("delayed large packets cannot corroborate an earlier cursor discontinuity", () => {
  const input = new LookInput();
  assert.equal(input.read(packet(1745, 0, 10)), null);
  assert.equal(input.read(packet(1745, 0, 80)), null);
  assert.deepEqual(input.read(packet(3, 1, 88)), { x: 3, y: 1 });
});

test("lock lifecycle reset discards a pending discontinuity and previous timestamp", () => {
  const input = new LookInput();
  assert.equal(input.read(packet(1745, 0, 100)), null);
  input.reset();
  assert.deepEqual(input.read(packet(5, -3, 10)), { x: 5, y: -3 });
});

test("a new lock rejects mouse packets queued before its acquisition", () => {
  const input = new LookInput();
  input.reset(500);
  assert.equal(input.read(packet(1745, 0, 450)), null);
  assert.deepEqual(input.read(packet(5, 2, 501)), { x: 5, y: 2 });
});

test("non-finite and stale input cannot corrupt the look state", () => {
  const input = new LookInput();
  assert.deepEqual(input.read(packet(2, 3, 10)), { x: 2, y: 3 });
  assert.equal(input.read(packet(4, 5, 9)), null);
  assert.equal(input.read(packet(NaN, 2, 18)), null);
  assert.equal(input.read(packet(4, Infinity, 26)), null);
  assert.deepEqual(input.read(packet(6, -2, 34)), { x: 6, y: -2 });
});
