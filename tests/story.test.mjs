import test from "node:test";
import assert from "node:assert/strict";
import { Story } from "../src/story.mjs";
import { atBackThreshold, inHall } from "../src/layout.mjs";

function leave(s) {
  if (!s.doorOpen) s.interact("door");
  assert.equal(s.doorOpen, true);
  return s.crossBackDoor();
}
function restorePower(s) {
  s.interact("telephone");
  s.interact("fuse");
  s.interact("panel");
}
function firstPass(s) {
  restorePower(s);
  s.observe(1.4, true, true, 1.6);
  assert.equal(leave(s), "pass-1");
}
function encounter(s) {
  s.observe(2.2, true, true, 1.6);
  s.observe(0.1, false, true, 1.6);
  s.observe(1.4, true, true, 1.6);
}
function bedroom(s) {
  encounter(s);
  s.interact("drawer");
  s.interact("drawer");
  s.interact("room-bedroom");
  s.interact("diary");
}
function toInversion(s) {
  firstPass(s);
  bedroom(s);
  assert.equal(leave(s), "pass-2");
  s.interact("bath-clue");
  s.setClock(3, 17);
  s.interact("telephone");
  assert.equal(leave(s), "pass-3");
}

test("a closed rear door cannot consume a loop or advance the house", () => {
  const s = new Story();
  restorePower(s);
  s.observe(1.5, true, true);
  assert.equal(s.crossBackDoor(), null);
  assert.equal(s.stage, 0);
  assert.equal(s.laps, 0);
});
test("leaving early returns to the same pass and retains discoveries", () => {
  const s = new Story();
  s.interact("letter");
  s.interact("fuse");
  s.interact("room-lounge");
  assert.equal(leave(s), "incomplete-pass");
  assert.equal(s.stage, 0);
  assert.equal(s.laps, 1);
  assert.equal(s.doorOpen, false);
  assert.equal(s.hasLetter, true);
  assert.equal(s.hasFuse, true);
  assert.equal(s.doors.lounge, true);
});
test("walking around the house never substitutes for crossing the rear door", () => {
  const s = new Story();
  restorePower(s);
  s.observe(1.5, true, true);
  for (const [x, z] of [
    [0, 6.7],
    [0, 0],
    [7.4, 0],
    [3.5, -4],
    [3.5, 7],
    [7.4, 1.8],
  ]) {
    assert.equal(s.traverse(x, z), null);
  }
  assert.equal(s.stage, 0);
  assert.equal(s.laps, 0);
  assert.equal(leave(s), "pass-1");
});
test("rear threshold is bounded to the porch and the corridor is one L", () => {
  assert.equal(atBackThreshold(7.4, 1.7), true);
  assert.equal(atBackThreshold(7.4, 1.5), false);
  assert.equal(atBackThreshold(5, 2), false);
  assert.equal(atBackThreshold(9, 2), false);
  assert.equal(inHall(0, 6), true);
  assert.equal(inHall(6, 0), true);
  assert.equal(inHall(3.5, 6), false);
  assert.equal(inHall(3.5, -3), false);
});
test("first pass requires the call, restored power and normal reflection", () => {
  const s = new Story();
  assert.equal(leave(s), "incomplete-pass");
  s.observe(1.5, true, true);
  assert.equal(leave(s), "incomplete-pass");
  s.interact("telephone");
  assert.equal(leave(s), "incomplete-pass");
  assert.equal(s.interact("panel"), "panel-empty");
  s.interact("fuse");
  assert.equal(s.interact("panel"), "power");
  assert.equal(leave(s), "pass-1");
  assert.equal(s.doorOpen, false);
  assert.equal(
    s.crossBackDoor(),
    null,
    "A single crossing cannot be consumed twice",
  );
});
test("normal wandering cannot freeze the reflection without sustained attention", () => {
  const s = new Story();
  s.stage = 1;
  s.observe(4, false, true);
  assert.equal(s.frozen, false);
  s.observe(2.2, true, true);
  s.observe(0.2, false, false);
  assert.equal(s.frozen, false);
  assert.deepEqual(s.observe(0.1, false, true), ["held"]);
  assert.equal(s.keyAvailable, false);
  assert.deepEqual(s.observe(1.4, true, true), ["returned"]);
  assert.equal(s.keyAvailable, true);
});
test("bedroom key unlocks the bedroom while the front door remains closed", () => {
  const s = new Story();
  firstPass(s);
  assert.equal(s.interact("room-bedroom"), "bedroom-locked");
  assert.equal(s.interact("diary"), "bedroom-locked");
  bedroom(s);
  assert.equal(s.hasKey, true);
  assert.equal(s.hasDiary, true);
  assert.equal(s.interact("front-door"), "front-locked");
  assert.equal(s.doorOpen, false);
});
test("drawer opened before the encounter recovers without losing its key", () => {
  const s = new Story();
  s.interact("drawer");
  firstPass(s);
  encounter(s);
  assert.equal(s.interact("drawer"), "key");
  assert.equal(s.hasKey, true);
});
test("an early correct clock setting recovers when its reflected clue is found", () => {
  const s = new Story();
  firstPass(s);
  bedroom(s);
  leave(s);
  assert.equal(s.setClock(3, 17), "clock-set");
  assert.equal(s.clockSolved, false);
  assert.equal(s.interact("bath-clue"), "time-clue");
  assert.equal(s.clockSolved, true);
  assert.equal(s.ready(), false);
  assert.equal(s.interact("telephone"), "call");
  assert.equal(s.ready(), true);
});
test("invalid clock values preserve the existing hands", () => {
  const s = new Story();
  const before = [s.clockHour, s.clockMinute];
  for (const [h, m] of [
    ["abc", 17],
    [3, 99],
    [0, 17],
    [13, 17],
    [3, -1],
    [3.5, 17],
  ]) {
    assert.equal(s.setClock(h, m), "invalid-time");
    assert.deepEqual([s.clockHour, s.clockMinute], before);
  }
});
test("wrong silence order recovers and checking the phone retains partial progress", () => {
  const s = new Story();
  toInversion(s);
  assert.equal(s.interact("radio"), "wrong-order");
  assert.equal(s.interact("musicbox"), "echo-silenced");
  assert.equal(s.interact("radio"), "wrong-order");
  assert.equal(s.echoIndex, 0);
  assert.equal(s.interact("musicbox"), "echo-silenced");
  assert.equal(s.interact("musicbox"), "already-quiet");
  assert.equal(s.interact("tap"), "echo-silenced");
  assert.equal(s.interact("telephone"), "telephone-dead");
  assert.equal(s.echoIndex, 2);
  assert.equal(s.interact("radio"), "house-quiet");
  assert.equal(leave(s), "pass-4");
});
test("premature final exit loops instead of bypassing the refusal", () => {
  const s = new Story();
  s.stage = 4;
  assert.equal(leave(s), "incomplete-pass");
  assert.equal(s.stage, 4);
  assert.equal(s.exitReleased, false);
  assert.equal(s.doorOpen, false);
  assert.equal(s.laps, 1);
});
test("rechecking the three sound sources cannot break the final silence", () => {
  const s = new Story();
  toInversion(s);
  for (const id of ["musicbox", "tap", "radio"]) s.interact(id);
  assert.equal(leave(s), "pass-4");
  const radioState = s.radioOn;
  for (const id of ["musicbox", "tap", "radio"]) {
    assert.equal(s.interact(id), "already-quiet");
    assert.equal(s.echoIndex, 3);
    assert.equal(s.radioOn, radioState);
  }
});
test("finale requires facing the occupant and deliberately walking away", () => {
  const s = new Story();
  s.stage = 4;
  s.observe(3, false, false, 4, true);
  assert.equal(s.exitReleased, false);
  s.observe(0.5, true, true, 1.5, false);
  s.observe(3, false, true, 1.7, false);
  assert.equal(s.exitReleased, false);
  assert.deepEqual(s.observe(1.7, false, true, 3, true), ["released"]);
  assert.equal(s.interact("front-door"), "front-locked");
  assert.equal(leave(s), "ending");
  assert.equal(s.doorOpen, true);
});
test("all five passes complete through explicit rear-door crossings", () => {
  const s = new Story();
  toInversion(s);
  for (const id of ["musicbox", "tap", "radio"]) s.interact(id);
  assert.equal(leave(s), "pass-4");
  s.observe(0.2, true, true, 1.5);
  s.observe(1.7, false, false, 3, true);
  assert.equal(leave(s), "ending");
  assert.equal(s.stage, 4);
  assert.equal(s.laps, 4);
});
test("restart restores items, doors, loop state, sound order and final conditions", () => {
  const s = new Story();
  toInversion(s);
  s.visit("kitchen");
  s.interact("room-lounge");
  s.interact("letter");
  s.echoIndex = 3;
  s.exitReleased = true;
  s.doorOpen = true;
  s.reset();
  assert.deepEqual(s, new Story());
});
test("telephone calls and kitchen radio have independent state", () => {
  const s = new Story();
  assert.equal(s.interact("radio"), "radio-no-power");
  assert.equal(s.heardArrival, false);
  s.power = true;
  assert.equal(s.interact("radio"), "radio-off");
  assert.equal(s.heardArrival, false);
  assert.equal(s.interact("telephone"), "arrival-recording");
  assert.equal(s.radioOn, false);
  s.stage = 2;
  s.clockSolved = true;
  assert.equal(s.interact("radio"), "radio-on");
  assert.equal(s.heardCall, false);
  assert.equal(s.interact("telephone"), "call");
  s.stage = 3;
  assert.equal(s.interact("telephone"), "telephone-dead");
  assert.equal(s.echoIndex, 0);
});
