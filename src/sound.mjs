import { TARGETS, HALL_CLOCK, EXIT, FRONT_DOOR, MIRROR } from "./layout.mjs";
import { VOICES } from "./story.mjs";
import { TelephoneRinger, makeTelephoneRing } from "./telephone-ring.mjs";
import { DreadScore } from "./dread-score.mjs";
import { HORROR_TEXTURES, makeHorrorTexture } from "./horror-textures.mjs";

// Original, nonverbal performances. The mouth resonances shape noise and an
// irregular air stream; they never synthesize a word or reuse a story voice.
const DEMON_TEXTURES = {
  inhale: { duration: 1.65, seed: 239, breath: 1, throat: 0.13 },
  reveal: { duration: 0.78, seed: 811, breath: 0.35, throat: 0.76 },
  withdraw: { duration: 0.7, seed: 1709, contact: true },
  step0: { duration: 0.28, seed: 2351, contact: true },
  step1: { duration: 0.3, seed: 3511, contact: true },
  fold: { duration: 0.86, seed: 4733, contact: true },
  ceiling: { duration: 1.5, seed: 6421, breath: 0.8, throat: 0.2 },
  witness: { duration: 1.85, seed: 8297, breath: 0.7, throat: 0.1 },
};

function makeDemonTexture(context, kind) {
  const profile = DEMON_TEXTURES[kind],
    rate = context.sampleRate,
    buffer = context.createBuffer(1, Math.ceil(rate * profile.duration), rate),
    samples = buffer.getChannelData(0);
  let seed = profile.seed,
    softNoise = 0,
    phase = 0,
    peak = 0;
  const resonances = [
    { frequency: 510, width: 115, weight: 0.68, previous: 0, older: 0 },
    { frequency: 1370, width: 240, weight: 0.3, previous: 0, older: 0 },
    { frequency: 2510, width: 420, weight: 0.13, previous: 0, older: 0 },
  ];
  for (const resonance of resonances)
    resonance.radius = Math.exp((-Math.PI * resonance.width) / rate);
  for (let i = 0; i < samples.length; i++) {
    const time = i / rate,
      position = time / profile.duration;
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    const white = ((seed >>> 0) / 4294967296) * 2 - 1;
    softNoise += (white - softNoise) * 0.17;
    let value;
    if (profile.contact) {
      // A palm takes weight, lets its skin drag, then the sleeve catches up.
      // Short unequal contacts avoid a mechanical, identical tick every step.
      const step = kind.startsWith("step"),
        fold = kind === "fold",
        first = Math.exp(-time * (step ? 75 : 42)),
        second = Math.exp(-Math.pow((time - (fold ? 0.23 : 0.115)) / 0.035, 2)),
        drag = Math.sin(Math.PI * position) ** 1.4 * Math.exp(-position * 1.8),
        grain = 0.55 + 0.45 * Math.sin(time * 67 + Math.sin(time * 23) * 1.5);
      value =
        softNoise * (first * 1.45 + drag * grain * 0.52) +
        (white - softNoise) * second * (fold ? 0.18 : 0.075) +
        Math.sin(time * (step ? 414 : 319)) * first * 0.1;
    } else {
      // Slow inhale, an involuntary catch, then a strained, almost closed
      // throat. Nothing loops; a player who keeps looking hears the silence.
      const pitch =
        (kind === "reveal" ? 104 - position * 42 : 81 - position * 9) +
        Math.sin(time * 39) * 3.8 +
        Math.sin(time * 113) * 1.6;
      phase += pitch / rate;
      const cycle = phase % 1,
        pulse = Math.exp(-cycle * 15) - 0.067,
        irregular =
          0.67 + 0.2 * Math.sin(time * 31) + 0.13 * Math.sin(time * 79.1),
        air = softNoise * (profile.breath || 0),
        excitation = air + pulse * irregular * (profile.throat || 0);
      let mouth = 0;
      for (let index = 0; index < resonances.length; index++) {
        const resonance = resonances[index],
          frequency = resonance.frequency * (1 + Math.sin(time * 3.4) * 0.055),
          next =
            (1 - resonance.radius) * excitation +
            2 *
              resonance.radius *
              Math.cos((2 * Math.PI * frequency) / rate) *
              resonance.previous -
            resonance.radius * resonance.radius * resonance.older;
        resonance.older = resonance.previous;
        resonance.previous = next;
        mouth += next * resonance.weight;
      }
      const catchBreath =
          1 - 0.68 * Math.exp(-Math.pow((position - 0.68) / 0.045, 2)),
        swell =
          kind === "reveal"
            ? Math.sin(Math.PI * position) ** 0.45 * Math.exp(-position * 1.4)
            : Math.sin(Math.PI * position) ** 1.4;
      value = (air * 0.31 + mouth * 2.2) * swell * catchBreath;
    }
    const edge = Math.min(1, time / 0.012, (profile.duration - time) / 0.065);
    samples[i] = Math.tanh(value * 2.1) * Math.max(0, edge);
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  // A known ceiling before the per-cue mix, independent of device sample rate.
  if (peak > 0)
    for (let i = 0; i < samples.length; i++) samples[i] *= 0.8 / peak;
  return buffer;
}

function makeRoomAir(context) {
  const buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let index = 0; index < data.length; index++) {
    last = (last + (Math.random() * 2 - 1) * .035) / 1.02;
    data[index] = last;
  }
  return buffer;
}

