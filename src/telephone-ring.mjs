// Original electromechanical telephone bell: alternating clapper strikes excite
// two fixed, inharmonic steel resonators. No oscillator pitch sweep or recording.
export function makeTelephoneRing(context) {
  const rate = context.sampleRate;
  const buffer = context.createBuffer(1, Math.ceil(rate * 1.34), rate);
  const output = buffer.getChannelData(0);
  const modes = [
    [887, 1368, 1803, 2467, 3123],
    [1109, 1657, 2287, 2839, 3527],
  ];
  const weights = [1, .46, .27, .14, .075];
  const bells = modes.map(frequencies => {
    const data = new Float32Array(Math.ceil(rate * .29));
    for (let mode = 0; mode < frequencies.length; mode++) {
      const step = 2 * Math.PI * frequencies[mode] / rate;
      const rotation = 2 * Math.cos(step);
      const decay = Math.exp(-(18 + mode * 11) / rate);
      let previous = 0, older = -Math.sin(step), level = weights[mode];
      for (let index = 0; index < data.length; index++) {
        const value = rotation * previous - older;
        older = previous;
        previous = value;
        // A short felt-hammer attack removes an artificial digital edge.
        data[index] += value * level * Math.min(1, index / (rate * .0008));
        level *= decay;
      }
    }
    return data;
  });
  for (const start of [0, .64]) {
    for (let strike = 0; strike < 12; strike++) {
      const offset = Math.round((start + strike * .0356 + Math.sin(strike * 2.1) * .0007) * rate);
      const bell = bells[strike % 2];
      const strength = .87 + .13 * Math.sin(strike * 1.71 + .8);
      for (let index = 0; index < bell.length && index + offset < output.length; index++)
        output[index + offset] += bell[index] * strength;
    }
  }
  let peak = 0;
  for (const value of output) peak = Math.max(peak, Math.abs(value));
  for (let index = 0; index < output.length; index++)
    output[index] *= .64 / Math.max(peak, .001) * Math.min(1, (output.length - index - 1) / (rate * .04));
  return buffer;
}

export class TelephoneRinger {
  constructor(context, destination, buffer = null) {
    this.context = context;
    this.destination = destination;
    this.buffer = buffer || makeTelephoneRing(context);
    this.source = this.envelope = null;
    this.nextAt = 0;
  }
  update(ringing) {
    if (!ringing) {
      this.stop();
      return;
    }
    const time = this.context.currentTime;
    if (time < this.nextAt || this.source) return;
    const source = this.context.createBufferSource();
    const envelope = this.context.createGain();
    source.buffer = this.buffer;
    envelope.gain.value = .56;
    source.connect(envelope);
    envelope.connect(this.destination);
    this.source = source;
    this.envelope = envelope;
    this.nextAt = time + 3.6;
    source.onended = () => {
      if (this.source === source) this.source = this.envelope = null;
      source.disconnect();
      envelope.disconnect();
    };
    source.start();
  }
  stop(immediate = false) {
    const source = this.source, envelope = this.envelope;
    this.source = this.envelope = null;
    this.nextAt = 0;
    if (!source) return;
    const time = this.context.currentTime;
    if (!immediate) {
      envelope.gain.cancelScheduledValues(time);
      envelope.gain.setValueAtTime(envelope.gain.value, time);
      envelope.gain.linearRampToValueAtTime(0, time + .018);
    }
    try { source.stop(immediate ? time : time + .02); } catch {}
  }
}
