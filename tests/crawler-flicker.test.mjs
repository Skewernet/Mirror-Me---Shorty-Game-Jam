import test from "node:test";
import assert from "node:assert/strict";
import { CRAWLER_FLICKER, crawlerFlickerAt } from "../src/crawler-flicker.mjs";

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
    assert.ok(Math.min(...lengths) >= .17 && Math.min(...gaps) >= .45);
    assert.ok(lengths.reduce((sum, value) => sum + value, 0) / durations[id] < .4);
    patterns.add(JSON.stringify(windows.map(({ from, to }) => [from, to])));
  }
  assert.equal(patterns.size, Object.keys(durations).length);
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