function makeFoleyNoise(context) {
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index++) data[index] = Math.random() * 2 - 1;
  return buffer;
}

// Original finite mechanical and throat textures. They are prepared with the
// other PCM while loading; no audio buffer is created by a lighting/twitch cue.
function makeHauntTexture(context, kind) {
  const rate = context.sampleRate, duration = kind === "switches" ? .24 : .72;
  const buffer = context.createBuffer(1, Math.ceil(rate * duration), rate);
  const samples = buffer.getChannelData(0);
  const onsets = kind === "switches" ? [0, .047, .138] : [.015, .071, .143, .312, .483];
  let seed = kind === "switches" ? 51017 : 73939;
  for (let event = 0; event < onsets.length; event++) {
    const begin = Math.round(onsets[event] * rate);
    const length = Math.round(rate * (kind === "switches" ? .065 : .075));
    for (let index = 0; index < length && begin + index < samples.length; index++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const white = seed / 2147483648 - 1, time = index / rate;
      const envelope = Math.exp(-time * (kind === "switches" ? 112 : 79)) * (1 - Math.exp(-time * 2500));
      const tone = kind === "switches"
        ? Math.sin(time * Math.PI * 2 * (2050 - event * 173)) * .20 + Math.sin(time * Math.PI * 2 * 186) * .35
        : Math.sin(time * Math.PI * 2 * (690 + event * 37)) * .31 + Math.sin(time * Math.PI * 2 * 1190) * .24;
      samples[begin + index] += (white * .43 + tone) * envelope * (event % 2 ? .70 : .90);
    }
  }
  return buffer;
}

