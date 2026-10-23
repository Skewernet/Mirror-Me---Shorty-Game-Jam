import { VOICES } from "./story.mjs";
export class Sound {
  constructor(onSubtitle) {
    this.onSubtitle = onSubtitle;
    this.volume = 0.55;
    this.voiceEnabled = true;
    this.silent = false;
    this.lastStep = 0;
    this.buffers = new Map();
    this.playingVoice = null;
    this.voiceTimer = null;
    this.voiceToken = 0;
    this.paused = true;
  }
  async start() {
    if (!this.context) {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
      const c = this.context;
      this.master = c.createGain();
      this.master.gain.value = this.volume * 0.48;
      const compressor = c.createDynamicsCompressor();
      compressor.threshold.value = -12;
      compressor.ratio.value = 5;
      this.master.connect(compressor);
      compressor.connect(c.destination);
      this.ambience = c.createGain();
      this.ambience.gain.value = 0.13;
      this.ambience.connect(this.master);
      for (const [freq, gain] of [
        [49, 0.11],
        [98, 0.025],
        [147, 0.01],
      ]) {
        const o = c.createOscillator(),
          g = c.createGain();
        o.frequency.value = freq;
        g.gain.value = gain;
        o.connect(g);
        g.connect(this.ambience);
        o.start();
      }
      const noise = c.createBuffer(1, c.sampleRate * 3, c.sampleRate),
        data = noise.getChannelData(0);
      let last = 0;
      for (let i = 0; i < data.length; i++) {
        last = (last + (Math.random() * 2 - 1) * 0.03) / 1.015;
        data[i] = last;
      }
      const air = c.createBufferSource(),
        filter = c.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 700;
      air.buffer = noise;
      air.loop = true;
      air.connect(filter);
      filter.connect(this.ambience);
      air.start();
    }
    this.paused = false;
    await this.context.resume();
  }
  setVolume(value) {
    this.volume = value;
    if (this.master)
      this.master.gain.setTargetAtTime(
        value * 0.48,
        this.context.currentTime,
        0.05,
      );
  }
  setVoice(value) {
    this.voiceEnabled = value;
    if (!value) this.stopVoice(false);
  }
  async pause() {
    this.paused = true;
    this.stopVoice();
    if (this.context?.state === "running") await this.context.suspend();
  }
  stopVoice(clear = true) {
    this.voiceToken++;
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
    this.lastStep = 0;
    this.silent = false;
    if (this.ambience) this.ambience.gain.value = 0.13;
  }
  impulse(frequency, gain, duration, pan = 0) {
    if (!this.context || this.paused) return;
    const c = this.context,
      t = c.currentTime,
      o = c.createOscillator(),
      g = c.createGain(),
      p = c.createStereoPanner();
    o.type = "sine";
    o.frequency.setValueAtTime(frequency, t);
    o.frequency.exponentialRampToValueAtTime(frequency * 0.55, t + duration);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    p.pan.value = pan;
    o.connect(g);
    g.connect(p);
    p.connect(this.master);
    o.start();
    o.stop(t + duration);
  }
  noiseBurst(duration, gain, frequency, pan = 0) {
    if (!this.context || this.paused) return;
    const c = this.context;
    if (!this.foleyNoise) {
      this.foleyNoise = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const data = this.foleyNoise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const t = c.currentTime;
    const source = c.createBufferSource(),
      filter = c.createBiquadFilter();
    const envelope = c.createGain(),
      stereo = c.createStereoPanner();
    source.buffer = this.foleyNoise;
    filter.type = "bandpass";
    filter.frequency.value = frequency;
    filter.Q.value = 0.8;
    envelope.gain.setValueAtTime(0.0001, t);
    envelope.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    stereo.pan.value = pan;
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(stereo);
    stereo.connect(this.master);
    source.start(t, Math.random() * 0.2);
    source.stop(t + duration);
  }
  step(distance, speed, carpet = true) {
    if (distance < this.lastStep) this.lastStep = distance;
    if (speed > 0.15 && distance - this.lastStep > 0.82) {
      this.lastStep = distance;
      this.impulse(
        105 + Math.random() * 20,
        0.14,
        0.1,
        Math.floor(distance / 0.82) % 2 ? 0.16 : -0.16,
      );
      this.noiseBurst(
        carpet ? 0.16 : 0.11,
        carpet ? 0.02 : 0.04,
        carpet ? 650 : 1050,
      );
    }
  }
  effect(id) {
    if (id === "drawer-open" || id === "drawer-close") {
      this.noiseBurst(0.48, 0.095, 460, 0.4);
      this.impulse(62, 0.07, 0.12, 0.4);
    }
    if (id === "key") {
      this.noiseBurst(0.04, 0.035, 2600, 0.3);
      for (const frequency of [1780, 2390, 3170])
        this.impulse(frequency, 0.018, 0.35, 0.3);
    }
    if (id === "unlocked") {
      this.impulse(110, 0.2, 0.22);
      this.noiseBurst(0.14, 0.09, 1500);
    }
    if (id === "locked") {
      this.impulse(95, 0.1, 0.1);
      this.noiseBurst(0.1, 0.08, 1000);
    }
    if (id === "knock") {
      this.impulse(72, 0.16, 0.16, 0.75);
      this.noiseBurst(0.12, 0.12, 520, 0.75);
      setTimeout(() => this.impulse(65, 0.13, 0.2, 0.75), 360);
    }
  }
  update(frozen) {
    if (this.ambience)
      this.ambience.gain.setTargetAtTime(
        frozen ? 0.003 : 0.13,
        this.context.currentTime,
        0.7,
      );
  }
  async voice(id) {
    const line = VOICES[id];
    if (!line) return;
    this.stopVoice();
    const token = this.voiceToken;
    this.onSubtitle(`${line.speaker} — “${line.text}”`);
    const fallbackDuration = Math.max(3500, line.text.length * 65);
    this.voiceTimer = setTimeout(() => {
      if (token === this.voiceToken) this.onSubtitle("");
    }, fallbackDuration);
    if (!this.voiceEnabled || !this.context || this.paused) return;
    try {
      if (!this.buffers.has(id)) {
        const r = await fetch(`assets/voice/${id}.ogg`);
        if (!r.ok) throw Error(`voice ${id}: ${r.status}`);
        const buffer = await this.context.decodeAudioData(
          await r.arrayBuffer(),
        );
        this.buffers.set(id, buffer);
      }
      if (token !== this.voiceToken || this.paused) return;
      const source = this.context.createBufferSource(),
        g = this.context.createGain(),
        filter = this.context.createBiquadFilter();
      source.buffer = this.buffers.get(id);
      g.gain.value = 0.85;
      filter.type = "lowpass";
      filter.frequency.value = line.speaker === "THE GLASS" ? 3100 : 6000;
      source.connect(filter);
      filter.connect(g);
      g.connect(this.master);
      this.playingVoice = source;
      clearTimeout(this.voiceTimer);
      this.voiceTimer = setTimeout(
        () => {
          if (token === this.voiceToken) this.onSubtitle("");
        },
        source.buffer.duration * 1000 + 850,
      );
      source.onended = () => {
        if (this.playingVoice === source) this.playingVoice = null;
      };
      source.start();
    } catch (error) {
      console.warn("Voice unavailable; subtitles retained.", error.message);
    }
  }
}
