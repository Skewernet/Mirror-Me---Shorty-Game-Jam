// Finite electrical interruptions, in seconds from a readable creature reveal.
// Unequal gaps and outage lengths are authored per circuit; no random value is
// generated each frame and no repeating oscillator can become a fixed strobe.
const intervals = {
  "bathroom-ceiling": [[.43, .67], [1.32, 1.70], [2.61, 2.79], [3.54, 3.96]],
  "far-hall-crawler": [[.36, .55], [1.03, 1.42], [2.27, 2.53], [3.61, 4.04]],
  "sitting-room-return": [[.32, .54], [1.23, 1.64], [2.47, 2.72]],
  "last-ceiling": [[.40, .65], [1.19, 1.54], [2.58, 2.99]],
};

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
