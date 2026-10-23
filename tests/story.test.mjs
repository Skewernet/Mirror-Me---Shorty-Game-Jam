import test from "node:test";
import assert from "node:assert/strict";
import { Story } from "../src/story.mjs";
function lap(s) {
  s.traverse(3.5, -2);
  return s.traverse(3.5, 4);
}
function encounter(s) {
  s.observe(1.1, true, true);
  lap(s);
  s.observe(1.7, true, true);
  s.observe(0.1, false, true);
  s.observe(1.1, true, true);
}
test("loops cannot skip the first believable reflection", () => {
  const s = new Story();
  assert.equal(lap(s), "missed-mirror");
  assert.equal(s.stage, 0);
  s.observe(1.1, true, true);
  assert.equal(lap(s), "second-pass");
  assert.equal(s.stage, 1);
});
test("held reflection requires observation, looking away, and looking back", () => {
  const s = new Story();
  s.stage = 1;
  s.observe(2, false, true);
  assert.equal(s.frozen, false);
  s.observe(1.7, true, true);
  s.observe(0.1, false, false);
  assert.equal(s.frozen, false);
  assert.deepEqual(s.observe(0.1, false, true), ["held"]);
  assert.equal(s.keyAvailable, false);
  assert.deepEqual(s.observe(1.1, true, true), ["returned"]);
  assert.equal(s.keyAvailable, true);
});
test("loop threshold cannot repeatedly advance without another circuit", () => {
  const s = new Story();
  s.firstSeen = 2;
  lap(s);
  const laps = s.laps;
  for (let i = 0; i < 30; i++) s.traverse(3.5, 4);
  assert.equal(s.laps, laps);
  assert.equal(s.stage, 1);
});
test("drawer and door cannot bypass the encounter; opening early cannot softlock", () => {
  const s = new Story();
  assert.equal(s.interact("door"), "locked");
  assert.equal(s.interact("drawer"), "drawer-open");
  assert.equal(s.interact("drawer"), "drawer-close");
  assert.equal(s.hasKey, false);
  encounter(s);
  assert.equal(s.interact("drawer"), "drawer-open");
  assert.equal(s.interact("drawer"), "key");
  assert.equal(s.interact("door"), "unlocked");
  assert.equal(s.doorOpen, true);
});
test("restart resets every progression field, including early interactions", () => {
  const s = new Story();
  s.interact("note");
  encounter(s);
  s.interact("drawer");
  s.interact("drawer");
  s.interact("door");
  s.reset();
  assert.deepEqual(s, new Story());
});
