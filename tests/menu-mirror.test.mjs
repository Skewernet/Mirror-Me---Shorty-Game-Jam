import test from 'node:test';
import assert from 'node:assert/strict';
import { menuMirrorAt, MENU_MIRROR_GLIMPSES, MENU_MIRROR_PERIOD } from '../src/menu-mirror.mjs';

test('the title reflection has brief irregular glimpses with a calm entry and no strobe cadence', () => {
  assert.ok(MENU_MIRROR_GLIMPSES[0].start >= 3000);
  const gaps = new Set();
  let total = 0;
  for (const [index, glimpse] of MENU_MIRROR_GLIMPSES.entries()) {
    const duration = glimpse.end - glimpse.start;
    assert.ok(duration >= 100 && duration <= 260);
    total += duration;
    if (index) gaps.add(glimpse.start - MENU_MIRROR_GLIMPSES[index - 1].end);
    if (index > 1) assert.ok(glimpse.start - MENU_MIRROR_GLIMPSES[index - 2].start > 1000,
      'More than two glimpses begin in one second');
  }
  assert.ok(gaps.size >= 4, 'Reveals repeat with a uniform cadence');
  assert.ok(total / MENU_MIRROR_PERIOD < .04, 'The distorted form dominates a quiet menu');
});

test('reflection edges resolve directly from current elapsed time and skip stale reveals', () => {
  for (const glimpse of MENU_MIRROR_GLIMPSES) {
    assert.equal(menuMirrorAt(glimpse.start - .01).state, 'normal');
    assert.equal(menuMirrorAt(glimpse.start).state, 'distorted');
    assert.equal(menuMirrorAt(glimpse.end - .01).index, glimpse.index);
    assert.equal(menuMirrorAt(glimpse.end).state, 'normal');
  }
  assert.equal(menuMirrorAt(9000).state, 'normal', 'A long frame must not replay the earlier flash');
  assert.deepEqual(menuMirrorAt(MENU_MIRROR_PERIOD + 4500), menuMirrorAt(4500));
  for (const invalid of [-1, NaN, Infinity, '4500', null]) assert.deepEqual(menuMirrorAt(invalid), menuMirrorAt(0));
  for (let time = 0; time <= MENU_MIRROR_PERIOD * 2; time += 97)
    assert.ok(menuMirrorAt(time).nextIn > 0, 'An edge can busy-loop without advancing time');
});
