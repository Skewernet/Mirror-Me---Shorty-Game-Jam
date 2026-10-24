import test from "node:test";
import assert from "node:assert/strict";
import { Sound } from "../src/sound.mjs";

function clock(t) {
  let milliseconds = 0;
  t.mock.method(performance, "now", () => milliseconds);
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  return (amount) => {
    milliseconds += amount;
    t.mock.timers.tick(amount);
  };
}

test("subtitle-only funeral news pauses at its current offset and completes once after resuming", async (t) => {
  const advance = clock(t),
    captions = [],
    completed = [],
    sound = new Sound((text) => captions.push(text));
  t.after(() => sound.stopVoice());
  sound.paused = false;
  await sound.voice("news", {
    segmented: true,
    position: { x: 1.04, y: 1.04, z: 11.92 },
    onComplete: (id) => completed.push(id),
  });
  assert.equal(sound.context, undefined);
  assert.equal(sound.currentVoice, "news");
  assert.ok(captions.at(-1).length > 0);
  advance(2100);
  const offset = sound.voiceElapsed();
  assert.equal(offset, 2.1);
  await sound.pause();
  advance(60000);
  assert.equal(sound.voiceElapsed(), offset);
  assert.deepEqual(completed, []);
  sound.resumeDialogue();
  assert.equal(sound.currentVoice, "news");
  assert.equal(sound.voiceElapsed(), offset);
  assert.deepEqual(sound.voiceOptions.position, { x: 1.04, y: 1.04, z: 11.92 });
  const remaining = (sound.voiceDuration - offset) * 1000;
  advance(remaining + 600);
  assert.deepEqual(completed, []);
  advance(60);
  assert.deepEqual(completed, ["news"]);
  assert.equal(sound.currentVoice, null);
  assert.equal(captions.at(-1), "");
  advance(60000);
  assert.deepEqual(completed, ["news"]);
});

test("muting voices keeps funeral subtitles and waits for the decoded report duration", async (t) => {
  const advance = clock(t),
    captions = [],
    completed = [],
    sound = new Sound((text) => captions.push(text));
  t.after(() => sound.stopVoice());
  sound.paused = false;
  sound.voiceEnabled = false;
  sound.context = {};
  sound.buffers.set("news", { duration: 4.25 });
  t.mock.method(sound, "loadBuffer", async (id) => sound.buffers.get(id));
  await sound.voice("news", {
    segmented: true,
    onComplete: (id) => completed.push(id),
  });
  assert.equal(sound.playingVoice, null);
  assert.equal(sound.voiceDuration, 4.25);
  assert.ok(captions.at(-1).length > 0);
  advance(4840);
  assert.equal(sound.busy, true);
  assert.deepEqual(completed, []);
  advance(70);
  assert.equal(sound.busy, false);
  assert.deepEqual(completed, ["news"]);
  assert.equal(captions.at(-1), "");
});

test("restarting cancels an unfinished funeral callback and its saved pause state", async (t) => {
  const advance = clock(t),
    completed = [],
    sound = new Sound(() => {});
  t.after(() => sound.stopVoice());
  sound.paused = false;
  await sound.voice("news", { onComplete: (id) => completed.push(id) });
  advance(900);
  await sound.pause();
  assert.equal(sound.resumeVoice.id, "news");
  sound.reset();
  advance(60000);
  sound.resumeDialogue();
  assert.equal(sound.resumeVoice, null);
  assert.equal(sound.currentVoice, null);
  assert.equal(sound.busy, false);
  assert.deepEqual(completed, []);
});

test("the strike word completes in full with its short configured gap after pause", async (t) => {
  const advance = clock(t), completed = [], sound = new Sound(() => {});
  t.after(() => sound.stopVoice());
  sound.paused = false;
  sound.voiceEnabled = false;
  sound.context = {};
  sound.buffers.set("goodnight", { duration: .856 });
  t.mock.method(sound, "loadBuffer", async (id) => sound.buffers.get(id));
  await sound.voice("goodnight", { postGap: .05, onComplete: id => completed.push(id) });
  advance(300);
  await sound.pause();
  assert.equal(sound.resumeVoice.options.postGap, .05);
  advance(10000);
  assert.deepEqual(completed, []);
  sound.resumeDialogue();
  await Promise.resolve();
  await Promise.resolve();
  advance(600);
  assert.deepEqual(completed, [], "Neither pausing nor the short gap may truncate the word");
  advance(10);
  assert.deepEqual(completed, ["goodnight"]);
});
