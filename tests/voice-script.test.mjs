import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { Story, VOICES, WRITINGS } from "../src/story.mjs";

const directory = new URL("../assets/voice/", import.meta.url);
const lines = JSON.parse(readFileSync(new URL("lines.json", directory), "utf8"));
const clips = JSON.parse(readFileSync(new URL("production.json", directory), "utf8")).clips;

test("shipped speech matches subtitles, synthesis records, hashes and decoded headroom", () => {
  assert.deepEqual(Object.keys(lines).sort(), Object.keys(VOICES).sort());
  assert.deepEqual(Object.keys(clips).sort(), Object.keys(VOICES).sort());
  for (const [id, voice] of Object.entries(VOICES)) {
    assert.equal(lines[id].text, voice.text, `${id} synthesis text`);
    assert.equal(clips[id].text, voice.text, `${id} rendered text`);
    const actual = createHash("sha256").update(readFileSync(new URL(`${id}.ogg`, directory))).digest("hex");
    assert.equal(actual, clips[id].sha256, `${id} rendered audio`);
    assert.ok(clips[id].decoded_true_peak_dbfs <= -3, `${id} decoded headroom`);
  }
});

test("Mum's call, accusation and attack Goodnight retain the same supplied voice", () => {
  for (const id of ["recording", "ending", "goodnight"]) {
    assert.equal(lines[id].voice, "bf_isabella", id);
    assert.equal(lines[id].speaker_id, 22, id);
    assert.equal(clips[id].speaker_id, 22, `${id} actual render`);
  }
  assert.equal(VOICES.goodnight.speaker, "MUM");
  assert.equal(VOICES.goodnight.text, "Goodnight.");
  assert.match(VOICES.recording.text, /fuse went out again/);
  assert.match(VOICES.recording.text, /Please don't leave before saying goodnight/);
});

test("bathroom clue gives a direct 03:17 observation rather than backward digits", () => {
  const story = new Story();
  story.stage = 2;
  story.hasTimeClue = true;
  assert.match(story.hint(), /03:17/);
  assert.doesNotMatch(story.hint(), /71:30|backward/);
  assert.doesNotMatch(WRITINGS.diary, /hour backward/);
  assert.equal(VOICES.time.text, "The mirror has three seventeen written on it.");
});
