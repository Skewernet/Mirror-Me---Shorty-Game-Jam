import test from "node:test";
import assert from "node:assert/strict";
import { Story } from "../src/story.mjs";
function lap(s) {
  s.traverse(3.5, -4);
  return s.traverse(3.5, 6.6);
}
function firstPass(s) {
  s.interact("telephone");
  s.interact("fuse");
  s.interact("panel");
  s.observe(1.4, true, true, 1.6);
  assert.equal(lap(s), "pass-1");
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
  assert.equal(lap(s), "pass-2");
  s.interact("bath-clue");
  s.setClock(3, 17);
  s.interact("telephone");
  assert.equal(lap(s), "pass-3");
}
test("first pass requires exploration, power and a believable reflection", () => {
  const s = new Story();
  assert.equal(lap(s), "incomplete-pass");
  s.observe(1.5, true, true);
  assert.equal(lap(s), "incomplete-pass");
  s.interact("telephone");
  assert.equal(lap(s), "incomplete-pass");
  assert.equal(s.interact("panel"), "panel-empty");
  s.interact("fuse");
  assert.equal(s.interact("panel"), "power");
  assert.equal(lap(s), "pass-1");
});
test("revisiting the southern threshold cannot farm a pass", () => {
  const s = new Story();
  firstPass(s);
  const n = s.laps;
  for (let i = 0; i < 20; i++) s.traverse(3.5, 7);
  assert.equal(s.laps, n);
  assert.equal(s.stage, 1);
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
test("bedroom stays locked until the encounter key; key cannot open the exit", () => {
  const s = new Story();
  firstPass(s);
  assert.equal(s.interact("room-bedroom"), "bedroom-locked");
  assert.equal(s.interact("diary"), "bedroom-locked");
  bedroom(s);
  assert.equal(s.hasKey, true);
  assert.equal(s.hasDiary, true);
  assert.equal(s.interact("door"), "locked");
  assert.equal(s.doorOpen, false);
});
test("drawer opened before the scare recovers without losing the key", () => {
  const s = new Story();
  s.interact("drawer");
  firstPass(s);
  encounter(s);
  assert.equal(s.interact("drawer"), "key");
  assert.equal(s.hasKey, true);
});
test("the backward time clue and correct hour are both required", () => {
  const s = new Story();
  firstPass(s);
  bedroom(s);
  lap(s);
  assert.equal(s.setClock(3, 17), "clock-set");
  assert.equal(s.clockSolved, false);
  assert.equal(s.interact("bath-clue"), "time-clue");
  assert.equal(s.clockSolved, true);
  assert.equal(s.ready(), false);
  assert.equal(s.interact("telephone"), "call");
  assert.equal(s.ready(), true);
});
test("invalid clock values do not corrupt the current hands", () => {
  const s = new Story();
  const before = [s.clockHour, s.clockMinute];
  assert.equal(s.setClock("abc", 17), "invalid-time");
  assert.deepEqual([s.clockHour, s.clockMinute], before);
  assert.equal(s.setClock(3, 99), "invalid-time");
  assert.deepEqual([s.clockHour, s.clockMinute], before);
});
test("wrong silence order restarts the three sounds; correct reverse order unlocks the next pass", () => {
  const s = new Story();
  toInversion(s);
  assert.equal(s.interact("radio"), "wrong-order");
  assert.equal(s.interact("musicbox"), "echo-silenced");
  assert.equal(s.interact("radio"), "wrong-order");
  assert.equal(s.echoIndex, 0);
  assert.equal(s.interact("musicbox"), "echo-silenced");
  assert.equal(s.interact("musicbox"), "already-quiet");
  assert.equal(s.interact("tap"), "echo-silenced");
  assert.equal(s.interact("radio"), "house-quiet");
  assert.equal(lap(s), "pass-4");
});
test("finale requires facing the occupant and deliberately leaving its instruction", () => {
  const s = new Story();
  s.stage = 4;
  s.observe(3, false, false, 4, true);
  assert.equal(s.exitReleased, false);
  s.observe(0.5, true, true, 1.5, false);
  s.observe(3, false, true, 1.7, false);
  assert.equal(s.exitReleased, false);
  assert.deepEqual(s.observe(1.7, false, true, 3, true), ["released"]);
  assert.equal(s.interact("door"), "unlocked");
});
test("all five stages and ending can complete in one state-machine run", () => {
  const s = new Story();
  toInversion(s);
  for (const id of ["musicbox", "tap", "radio"]) s.interact(id);
  lap(s);
  s.observe(0.2, true, true, 1.5);
  s.observe(1.7, false, false, 3, true);
  s.interact("door");
  assert.equal(s.stage, 4);
  assert.equal(s.doorOpen, true);
  assert.equal(s.laps, 4);
  assert.equal(s.visited.length, 0);
});
test("restart restores all objects, doors, clues and final conditions", () => {
  const s = new Story();
  toInversion(s);
  s.visit("kitchen");
  s.interact("room-lounge");
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
  s.interact("musicbox");
  s.interact("tap");
  assert.equal(s.interact("telephone"), "telephone-dead");
  assert.equal(s.echoIndex, 2);
  assert.equal(s.interact("radio"), "house-quiet");
});
