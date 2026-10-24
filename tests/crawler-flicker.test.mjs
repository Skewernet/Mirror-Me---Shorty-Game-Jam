import test from "node:test";
import assert from "node:assert/strict";
import { BLACKOUT_ENVIRONMENT, CRAWLER_FLICKER, FUNERAL_BLACKOUT, crawlerFlickerAt, funeralBlackoutAt } from "../src/crawler-flicker.mjs";

const durations = {
  "bathroom-ceiling": 4.4,
  "far-hall-crawler": 4.6,
  "sitting-room-return": 3.4,
  "last-ceiling": 3.5,
};

test("every authored floor and ceiling crawler has a distinct irregular electrical pattern", () => {
  assert.deepEqual(Object.keys(CRAWLER_FLICKER).sort(), Object.keys(durations).sort());
  const patterns = new Set();
  for (const [id, windows] of Object.entries(CRAWLER_FLICKER)) {
    assert.ok(windows.length >= 3 && windows.length <= 4);
    assert.ok(windows[0].from >= .3, "Initial reveal must stay readable");
    assert.ok(windows.at(-1).to < durations[id] - .1);
    const lengths = windows.map(window => window.to - window.from);
    const gaps = windows.slice(1).map((window, index) => window.from - windows[index].to);
    assert.ok(Math.max(...lengths) - Math.min(...lengths) > .1, "Outages must have unequal lengths");
    assert.ok(Math.max(...gaps) - Math.min(...gaps) > .1, "Returns must have unequal gaps");
    assert.ok(Math.min(...lengths) >= .3 && Math.min(...gaps) >= .25);
    const darkFraction = lengths.reduce((sum, value) => sum + value, 0) / durations[id];
    assert.ok(darkFraction > .4 && darkFraction < .55, "Mains failures need substantial darkness without a sustained strobe");
    patterns.add(JSON.stringify(windows.map(({ from, to }) => [from, to])));
  }
  assert.equal(patterns.size, Object.keys(durations).length);
});

test("whole-house blackouts suppress all indirect fills without changing program light counts", () => {
  for (const value of Object.values(BLACKOUT_ENVIRONMENT)) assert.ok(value > 0 && value < .05);
});

test("the finite funeral outage sequence carries through the final accusation then restores", () => {
  assert.equal(FUNERAL_BLACKOUT.windows.length, 5);
  assert.ok(FUNERAL_BLACKOUT.duration < 5.5);
  assert.equal(funeralBlackoutAt(3.1).lightMultiplier, 0);
  assert.equal(funeralBlackoutAt(4.1).lightMultiplier, 0);
  assert.equal(funeralBlackoutAt(0).lightMultiplier, 1);
  for (const window of FUNERAL_BLACKOUT.windows) {
    assert.equal(funeralBlackoutAt(window.from).lightMultiplier, 0);
    assert.equal(funeralBlackoutAt(window.to).lightMultiplier, 1);
  }
  for (const time of [-1, NaN, Infinity, FUNERAL_BLACKOUT.duration, 90])
    assert.equal(funeralBlackoutAt(time).lightMultiplier, 1);
});

test("crawler lights really turn off, return fully on, and stop with their finite schedule", () => {
  for (const [id, windows] of Object.entries(CRAWLER_FLICKER)) {
    assert.equal(crawlerFlickerAt(id, 0).lightMultiplier, 1);
    windows.forEach((window, index) => {
      assert.equal(crawlerFlickerAt(id, window.from - .001).lightMultiplier, 1);
      assert.equal(crawlerFlickerAt(id, window.from).lightMultiplier, 0);
      assert.equal(crawlerFlickerAt(id, (window.from + window.to) / 2).index, index);
      assert.equal(crawlerFlickerAt(id, window.to).lightMultiplier, 1);
    });
    assert.equal(crawlerFlickerAt(id, durations[id]).lightMultiplier, 1);
    assert.equal(crawlerFlickerAt(id, 100).lightMultiplier, 1);
  }
});

test("sampling a paused or low-frame-rate electrical sequence cannot accumulate or replay flashes", () => {
  for (const id of Object.keys(CRAWLER_FLICKER)) {
    const age = CRAWLER_FLICKER[id][0].from;
    const paused = crawlerFlickerAt(id, age);
    for (let index = 0; index < 20; index++) assert.equal(crawlerFlickerAt(id, age), paused);
    assert.equal(crawlerFlickerAt(id, 12).lightMultiplier, 1);
    assert.equal(crawlerFlickerAt(id, 0).lightMultiplier, 1, "Restart must not retain an outage");
    assert.equal(crawlerFlickerAt(id, 12).index, -1, "Old intervals cannot replay as a backlog");
  }
});

test("non-crawler encounters and invalid time never introduce a new electrical effect", () => {
  for (const id of ["inverted-witness", "bedroom-fold", "unknown", undefined])
    for (const age of [0, .5, 1, 2, 4, -1, NaN, Infinity])
      assert.equal(crawlerFlickerAt(id, age).lightMultiplier, 1);
});
