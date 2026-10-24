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
  for (const id of ["recording", "call", "routineCall", "ending", "goodnight"]) {
    assert.equal(lines[id].voice, "bf_isabella", id);
    assert.equal(lines[id].speaker_id, 22, id);
    assert.equal(clips[id].speaker_id, 22, `${id} actual render`);
  }
  assert.equal(VOICES.goodnight.speaker, "MUM");
  assert.equal(VOICES.goodnight.text, "Goodnight.");
  assert.match(VOICES.recording.text, /fuse went out again/);
  assert.match(VOICES.recording.text, /Please don't leave before saying goodnight/);
});

test("post-key mirror takes have eight indirect lines and original layered glass processing", () => {
  const voices = Array.from({ length: 8 }, (_, index) => VOICES[`mirror${index}`]);
  assert.equal(new Set(voices.map(voice => voice.text)).size, 8);
  for (let index = 0; index < voices.length; index++) {
    const id = `mirror${index}`;
    assert.equal(voices[index].speaker, "THE GLASS");
    assert.doesNotMatch(voices[index].text, /killed|murdered|stabbed|console|key/i);
    assert.equal(lines[id].voice, "bf_emma");
    assert.equal(lines[id].role, "glass");
  }
  for (const [id, line] of Object.entries(lines).filter(([, line]) => line.role === "glass")) {
    assert.match(clips[id].effects, /asplit=3/);
    assert.match(clips[id].effects, /tremolo=f=31/);
    assert.match(clips[id].original_rattle, /no external recording/);
  }
});

test("Mum's routine call directs the diary and states the reverse-sound sequence", () => {
  const voice = VOICES.routineCall, line = lines.routineCall, clip = clips.routineCall;
  assert.match(voice.text, /diary.*beside the bed/i);
  assert.match(voice.text, /the diary/i);
  assert.doesNotMatch(voice.text, /my diary/i);
  assert.equal(voice.captionCues[1].text, "The diary. Beside the bed.");
  assert.match(voice.text, /music box.*bathroom tap.*kitchen radio/i);
  assert.equal(voice.duration, clip.file_seconds);
  assert.equal(voice.captionCues.length, line.segments.length);
  assert.deepEqual(voice.captionCues.map(cue => cue.at), clip.phrase_starts_seconds);
  assert.ok(voice.duration > 15 && voice.duration < 30);
  assert.ok(voice.captionCues.at(-1).at < voice.duration);
});

test("Mum's second call has measured phrase captions and uneven pleading pauses", () => {
  const line = lines.call, clip = clips.call, voice = VOICES.call;
  assert.equal(voice.text, "Mara... the music box... the bath... the radio... please... please don't leave... please don't do this...");
  assert.equal(line.segments.length, 7);
  assert.equal(voice.captionCues.length, line.segments.length);
  assert.deepEqual(voice.captionCues.map(cue => cue.at), clip.phrase_starts_seconds);
  const words = text => text.toLowerCase().replace(/[^a-z\s']/g, "").replace(/\s+/g, " ").trim();
  assert.equal(words(voice.captionCues.map(cue => cue.text).join(" ")), words(voice.text));
  assert.equal(words(line.segments.join(" ")), words(voice.text));
  assert.ok(new Set(line.pauses_after_seconds).size > 3);
  assert.ok(line.pauses_after_seconds.every(pause => pause >= .6 && pause < 2));
  assert.ok(line.speed < 1 && line.speed >= .75);
  assert.equal(voice.duration, clip.file_seconds);
  assert.ok(voice.captionCues.at(-1).at < voice.duration);
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

test("clock-loop mirror hints keep the bath/clock connection indirect", () => {
  const hints = ["mirrorClock0", "mirrorClock1", "mirrorClock2"];
  assert.equal(new Set(hints.map(id => VOICES[id].text)).size, 3);
  for (const id of hints) {
    assert.equal(VOICES[id].speaker, "THE GLASS");
    assert.equal(lines[id].role, "glass");
    assert.equal(lines[id].voice, "bf_emma");
    assert.doesNotMatch(VOICES[id].text, /03:17|three seventeen|go to|set the|use the|bathroom mirror/i);
  }
  assert.match(hints.map(id => VOICES[id].text).join(" "), /hands.*water.*Mum.*bath/i);
});
