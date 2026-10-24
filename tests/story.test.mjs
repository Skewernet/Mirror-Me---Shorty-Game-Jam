import test from "node:test";
import assert from "node:assert/strict";
import { Story, WRITINGS, VOICES } from "../src/story.mjs";
import { KEEPSAKE_ORDER, RADIO_SOLUTION } from "../src/chapters.mjs";
import { RADIUS } from "../src/physics.mjs";
import {
  atBackThreshold,
  atMirrorThreshold,
  atFrontThreshold,
  inHall,
  PORTAL,
  MIRROR,
} from "../src/layout.mjs";

function leave(s, chapter) {
  assert.equal(
    s.doorOpen,
    true,
    "Finishing the chapter opens the rear latch automatically",
  );
  assert.equal(s.crossBackDoor(), "pass-" + chapter);
  assert.equal(s.doorOpen, false);
}
function firstPass(s) {
  s.interact("telephone");
  s.interact("fuse");
  s.interact("panel");
  s.observe(1.4, true, true, 1.6);
  leave(s, 1);
}
function encounter(s) {
  s.observe(2.2, true, true, 1.6);
  s.observe(0.1, false, true, 1.6);
  s.observe(1.4, true, true, 1.6);
}
function secondPass(s) {
  s.interact("photo");
  encounter(s);
  s.interact("drawer");
  s.interact("drawer");
  s.interact("room-bedroom");
  s.interact("diary");
  leave(s, 2);
}
function thirdPass(s) {
  s.interact("bath-clue");
  s.setClock(3, 17);
  s.interact("station-clue");
  s.tuneRadio(RADIO_SOLUTION);
  s.interact("telephone");
  leave(s, 3);
}
function toKeepsakes(s) {
  firstPass(s);
  secondPass(s);
  thirdPass(s);
}
function fourthPass(s) {
  for (const { item, target } of KEEPSAKE_ORDER) {
    s.interact("keepsake-" + item);
    s.placeKeepsake(target, item);
  }
  leave(s, 4);
}
function fifthPass(s) {
  for (const id of ["musicbox", "tap", "radio"]) s.interact(id);
  leave(s, 5);
}

