import { DreadScore } from './dread-score.mjs';

// Original slow title-screen score. No recordings, voice or external
// assets; its context is created only by an explicit sound button gesture.
export class MenuAtmosphere {
  constructor({ volume = .55, onChange = () => {} } = {}) {
    this.volume = volume;
    this.onChange = onChange;
    this.enabled = false;
    this.active = true;
    this.context = null;
    this.nodes = [];
    this.sources = [];
    this.sequence = 0;
    this.suspendTimer = null;
  }
  prepare() {
    if (this.context) return;
    const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Audio) throw new Error('Audio is not supported.');
    const c = this.context = new Audio();
    const master = this.master = c.createGain();
    master.gain.value = 0;
    master.connect(c.destination);
    this.nodes.push(master);
    const buffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const samples = buffer.getChannelData(0);
    let seed = 8713, low = 0;
    for (let i = 0; i < samples.length; i++) {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      const white = (seed >>> 0) / 2147483648 - 1;
      low += (white - low) * .12;
      samples[i] = low;
    }
    this.score = new DreadScore(c, master, { noiseBuffer: buffer });
    this.score.setLevel(1);
  }
  async setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    try {
      if (this.enabled) this.prepare();
      await this.apply();
    } catch (error) {
      this.enabled = false;
      this.onChange(this.snapshot());
      throw error;
    }
    this.onChange(this.snapshot());
  }
  setVolume(value) {
    this.volume = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : .55;
    this.apply().catch(() => {});
  }
  setActive(active) {
    this.active = Boolean(active);
    this.apply().catch(() => {});
  }
  async apply() {
    clearTimeout(this.suspendTimer);
    const sequence = ++this.sequence, c = this.context;
    if (!c || c.state === 'closed') return;
    const audible = this.enabled && this.active && this.volume > 0;
    if (audible && c.state !== 'running') await c.resume();
    // A newer mute/capture request can arrive while resume is pending. It
    // may have seen a suspended context, so reconcile again once resume has
    // actually finished rather than leaving silent oscillators running.
    if (sequence !== this.sequence) return this.apply();
    const time = c.currentTime;
    this.master.gain.cancelScheduledValues(time);
    this.master.gain.setTargetAtTime(audible ? this.volume * .36 : 0, time, .065);
    if (!audible && c.state === 'running') this.suspendTimer = setTimeout(() => {
      if (sequence === this.sequence && c.state === 'running') c.suspend().catch(() => {});
    }, 350);
  }
  snapshot() {
    return { enabled: this.enabled, active: this.active, volume: this.volume,
      context: this.context?.state || 'uncreated', nodes: this.nodes.length + (this.score?.nodes.length || 0),
      gain: this.master?.gain.value || 0, score: this.score?.snapshot() || null };
  }
  async dispose() {
    clearTimeout(this.suspendTimer); this.sequence++;
    this.score?.dispose();
    for (const source of this.sources) { try { source.stop(); } catch {} }
    for (const node of this.nodes) { try { node.disconnect(); } catch {} }
    this.sources = []; this.nodes = [];
    if (this.context && this.context.state !== 'closed') await this.context.close();
  }
}
