import test from "node:test";
import assert from "node:assert/strict";
import {
  LookInput,
  LOOK_RADIANS_PER_PIXEL,
  MAX_LOOK_FRAME_ANGLE,
  MAX_LOOK_RATE,
} from "../src/look-input.mjs";

const packet = (x, y, timeStamp) => ({ movementX: x, movementY: y, timeStamp });
const enqueue = (input, x, y, time, now = time) => input.enqueue(packet(x, y, time), now);
const angle = (motion, sensitivity = 1) => motion
  ? Math.hypot(motion.x, motion.y) * LOOK_RADIANS_PER_PIXEL * sensitivity : 0;
const near = (a, b, label = "values differ") => assert.ok(Math.abs(a - b) < 1e-9, `${label}: ${a} vs ${b}`);
const bounded = (motion, dt = 1 / 60, sensitivity = 1) => {
  assert.ok(angle(motion, sensitivity) <= Math.min(MAX_LOOK_FRAME_ANGLE, MAX_LOOK_RATE * Math.min(dt, .05)) + 1e-9,
    `One rendered frame turned ${angle(motion, sensitivity)} radians`);
};

test("ordinary input is summed once per frame with exact horizontal and diagonal counts", () => {
  const input = new LookInput();
  enqueue(input, 12, -7, 10);
  enqueue(input, -3, 2, 18);
  assert.deepEqual(input.consume(1 / 60, 1), { x: 9, y: -5 });
  assert.equal(input.consume(1 / 60, 1), null, "Events cannot be applied twice");
});

test("the published coherent-large-packet failure cannot apply a half turn in one frame", () => {
  const input = new LookInput();
  enqueue(input, 1000, 0, 10);
  enqueue(input, 1000, 0, 18);
  const motion = input.consume(1 / 60, 1);
  assert.ok(motion === null || motion.x > 0, "A discarded burst must not reverse the look direction");
  bounded(motion);
  assert.ok(angle(motion) < Math.PI / 4, "Formerly accepted 206-degree spin must be impossible");
  assert.equal(input.consume(1 / 60, 1), null, "Dropped excess cannot become a delayed spin");
});

test("two individually sub-90-degree packets share one frame budget", () => {
  const input = new LookInput();
  enqueue(input, 850, 0, 10);
  enqueue(input, 850, 0, 18);
  const motion = input.consume(1 / 60, 1);
  bounded(motion);
  assert.ok(angle(motion) < Math.PI / 4, "Formerly accepted 175-degree frame turn must be impossible");
  assert.equal(input.consume(), null);
});

test("same-timestamp ordinary packet bursts cannot evade the total frame budget", () => {
  const input = new LookInput();
  for (let i = 0; i < 10; i++) enqueue(input, 200, 0, 10);
  bounded(input.consume(1 / 60, 1));
  for (let frame = 0; frame < 10; frame++) assert.equal(input.consume(), null);
});

test("a queue delivered after a short doorway stall drains without catch-up rotation", () => {
  const input = new LookInput();
  for (let i = 0; i < 10; i++) enqueue(input, 200, 0, 10 + i * 8, 90);
  const motion = input.consume(.2, 1);
  bounded(motion, .2);
  assert.ok(angle(motion) <= MAX_LOOK_FRAME_ANGLE + 1e-9);
  for (let frame = 0; frame < 10; frame++) assert.equal(input.consume(1 / 60, 1), null);
});

test("stale queued mouse movement is dropped rather than delivered after a long stall", () => {
  const input = new LookInput();
  enqueue(input, 2000, 0, 10, 250);
  assert.equal(input.consume(), null);
  enqueue(input, 4, -2, 251, 251);
  assert.deepEqual(input.consume(), { x: 4, y: -2 });
});

