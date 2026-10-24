// Real Web Audio, including spatial panning, without a GPU renderer.
// These isolated cues are measured before master gain and compression.
const { chromium } = require("playwright");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const url = (process.env.MIRROR_TEST_URL || "http://127.0.0.1:8000").replace(
  /\/$/,
  "",
);
const out = process.env.MIRROR_TEST_OUTPUT || "/tmp/mirror-me-demon-sound";
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: [
      "--no-sandbox",
      "--disable-gpu",
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.route("**/__demon-audio__", (r) =>
      r.fulfill({
        contentType: "text/html",
        body: '<!doctype html><link rel="icon" href="data:,"><body>Audio validation</body>',
      }),
    );
    await page.goto(url + "/__demon-audio__");
    const result = await page.evaluate(async () => {
      const { Sound } = await import("/src/sound.mjs");
      const rate = 48000;
      const ids = [
        "demon-inhale",
        "demon-reveal",
        "demon-withdraw",
        "crawl-step",
        "crawl-arrival",
        "joint-fold",
        "ceiling-breath",
        "witness-breath",
        "funeral-lunge",
        "funeral-impact",
      ];
      const clips = [];
      for (const id of ids) {
        const c = new OfflineAudioContext(2, rate * 3, rate),
          s = new Sound(() => {});
        s.context = c;
        s.paused = false;
        s.master = c.createGain();
        s.master.gain.value = 1;
        s.master.connect(c.destination);
        s.effects = c.createGain();
        s.effects.connect(s.master);
        let disconnects = 0;
        const panner = s.panner.bind(s);
        s.panner = (...args) => {
          const p = panner(...args),
            disconnect = p.disconnect.bind(p);
          p.disconnect = (...values) => {
            disconnects++;
            return disconnect(...values);
          };
          return p;
        };
        s.effect(id, { x: 0, y: 0, z: -0.5 });
        const buffer = await c.startRendering();
        await new Promise((r) => setTimeout(r, 30));
        let peak = 0,
          energy = 0,
          tail = 0,
          nans = 0;
        for (let channel = 0; channel < 2; channel++) {
          const d = buffer.getChannelData(channel);
          for (let i = 0; i < d.length; i++) {
            if (!Number.isFinite(d[i])) nans++;
            peak = Math.max(peak, Math.abs(d[i]));
            energy += d[i] * d[i];
            if (i > d.length - rate * 0.2)
              tail = Math.max(tail, Math.abs(d[i]));
          }
        }
        const pcm = new Int16Array(buffer.length * 2);
        for (let i = 0; i < buffer.length; i++)
          for (let ch = 0; ch < 2; ch++)
            pcm[i * 2 + ch] = Math.round(
              Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i])) * 32767,
            );
        const bytes = new Uint8Array(pcm.buffer);
        let encoded = "";
        for (let i = 0; i < bytes.length; i += 0x4000)
          encoded += String.fromCharCode(...bytes.subarray(i, i + 0x4000));
        clips.push({
          id,
          peak,
          rms: Math.sqrt(energy / (buffer.length * 2)),
          tail,
          nans,
          active: s.creatureNodes.size,
          disconnects,
          seconds: [...s.creatureBuffers.values()].map((b) => b.duration),
          pcm: btoa(encoded),
        });
      }
      // An overlapping, realistic premonition/reveal sequence is measured before
      // the user's master attenuation or the existing safety compressor.
      const mix = new OfflineAudioContext(2, rate * 4, rate),
        s = new Sound(() => {});
      s.context = mix;
      s.paused = false;
      s.master = mix.createGain();
      s.master.connect(mix.destination);
      s.effects = mix.createGain();
      s.effects.connect(s.master);
      s.effect("demon-inhale", { x: 0, y: 0, z: -0.5 });
      const suspend = mix.suspend(0.8).then(() => {
        s.effect("demon-reveal", { x: 0, y: 0, z: -0.5 });
        return mix.resume();
      });
      const rendering = mix.startRendering();
      await suspend;
      const mixed = await rendering;
      let mixPeak = 0;
      for (let ch = 0; ch < 2; ch++)
        for (const sample of mixed.getChannelData(ch))
          mixPeak = Math.max(mixPeak, Math.abs(sample));
      // A pause longer than the old 4.2-second wall-clock cleanup must preserve
      // the scheduled cue and its panner until the AudioContext actually resumes.
      const live = new AudioContext();
      await live.resume();
      const paused = new Sound(() => {});
      paused.context = live;
      paused.paused = false;
      paused.master = live.createGain();
      paused.master.gain.value = 0;
      paused.master.connect(live.destination);
      paused.effects = live.createGain();
      paused.effects.connect(paused.master);
      let liveDisconnects = 0;
      const panner = paused.panner.bind(paused);
      paused.panner = (...a) => {
        const p = panner(...a),
          disc = p.disconnect.bind(p);
        p.disconnect = () => {
          liveDisconnects++;
          disc();
        };
        return p;
      };
      paused.effect("demon-inhale", { x: 0, y: 0, z: -0.5 });
      await new Promise((r) => setTimeout(r, 120));
      await paused.pause();
      const frozen = live.currentTime;
      await new Promise((r) => setTimeout(r, 4450));
      const suspended = {
        timeDelta: live.currentTime - frozen,
        nodes: paused.creatureNodes.size,
        disconnects: liveDisconnects,
      };
      paused.resumeDialogue();
      await live.resume();
      await new Promise((r) => setTimeout(r, 1900));
      const resumed = {
        nodes: paused.creatureNodes.size,
        disconnects: liveDisconnects,
      };
      paused.effect("demon-inhale", { x: 0, y: 0, z: -0.5 });
      paused.reset();
      await new Promise((r) => setTimeout(r, 80));
      const reset = {
        nodes: paused.creatureNodes.size,
        disconnects: liveDisconnects,
      };
      paused.paused = true;
      paused.effect("demon-reveal", { x: 0, y: 0, z: -0.5 });
      const disabled = {
        nodes: paused.creatureNodes.size,
        disconnects: liveDisconnects,
      };
      paused.paused = false;
      paused.effect("demon-inhale", { x: 0, y: 0, z: -0.5 });
      await live.suspend();
      paused.stopCreatureCues();
      await live.resume();
      await new Promise((r) => setTimeout(r, 80));
      const cancelled = {
        nodes: paused.creatureNodes.size,
        disconnects: liveDisconnects,
      };
      await live.close();
      return { clips, mixPeak, suspended, resumed, reset, disabled, cancelled };
    });
    assert.deepEqual(errors, []);
    for (const clip of result.clips) {
      assert.equal(clip.nans, 0);
      assert.ok(
        clip.peak > 0.0001 && clip.peak < 0.5,
        clip.id + " non-silent with headroom",
      );
      assert.equal(clip.tail, 0, clip.id + " finite tail");
      assert.equal(clip.active, 0, clip.id + " source cleanup");
      assert.equal(clip.disconnects, 1, clip.id + " panner cleanup");
      const pcm = Buffer.from(clip.pcm, "base64");
      const header = Buffer.alloc(44);
      header.write("RIFF");
      header.writeUInt32LE(36 + pcm.length, 4);
      header.write("WAVE", 8);
      header.write("fmt ", 12);
      header.writeUInt32LE(16, 16);
      header.writeUInt16LE(1, 20);
      header.writeUInt16LE(2, 22);
      header.writeUInt32LE(48000, 24);
      header.writeUInt32LE(48000 * 4, 28);
      header.writeUInt16LE(4, 32);
      header.writeUInt16LE(16, 34);
      header.write("data", 36);
      header.writeUInt32LE(pcm.length, 40);
      fs.writeFileSync(
        out + "/" + clip.id + ".wav",
        Buffer.concat([header, pcm]),
      );
      delete clip.pcm;
      clip.peakDbfs = 20 * Math.log10(clip.peak);
    }
    assert.ok(result.mixPeak < 0.5, "overlapping cues retain headroom");
    assert.equal(result.suspended.nodes, 1);
    assert.equal(result.suspended.disconnects, 0);
    assert.ok(result.suspended.timeDelta < 0.1);
    assert.equal(result.resumed.nodes, 0);
    assert.equal(result.resumed.disconnects, 1);
    assert.equal(result.reset.nodes, 0);
    assert.equal(result.reset.disconnects, 2);
    assert.deepEqual(
      result.disabled,
      result.reset,
      "paused effects cannot start a source",
    );
    assert.equal(
      result.cancelled.nodes,
      0,
      "a paused creature cue can be cancelled when scares are disabled",
    );
    assert.equal(
      result.cancelled.disconnects,
      3,
      "cancelled spatial source disconnects after resume",
    );
    result.status = "PASS";
    result.errors = errors;
    fs.writeFileSync(out + "/review.json", JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
