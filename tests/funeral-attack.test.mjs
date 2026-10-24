import test from "node:test";
import assert from "node:assert/strict";
import { FuneralAttack, FUNERAL_ATTACK_DISTANCE, FUNERAL_ATTACK_TIMING } from "../src/funeral-attack.mjs";
import { overlaps } from "../src/physics.mjs";

const bounds = { minX: -2.7, maxX: 2.7, minZ: 7.56, maxZ: 12.4 };
const player = { x: 0, z: 9.6, yaw: Math.PI, pitch: -.1 };

test("funeral attack is hidden until triggered, turns before lunging and ends once", () => {
  const attack = new FuneralAttack(bounds);
  assert.equal(attack.update(100).active, false);
  assert.equal(attack.begin(100, player), true);
  assert.equal(attack.begin(100.1, player), false);
  const turn = attack.update(100.1);
  assert.equal(turn.phase, "turn");
  assert.equal(turn.lunge, 0);
  const lunge = attack.update(100.29);
  assert.equal(lunge.phase, "lunge");
  assert.ok(Math.hypot(lunge.x - player.x, lunge.z - player.z) < 2);
  assert.equal(lunge.fade, 0);
  assert.ok(attack.update(100.53).fade > .3);
  assert.equal(attack.update(100.69).done, true);
  assert.equal(attack.begin(101, player), false);
});

test("the strike lands within 380 milliseconds and reaches black within 680 milliseconds", () => {
  const attack = new FuneralAttack(bounds);
  attack.begin(0, player);
  const beforeLunge = attack.update(FUNERAL_ATTACK_TIMING.turn - .001);
  assert.equal(beforeLunge.phase, "turn");
  assert.equal(beforeLunge.lunge, 0);
  assert.equal(beforeLunge.strike, false);
  const lunge = attack.update(FUNERAL_ATTACK_TIMING.turn);
  assert.equal(lunge.phase, "lunge");
  assert.equal(lunge.fade, 0);
  const beforeStrike = attack.update(.379);
  assert.equal(beforeStrike.phase, "lunge");
  assert.equal(beforeStrike.strike, false);
  const impact = attack.update(.38);
  assert.equal(impact.phase, "impact");
  assert.equal(impact.strike, true);
  assert.equal(impact.strikeAt, .38);
  assert.ok(Math.abs(Math.hypot(impact.x - player.x, impact.z - player.z) - FUNERAL_ATTACK_DISTANCE) < 1e-9);
  const complete = attack.update(FUNERAL_ATTACK_TIMING.total);
  assert.equal(complete.phase, "done");
  assert.equal(complete.done, true);
  assert.equal(complete.active, false);
  assert.equal(complete.fade, 1);
});

test("the mother meets the player's current eye line without pitching down toward her", () => {
  const attack = new FuneralAttack(bounds);
  attack.begin(0, { ...player, camera: { position: { y: 1.68 } } });
  const halfway = attack.update(.1);
  assert.ok(halfway.pitch > player.pitch && halfway.pitch < 0);
  const impact = attack.update(.38);
  assert.ok(Math.abs(impact.pitch) < 1e-9);
  assert.equal(impact.eyeHeight, 1.68);
});

test("funeral attack pause preserves pose and reset cancels camera control", () => {
  const attack = new FuneralAttack(bounds);
  attack.begin(3, player);
  assert.deepEqual(attack.update(3.29), attack.update(3.29));
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
  attack.update(.29);
  assert.equal(attack.reduce(.29), true);
  const paused = attack.update(.29);
  assert.equal(paused.enabled, false);
  assert.equal(paused.yaw, undefined);
  assert.equal(paused.phase, "quiet-fade");
  assert.deepEqual(attack.update(.29), paused);
  assert.equal(attack.update(1.40).done, true);
});

test("reducing scares cannot restart a strike which has already finished", () => {
  const attack = new FuneralAttack(bounds);
  attack.begin(0, player);
  // Exercise a delayed settings event without an intervening animation update.
  assert.equal(attack.reduce(1), false);
  assert.equal(attack.update(1).done, true);
  assert.equal(attack.update(1).fade, 1);
});