test("an unfinished chapter keeps the back door locked and cannot consume a pass", () => {
  const s = new Story();
  s.interact("letter");
  s.interact("fuse");
  assert.equal(s.interact("door"), "backdoor-locked");
  assert.equal(s.crossBackDoor(), null);
  s.interact("telephone");
  s.interact("panel");
  assert.equal(
    s.crossBackDoor(),
    null,
    "Power and the call are insufficient without the ordinary reflection",
  );
  assert.equal(s.laps, 0);
  assert.equal(s.stage, 0);
  assert.equal(s.hasLetter, true);
  assert.equal(s.power, true);
});
test("completing a chapter opens the latch once without duplicate interaction events", () => {
  const s = new Story();
  s.observe(1.4, true, true);
  s.interact("telephone");
  s.interact("fuse");
  assert.equal(s.interact("panel"), "power");
  assert.equal(s.doorOpen, true);
  assert.deepEqual(s.drainEvents(), ["backdoor-unlocked"]);
  assert.equal(s.interact("door"), "backdoor-open");
  assert.deepEqual(s.observe(0.1, true, true), []);
  assert.deepEqual(s.drainEvents(), []);
  leave(s, 1);
  assert.equal(
    s.crossBackDoor(),
    null,
    "A single crossing cannot be consumed twice",
  );
  assert.equal(s.laps, 1);
});
test("the latch event can be consumed by observation and never repeats", () => {
  const s = new Story();
  s.interact("telephone");
  s.interact("fuse");
  s.interact("panel");
  assert.deepEqual(s.observe(1.4, true, true), ["backdoor-unlocked"]);
  assert.deepEqual(s.observe(3, true, true), []);
  assert.deepEqual(s.drainEvents(), []);
});
test("walking the L never substitutes for physically crossing the rear door", () => {
  const s = new Story();
  s.interact("telephone");
  s.interact("fuse");
  s.interact("panel");
  s.observe(1.5, true, true);
  for (const [x, z] of [
    [0, 6.7],
    [0, 0],
    [7.4, 0],
    [7.4, 1.2],
    [3.5, -4],
  ])
    assert.equal(s.traverse(x, z), null);
  assert.equal(s.stage, 0);
  assert.equal(s.laps, 0);
  leave(s, 1);
});
test("rear, mirror and front crossing planes exclude neighboring rooms", () => {
  assert.equal(atBackThreshold(7.4, PORTAL.thresholdZ + 0.01), true);
  assert.equal(atBackThreshold(7.4, PORTAL.thresholdZ - 0.01), false);
  assert.equal(atBackThreshold(5, 2), false);
  assert.equal(atMirrorThreshold(MIRROR.x - RADIUS, 0), true);
  assert.equal(atMirrorThreshold(MIRROR.x - RADIUS - 0.01, 0), false);
  assert.equal(atMirrorThreshold(MIRROR.x + 0.1, 0.51), false);
  assert.equal(atFrontThreshold(0, 8.15), true);
  assert.equal(atFrontThreshold(0, 8.13), false);
  assert.equal(atFrontThreshold(0.5, 8.2), false);
  assert.equal(inHall(0, 6), true);
  assert.equal(inHall(6, 0), true);
  assert.equal(inHall(3.5, 6), false);
  assert.equal(inHall(3.5, -3), false);
});
test("the held reflection requires sustained attention and a nearby look away", () => {
  const s = new Story();
  firstPass(s);
  s.observe(4, false, true);
  assert.equal(s.frozen, false);
  s.observe(2.2, true, true);
  s.observe(0.2, false, false);
  assert.equal(s.frozen, false);
  assert.deepEqual(s.observe(0.1, false, true), ["held"]);
  assert.equal(s.keyAvailable, false);
  assert.deepEqual(s.observe(1.4, true, true), ["returned"]);
  assert.equal(s.keyAvailable, true);
  assert.equal(
    s.doorOpen,
    false,
    "The encounter alone does not replace reading the diary",
  );
});
test("the bedroom key and an early-opened drawer recover without opening the front door", () => {
  const s = new Story();
  s.interact("drawer");
  firstPass(s);
  assert.equal(s.interact("room-bedroom"), "bedroom-locked");
  assert.equal(s.interact("diary"), "bedroom-locked");
  encounter(s);
  assert.equal(s.interact("drawer"), "key");
  assert.equal(s.interact("room-bedroom"), "room-open");
  assert.equal(s.interact("diary"), "diary");
  assert.equal(s.doorOpen, false, "The crooked hall photograph is still unfinished");
  assert.equal(s.interact("photo"), "photo-straightened");
  assert.equal(s.doorOpen, true);
  assert.equal(s.interact("front-door"), "front-locked");
});
test("the crooked hall photograph is noticed once, straightened explicitly and reset", () => {
  const s = new Story();
  assert.equal(s.noticePhoto(), null);
  assert.equal(s.interact("photo"), "photo");
  assert.equal(s.photoStraightened, false);
  firstPass(s);
  assert.equal(s.photoNoticed, false, "A spatial return alone cannot speak about an unseen photograph");
  assert.equal(s.noticePhoto(), "photo-crooked");
  assert.equal(s.noticePhoto(), null);
  assert.equal(s.interact("photo"), "photo-straightened");
  assert.equal(s.photoStraightened, true);
  assert.equal(s.interact("photo"), "photo");
  assert.equal(s.noticePhoto(), null);
  assert.equal(s.doorOpen, false, "Straightening cannot replace the mirror and diary gates");
  s.reset();
  assert.equal(s.photoStraightened, false);
  assert.equal(s.photoNoticed, false);
});
test("the reflected clock, tuned radio and second telephone call are ordered gates", () => {
  const s = new Story();
  firstPass(s);
  secondPass(s);
  assert.equal(s.tuneRadio(93.7), "radio-await-clock");
  assert.equal(s.interact("telephone"), "telephone-repeat");
  assert.equal(s.setClock(3, 17), "clock-set");
  assert.equal(s.clockSolved, false);
  assert.equal(s.interact("bath-clue"), "time-clue");
  assert.equal(
    s.clockSolved,
    true,
    "An early correct clock recovers when its clue is found",
  );
  assert.equal(s.interact("telephone"), "telephone-repeat");
  assert.equal(s.interact("radio"), "radio-tune");
  assert.equal(s.tuneRadio(93.8), "radio-static");
  assert.equal(s.radioTuned, false);
  assert.equal(s.doorOpen, false);
  assert.equal(s.tuneRadio("93.7"), "radio-tuned");
  assert.equal(s.heardCall, false);
  assert.equal(s.doorOpen, false);
  assert.equal(s.interact("telephone"), "call");
  assert.deepEqual(s.drainEvents(), ["backdoor-unlocked"]);
  assert.equal(s.ready(), true);
});
test("the kitchen station clue appears only after the clock and is absent from the diary", () => {
  const s = new Story();
  assert.equal(s.hasStationClue, false);
  assert.notEqual(s.interact("station-clue"), "station-clue");
  assert.equal(s.hasStationClue, false);
  firstPass(s);
  secondPass(s);
  assert.notEqual(s.interact("station-clue"), "station-clue");
  assert.equal(s.hasStationClue, false);
  s.interact("bath-clue");
  s.setClock(3, 17);
  assert.match(s.hint(), /kitchen/i);
  assert.doesNotMatch(s.hint(), /93\.7/, "The unread clue must direct the player to the kitchen");
  assert.equal(s.interact("station-clue"), "station-clue");
  assert.equal(s.hasStationClue, true);
  assert.equal(s.clockSolved, true);
  assert.equal(s.radioTuned, false, "Reading blood cannot tune the radio for the player");
  assert.equal(s.tuneRadio(93.7), "radio-tuned");
  s.interact("telephone");
  leave(s, 3);
  for (const stage of [3, 4, 5, 6]) {
    s.stage = stage;
    assert.equal(s.interact("station-clue"), "station-clue", "Persistent visible writing remains inspectable");
    assert.equal(s.hasStationClue, true);
    assert.equal(s.radioTuned, true, "Rereading cannot undo the solved puzzle");
  }
  assert.doesNotMatch(WRITINGS.diary, /93[.,]7/);
  assert.doesNotMatch(VOICES.diary.text, /93[.,]7|ninety[- ]three/i);
  assert.match(WRITINGS.diary, /close the (?:bedroom )?music box[\s\S]*stop the (?:bathroom )?tap[\s\S]*switch off the (?:kitchen )?radio/i);
  s.reset();
  assert.equal(s.hasStationClue, false);
  assert.doesNotMatch(WRITINGS.diary, /03:17|3:17|93\.7/, "The early diary must not reveal later numeric solutions");
});
test("post-key mirror interactions cycle through eight reminders instead of repeating the drawer clue", () => {
  const s = new Story();
  assert.equal(s.interact("mirror"), "mirror-first");
  firstPass(s);
  encounter(s);
  assert.equal(s.interact("mirror"), "mirror-held", "The original drawer clue remains until its key is taken");
  s.interact("drawer");
  assert.equal(s.interact("drawer"), "key");
  const events = Array.from({ length: 10 }, () => s.interact("mirror"));
  assert.deepEqual(events, [...Array.from({ length: 8 }, (_, i) => "mirror" + i), "mirror0", "mirror1"]);
  assert.equal(new Set(events.slice(0, 8).map(id => VOICES[id].text)).size, 8);
  assert.ok(events.every(id => VOICES[id].speaker === "THE GLASS"));
  assert.equal(s.frozen, true, "A taunt must not unfreeze the reflection");
  assert.equal(s.encounter, true);
  assert.equal(s.hasKey, true);
  assert.equal(s.truthFound, false, "A mirror reminder cannot acknowledge the final bedside truth");
  s.stage = 5;
  assert.equal(s.interact("mirror"), "mirror-enter");
  s.stage = 6;
  assert.equal(s.interact("mirror"), "mirror-inverted");
  s.reset();
  assert.equal(s.mirrorTauntCursor, 0);
  assert.equal(s.interact("mirror"), "mirror-first");
});
test("Mum's final routine call is available after the last offering and only once across the return", () => {
  const s = new Story();
  toKeepsakes(s);
  assert.equal(s.heardRoutineCall, false);
  assert.equal(s.interact("telephone"), "telephone-dead");
  for (const { item, target } of KEEPSAKE_ORDER) {
    s.interact("keepsake-" + item);
    s.placeKeepsake(target, item);
  }
  assert.equal(s.interact("telephone"), "routine-call");
  assert.equal(s.heardRoutineCall, true);
  assert.equal(s.ritualIndex, 3);
  assert.equal(s.echoIndex, 0);
  assert.equal(s.interact("telephone"), "telephone-dead");
  leave(s, 4);
  assert.equal(s.interact("telephone"), "telephone-dead");
  assert.match(VOICES.routineCall.text, /diary[\s\S]*bed/i);
  assert.match(VOICES.routineCall.text, /music box[\s\S]*bathroom tap[\s\S]*kitchen radio/i);
  s.reset();
  assert.equal(s.heardRoutineCall, false);
});
test("the routine call remains available in the reverse chapter without becoming a new gate", () => {
  const s = new Story();
  toKeepsakes(s);
  fourthPass(s);
  assert.equal(s.heardRoutineCall, false);
  assert.equal(s.interact("telephone"), "routine-call");
  assert.equal(s.echoIndex, 0);
  assert.equal(s.interact("diary"), "diary-routine");
  assert.match(WRITINGS.routine, /music box[\s\S]*tap[\s\S]*kitchen radio/i);
  fifthPass(s);
  assert.equal(s.stage, 5);
  const skipped = new Story();
  toKeepsakes(skipped);
  fourthPass(skipped);
  fifthPass(skipped);
  assert.equal(skipped.heardRoutineCall, false);
  assert.equal(skipped.stage, 5, "A player who already knows the routine can finish without answering");
  assert.equal(skipped.interact("telephone"), "telephone-dead");
  const quiet = new Story();
  toKeepsakes(quiet);
  fourthPass(quiet);
  for (const id of ["musicbox", "tap", "radio"]) quiet.interact(id);
  assert.equal(quiet.stage, 4);
  assert.equal(quiet.silenceComplete, true);
  assert.equal(quiet.interact("telephone"), "telephone-dead",
    "An unanswered hint must not replay completed instructions after the house becomes quiet");
});
test("invalid clock and radio inputs preserve valid puzzle state", () => {
  const s = new Story();
  firstPass(s);
  secondPass(s);
  const hands = [s.clockHour, s.clockMinute];
  for (const [h, m] of [
    ["abc", 17],
    [3, 99],
    [0, 17],
    [13, 17],
    [3, -1],
    [3.5, 17],
    [null, 17],
    [true, 17],
    ["", 17],
  ]) {
    assert.equal(s.setClock(h, m), "invalid-time");
    assert.deepEqual([s.clockHour, s.clockMinute], hands);
  }
  s.interact("bath-clue");
  s.setClock(3, 17);
  const invalidFrequencies = ["", null, true, NaN, Infinity, 87, 109];
  for (const f of invalidFrequencies) {
    assert.equal(s.tuneRadio(f), "radio-static");
    assert.equal(s.radioFrequency, 88);
    assert.equal(s.radioTuned, false);
  }
  // An ordinary wrong station is a real dial position, not invalid form input.
  for (const f of [93.6, 93.8, 99]) {
    assert.equal(s.tuneRadio(f), "radio-static");
    assert.equal(s.radioFrequency, f);
    assert.equal(s.radioTuned, false);
    assert.equal(s.doorOpen, false);
  }
  assert.equal(s.tuneRadio(93.7), "radio-tuned");
  for (const f of invalidFrequencies) {
    assert.equal(s.tuneRadio(f), "radio-static");
    assert.equal(s.radioFrequency, RADIO_SOLUTION);
    assert.equal(s.radioTuned, true);
  }
  assert.equal(s.tuneRadio(99), "radio-tuned");
  assert.equal(s.radioFrequency, RADIO_SOLUTION);
  assert.equal(s.radioTuned, true);
});
test("telephone calls cannot be replaced by switching or tuning the kitchen radio", () => {
  const s = new Story();
  assert.equal(s.interact("radio"), "radio-no-power");
  s.interact("fuse");
  s.interact("panel");
  assert.equal(s.interact("radio"), "radio-off");
  assert.equal(s.heardArrival, false);
  assert.equal(s.interact("telephone"), "arrival-recording");
  assert.equal(s.radioOn, false);
  s.observe(1.4, true, true);
  leave(s, 1);
  secondPass(s);
  s.interact("bath-clue");
  s.setClock(3, 17);
  s.tuneRadio(93.7);
  assert.equal(s.heardCall, false);
  assert.equal(s.interact("telephone"), "call");
});
test("keepsakes are unavailable before their chapter and unknown items are rejected", () => {
  const s = new Story();
  assert.equal(s.interact("keepsake-watch"), "keepsake-unavailable");
  assert.equal(s.interact("keepsake-unknown"), null);
  assert.equal(s.placeKeepsake("radio-altar", "watch"), "ritual-inactive");
  assert.deepEqual(s.keepsakes, { watch: false, ring: false, ribbon: false });
});
test("missing items and wrong offerings preserve inventory and correct ritual progress", () => {
  const s = new Story();
  toKeepsakes(s);
  assert.equal(s.placeKeepsake("radio-altar", "watch"), "keepsake-not-held");
  s.interact("keepsake-watch");
  s.interact("keepsake-ring");
  s.interact("keepsake-ribbon");
  assert.equal(s.placeKeepsake("bath-dish", "ring"), "ritual-wrong");
  assert.equal(s.placeKeepsake("radio-altar", "ribbon"), "ritual-wrong");
  assert.equal(s.ritualIndex, 0);
  assert.equal(s.keepsakes.ring, true);
  assert.equal(s.placeKeepsake("radio-altar", "watch"), "keepsake-placed");
  assert.equal(s.placeKeepsake("musicbox-base", "ribbon"), "ritual-wrong");
  assert.equal(s.ritualIndex, 1);
  assert.equal(s.keepsakes.ribbon, true);
  assert.equal(
    s.placeKeepsake("radio-altar", "watch"),
    "keepsake-already-placed",
  );
  assert.equal(s.interact("keepsake-watch"), "keepsake-repeat");
  assert.deepEqual(s.placedKeepsakes, ["watch"]);
  assert.equal(s.doorOpen, false);
  assert.equal(s.placeKeepsake("bath-dish", "ring"), "keepsake-placed");
  assert.equal(s.placeKeepsake("musicbox-base", "ribbon"), "ritual-complete");
  assert.deepEqual(s.placedKeepsakes, ["watch", "ring", "ribbon"]);
  assert.deepEqual(s.keepsakes, { watch: false, ring: false, ribbon: false });
  assert.deepEqual(s.drainEvents(), ["backdoor-unlocked"]);
});
test("wrong silence order recovers without undoing keepsakes and checking the phone preserves partial silence", () => {
  const s = new Story();
  toKeepsakes(s);
  fourthPass(s);
  assert.equal(s.interact("radio"), "wrong-order");
  assert.equal(s.interact("musicbox"), "echo-silenced");
  assert.equal(s.musicboxOn, false);
  assert.equal(s.interact("radio"), "wrong-order");
  assert.equal(s.echoIndex, 0);
  assert.equal(s.musicboxOn, true);
  assert.equal(s.tapOn, true);
  assert.equal(s.radioOn, true);
  assert.deepEqual(s.placedKeepsakes, ["watch", "ring", "ribbon"]);
  assert.equal(s.interact("musicbox"), "echo-silenced");
  assert.equal(s.interact("musicbox"), "already-quiet");
  assert.equal(s.interact("tap"), "echo-silenced");
  assert.equal(s.interact("telephone"), "routine-call");
  assert.equal(s.heardRoutineCall, true);
  assert.equal(s.interact("telephone"), "telephone-dead");
  assert.equal(s.echoIndex, 2);
  assert.equal(s.doorOpen, false);
  assert.equal(s.interact("radio"), "house-quiet");
  assert.equal(s.musicboxOn, false);
  assert.equal(s.tapOn, false);
  assert.equal(s.radioOn, false);
  assert.deepEqual(s.drainEvents(), ["backdoor-unlocked"]);
});
test("the spent back door disappears and an interaction click cannot cross the empty mirror", () => {
  const s = new Story();
  toKeepsakes(s);
  fourthPass(s);
  fifthPass(s);
  assert.equal(s.backdoorGone, true);
  assert.equal(s.mirrorReady, true);
  assert.equal(s.interact("door"), "backdoor-gone");
  assert.equal(s.crossBackDoor(), null);
  assert.equal(s.interact("mirror"), "mirror-enter");
  assert.equal(s.stage, 5);
  assert.equal(s.inverted, false);
  assert.equal(s.crossMirror(), "mirror-crossed");
  assert.equal(s.crossMirror(), null);
  assert.equal(s.stage, 6);
  assert.equal(s.inverted, true);
  for (const id of ["musicbox", "tap", "radio"])
    assert.equal(s.interact(id), "already-quiet");
  assert.equal(s.silenceComplete, true);
  assert.equal(s.doorOpen, false);
});
test("acknowledging the bedside truth and switching off the lamp must precede the front departure", () => {
  const s = new Story();
  for (let stage = 0; stage < 6; stage++) {
    s.stage = stage;
    assert.equal(s.interact("bed-farewell"), "bed-waiting");
    assert.equal(s.truthFound, false);
    assert.equal(s.interact("front-door"), "front-locked");
    assert.equal(s.interact("bedside-lamp"), "lamp-stay");
    assert.equal(s.enterWake(), null);
  }
  s.stage = 6;
  assert.equal(s.truthFound, false);
  assert.equal(s.interact("bedside-lamp"), "lamp-not-yet");
  assert.equal(s.interact("bed-farewell"), "farewell");
  assert.equal(s.truthFound, true);
  assert.equal(s.farewellSaid, true);
  assert.equal(s.interact("bed-farewell"), "farewell-repeat");
  assert.equal(s.enterWake(), null);
  assert.equal(s.interact("bedside-lamp"), "lamp-off");
  assert.deepEqual(s.drainEvents(), ["front-unlocked"]);
  assert.equal(s.interact("bedside-lamp"), "lamp-already-off");
  assert.deepEqual(s.drainEvents(), []);
  assert.equal(
    s.enterWake(),
    null,
    "Releasing the lock alone is not a physical departure",
  );
  assert.equal(s.interact("front-door"), "ending-open");
  assert.equal(s.interact("front-door"), "front-open");
  assert.equal(s.enterWake(), "wake-entered");
  assert.equal(s.enterWake(), null);
});
test("the mirror reveals the real house but only the bedside evidence records Mara's acknowledgment", () => {
  const s = new Story();
  toKeepsakes(s);
  fourthPass(s);
  fifthPass(s);
  assert.equal(s.truthFound, false);
  assert.equal(s.crossMirror(), "mirror-crossed");
  assert.equal(s.truthFound, false);
  for (const id of ["mirror", "photo", "telephone", "radio", "front-door"])
    s.interact(id);
  assert.equal(s.truthFound, false);
  assert.equal(s.frontReleased, false);
  assert.equal(s.interact("bed-farewell"), "farewell");
  assert.equal(s.truthFound, true);
  assert.equal(s.frontReleased, false);
  assert.equal(s.interact("bed-farewell"), "farewell-repeat");
  assert.deepEqual(s.drainEvents(), []);
  s.reset();
  assert.equal(s.truthFound, false);
  assert.equal(s.farewellSaid, false);
  assert.equal(s.frontReleased, false);
});
test("all seven chapters complete through five rear crossings, the mirror, and the front threshold", () => {
  const s = new Story();
  toKeepsakes(s);
  fourthPass(s);
  fifthPass(s);
  assert.equal(s.stage, 5);
  assert.equal(s.laps, 5);
  assert.equal(s.crossMirror(), "mirror-crossed");
  assert.equal(s.truthFound, false);
  s.interact("bed-farewell");
  assert.equal(s.truthFound, true);
  s.interact("bedside-lamp");
  s.interact("front-door");
  assert.equal(s.enterWake(), "wake-entered");
  assert.equal(s.stage, 6);
  assert.equal(s.endingStarted, true);
});
test("restart clears items, offerings, sounds, vanished doors, mirror world and queued events", () => {
  const s = new Story();
  toKeepsakes(s);
  fourthPass(s);
  fifthPass(s);
  s.crossMirror();
  s.interact("bed-farewell");
  s.interact("bedside-lamp");
  s.interact("front-door");
  s.enterWake();
  s.interact("room-lounge");
  s.interact("letter");
  s.visit("kitchen");
  s.reset();
  assert.deepEqual(s, new Story());
});

test("the clock loop gives finite, indirect bath clues without repeating the key hint", () => {
  const s = new Story();
  firstPass(s);
  secondPass(s);
  assert.equal(s.stage, 2);
  const lines = Array.from({ length: 7 }, () => s.interact("mirror"));
  assert.deepEqual(lines, ["mirrorClock0", "mirrorClock1", "mirrorClock2", "mirrorClock0", "mirrorClock1", "mirrorClock2", "mirrorClock0"]);
  for (const id of new Set(lines)) {
    assert.ok(VOICES[id]);
    assert.doesNotMatch(VOICES[id].text, /03:17|3:17|three seventeen|set the clock|go to the bathroom|console|drawer|bedroom key/i);
  }
  assert.equal(s.hasTimeClue, false);
  assert.equal(s.clockSolved, false);
  assert.equal(s.hasStationClue, false);
  s.reset();
  assert.equal(s.mirrorClockCursor, 0);
  assert.equal(s.interact("mirror"), "mirror-first");
});
