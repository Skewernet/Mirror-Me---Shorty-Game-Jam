import { TARGETS, HALL_CLOCK } from "./layout.mjs";
import { VOICES } from "./story.mjs";
export class Sound {
  constructor(onSubtitle) {
    this.onSubtitle = onSubtitle;
    this.volume = 0.55;
    this.voiceEnabled = true;
    this.lastStep = 0;
    this.buffers = new Map();
    this.playingVoice = null;
    this.voiceTimer = null;
    this.voiceToken = 0;
    this.paused = true;
    this.busy = false;
    this.currentVoice = null;
    this.resumeId = null;
    this.musicNext = 0;
    this.dripNext = 0;
    this.noteIndex = 0;
    this.ringNext = 0;
    this.tickNext = 0;
    this.creakNext = 0;
  }
  async start() {
    if (!this.context) {
      const c = (this.context = new (window.AudioContext ||
        window.webkitAudioContext)());
      this.master = c.createGain();
      this.master.gain.value = this.volume * 0.55;
      const compressor = c.createDynamicsCompressor();
      compressor.threshold.value = -15;
      compressor.ratio.value = 4;
      this.master.connect(compressor);
      compressor.connect(c.destination);
      this.ambience = c.createGain();
      this.ambience.gain.value = 0.13;
      this.ambience.connect(this.master);
      for (const [f, gain] of [
        [49, 0.09],
        [98, 0.017],
        [147, 0.006],
      ]) {
        const o = c.createOscillator(),
          g = c.createGain();
        o.frequency.value = f;
        g.gain.value = gain;
        o.connect(g);
        g.connect(this.ambience);
        o.start();
      }
      this.noise = c.createBuffer(1, c.sampleRate * 3, c.sampleRate);
      const data = this.noise.getChannelData(0);
      let last = 0;
      for (let i = 0; i < data.length; i++) {
        last = (last + (Math.random() * 2 - 1) * 0.035) / 1.02;
        data[i] = last;
      }
      const air = c.createBufferSource(),
        filter = c.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 600;
      air.buffer = this.noise;
      air.loop = true;
      air.connect(filter);
      filter.connect(this.ambience);
      air.start();
      this.phonePanner = this.panner(
        TARGETS.telephone.x,
        TARGETS.telephone.y,
        TARGETS.telephone.z,
      );
      this.phonePanner.connect(this.master);
      this.radio = this.roomNoise(
        TARGETS.radio.x,
        TARGETS.radio.y,
        TARGETS.radio.z,
        850,
        0,
      );
      this.radioSpeech = c.createGain();
      this.radioSpeech.gain.value = this.voiceEnabled ? 1.8 : 0;
      this.radioSpeech.connect(this.radio);
      // Original weather bulletin with a long quiet tail; it follows the radio knob,
      // room position and voice switch, independently of narrative dialogue.
      this.loadBuffer("broadcast")
        .then((buffer) => {
          const source = c.createBufferSource();
          source.buffer = buffer;
          source.loop = true;
          source.connect(this.radioSpeech);
          source.start();
          this.broadcast = source;
        })
        .catch((error) =>
          console.warn(
            "Radio bulletin unavailable; static retained.",
            error.message,
          ),
        );
      this.water = this.roomNoise(
        TARGETS.tap.x,
        TARGETS.tap.y,
        TARGETS.tap.z,
        1600,
        0.1,
      );
      this.rain = this.roomNoise(-4.35, 1.7, 4.1, 2100, 0.045);
      this.rain.panner.refDistance = 2.5;
      this.creakNext = c.currentTime + 16;
      this.musicPanner = this.panner(
        TARGETS.musicbox.x,
        TARGETS.musicbox.y,
        TARGETS.musicbox.z,
      );
      this.musicPanner.connect(this.master);
    }
    this.paused = false;
    await this.context.resume();
    if (this.resumeId) {
      const id = this.resumeId;
      this.resumeId = null;
      this.voice(id);
    }
  }
  panner(x, y, z) {
    const p = this.context.createPanner();
    p.panningModel = "HRTF";
    p.distanceModel = "inverse";
    p.refDistance = 1.2;
    p.maxDistance = 15;
    p.rolloffFactor = 1.4;
    p.positionX.value = x;
    p.positionY.value = y;
    p.positionZ.value = z;
    return p;
  }
  roomNoise(x, y, z, frequency, gain) {
    const c = this.context,
      source = c.createBufferSource(),
      filter = c.createBiquadFilter(),
      g = c.createGain(),
      p = this.panner(x, y, z);
    source.buffer = this.noise;
    source.loop = true;
    filter.type = "bandpass";
    filter.frequency.value = frequency;
    filter.Q.value = 1;
    g.gain.value = gain;
    source.connect(filter);
    filter.connect(g);
    g.connect(p);
    p.connect(this.master);
    source.start();
    g.panner = p;
    return g;
  }
  setVolume(value) {
    this.volume = value;
    if (this.master)
      this.master.gain.setTargetAtTime(
        value * 0.55,
        this.context.currentTime,
        0.05,
      );
  }
  setVoice(value) {
    this.voiceEnabled = value;
    if (this.radioSpeech) this.radioSpeech.gain.value = value ? 1.8 : 0;
    if (!value && this.playingVoice) {
      this.playingVoice.onended = null;
      try {
        this.playingVoice.stop();
      } catch {}
      this.playingVoice = null;
    }
  }
  async pause() {
    this.paused = true;
    if (this.currentVoice) this.resumeId = this.currentVoice;
    this.stopVoice();
    if (this.context?.state === "running") await this.context.suspend();
  }
  stopVoice(clear = true) {
    this.voiceToken++;
    this.busy = false;
    this.currentVoice = null;
    if (this.playingVoice) {
      this.playingVoice.onended = null;
      try {
        this.playingVoice.stop();
      } catch {}
      this.playingVoice = null;
    }
    clearTimeout(this.voiceTimer);
    if (clear) this.onSubtitle("");
  }
  reset() {
    this.stopVoice();
    this.resumeId = null;
    this.lastStep = 0;
    this.musicNext = this.dripNext = this.noteIndex = 0;
    this.ringNext = 0;
    this.tickNext = 0;
    this.creakNext = (this.context?.currentTime || 0) + 16;
    if (this.ambience) this.ambience.gain.value = 0.13;
  }
  impulse(frequency, gain, duration, pan = 0, destination = null) {
    if (!this.context || this.paused) return;
    const c = this.context,
      t = c.currentTime,
      o = c.createOscillator(),
      g = c.createGain(),
      p = c.createStereoPanner();
    o.frequency.setValueAtTime(frequency, t);
    o.frequency.exponentialRampToValueAtTime(frequency * 0.72, t + duration);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    p.pan.value = pan;
    o.connect(g);
    g.connect(p);
    p.connect(destination || this.master);
    o.start();
    o.stop(t + duration);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
      p.disconnect();
    };
  }
  noiseBurst(duration, gain, frequency, pan = 0, destination = null) {
    if (!this.context || this.paused) return;
    const c = this.context;
    if (!this.foleyNoise) {
      this.foleyNoise = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = this.foleyNoise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = c.currentTime,
      source = c.createBufferSource(),
      f = c.createBiquadFilter(),
      envelope = c.createGain(),
      stereo = c.createStereoPanner();
    source.buffer = this.foleyNoise;
    f.type = "bandpass";
    f.frequency.value = frequency;
    f.Q.value = 0.8;
    envelope.gain.setValueAtTime(0.0001, t);
    envelope.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    stereo.pan.value = pan;
    source.connect(f);
    f.connect(envelope);
    envelope.connect(stereo);
    stereo.connect(destination || this.master);
    source.start(t, Math.random() * 0.15);
    source.stop(t + duration);
    source.onended = () => {
      source.disconnect();
      f.disconnect();
      envelope.disconnect();
      stereo.disconnect();
    };
  }
  step(distance, speed, carpet = true) {
    if (distance < this.lastStep) this.lastStep = distance;
    if (speed > 0.15 && distance - this.lastStep > 0.8) {
      this.lastStep = distance;
      this.impulse(
        92 + Math.random() * 17,
        0.12,
        0.12,
        Math.floor(distance / 0.8) % 2 ? 0.08 : -0.08,
      );
      this.noiseBurst(
        carpet ? 0.18 : 0.13,
        carpet ? 0.023 : 0.043,
        carpet ? 580 : 1100,
      );
    }
  }
  effect(id, position = null) {
    if (
      position &&
      [
        "frame-shift",
        "frame-fall",
        "cup-slide",
        "cup-fall",
        "mirror-snap",
        "hall-appearance",
        "loop-latch",
      ].includes(id) &&
      this.context &&
      !this.paused
    ) {
      const source = this.panner(position.x, position.y || 0.3, position.z);
      source.connect(this.master);
      if (id === "mirror-snap" || id === "hall-appearance") {
        // A short, spatial impact with headroom, followed by a thin glass resonance.
        this.impulse(id === "mirror-snap" ? 56 : 43, 0.24, 0.4, 0, source);
        this.noiseBurst(
          0.19,
          0.16,
          id === "mirror-snap" ? 1480 : 540,
          0,
          source,
        );
        for (const f of [730, 1130]) this.impulse(f, 0.018, 0.9, 0, source);
      } else if (id === "loop-latch") {
        this.noiseBurst(0.14, 0.09, 860, 0, source);
        this.impulse(67, 0.1, 0.23, 0, source);
      } else if (id === "frame-shift") {
        this.noiseBurst(0.4, 0.075, 320, 0, source);
      } else if (id === "cup-slide") {
        this.noiseBurst(0.3, 0.045, 1450, 0, source);
      } else if (id === "frame-fall") {
        this.impulse(83, 0.22, 0.22, 0, source);
        this.noiseBurst(0.24, 0.19, 650, 0, source);
        this.impulse(1850, 0.024, 0.55, 0, source);
      } else {
        for (const f of [1700, 2450, 3100])
          this.impulse(f, 0.035, 0.55, 0, source);
        this.noiseBurst(0.07, 0.07, 2200, 0, source);
      }
      setTimeout(() => source.disconnect(), 2500);
      return;
    }
    if (
      [
        "drawer-open",
        "drawer-close",
        "door-wood",
        "backdoor-open",
        "backdoor-close",
      ].includes(id)
    ) {
      this.noiseBurst(0.52, 0.075, 420, 0.35);
      this.impulse(58, 0.08, 0.16, 0.35);
    }
    if (id === "key" || id === "fuse") {
      this.noiseBurst(0.04, 0.03, 2400, 0.2);
      for (const f of [1700, 2410, 3180]) this.impulse(f, 0.014, 0.3, 0.2);
    }
    if (id === "unlocked") {
      this.impulse(103, 0.12, 0.19);
      this.noiseBurst(0.12, 0.085, 1500);
    }
    if (id === "locked" || id === "front-locked" || id === "bedroom-locked")
      this.noiseBurst(0.12, 0.08, 850);
    if (id === "knock" || id === "behind") {
      this.impulse(72, 0.15, 0.17, id === "behind" ? -0.8 : 0.7);
      this.noiseBurst(0.14, 0.08, 480, 0.7);
    }
    if (id === "switch" || id === "power")
      this.noiseBurst(0.06, id === "power" ? 0.13 : 0.04, 1800);
    if (id === "clock-set" || id === "clock-solved")
      this.noiseBurst(0.08, 0.04, 1300);
    if (id === "glass") {
      for (const f of [480, 760, 1030]) this.impulse(f, 0.028, 1.1);
    }
    if (id === "echo-silenced" || id === "house-quiet")
      this.noiseBurst(0.045, 0.028, 750);
    if (id === "wrong-order") this.impulse(39, 0.07, 1.0);
    if (id === "drip") this.impulse(850, 0.015, 0.15, 0, this.water?.panner);
  }
  update(state, player) {
    if (!this.context || this.paused) return;
    const c = this.context,
      t = c.currentTime,
      l = c.listener;
    if (l.positionX) {
      l.positionX.value = player.x;
      l.positionY.value = 1.64;
      l.positionZ.value = player.z;
      l.forwardX.value = -Math.sin(player.yaw);
      l.forwardY.value = 0;
      l.forwardZ.value = -Math.cos(player.yaw);
      l.upX.value = 0;
      l.upY.value = 1;
      l.upZ.value = 0;
    }
    const frozen = state.frozen || state.stage >= 3;
    this.ambience.gain.setTargetAtTime(frozen ? 0.006 : 0.13, t, 0.8);
    const inverted = state.stage >= 3,
      echo = state.echoIndex || 0;
    this.radio.gain.setTargetAtTime(
      inverted && echo >= 3 ? 0 : state.power && state.radioOn ? 0.12 : 0,
      t,
      0.15,
    );
    this.water.gain.setTargetAtTime(inverted && echo >= 2 ? 0 : 0.11, t, 0.15);
    this.rain.gain.setTargetAtTime(state.stage >= 4 ? 0 : 0.045, t, 0.8);
    // Sparse structural sound, kept separate from the three puzzle sources.
    if (state.stage < 3 && t > this.creakNext) {
      this.creakNext = t + 24 + Math.random() * 12;
      const source = this.panner(4.3, 2.25, 0);
      source.connect(this.master);
      this.noiseBurst(0.8, 0.05, 210, 0, source);
      this.impulse(96, 0.025, 0.6, 0, source);
      setTimeout(() => source.disconnect(), 2500);
    }
    if (
      !state.clockSolved &&
      Math.hypot(player.x - HALL_CLOCK.x, player.z - HALL_CLOCK.z) < 2.3 &&
      t > this.tickNext
    ) {
      this.tickNext = t + 1;
      this.impulse(1380, 0.01, 0.025);
    }
    if (
      ((!state.heardArrival && state.stage === 0) ||
        (state.stage === 2 && state.clockSolved && !state.heardCall)) &&
      t > this.ringNext
    ) {
      this.ringNext = t + 1.6;
      this.impulse(930, 0.12, 0.22, 0, this.phonePanner);
      this.impulse(1130, 0.07, 0.24, 0, this.phonePanner);
    }
    if (t > this.musicNext && !(inverted && echo >= 1) && state.stage >= 1) {
      this.musicNext = t + 1.4;
      const notes = [659.25, 783.99, 587.33, 523.25, 659.25, 440];
      this.impulse(
        notes[this.noteIndex++ % notes.length],
        0.045,
        0.65,
        0,
        this.musicPanner,
      );
    }
  }
  async loadBuffer(id) {
    if (!this.buffers.has(id)) {
      const r = await fetch(`assets/voice/${id}.ogg`);
      if (!r.ok) throw Error(`voice ${id}: ${r.status}`);
      this.buffers.set(
        id,
        await this.context.decodeAudioData(await r.arrayBuffer()),
      );
    }
    return this.buffers.get(id);
  }
  async voice(id) {
    const line = VOICES[id];
    if (!line) return;
    this.stopVoice();
    this.busy = true;
    this.currentVoice = id;
    const token = this.voiceToken;
    this.onSubtitle(`${line.speaker} — “${line.text}”`);
    const done = () => {
      if (token === this.voiceToken) {
        this.onSubtitle("");
        this.busy = false;
        this.currentVoice = null;
      }
    };
    this.voiceTimer = setTimeout(done, Math.max(3500, line.text.length * 65));
    if (!this.voiceEnabled || !this.context || this.paused) return;
    try {
      await this.loadBuffer(id);
      if (token !== this.voiceToken || this.paused) return;
      const c = this.context,
        source = c.createBufferSource(),
        g = c.createGain(),
        filter = c.createBiquadFilter();
      source.buffer = this.buffers.get(id);
      g.gain.value = line.speaker === "THE TELEPHONE" ? 1.65 : 0.95;
      filter.type = "lowpass";
      filter.frequency.value =
        line.speaker === "THE GLASS"
          ? 3200
          : line.speaker === "THE TELEPHONE"
            ? 3300
            : 6000;
      source.connect(filter);
      filter.connect(g);
      g.connect(
        line.speaker === "THE TELEPHONE" ? this.phonePanner : this.master,
      );
      this.playingVoice = source;
      clearTimeout(this.voiceTimer);
      this.voiceTimer = setTimeout(done, source.buffer.duration * 1000 + 650);
      source.onended = () => {
        if (this.playingVoice === source) this.playingVoice = null;
        source.disconnect();
        filter.disconnect();
        g.disconnect();
      };
      source.start();
    } catch (error) {
      console.warn("Voice unavailable; subtitles retained.", error.message);
    }
  }
}
