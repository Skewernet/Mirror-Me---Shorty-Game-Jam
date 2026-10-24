import test from "node:test";
import assert from "node:assert/strict";
import { FuneralAttack } from "../src/funeral-attack.mjs";
import { overlaps } from "../src/physics.mjs";

const bounds = { minX: -2.7, maxX: 2.7, minZ: 7.56, maxZ: 12.4 };
const player = { x: 0, z: 9.6, yaw: Math.PI, pitch: -.1 };

test("funeral attack is hidden until triggered, turns before lunging and ends once", () => {
  const attack = new FuneralAttack(bounds);
  assert.equal(attack.update(100).active, false);
  assert.equal(attack.begin(100, player), true);
  assert.equal(attack.begin(100.1, player), false);
  const turn = attack.update(100.3);
  assert.equal(turn.phase, "turn");
  assert.equal(turn.lunge, 0);
  const lunge = attack.update(101);
  assert.equal(lunge.phase, "lunge");
  assert.ok(Math.hypot(lunge.x - player.x, lunge.z - player.z) < 2);
  assert.equal(lunge.fade, 0);
  assert.ok(attack.update(101.7).fade > .3);
  assert.equal(attack.update(102).done, true);
});

test("funeral attack pause preserves pose and reset cancels camera control", () => {
  const attack = new FuneralAttack(bounds);
  attack.begin(3, player);
  assert.deepEqual(attack.update(3.9), attack.update(3.9));
  attack.reset();
  assert.equal(attack.update(30).active, false);
  assert.equal(attack.update(30).fade, 0);
  assert.equal(attack.begin(31, player), true);
});

test("funeral lunge finds a clear path when a wall or chair blocks directly behind", () => {
  const chair = { minX: -.4, maxX: .4, minZ: 8, maxZ: 9.1 };
  const attack = new FuneralAttack(bounds, [chair]);
  attack.begin(0, player);
  assert.equal(attack.enabled, true);
  for (let t = 0; t < 2; t += 1 / 120) {
    const state = attack.update(t);
    assert.equal(overlaps(state.x, state.z, chair, .23), false);
    assert.ok(state.x > bounds.minX + .23 && state.x < bounds.maxX - .23);
    assert.ok(state.z > bounds.minZ + .23 && state.z < bounds.maxZ - .23);
  }
});

test("disabled sudden scares uses a finite quiet fade without forced camera or attacker", () => {
  const attack = new FuneralAttack(bounds);
  attack.begin(0, player, { enabled: false });
  const state = attack.update(.7);
  assert.equal(state.enabled, false);
  assert.equal(state.yaw, undefined);
  assert.ok(state.fade > 0 && state.fade < 1);
  assert.equal(attack.update(1.31).done, true);
});

test("turning scares off during a paused attack cancels the turn and completes a quiet fade", () => {
  const attack = new FuneralAttack(bounds);
  attack.begin(0, player);
  attack.update(.9);
  assert.equal(attack.reduce(.9), true);
  const paused = attack.update(.9);
  assert.equal(paused.enabled, false);
  assert.equal(paused.yaw, undefined);
  assert.equal(paused.phase, "quiet-fade");
  assert.deepEqual(attack.update(.9), paused);
  assert.equal(attack.update(2.01).done, true);
});
