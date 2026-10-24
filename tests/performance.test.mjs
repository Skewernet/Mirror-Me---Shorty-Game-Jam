import test from 'node:test';
import assert from 'node:assert/strict';
import { AdaptiveResolution } from '../src/performance.mjs';

function run(control, ms, seconds) {
  const changes = [];
  for (let time = 0; time < seconds * 1000; time += ms) {
    const scale = control.sample(ms);
    if (scale !== null) changes.push(scale);
  }
  return changes;
}

test('60 Hz frame delivery keeps the selected picture resolution', () => {
  const control = new AdaptiveResolution();
  assert.deepEqual(run(control, 1000 / 60, 30), []);
  assert.equal(control.scale, 1);
});
test('loading spikes and paused time cannot lower the gameplay resolution', () => {
  const control = new AdaptiveResolution();
  run(control, 1000 / 60, 5);
  control.sample(800);
  run(control, 1000 / 60, 2);
  assert.equal(control.scale, 1);
  for (let n = 0; n < 20; n++) control.sample(300, false);
  assert.equal(control.snapshot().samples, 0);
  assert.deepEqual(run(control, 33, 2), []);
});
test('sustained missed frames lower resolution in spaced steps to a finite floor', () => {
  const control = new AdaptiveResolution();
  assert.deepEqual(run(control, 33, 2), []);
  const changes = run(control, 33, 40);
  assert.deepEqual(changes, [.9, .8, .7, .6]);
  assert.equal(control.scale, .6);
  assert.equal(control.adjustments, 4);
});
test('recovery needs sustained 60 Hz delivery and never reallocates every frame', () => {
  const control = new AdaptiveResolution();
  control.reset(.7);
  assert.deepEqual(run(control, 1000 / 60, 10), []);
  assert.deepEqual(run(control, 1000 / 60, 6), [.75]);
  assert.deepEqual(run(control, 1000 / 60, 5), []);
});
test('manual disabled mode restores full selected resolution and ignores measurements', () => {
  const control = new AdaptiveResolution();
  control.reset(.7);
  assert.equal(control.setEnabled(false), 1);
  assert.deepEqual(run(control, 45, 40), []);
  assert.equal(control.scale, 1);
  control.setEnabled(true);
  assert.deepEqual(run(control, 33, 2), []);
});
test('invalid timing and manual quality reset cannot retain pressure or invalid scales', () => {
  const control = new AdaptiveResolution();
  run(control, 33, 3);
  for (const value of [NaN, Infinity, -2, 0, 2000]) control.sample(value);
  assert.deepEqual(run(control, 33, 2), []);
  control.reset(100);
  assert.equal(control.scale, 1);
  control.reset(.1);
  assert.equal(control.scale, .6);
});
