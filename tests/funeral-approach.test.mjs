import test from "node:test";
import assert from "node:assert/strict";
import {
  FuneralApproach, FUNERAL_APPROACH_TIMING as TIMING,
  FUNERAL_CASKET_STAND as STAND, FUNERAL_CASKET_FOCUS as FOCUS,
} from "../src/funeral-approach.mjs";
import { overlaps } from "../src/physics.mjs";

const bounds = { minX: -4, maxX: 4, minZ: 7.56, maxZ: 17.2 };
const player = { x: .18, z: 8.36, yaw: Math.PI, pitch: -.08 };

test("funeral approach preserves entry pose, surveys before moving, then holds the casket", () => {
  const approach = new FuneralApproach(bounds);
  assert.equal(approach.update(10).active, false);
  assert.equal(approach.begin(10, player), true);
  assert.equal(approach.begin(11, player), false);
  const start = approach.update(10);
  for (const key of ["x", "z", "yaw", "pitch"]) assert.equal(start[key], player[key]);
  for (const age of [1, 2.4, 4, 5.9]) {
    const state = approach.update(10 + age);
    assert.equal(state.phase, "survey");
    assert.equal(state.x, player.x); assert.equal(state.z, player.z);
    assert.equal(state.speed, 0);
  }
  assert.notEqual(approach.update(12.4).yaw, approach.update(15).yaw);
  const walking = approach.update(22);
  assert.equal(walking.phase, "approach");
  assert.ok(walking.z > player.z && walking.z < STAND.z);
  const hold = approach.update(10 + TIMING.arrive);
  assert.equal(hold.phase, "hold"); assert.equal(hold.holding, true);
  assert.equal(hold.x, STAND.x); assert.equal(hold.z, STAND.z);
  assert.equal(hold.speed, 0);
  assert.deepEqual(approach.update(1000), hold, "The entire uncut report can finish at the casket");
  assert.ok(hold.pitch < -.3 && hold.pitch > -.7);
  const expectedYaw = Math.atan2(-(FOCUS.x - hold.x), -(FOCUS.z - hold.z));
  assert.ok(Math.abs(Math.atan2(Math.sin(hold.yaw - expectedYaw), Math.cos(hold.yaw - expectedYaw))) < 1e-9);
});

test("funeral approach has smooth bounded travel and no yaw wrap jump", () => {
  const approach = new FuneralApproach(bounds);
  approach.begin(0, player);
  let previous = approach.update(0), maxSpeed = 0, maxTurn = 0;
  for (let time = 1 / 240; time < 25; time += 1 / 240) {
    const state = approach.update(time);
    const step = Math.hypot(state.x - previous.x, state.z - previous.z) * 240;
    maxSpeed = Math.max(maxSpeed, step);
    maxTurn = Math.max(maxTurn, Math.abs(state.yaw - previous.yaw) * 240);
    assert.ok(state.routeSafe);
    previous = state;
  }
  assert.ok(maxSpeed < .78, `Slow, even funeral walk: ${maxSpeed} m/s`);
  assert.ok(maxTurn < .9, `No sudden camera reversal: ${maxTurn} rad/s`);
});

test("funeral approach is simulation-clock stable and releases exclusively to the strike", () => {
  const approach = new FuneralApproach(bounds);
  approach.begin(30, player);
  assert.deepEqual(approach.update(42.2), approach.update(42.2));
  assert.equal(approach.release(), true);
  assert.equal(approach.release(), false);
  assert.equal(approach.update(100).active, false);
  assert.equal(approach.update(100).yaw, undefined);
  approach.reset();
  assert.equal(approach.update(100).phase, "idle");
  assert.equal(approach.begin(101, player), true);
  assert.equal(approach.update(101).z, player.z);
});

test("unexpected furniture on the route prevents scripted movement instead of clipping", () => {
  const obstacle = { minX: -.35, maxX: .5, minZ: 11.2, maxZ: 11.8 };
  const approach = new FuneralApproach(bounds, [obstacle]);
  approach.begin(0, player);
  for (let time = 0; time <= 30; time += .1) {
    const state = approach.update(time);
    assert.equal(state.routeSafe, false);
    assert.equal(state.x, player.x); assert.equal(state.z, player.z);
    assert.equal(overlaps(state.x, state.z, obstacle), false);
  }
  assert.equal(approach.update(30).holding, true, "Fallback cannot hold the report or ending open");
});
