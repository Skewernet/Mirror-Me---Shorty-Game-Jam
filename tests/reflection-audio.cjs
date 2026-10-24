const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.MIRROR_TEST_URL || 'http://127.0.0.1:8000';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required'] });
  try {
    const page = await browser.newPage(), errors = [], failed = [];
    page.on('console', message => { if (message.text().startsWith('Audio check:')) console.log(message.text()); });
    page.on('pageerror', error => errors.push(error.message));
    page.on('requestfailed', request => failed.push(request.url()));
    await page.route('**/__reflection-audio__', route => route.fulfill({ contentType: 'text/html',
      body: '<!doctype html><link rel="icon" href="data:,"><body>Reflection sound validation</body>' }));
    await page.goto(base + '/__reflection-audio__');
    const report = await page.evaluate(async () => {
      const { Sound } = await import('/src/sound.mjs');
      const { EXTRA_VOICES } = await import('/src/extra-voices.mjs');
      const check = (value, message) => { if (!value) throw new Error(message); };
      const measurements = [];
      for (const id of ['reflection-twitch', 'light-relay', 'light-switch-bank']) {
        console.log('Audio check: offline ' + id);
        const context = new OfflineAudioContext(2, 48000 * 2, 48000);
        const sound = new Sound(() => {});
        await sound.prepare();
        check(!sound.context, 'Preparing new cues opened an audio device');
        sound.context = context; sound.paused = false;
        sound.master = context.createGain(); sound.master.connect(context.destination);
        sound.effects = context.createGain(); sound.effects.connect(sound.master);
        let allocations = 0, disconnects = 0;
        const create = context.createBuffer.bind(context);
        context.createBuffer = (...args) => { allocations++; return create(...args); };
        const panner = sound.panner.bind(sound);
        sound.panner = (...args) => {
          const source = panner(...args), disconnect = source.disconnect.bind(source);
          source.disconnect = (...values) => { disconnects++; return disconnect(...values); };
          return source;
        };
        sound.effect(id, { x: 0, y: 0, z: -.5 });
        check(allocations === 0, 'Cue allocated PCM during play: ' + id);
        check(sound.creatureNodes.size === 1, 'Cue source was not tracked: ' + id);
        const buffer = await context.startRendering();
        await new Promise(resolve => setTimeout(resolve, 30));
        let peak = 0, energy = 0, tail = 0;
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
          const samples = buffer.getChannelData(channel);
          for (let index = 0; index < samples.length; index++) {
            const sample = samples[index];
            check(Number.isFinite(sample), 'Non-finite cue: ' + id);
            peak = Math.max(peak, Math.abs(sample)); energy += sample * sample;
            if (index > samples.length - 4800) tail = Math.max(tail, Math.abs(sample));
          }
        }
        check(peak > .005 && peak < .2 && energy > .001, 'Cue is silent or lacks headroom: ' + id);
        check(tail < 1e-6 && !sound.creatureNodes.size && disconnects === 1,
          'Cue/panner outlived audio completion: ' + id);
        measurements.push({ id, peak, tail, allocations, disconnects });
      }
      const sound = new Sound(() => {}); await sound.prepare();
      console.log('Audio check: live start');
      await sound.start(); sound.master.gain.value = 0;
      sound.effect('reflection-twitch');
      check(sound.creatureNodes.size === 1, 'Live rattle not tracked');
      await sound.pause();
      console.log('Audio check: paused');
      check(sound.context.state === 'suspended' && sound.creatureNodes.size === 1,
        'Pause does not retain the unheard rattle tail');
      await sound.start();
      console.log('Audio check: resumed');
      sound.stopCreatureCues();
      check(!sound.creatureNodes.size, 'Comfort cancellation retains rattle');
      const durations = [];
      console.log('Audio check: decoding new takes');
      for (const id of Object.keys(EXTRA_VOICES)) {
        const buffer = await sound.loadBuffer(id);
        check(buffer.duration > 1 && Number.isFinite(buffer.duration), 'New take failed decode: ' + id);
        let peak = 0;
        for (const sample of buffer.getChannelData(0)) {
          check(Number.isFinite(sample), 'New speech contains non-finite PCM');
          peak = Math.max(peak, Math.abs(sample));
        }
        check(peak > .01 && peak < .72, 'Decoded speech is silent/clipped: ' + id);
        durations.push({ id, seconds: buffer.duration, peak });
      }
      sound.voiceEnabled = false;
      await sound.voice('routineCall');
      console.log('Audio check: routine voice ' + sound.voiceDuration);
      const decodedRoutineDuration = durations.find(clip => clip.id === 'routineCall').seconds;
      // Vorbis priming is trimmed by Web Audio; ffprobe's container duration
      // includes that padding. Completion must follow the decoded PCM exactly.
      check(sound.currentVoice === 'routineCall' && sound.voiceDuration === decodedRoutineDuration &&
        Math.abs(decodedRoutineDuration - EXTRA_VOICES.routineCall.duration) < .1,
        'Mum reminder does not retain its full decoded duration');
      sound.reset();
      check(!sound.creatureNodes.size && !sound.currentVoice, 'Reset retains a new sound/voice');
      await sound.context.close();
      console.log('Audio check: closed');
      return { status: 'PASS', measurements, durations,
        checks: ['context-free preparation', 'zero play-time PCM allocations', 'finite original clicking/relay cues',
          'source/panner completion cleanup', 'pause retained tail', 'comfort/reset cancellation',
          'nine new Oggs decode with headroom', 'actual mother reminder duration'] };
    });
    assert.deepEqual(errors, []); assert.deepEqual(failed, []);
    console.log(JSON.stringify({ ...report, errors, failed }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
