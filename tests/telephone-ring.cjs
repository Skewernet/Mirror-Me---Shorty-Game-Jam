// Real Web Audio: finite bell rendering and actual Sound story/pause lifecycle.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const url = (process.env.MIRROR_TEST_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-gpu", "--autoplay-policy=no-user-gesture-required"],
  });
  try {
    const page = await browser.newPage();
    const errors = [], failed = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    page.on("requestfailed", request => failed.push(request.url()));
    await page.route("**/__telephone-audio__", route => route.fulfill({
      contentType: "text/html", body: '<!doctype html><link rel="icon" href="data:,"><body>Telephone audio validation</body>',
    }));
    await page.goto(url + "/__telephone-audio__");
    const result = await page.evaluate(async () => {
      const { Sound } = await import("/src/sound.mjs");
      const { TelephoneRinger } = await import("/src/telephone-ring.mjs");
      const check = (value, message) => { if (!value) throw new Error(message); };
      const sound = new Sound(() => {});
      const beforePreparation = performance.now();
      await sound.prepare();
      const preparationMs = performance.now() - beforePreparation;
      check(!sound.context, "Preparing PCM created an audio device before activation");
      const prepared = sound.phoneRingBuffer, foley = sound.foleyNoise;
      check(prepared && foley && sound.creatureBuffers.size === 8, "First-use audio was not prepared before ENTER");
      const beforeStart = performance.now();
      await sound.start();
      const startMs = performance.now() - beforeStart;
      sound.master.gain.value = 0;
      check(sound.phoneRinger.buffer === prepared && sound.foleyNoise === foley,
        "Audio unlock rebuilt prepared PCM");
      let newBuffers = 0;
      const createBuffer = sound.context.createBuffer.bind(sound.context);
      sound.context.createBuffer = (...args) => { newBuffers++; return createBuffer(...args); };
      sound.effect("switch");
      check(newBuffers === 0, "The first flashlight switch allocated a noise buffer");

      const player = { x: 0, z: 6.7, yaw: 0 };
      const state = { stage: 0, power: false, heardArrival: false, clockSolved: true,
        tapOn: false, radioOn: false, musicboxOn: false, echoIndex: 0 };
      sound.update(state, player);
      const first = sound.phoneRinger.source;
      check(first && first.buffer === prepared, "Opening telephone never rings");
      sound.update(state, player);
      check(sound.phoneRinger.source === first, "A frame starts overlapping telephone rings");
      check(sound.phoneRinger.nextAt > sound.context.currentTime + 3,
        "The telephone lacks a silent interval between double rings");
      state.heardArrival = true;
      sound.update(state, player);
      check(!sound.phoneRinger.source, "Answering does not stop the telephone");
      Object.assign(state, { stage: 2, clockSolved: false, radioTuned: false, heardCall: false });
      sound.update(state, player);
      check(!sound.phoneRinger.source, "Second telephone rings before clock/station gates");
      state.clockSolved = state.radioTuned = true;
      sound.update(state, player);
      check(sound.phoneRinger.source, "Solved clock and station do not start the second telephone");
      sound.busy = true;
      sound.update(state, player);
      check(!sound.phoneRinger.source, "The telephone rings over dialogue");
      sound.busy = false;
      sound.update(state, player);
      check(sound.phoneRinger.source, "Pending telephone cannot resume after dialogue");
      await sound.pause();
      check(!sound.phoneRinger.source && sound.context.state === "suspended", "Pause retains a live ring");
      sound.update(state, player);
      check(!sound.phoneRinger.source, "Paused simulation restarts ringing");
      await sound.start();
      sound.update(state, player);
      check(sound.phoneRinger.source && sound.phoneRinger.buffer === prepared,
        "Resume does not restart the pending phone from its cached bell");
      sound.voiceEnabled = false;
      await sound.voice("call");
      check(!sound.phoneRinger.source && sound.busy && sound.voiceDuration >= 16,
        "The actual mother call does not interrupt ringing and retain its full duration");
      sound.stopVoice();
      state.heardCall = true;
      sound.update(state, player);
      check(!sound.phoneRinger.source, "Answered second telephone restarts ringing");
      Object.assign(state, { stage: 3, ritualIndex: 2, heardRoutineCall: false });
      sound.update(state, player);
      check(!sound.phoneRinger.source, "Routine call rings before the keepsakes are all returned");
      state.ritualIndex = 3;
      sound.update(state, player);
      check(sound.phoneRinger.source, "Last returned keepsake does not start Mum's routine reminder");
      state.heardRoutineCall = true;
      sound.update(state, player);
      check(!sound.phoneRinger.source, "Answering the routine call leaves its bell ringing");
      Object.assign(state, { stage: 4, heardRoutineCall: false });
      sound.update(state, player);
      check(sound.phoneRinger.source, "Pending routine call is lost at the next chapter");
      state.heardRoutineCall = true;
      sound.update(state, player);
      check(!sound.phoneRinger.source, "Answered routine call rings again after the return");
      Object.assign(state, { stage: 2, heardCall: false });
      state.heardCall = false;
      sound.update(state, player);
      check(sound.phoneRinger.source, "Fixture failed to restart pending phone");
      sound.reset();
      check(!sound.phoneRinger.source && sound.phoneRinger.nextAt === 0, "Restart leaks a phone source/cadence");
      await sound.context.close();

      const measure = buffer => {
        let peak = 0, energy = 0, tail = 0, finite = true;
        const samples = buffer.getChannelData(0);
        for (let index = 0; index < samples.length; index++) {
          const value = samples[index];
          finite &&= Number.isFinite(value);
          peak = Math.max(peak, Math.abs(value));
          energy += value * value;
          if (index > samples.length - buffer.sampleRate * .2) tail = Math.max(tail, Math.abs(value));
        }
        return { peak, rms: Math.sqrt(energy / samples.length), tail, finite };
      };
      const context = new OfflineAudioContext(1, 48000 * 3, 48000);
      const ring = new TelephoneRinger(context, context.destination, prepared);
      ring.update(true);
      const rendered = await context.startRendering();
      const normal = measure(rendered);
      check(normal.finite && normal.peak > .1 && normal.peak < .5 && normal.rms > .01,
        "Telephone is silent, clipped or non-finite");
      check(normal.tail < 1e-6 && !ring.source, "Telephone tail is not finite or source cleanup failed");
      const second = new OfflineAudioContext(1, 48000, 48000);
      const stopped = new TelephoneRinger(second, second.destination, prepared);
      stopped.update(true);
      const interrupt = second.suspend(.12).then(() => { stopped.stop(); return second.resume(); });
      const rendering = second.startRendering();
      await interrupt;
      const interrupted = await rendering;
      const afterStop = interrupted.getChannelData(0).slice(Math.ceil(.16 * 48000));
      check(afterStop.every(value => Math.abs(value) < 1e-6), "Answering leaves a ringing tail under the caller");
      return { status: "PASS", preparationMs, startMs, firstSwitchBufferAllocations: newBuffers,
        bellSeconds: prepared.duration, bell: normal, checks: [
          "context-free yielding PCM preparation", "first switch uses cached noise", "opening phone ring",
          "clock/station second-call gates", "single spatial ring with quiet cadence", "answer and dialogue stop",
          "pause/resume", "actual mother Ogg duration", "post-keepsake routine reminder gates", "restart cleanup", "finite Web Audio render and interrupted tail",
        ] };
    });
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
    console.log(JSON.stringify({ ...result, errors, failed }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