test("a deliberate fast half turn across rendered frames remains controllable and exact", () => {
  const input = new LookInput();
  let total = 0;
  for (let frame = 0; frame < 14; frame++) {
    enqueue(input, 125, 0, 10 + frame * (1000 / 60));
    const motion = input.consume(1 / 60, 1);
    bounded(motion);
    total += motion.x;
  }
  near(total, 1750, "Normal fast flick lost displacement");
  assert.ok(total * LOOK_RADIANS_PER_PIXEL > Math.PI);
  assert.equal(input.consume(), null);
});

test("high-DPI input at a low configured sensitivity preserves intended small turns", () => {
  const input = new LookInput();
  enqueue(input, 1000, 0, 10);
  assert.deepEqual(input.consume(1 / 60, .1), { x: 1000, y: 0 });
  enqueue(input, 1000, 0, 26);
  const limited = input.consume(1 / 60, 2);
  bounded(limited, 1 / 60, 2);
  assert.equal(input.consume(1 / 60, 2), null);
});

test("diagonal bursts are limited as one angular vector rather than two independent axes", () => {
  const input = new LookInput();
  enqueue(input, 300, -150, 10);
  const motion = input.consume(1 / 60, 1);
  bounded(motion);
  near(motion.x / motion.y, -2, "Clamping changed the look direction");
  assert.equal(input.consume(), null);
});

test("high refresh rate frames enforce the elapsed-time turn budget", () => {
  const input = new LookInput();
  enqueue(input, 200, 0, 10);
  const dt = 1 / 240;
  const motion = input.consume(dt, 1);
  bounded(motion, dt);
  near(angle(motion), MAX_LOOK_RATE * dt, "Rate limit changed with a 240 Hz frame");
});

test("reciprocal cursor-recentering packets cancel before any camera turn is applied", () => {
  const input = new LookInput();
  enqueue(input, 1745, 0, 10);
  enqueue(input, -1745, 0, 18);
  near(angle(input.consume()), 0);
  enqueue(input, 1745, 0, 26);
  enqueue(input, -1741, 3, 34);
  assert.deepEqual(input.consume(), { x: 4, y: 3 });
});

test("capture reset clears queued motion and rejects packets predating the new capture", () => {
  const input = new LookInput();
  enqueue(input, 2000, 0, 10);
  input.reset(500);
  assert.equal(input.consume(), null);
  enqueue(input, 1745, 0, 450, 501);
  assert.equal(input.consume(), null);
  enqueue(input, 5, -3, 502, 502);
  assert.deepEqual(input.consume(), { x: 5, y: -3 });
});

test("non-finite and reordered packets cannot corrupt the next valid mouse frame", () => {
  const input = new LookInput();
  enqueue(input, 2, 3, 10);
  enqueue(input, 100, 100, 9, 10);
  enqueue(input, NaN, 2, 18);
  enqueue(input, 4, Infinity, 26);
  enqueue(input, 4, 1, NaN, 30);
  assert.deepEqual(input.consume(), { x: 2, y: 3 });
  enqueue(input, 6, -2, 34);
  assert.deepEqual(input.consume(), { x: 6, y: -2 });
});

test("diagnostics record discarded input and limited frames without retaining a motion tail", () => {
  const input = new LookInput();
  enqueue(input, 2000, 0, 10);
  input.consume();
  enqueue(input, NaN, 0, 18);
  const state = input.snapshot();
  assert.ok(state.clampedFrames >= 1);
  assert.ok(state.discarded >= 1);
  assert.equal(Boolean(state.pending), false);
  assert.equal(input.consume(), null);
});

test("invalid frame timing or sensitivity drains rather than storing a future turn", () => {
  for (const [dt, sensitivity] of [[NaN, 1], [0, 1], [-1, 1], [1 / 60, Infinity], [1 / 60, 0]]) {
    const input = new LookInput();
    enqueue(input, 100, 50, 10);
    assert.equal(input.consume(dt, sensitivity), null);
    assert.equal(input.consume(), null);
    enqueue(input, 3, -2, 18);
    assert.deepEqual(input.consume(), { x: 3, y: -2 });
  }
});