export class Sound {
  constructor(onSubtitle) {
    this.onSubtitle = onSubtitle;
    this.volume = 0.55;
    this.voiceEnabled = true;
    this.lastStep = 0;
    this.buffers = new Map();
    this.playingVoice = null;
    this.voiceTimer = null;
    this.captionTimer = null;
    this.voiceNodes = [];
    this.voiceToken = 0;
    this.paused = true;
    this.busy = false;
    this.currentVoice = null;
    this.resumeVoice = null;
    this.voiceOptions = null;
    this.voiceOffset = 0;
    this.voiceStartedAt = 0;
    this.voiceDuration = 0;
    this.musicNext = 0;
    this.dripNext = 0;
    this.noteIndex = 0;
    this.tickNext = 0;
    this.creakNext = 0;
    this.creakIndex = 0;
    this.creatureBuffers = new Map();
    this.creatureNodes = new Set();
    this.creatureStep = 0;
    this.attackBuffers = new Map();
    this.funeralActive = false;
    this.funeralTension = 0;
  }
  async prepare() {
    if (this.preparing) return this.preparing;
    // AudioBuffer is just PCM storage, with no device, clock or activation.
    // Generate original textures while the title loads, rather than blocking
    // the pointer-lock click or allocating white noise on the first F press.
    if (typeof AudioBuffer === "undefined") return;
    const storage = {
      sampleRate: 48000,
      createBuffer: (channels, length, sampleRate) => new AudioBuffer({
        numberOfChannels: channels, length, sampleRate,
      }),
    };
    const yieldTask = () => new Promise(resolve => setTimeout(resolve, 0));
    this.preparing = (async () => {
      for (const kind of Object.keys(DEMON_TEXTURES)) {
        if (!this.creatureBuffers.has(kind))
          this.creatureBuffers.set(kind, makeDemonTexture(storage, kind));
        await yieldTask();
      }
      this.noise ||= makeRoomAir(storage);
      await yieldTask();
      this.foleyNoise ||= makeFoleyNoise(storage);
      await yieldTask();
      this.phoneRingBuffer ||= makeTelephoneRing(storage);
      this.switchBankBuffer ||= makeHauntTexture(storage, "switches");
      await yieldTask();
      this.reflectionRattleBuffer ||= makeHauntTexture(storage, "reflection");
      for (const kind of Object.keys(HORROR_TEXTURES)) {
        if (!this.attackBuffers.has(kind)) this.attackBuffers.set(kind, makeHorrorTexture(storage, kind));
        await yieldTask();
      }
    })();
    return this.preparing;
  }
  async start() {
    if (!this.context) {
      const c = (this.context = new (window.AudioContext ||
        window.webkitAudioContext)());
      // Warm these small buffers at the initial audio-unlock screen. Building
      // a first breath while a body enters the hall would hitch its animation.
      for (const kind of Object.keys(DEMON_TEXTURES))
        if (!this.creatureBuffers.has(kind))
          this.creatureBuffers.set(kind, makeDemonTexture(c, kind));
      this.switchBankBuffer ||= makeHauntTexture(c, "switches");
      this.reflectionRattleBuffer ||= makeHauntTexture(c, "reflection");
      for (const kind of Object.keys(HORROR_TEXTURES))
        if (!this.attackBuffers.has(kind)) this.attackBuffers.set(kind, makeHorrorTexture(c, kind));
      this.master = c.createGain();
      this.master.gain.value = this.volume * 0.55;
      const compressor = c.createDynamicsCompressor();
      compressor.threshold.value = -15;
      compressor.ratio.value = 4;
      this.master.connect(compressor);
      compressor.connect(c.destination);
      this.effects = c.createGain();
      this.effects.gain.value = 1;
      this.effects.connect(this.master);
      this.tension = c.createGain();
      this.tension.gain.value = 0;
      this.tension.connect(this.master);
      // Original beating room modes, mixed below the ordinary household sound.
      // Their absence after the reversed routine is more noticeable than music.
      for (const [frequency, level] of [
        [38.1, 0.18],
        [39.25, 0.13],
        [76.2, 0.035],
      ]) {
        const oscillator = c.createOscillator(),
          gain = c.createGain();
        oscillator.frequency.value = frequency;
        gain.gain.value = level;
        oscillator.connect(gain);
        gain.connect(this.tension);
        oscillator.start();
      }
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
      this.noise ||= makeRoomAir(c);
      this.foleyNoise ||= makeFoleyNoise(c);
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
      this.phoneRinger = new TelephoneRinger(c, this.phonePanner, this.phoneRingBuffer);
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
      this.funeralScore = new DreadScore(c, this.master, { noiseBuffer: this.noise });
    }
    this.paused = false;
    await this.context.resume();
    this.resumeDialogue();
  }
  resumeDialogue() {
    this.paused = false;
    if (!this.resumeVoice) return;
    const { id, options } = this.resumeVoice;
    this.resumeVoice = null;
    this.voice(id, options);
  }
  voiceElapsed() {
    if (!this.busy) return this.resumeVoice?.options.offset || 0;
    return Math.min(
      this.voiceDuration,
      this.voiceOffset +
        Math.max(0, performance.now() / 1000 - this.voiceStartedAt),
    );
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
    g.filter = filter;
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
    if (value && this.currentVoice && !this.playingVoice && !this.paused)
      this.voice(this.currentVoice, {
        ...this.voiceOptions,
        offset: this.voiceElapsed(),
      });
  }
  async pause() {
    this.paused = true;
    this.phoneRinger?.stop(true);
    if (this.currentVoice)
      this.resumeVoice = {
        id: this.currentVoice,
        options: { ...this.voiceOptions, offset: this.voiceElapsed() },
      };
    this.stopVoice();
    if (this.context?.state === "running") await this.context.suspend();
  }
  stopVoice(clear = true) {
    this.voiceToken++;
    this.busy = false;
    this.currentVoice = null;
    this.voiceOptions = null;
    this.voiceOffset = this.voiceStartedAt = this.voiceDuration = 0;
    if (this.playingVoice) {
      this.playingVoice.onended = null;
      try {
        this.playingVoice.stop();
      } catch {}
      this.playingVoice = null;
    }
    clearTimeout(this.voiceTimer);
    clearInterval(this.captionTimer);
    for (const node of this.voiceNodes) node.disconnect();
    this.voiceNodes = [];
    if (clear) this.onSubtitle("");
  }
  stopCreatureCues() {
    for (const source of this.creatureNodes) {
      try {
        source.stop();
      } catch {}
    }
    this.creatureNodes.clear();
  }
  reset() {
    this.stopVoice();
    this.phoneRinger?.stop(true);
    this.stopCreatureCues();
    this.creatureStep = 0;
    this.funeralActive = false;
    this.funeralTension = 0;
    this.funeralScore?.silence();
    this.resumeVoice = null;
    this.lastStep = 0;
    this.footfallIndex = undefined;
    this.musicNext = this.dripNext = this.noteIndex = 0;
    this.tickNext = 0;
    this.creakNext = (this.context?.currentTime || 0) + 16;
    this.creakIndex = 0;
    if (this.tension) this.tension.gain.value = 0;
    if (this.effects) this.effects.gain.value = 1;
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
    p.connect(destination || this.effects || this.master);
    o.start();
    o.stop(t + duration);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
      p.disconnect();
    };
    return o;
  }
  noiseBurst(duration, gain, frequency, pan = 0, destination = null) {
    if (!this.context || this.paused) return;
    const c = this.context;
    this.foleyNoise ||= makeFoleyNoise(c);
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
    stereo.connect(destination || this.effects || this.master);
    source.start(t, Math.random() * 0.15);
    source.stop(t + duration);
    source.onended = () => {
      source.disconnect();
      f.disconnect();
      envelope.disconnect();
      stereo.disconnect();
    };
    return source;
  }
  creatureTexture(kind, gain, destination) {
    if (!this.context || this.paused) return;
    const context = this.context;
    if (!this.creatureBuffers.has(kind))
      this.creatureBuffers.set(kind, makeDemonTexture(context, kind));
    return this.preparedTexture(this.creatureBuffers.get(kind), gain, destination);
  }
  preparedTexture(buffer, gain, destination) {
    if (!this.context || this.paused || !buffer) return;
    const context = this.context;
    const source = context.createBufferSource(),
      envelope = context.createGain();
    source.buffer = buffer;
    envelope.gain.value = gain;
    source.connect(envelope);
    envelope.connect(destination || this.effects || this.master);
    this.creatureNodes.add(source);
    source.onended = () => {
      this.creatureNodes.delete(source);
      source.disconnect();
      envelope.disconnect();
    };
    source.start();
    source.stop(context.currentTime + source.buffer.duration);
    return source;
  }
  step(distance, speed, carpet = true) {
    // Same gait phase as Mara's distance-driven heel plant. Unlike a wall-clock
    // beat this cannot keep walking while she is blocked or standing still.
    const stepLength = 0.62,
      offset = 0.3348;
    const index = Math.floor((distance + offset) / stepLength);
    if (this.footfallIndex === undefined || distance < this.lastStep)
      this.footfallIndex = index;
    if (speed > 0.15 && index > this.footfallIndex) {
      this.footfallIndex = index;
      this.lastStep = distance;
      const pan = index % 2 ? 0.055 : -0.055;
      const variation = Math.sin(index * 2.39996) * 8;
      this.impulse(78 + variation, carpet ? 0.06 : 0.073, 0.075, pan);
      this.noiseBurst(
        carpet ? 0.14 : 0.1,
        carpet ? 0.029 : 0.043,
        carpet ? 460 : 1380,
        pan,
      );
      // A short sole drag gives the contact texture without a pitched thump.
      this.noiseBurst(0.19, carpet ? 0.012 : 0.016, carpet ? 760 : 620, pan);
    }
  }
  // Creature/transition sounds are authored synthesis. Ordinary spatial cues
  // duck with dialogue; finite attack stings retain their measured headroom.
  horrorCue(id, position = null) {
    if (!this.context || this.paused) return;
    const urgent = ["funeral-turn", "funeral-impact", "crawler-contact", "crawler-failure"].includes(id);
    const bus = urgent ? this.master : this.effects || this.master;
    // The forced-view sting belongs to the player's cinematic turn. A fixed
    // room coordinate would attenuate it when walking across the large parlor.
    const source = id === "funeral-turn" ? null :
      position ||
      (id === "backdoor-unlocked"
        ? { ...EXIT, y: 1.1 }
        : id === "front-unlocked"
          ? { ...FRONT_DOOR, y: 1.1 }
          : id === "mirror-crossed" || id === "mirror-enter"
            ? MIRROR
            : id === "radio-tuned" || id === "radio-static"
              ? TARGETS.radio
              : null);
    const p = source ? this.panner(source.x, source.y ?? 0.5, source.z) : null;
    if (p) {
      if (id.endsWith("unlocked")) {
        p.refDistance = 3;
        p.rolloffFactor = 1.2;
      }
      if (
        id.startsWith("demon-") ||
        [
          "crawl-step",
          "crawl-arrival",
          "joint-fold",
          "ceiling-breath",
          "witness-breath",
          "crawler-click", "crawler-contact", "crawler-failure",
        ].includes(id)
      ) {
        p.refDistance = 1.8;
        p.rolloffFactor = 1.1;
      }
      p.connect(bus);
    }
    const destination = p || bus,
      nodes = [],
      track = (node) => {
        if (node) nodes.push(node);
        return node;
      };
    const impulse = (frequency, gain, duration) =>
      track(this.impulse(frequency, gain, duration, 0, destination));
    const noise = (duration, gain, frequency) =>
      track(this.noiseBurst(duration, gain, frequency, 0, destination));
    const texture = (kind, gain) =>
      track(this.creatureTexture(kind, gain, destination));
    const sting = (kind, gain) => {
      if (!this.attackBuffers.has(kind)) this.attackBuffers.set(kind, makeHorrorTexture(this.context, kind));
      return track(this.preparedTexture(this.attackBuffers.get(kind), gain, destination));
    };
    if (id === "demon-inhale") {
      texture("inhale", 0.047);
    } else if (id === "demon-reveal") {
      texture("reveal", 0.083);
    } else if (id === "demon-withdraw") {
      texture("withdraw", 0.075);
    } else if (id === "crawl-step") {
      texture(`step${this.creatureStep++ % 2}`, 0.095);
    } else if (id === "crawl-arrival") {
      texture("reveal", 0.088);
      texture("withdraw", 0.043);
    } else if (id === "joint-fold") {
      texture("fold", 0.087);
    } else if (id === "ceiling-breath") {
      texture("ceiling", 0.064);
    } else if (id === "witness-breath") {
      texture("witness", 0.04);
    } else if (id === "broken-breath") {
      // A finite caught inhalation under Mara's fractured voiced take.
      // Short noise/formant envelopes supply breath, not another spoken voice.
      noise(0.16, 0.025, 980);
      noise(0.31, 0.013, 1750);
      impulse(184, 0.008, 0.23);
    } else if (id === "light-relay" || id === "light-switch-bank") {
      if (this.funeralActive) this.funeralTension = Math.max(.75, this.funeralTension);
      track(this.preparedTexture(this.switchBankBuffer, .105, destination));
    } else if (id === "reflection-twitch") {
      track(this.preparedTexture(this.reflectionRattleBuffer, .13, destination));
    } else if (id === "crawler-click") {
      sting("click", .16 + Math.max(0, Math.min(1, position?.intensity || 0)) * .07);
    } else if (id === "crawler-contact" || id === "crawler-failure") {
      sting("failure", .43);
    } else if (id === "mirror-crossed" || id === "mirror-enter") {
      for (const frequency of [417, 629, 947]) impulse(frequency, 0.025, 1.65);
      noise(1.15, 0.055, 1600);
      impulse(34, 0.1, 1.35);
    } else if (id === "backdoor-unlocked" || id === "front-unlocked") {
      noise(0.12, 0.075, 1260);
      impulse(83, 0.065, 0.28);
    } else if (id === "keepsake-placed" || id === "offering-placed") {
      noise(0.09, 0.027, 1300);
      impulse(770, 0.012, 0.25);
    } else if (id === "ritual-complete") {
      noise(0.8, 0.045, 240);
      impulse(37, 0.065, 1.2);
    } else if (id === "ritual-wrong-order" || id === "ritual-wrong") {
      noise(0.22, 0.06, 480);
      impulse(49, 0.065, 0.65);
    } else if (id === "radio-tuned") {
      noise(0.06, 0.025, 2200);
      impulse(930, 0.009, 0.11);
    } else if (id === "radio-static") {
      noise(0.55, 0.08, 1400);
    } else if (id === "lamp-off") {
      noise(0.055, 0.026, 1800);
    } else if (id === "wake-entered") {
      // A small pressure change and the sound of several chair legs, not a
      // triumphant exit cue. The reception voice arrives into earned silence.
      impulse(31, 0.075, 2.8);
      noise(1.25, 0.032, 210);
    } else if (id === "wake-turn") {
      noise(0.85, 0.045, 330);
      impulse(106, 0.025, 0.42);
    } else if (id === "funeral-turn") {
      this.funeralTension = 1;
      this.funeralScore?.setTension(1);
      sting("turn", .41);
    } else if (id === "funeral-lunge") {
      sting("lunge", .23);
    } else if (id === "funeral-impact") {
      sting("impact", .34);
    }
    if (p) {
      // Audio completion, rather than a wall-clock timer: pausing for several
      // seconds must not disconnect a cue which still has an unheard tail.
      let remaining = nodes.length;
      if (!remaining) p.disconnect();
      for (const node of nodes) {
        const clean = node.onended;
        node.onended = () => {
          clean?.();
          if (--remaining === 0) p.disconnect();
        };
      }
    }
  }
  effect(id, position = null) {
    if (
      [
        "demon-inhale",
        "demon-reveal",
        "demon-withdraw",
        "crawl-step",
        "crawl-arrival",
        "joint-fold",
        "ceiling-breath",
        "witness-breath",
        "broken-breath",
        "light-relay",
        "light-switch-bank",
        "reflection-twitch",
        "crawler-click", "crawler-contact", "crawler-failure",
        "mirror-crossed",
        "mirror-enter",
        "backdoor-unlocked",
        "front-unlocked",
        "keepsake-placed",
        "offering-placed",
        "ritual-complete",
        "ritual-wrong-order",
        "ritual-wrong",
        "radio-tuned",
        "radio-static",
        "lamp-off",
        "wake-entered",
        "wake-turn",
        "funeral-lunge",
        "funeral-impact",
        "funeral-turn",
      ].includes(id)
    ) {
      this.horrorCue(id, position);
      return;
    }
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
      source.connect(this.effects || this.master);
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
    if (
      id === "key" ||
      id === "fuse" ||
      id === "keepsake-watch" ||
      id === "keepsake-ring"
    ) {
      this.noiseBurst(0.04, 0.03, 2400, 0.2);
      for (const f of [1700, 2410, 3180]) this.impulse(f, 0.014, 0.3, 0.2);
    }
    if (id === "keepsake-ribbon") this.noiseBurst(0.2, 0.028, 650);
    if (id === "unlocked") {
      this.impulse(103, 0.12, 0.19);
      this.noiseBurst(0.12, 0.085, 1500);
    }
    if (
      id === "locked" ||
      id === "front-locked" ||
      id === "bedroom-locked" ||
      id === "backdoor-locked"
    )
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
    const inFuneral = Boolean(state.wakeEntered && !state.ended);
    if (inFuneral && !this.funeralActive) {
      this.funeralTension = .2;
      this.funeralScore?.restart();
    }
    if (!inFuneral) this.funeralTension = 0;
    this.funeralActive = inFuneral;
    this.funeralScore?.setTension(this.funeralTension);
    this.funeralScore?.setLevel(inFuneral ? this.busy ? .10 : .42 : 0, this.busy ? .12 : .75);
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
    const quiet =
      state.silenceComplete || state.echoIndex >= 3 || state.stage >= 5;
    const reversing = state.stage === 4;
    const echo = state.echoIndex || 0;
    const speaking = this.busy ? 0.48 : 1;
    const stageAir = [0.11, 0.075, 0.105, 0.135, 0.055, 0, 0][state.stage] ?? 0;
    this.ambience.gain.setTargetAtTime(
      quiet ? 0 : stageAir * speaking,
      t,
      0.65,
    );
    this.effects.gain.setTargetAtTime(this.busy ? 0.38 : 1, t, 0.12);
    const tension = [0, 0.014, 0.022, 0.035, 0.019, 0, 0][state.stage] ?? 0;
    this.tension.gain.setTargetAtTime(quiet ? 0 : tension * speaking, t, 0.9);
    this.radio.gain.setTargetAtTime(
      quiet || (reversing && echo >= 3)
        ? 0
        : state.power && state.radioOn
          ? 0.12
          : 0,
      t,
      0.15,
    );
    this.water.gain.setTargetAtTime(
      quiet || (reversing && echo >= 2) || state.tapOn === false ? 0 : 0.11,
      t,
      0.15,
    );
    this.rain.gain.setTargetAtTime(quiet ? 0 : 0.045, t, 0.8);
    // During tuning, static is a separate source from the two telephone calls.
    const tuning = state.stage === 2 && !state.radioTuned;
    this.radioSpeech.gain.setTargetAtTime(
      this.voiceEnabled && !tuning ? 1.8 : 0,
      t,
      0.15,
    );
    this.radio.filter.frequency.setTargetAtTime(tuning ? 1350 : 850, t, 0.2);
    if (state.stage < 5 && !quiet && t > this.creakNext) {
      const intervals = [27, 23, 19, 14, 18];
      this.creakNext =
        t + (intervals[state.stage] || 24) + (this.creakIndex++ % 3) * 2;
      const source = this.panner(
        this.creakIndex % 2 ? 4.3 : 0.25,
        2.25,
        this.creakIndex % 2 ? 0 : 4.3,
      );
      source.connect(this.effects || this.master);
      this.noiseBurst(0.8, 0.045, 210, 0, source);
      this.impulse(96, 0.023, 0.6, 0, source);
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
    this.phoneRinger?.update(!quiet && !this.busy &&
      ((!state.heardArrival && state.stage === 0) ||
        (state.stage === 2 && state.clockSolved && state.radioTuned && !state.heardCall) ||
        (((state.stage === 3 && state.ritualIndex === 3) || state.stage === 4) && !state.heardRoutineCall)));
    if (
      t > this.musicNext &&
      !quiet &&
      !(reversing && echo >= 1) &&
      state.musicboxOn !== false &&
      state.stage >= 1
    ) {
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
  async voice(id, options = {}) {
    const line = VOICES[id];
    if (!line) return;
    this.phoneRinger?.stop();
    this.stopVoice();
    this.busy = true;
    this.currentVoice = id;
    this.voiceOptions = options;
    this.voiceOffset = Math.max(0, options.offset || 0);
    this.voiceStartedAt = performance.now() / 1000;
    this.voiceDuration = Math.max(3.5, line.duration || line.text.length * 0.065);
    const token = this.voiceToken;
    const cues = line.captionCues;
    const chunks = cues?.length ? cues.map(cue => cue.text) : options.segmented
      ? line.text
          .match(/[^.!?]+[.!?]+|[^.!?]+$/g)
          ?.map((part) => part.trim()) || [line.text]
      : [line.text];
    const total = chunks.reduce((sum, part) => sum + part.length, 0);
    let previousCaption = -1;
    const caption = () => {
      if (token !== this.voiceToken) return;
      const elapsed = this.voiceElapsed();
      let position = (elapsed / this.voiceDuration) * total;
      let index = 0;
      if (cues?.length) {
        while (index < cues.length - 1 && elapsed >= cues[index + 1].at) index++;
      } else {
        while (index < chunks.length - 1 && position > chunks[index].length)
          position -= chunks[index++].length;
      }
      if (index !== previousCaption) {
        previousCaption = index;
        this.onSubtitle(`${line.speaker} — “${chunks[index]}”`);
      }
    };
    caption();
    this.captionTimer = setInterval(caption, 100);
    const done = () => {
      if (token === this.voiceToken && this.busy) {
        clearInterval(this.captionTimer);
        this.onSubtitle("");
        this.busy = false;
        this.currentVoice = null;
        this.voiceOptions = null;
        options.onComplete?.(id);
      }
    };
    const schedule = () => {
      clearTimeout(this.voiceTimer);
      this.voiceTimer = setTimeout(
        done,
        Math.max(0, this.voiceDuration - this.voiceOffset) * 1000 +
          (Number.isFinite(options.postGap) ? Math.max(0, options.postGap) * 1000 : 650),
      );
      options.onDuration?.(this.voiceDuration);
    };
    schedule();
    if (!this.context || this.paused) return;
    try {
      await this.loadBuffer(id);
      if (token !== this.voiceToken || this.paused || !this.busy) return;
      const buffer = this.buffers.get(id);
      this.voiceDuration = buffer.duration;
      this.voiceOffset = Math.min(
        this.voiceOffset,
        Math.max(0, buffer.duration - 0.01),
      );
      this.voiceStartedAt = performance.now() / 1000;
      previousCaption = -1;
      caption();
      schedule();
      if (!this.voiceEnabled) return;
      const c = this.context,
        source = c.createBufferSource(),
        g = c.createGain(),
        filter = c.createBiquadFilter();
      source.buffer = buffer;
      g.gain.value = options.position
        ? (options.gain ?? 1.15)
        : line.speaker === "THE TELEPHONE"
          ? 1.65
          : 0.95;
      filter.type = "lowpass";
      filter.frequency.value = options.radio
        ? 3700
        : line.speaker === "THE GLASS"
          ? 3200
          : line.speaker === "THE TELEPHONE"
            ? 3300
            : 6000;
      source.connect(filter);
      filter.connect(g);
      if (options.position) {
        const p = options.position,
          spatial = this.panner(p.x, p.y, p.z);
        spatial.refDistance = options.radio ? 4 : 2.2;
        spatial.rolloffFactor = options.radio ? 0.65 : 0.8;
        spatial.connect(this.master);
        g.connect(spatial);
        this.voiceNodes.push(spatial);
      } else
        g.connect(
          line.speaker === "THE TELEPHONE" ? this.phonePanner : this.master,
        );
      this.voiceNodes.push(filter, g);
      this.playingVoice = source;
      source.onended = () => {
        if (this.playingVoice === source) this.playingVoice = null;
        source.disconnect();
        filter.disconnect();
        g.disconnect();
      };
      source.start(0, this.voiceOffset);
    } catch (error) {
      console.warn("Voice unavailable; subtitles retained.", error.message);
    }
  }
}
