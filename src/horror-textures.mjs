// Original finite nonverbal PCM, generated once while loading. These use
// glottal closures, filtered air and resonances, never sampled film/voice audio.
export const HORROR_TEXTURES = Object.freeze({
  click: Object.freeze({ seconds: .88, seed: 82971 }),
  turn: Object.freeze({ seconds: 1.15, seed: 291113 }),
  lunge: Object.freeze({ seconds: .58, seed: 817331 }),
  impact: Object.freeze({ seconds: .42, seed: 617873 }),
  failure: Object.freeze({ seconds: 1.35, seed: 177133 }),
});

export function makeHorrorTexture(context, kind) {
  const profile = HORROR_TEXTURES[kind];
  if (!profile) throw new Error('Unknown horror texture: ' + kind);
  const rate = context.sampleRate;
  const buffer = context.createBuffer(1, Math.ceil(rate * profile.seconds), rate);
  const samples = buffer.getChannelData(0);
  const closures = kind === 'click' ? [.004, .041, .113, .286, .511, .566, .709] : [.005, .057, .129, .287];
  let seed = profile.seed, soft = 0, phase = 0, peak = 0;
  for (let index = 0; index < samples.length; index++) {
    const time = index / rate, progress = time / profile.seconds;
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    const white = (seed >>> 0) / 2147483648 - 1;
    soft += (white - soft) * .13;
    let click = 0;
    for (let event = 0; event < closures.length; event++) {
      const age = time - closures[event];
      if (age < 0 || age > .065) continue;
      const edge = (1 - Math.exp(-age * 2600)) * Math.exp(-age * (event % 2 ? 120 : 96));
      click += edge * (Math.sin(age * Math.PI * 2 * (630 + event * 47)) * .55 +
        Math.sin(age * Math.PI * 2 * 1390) * .19 + white * .28);
    }
    let value = click;
    if (kind !== 'click') {
      const pitch = (kind === 'impact' ? 66 : 110) - progress * (kind === 'failure' ? 69 : 43) +
        Math.sin(time * 37.1) * 4.2 + Math.sin(time * 83.3) * 1.7;
      phase += pitch / rate;
      const glottis = Math.exp(-(phase % 1) * 13) - .077;
      const mouth = glottis * (.58 + Math.sin(time * 31) * .17) +
        Math.sin(phase * Math.PI * 2) * .19 + soft * .31;
      const onset = 1 - Math.exp(-time * 950);
      const growl = Math.exp(-progress * (kind === 'turn' ? 2.8 : 2.0)) * onset;
      const air = Math.sin(Math.PI * Math.min(1, progress * 1.25)) ** .65;
      const blow = (white - soft) * Math.exp(-time * (kind === 'impact' ? 38 : 64)) * onset;
      value = mouth * growl * 1.7 + soft * air * .24 + blow * .55 + click * .43;
    }
    const tail = Math.max(0, Math.min(1, (profile.seconds - time) / .070));
    samples[index] = Math.tanh(value * 1.7) * tail;
    peak = Math.max(peak, Math.abs(samples[index]));
  }
  if (peak > 0) for (let index = 0; index < samples.length; index++) samples[index] *= .8 / peak;
  return buffer;
}
