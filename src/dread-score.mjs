// Original shared title/parlor score. A 44-second three-note phrase hangs over
// beating low strings; no drum clock, sampled performance or film cue is used.
export const DREAD_THEME = Object.freeze({
  id: 'mirror-me-the-house-remembers-1', period: 44,
  drones: Object.freeze([36.708, 55, 55.27, 73.416, 77.782]),
  notes: Object.freeze([
    Object.freeze({ at: 6.0, frequency: 146.832, rise: 2.4, hold: 2.0, fall: 5.4 }),
    Object.freeze({ at: 19.6, frequency: 174.614, rise: 3.4, hold: 1.8, fall: 5.8 }),
    Object.freeze({ at: 34.2, frequency: 155.563, rise: 2.5, hold: 1.5, fall: 5.0 }),
  ]),
});

export class DreadScore {
  constructor(context, destination, { noiseBuffer = null } = {}) {
    this.context = context;
    this.nodes = [];
    this.sources = [];
    this.disposed = false;
    this.level = 0;
    this.tension = 0;
    this.origin = context.currentTime;
    this.nextCycle = 0;
    this.output = this.own(context.createGain());
    this.output.gain.value = 0;
    this.output.connect(destination);
    const weights = [.085, .073, .047, .032, .016];
    DREAD_THEME.drones.forEach((frequency, index) => {
      const oscillator = this.own(context.createOscillator());
      const gain = this.own(context.createGain());
      oscillator.type = index >= 3 ? 'triangle' : 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.value = weights[index];
      oscillator.connect(gain);
      if (index >= 3) {
        const filter = this.own(context.createBiquadFilter());
        filter.type = 'lowpass'; filter.frequency.value = 420;
        filter.Q.value = .5;
        gain.connect(filter); filter.connect(this.output);
        if (index === 4) this.discord = gain;
      } else gain.connect(this.output);
      oscillator.start(); this.sources.push(oscillator);
    });
    this.notes = DREAD_THEME.notes.map(note => {
      const oscillator = this.own(context.createOscillator());
      const gain = this.own(context.createGain());
      const filter = this.own(context.createBiquadFilter());
      oscillator.type = 'triangle'; oscillator.frequency.value = note.frequency;
      gain.gain.value = 0;
      filter.type = 'lowpass'; filter.frequency.value = 780; filter.Q.value = .55;
      oscillator.connect(filter); filter.connect(gain); gain.connect(this.output);
      oscillator.start(); this.sources.push(oscillator);
      return { ...note, gain };
    });
    if (noiseBuffer) {
      const source = this.own(context.createBufferSource());
      const filter = this.own(context.createBiquadFilter());
      const gain = this.own(context.createGain());
      source.buffer = noiseBuffer; source.loop = true;
      filter.type = 'bandpass'; filter.frequency.value = 510; filter.Q.value = .65;
      gain.gain.value = .075;
      source.connect(filter); filter.connect(gain); gain.connect(this.output);
      source.start(); this.sources.push(source);
    }
    this.schedule();
    // Only automation events are queued here. Sources/PCM are never allocated
    // in a playing frame or at the first funeral beat.
    this.timer = setInterval(() => {
      if (!this.disposed && context.state === 'running') this.schedule();
    }, 8000);
  }
  own(node) { this.nodes.push(node); return node; }
  schedule() {
    const context = this.context;
    while (this.origin + this.nextCycle * DREAD_THEME.period < context.currentTime + 90) {
      const start = this.origin + this.nextCycle++ * DREAD_THEME.period;
      for (const note of this.notes) {
        const at = start + note.at;
        if (at < context.currentTime) continue;
        const gain = note.gain.gain;
        gain.setValueAtTime(0, at);
        gain.linearRampToValueAtTime(.024, at + note.rise);
        gain.setValueAtTime(.024, at + note.rise + note.hold);
        gain.linearRampToValueAtTime(0, at + note.rise + note.hold + note.fall);
      }
    }
  }
  setLevel(value, smoothing = .65) {
    const next = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
    if (Math.abs(next - this.level) < .0001 || this.disposed) return;
    this.level = next;
    const param = this.output.gain, time = this.context.currentTime;
    param.cancelScheduledValues(time);
    param.setTargetAtTime(next, time, Math.max(.015, smoothing));
  }
  setTension(value) {
    const next = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
    if (Math.abs(next - this.tension) < .0001 || this.disposed) return;
    this.tension = next;
    this.discord.gain.setTargetAtTime(.016 + next * .027, this.context.currentTime, 1.5);
  }
  restart() {
    if (this.disposed) return;
    const time = this.context.currentTime;
    for (const note of this.notes) {
      note.gain.gain.cancelScheduledValues(time);
      note.gain.gain.setValueAtTime(0, time);
    }
    this.origin = time; this.nextCycle = 0; this.schedule();
  }
  silence() {
    if (this.disposed) return;
    this.level = 0;
    this.output.gain.cancelScheduledValues(this.context.currentTime);
    this.output.gain.setValueAtTime(0, this.context.currentTime);
    this.setTension(0);
  }
  snapshot() {
    return { theme: DREAD_THEME.id, level: this.level, tension: this.tension,
      sources: this.sources.length, nodes: this.nodes.length, cyclesScheduled: this.nextCycle };
  }
  dispose() {
    if (this.disposed) return;
    clearInterval(this.timer); this.silence(); this.disposed = true;
    for (const source of this.sources) { try { source.stop(); } catch {} }
    for (const node of this.nodes) { try { node.disconnect(); } catch {} }
    this.sources.length = this.nodes.length = 0;
  }
}
