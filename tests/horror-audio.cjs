// Real Web Audio: prepared finite horror cues, intelligible attack speech,
// shared slow title/parlor score and the actual pause/reset/mute lifecycle.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.MIRROR_TEST_URL || 'http://127.0.0.1:8000';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required'] });
  try {
    const page = await browser.newPage(), errors = [], failed = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('requestfailed', request => failed.push(request.url()));
    await page.route('**/__horror-audio__', route => route.fulfill({ contentType: 'text/html',
      body: '<!doctype html><link rel="icon" href="data:,"><body>Horror audio validation</body>' }));
    await page.goto(base + '/__horror-audio__');
    const report = await page.evaluate(async () => {
      const { Sound } = await import('/src/sound.mjs');
      const { DreadScore, DREAD_THEME } = await import('/src/dread-score.mjs');
      const { MenuAtmosphere } = await import('/src/menu-audio.mjs');
      const check = (value, message) => { if (!value) throw new Error(message); };
      const measure = buffer => {
        let peak = 0, energy = 0, tail = 0;
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
          const samples = buffer.getChannelData(channel);
          for (let index = 0; index < samples.length; index++) {
            check(Number.isFinite(samples[index]), 'Non-finite audio sample');
            peak = Math.max(peak, Math.abs(samples[index]));
            energy += samples[index] * samples[index];
            if (index > samples.length - buffer.sampleRate * .1)
              tail = Math.max(tail, Math.abs(samples[index]));
          }
        }
        return { peak, rms: Math.sqrt(energy / (buffer.length * buffer.numberOfChannels)), tail };
      };
      const fixture = async seconds => {
        const context = new OfflineAudioContext(2, 48000 * seconds, 48000);
        const sound = new Sound(() => {});
        await sound.prepare();
        check(!sound.context, 'Preparation opened an audio device before activation');
        check(sound.attackBuffers.size === 5, 'Horror PCM was not fully prepared');
        sound.context = context; sound.paused = false;
        sound.master = context.createGain(); sound.master.connect(context.destination);
        sound.effects = context.createGain(); sound.effects.connect(sound.master);
        let allocations = 0, disconnects = 0;
        const create = context.createBuffer.bind(context);
        context.createBuffer = (...args) => { allocations++; return create(...args); };
        const panner = sound.panner.bind(sound);
        sound.panner = (...args) => {
          const node = panner(...args), disconnect = node.disconnect.bind(node);
          node.disconnect = (...values) => { disconnects++; return disconnect(...values); };
          return node;
        };
        return { context, sound, stats: () => ({ allocations, disconnects }) };
      };
      const clips = [];
      for (const id of ['crawler-click', 'funeral-turn', 'funeral-lunge', 'funeral-impact', 'crawler-contact']) {
        const { context, sound, stats } = await fixture(2);
        sound.effect(id, { x: 0, y: 0, z: -.5, intensity: .7 });
        check(stats().allocations === 0, 'First cue allocated PCM: ' + id);
        const measurements = measure(await context.startRendering());
        await new Promise(resolve => setTimeout(resolve, 20));
        check(measurements.peak > .025 && measurements.peak < .65,
          'Silent/clipped cue: ' + id + ' ' + JSON.stringify(measurements));
        check(measurements.tail < 1e-6, 'Unbounded cue tail: ' + id);
        check(!sound.creatureNodes.size && stats().disconnects === (id === 'funeral-turn' ? 0 : 1),
          'Cue/panner leak: ' + id);
        clips.push({ id, ...measurements, ...stats() });
      }
      // Maximum user volume, the actual attack's 1.05 spatial Goodnight gain,
      // overlapping stings, ducked score and the game's existing compressor.
      const mix = await fixture(3), { context, sound } = mix;
      sound.master.disconnect(); sound.master.gain.value = .55;
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -15; compressor.ratio.value = 4;
      sound.master.connect(compressor); compressor.connect(context.destination);
      context.listener.positionY.value = 1.64;
      const attackScore = new DreadScore(context, sound.master, { noiseBuffer: sound.noise });
      attackScore.setLevel(.1, .015); attackScore.setTension(1);
      const goodnight = await sound.loadBuffer('goodnight');
      const voice = context.createBufferSource(), speech = context.createGain();
      voice.buffer = goodnight; speech.gain.value = 1.05;
      const speechFilter = context.createBiquadFilter();
      speechFilter.type = 'lowpass'; speechFilter.frequency.value = 6000;
      const speechPanner = sound.panner(0, 1.5, -.4);
      speechPanner.refDistance = 2.2; speechPanner.rolloffFactor = .8;
      voice.connect(speechFilter); speechFilter.connect(speech); speech.connect(speechPanner);
      speechPanner.connect(sound.master);
      voice.start(.08);
      sound.effect('funeral-turn');
      const lunge = context.suspend(.22).then(() => { sound.effect('funeral-lunge'); return context.resume(); });
      const impact = context.suspend(.42).then(() => { sound.effect('funeral-impact'); return context.resume(); });
      const rendering = context.startRendering();
      await Promise.all([lunge, impact]);
      const attackMix = measure(await rendering);
      attackScore.dispose();
      check(attackMix.peak > .10 && attackMix.peak < .7,
        'Attack plus Mum speech clips or leaves an unbounded tail: ' + JSON.stringify(attackMix));
      check(mix.stats().allocations === 0, 'Attack allocated PCM during playback');
      const scoreContext = new OfflineAudioContext(2, 48000 * 48, 48000);
      const score = new DreadScore(scoreContext, scoreContext.destination);
      score.setLevel(1, .1);
      const scoreGraph = score.snapshot();
      const scoreAudio = measure(await scoreContext.startRendering());
      check(scoreAudio.peak > .08 && scoreAudio.peak < .45 && scoreAudio.rms > .025,
        'Slow score is silent or lacks headroom');
      check(scoreGraph.sources === 8 && scoreGraph.nodes <= 24, 'Score graph is unexpectedly large');
      check(DREAD_THEME.period === 44 && DREAD_THEME.notes[1].at - DREAD_THEME.notes[0].at > 13,
        'Score lost its sparse, slow phrase');
      score.dispose();

      const live = new Sound(() => {}); await live.prepare(); await live.start();
      live.master.gain.value = 0;
      let allocations = 0;
      const create = live.context.createBuffer.bind(live.context);
      live.context.createBuffer = (...args) => { allocations++; return create(...args); };
      const player = { x: 0, z: 10, yaw: 0 };
      const state = { stage: 6, wakeEntered: true, ended: false, silenceComplete: true,
        clockSolved: true, echoIndex: 3, musicboxOn: false, tapOn: false, radioOn: false };
      live.update(state, player);
      const normal = live.funeralScore.snapshot();
      check(normal.level === .42 && normal.tension === .2, 'Funeral theme did not enter automatically');
      live.busy = true; live.update(state, player);
      const ducked = live.funeralScore.snapshot();
      check(ducked.level === .10, 'Funeral soundtrack does not duck beneath the full news report');
      live.busy = false;
      live.effect('light-switch-bank'); live.update(state, player);
      check(live.funeralScore.snapshot().tension === .75, 'Pre-attack flicker does not tighten the score');
      live.effect('funeral-turn'); live.update(state, player);
      check(live.funeralScore.snapshot().tension === 1, 'Forced-turn cue does not peak the score');
      for (let index = 0; index < 120; index++) live.update(state, player);
      check(allocations === 0 && live.funeralScore.snapshot().sources === normal.sources,
        'Playing frames allocated PCM or grew the score graph');
      await live.pause(); const time = live.context.currentTime;
      await new Promise(resolve => setTimeout(resolve, 100));
      check(live.context.state === 'suspended' && live.context.currentTime === time, 'Score advances while paused');
      await live.start();
      check(live.context.state === 'running', 'Score cannot resume');
      const menu = new MenuAtmosphere(); await menu.setEnabled(true);
      check(menu.snapshot().score.theme === normal.theme, 'Menu and funeral use different themes');
      menu.setVolume(0); await new Promise(resolve => setTimeout(resolve, 420));
      check(menu.context.state === 'suspended', 'Muted menu leaves an audio context running');
      await menu.dispose();
      const hints = [];
      for (const id of ['mirrorClock0', 'mirrorClock1', 'mirrorClock2']) {
        const clip = await live.loadBuffer(id), audio = measure(clip);
        check(clip.duration > 2 && audio.peak > .01 && audio.peak < .72, 'Clock hint decode/headroom failed: ' + id);
        hints.push({ id, seconds: clip.duration, peak: audio.peak });
      }
      live.reset();
      check(live.funeralScore.snapshot().level === 0 && !live.creatureNodes.size, 'Reset retains score or attack cues');
      live.funeralScore.dispose(); await live.context.close();
      return { status: 'PASS', clips, attackMix, score: { ...scoreGraph, ...scoreAudio }, normal, ducked, hints,
        checks: ['prepared PCM reused', 'finite original clicking and growl cues', 'panner/source cleanup',
          'attack plus Mum headroom', 'shared slow title/parlor theme', 'speech ducking',
          'constant score graph', 'pause/resume/reset', 'menu mute suspension', 'three new hints decoded'] };
    });
    assert.deepEqual(errors, []); assert.deepEqual(failed, []);
    console.log(JSON.stringify({ ...report, errors, failed }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
