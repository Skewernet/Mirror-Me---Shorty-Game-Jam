import test from "node:test";
import assert from "node:assert/strict";
import { segmentDistance, playerInitiatedContact, crawlerThreatTarget,
  CrawlerFailure, CRAWLER_FAILURE_SECONDS } from "../src/crawler-threat.mjs";

const shape = { a: [0, .5, 0], b: [0, .8, 0], radius: .14, name: "torso" };
test("capsule distance handles parallel, crossing and degenerate segments", () => {
  assert.equal(segmentDistance([0, 0, 0], [0, 1, 0], [1, 0, 0], [1, 1, 0]).distance, 1);
  assert.equal(segmentDistance([-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0]).distance, 0);
  assert.equal(segmentDistance([0, 0, 0], [0, 0, 0], [0, 2, 0], [0, 2, 0]).distance, 2);
});
test("contact comes from a fresh player crossing, never standing, backing away or teleporting", () => {
  assert.ok(playerInitiatedContact({ x: .4, z: 0 }, { x: .3, z: 0 }, [shape]));
  assert.equal(playerInitiatedContact({ x: .3, z: 0 }, { x: .3, z: 0 }, [shape]), null);
  assert.equal(playerInitiatedContact({ x: .3, z: 0 }, { x: .5, z: 0 }, [shape]), null);
  assert.equal(playerInitiatedContact({ x: 5, z: 0 }, { x: .3, z: 0 }, [shape]), null);
  assert.equal(playerInitiatedContact({ x: .2, z: 0 }, { x: .19, z: 0 }, [shape]), null,
    "An actor already crossing the capsule must not punish an ordinary next step");
});
test("a resolved pursuit touches at 20, 60 and 120 Hz without tunnelling", () => {
  for (const hz of [20, 60, 120]) {
    let x = 1.5, hit = null;
    for (let frame = 0; frame < hz && !hit; frame++) {
      const next = x - 3.25 / hz;
      hit = playerInitiatedContact({ x, z: 0 }, { x: next, z: 0 }, [shape]);
      x = next;
    }
    assert.ok(hit, `Pursuit missed the actual contact surface at ${hz} Hz`);
    assert.ok(hit.distance <= hit.radius + 1e-8);
  }
});
test("a swept sideways graze still contacts when the frame ends moving away", () => {
  const combined = .36;
  for (const hz of [20, 60, 120]) {
    const halfTravel = 3.25 / hz / 2;
    const z = Math.sqrt(combined ** 2 - (halfTravel * .5) ** 2);
    assert.ok(Math.hypot(halfTravel, z) > combined, "Both endpoints start outside the contact surface");
    const hit = playerInitiatedContact({ x: -halfTravel, z }, { x: halfTravel, z }, [shape]);
    assert.ok(hit, `A real midpoint graze was missed at ${hz} Hz`);
    assert.ok(hit.fraction < 1 && hit.distance <= combined + 1e-10);
  }
});
test("ceiling bones above the player's real height cannot be touched from below", () => {
  const high = { ...shape, a: [0, 2.1, 0], b: [0, 2.25, 0], radius: .08 };
  assert.equal(playerInitiatedContact({ x: .4, z: 0 }, { x: .1, z: 0 }, [high]), null);
});
test("visual danger requires direct visible gaze and grows with proximity", () => {
  assert.equal(crawlerThreatTarget({ visible: false, gaze: 1, distance: .5 }), 0);
  assert.equal(crawlerThreatTarget({ visible: true, gaze: .8, distance: .5 }), 0);
  assert.ok(crawlerThreatTarget({ visible: true, gaze: 1, distance: 1.2 }) >
    crawlerThreatTarget({ visible: true, gaze: 1, distance: 5 }));
  for (const distance of [0, 1, 4, 10, Infinity])
    assert.ok(crawlerThreatTarget({ visible: true, gaze: 1, distance }) <= 1);
});
test("failure pose is finite, paused-clock deterministic and restartable", () => {
  const failure = new CrawlerFailure();
  assert.equal(failure.update(0).phase, "idle");
  assert.equal(failure.begin(10, { yaw: .2, pitch: .1 }), true);
  assert.equal(failure.begin(11, { yaw: 1 }), false);
  assert.deepEqual(failure.update(10.3), failure.update(10.3));
  for (let age = 0; age < 1.2; age += 1 / 120) {
    const state = failure.update(10 + age);
    assert.ok([state.yaw, state.pitch, state.eyeHeight, state.fade, state.strike].every(Number.isFinite));
    assert.ok(state.fade >= 0 && state.fade <= 1);
  }
  assert.equal(failure.update(10 + CRAWLER_FAILURE_SECONDS).done, true);
  assert.equal(failure.update(12).fade, 1);
  assert.ok(failure.update(12).eyeHeight < 1);
  failure.reset();
  assert.equal(failure.update(20).active, false);
  assert.equal(failure.begin(30, { yaw: 0, pitch: 0 }), true);
});
