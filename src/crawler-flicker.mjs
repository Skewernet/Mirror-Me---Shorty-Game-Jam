// Finite electrical interruptions, in seconds from a readable creature reveal.
// Unequal gaps and outage lengths are authored for the whole supply; no random value is
// generated each frame and no repeating oscillator can become a fixed strobe.
const intervals = {
  "bathroom-ceiling": [[.36, .78], [1.05, 1.66], [2.17, 2.48], [3.10, 3.73]],
  "far-hall-crawler": [[.33, .75], [1.06, 1.55], [2.13, 2.46], [3.28, 4.06]],
  "sitting-room-return": [[.32, .83], [1.14, 1.49], [2.00, 2.74]],
  "last-ceiling": [[.34, .83], [1.11, 1.64], [2.11, 2.92]],
};

export const BLACKOUT_ENVIRONMENT = Object.freeze({
  ambientMultiplier: .025,
  exteriorMultiplier: .04,
  environmentMultiplier: .04,
});

export const FUNERAL_BLACKOUT = Object.freeze({
  duration: 5.2,
  windows: Object.freeze([[.08, .52], [.79, 1.10], [1.41, 2.11], [2.92, 3.36], [3.85, 4.55]].map(
    ([from, to], index) => Object.freeze({ from, to, index, lightMultiplier: 0 }),
  )),
});

export const CRAWLER_FLICKER = Object.freeze(Object.fromEntries(
  Object.entries(intervals).map(([id, windows]) => [id, Object.freeze(windows.map(
    ([from, to], index) => Object.freeze({ from, to, index, lightMultiplier: 0 }),
  ))]),
));
const LIT = Object.freeze({ index: -1, lightMultiplier: 1 });

export function crawlerFlickerAt(id, age) {
  if (!Number.isFinite(age) || age < 0) return LIT;
  for (const window of CRAWLER_FLICKER[id] || [])
    if (age >= window.from && age < window.to) return window;
  return LIT;
}

export function funeralBlackoutAt(age) {
  if (!Number.isFinite(age) || age < 0 || age >= FUNERAL_BLACKOUT.duration) return LIT;
  for (const window of FUNERAL_BLACKOUT.windows)
    if (age >= window.from && age < window.to) return window;
  return LIT;
}
