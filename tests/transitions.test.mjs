import test from "node:test";
import assert from "node:assert/strict";
import { backDoorPose, mirrorPose } from "../src/transitions.mjs";
import { EXIT, PORTAL, MIRROR } from "../src/layout.mjs";

const close = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} ≈ ${expected}`);
const motion = (extra = {}) => ({
  x: EXIT.x + 0.16,
  z: PORTAL.thresholdZ + 0.038,
  yaw: Math.PI + 0.2,
  pitch: 0.31,
  vx: -0.6,
  vz: 1.7,
  speed: 1.8,
  distance: 73.2,
  bobOffset: 0.006,
  keys: ["KeyW", "KeyD"],
  ...extra,
});

test("a rear crossing carries sideways offset and overshoot into the front hall without stopping", () => {
  const incoming = motion(),
    before = structuredClone(incoming),
    result = backDoorPose(incoming);
  close(result.x, PORTAL.returnX - 0.16);
  close(result.z, PORTAL.returnZ - 0.038);
  close(result.yaw, 0.2);
  close(result.vx, 0.6);
  close(result.vz, -1.7);
  for (const key of ["pitch", "speed", "distance", "bobOffset", "keys"])
    assert.deepEqual(result[key], incoming[key]);
  assert.deepEqual(incoming, before);
  assert.notEqual(result, incoming);
});
test("the rear half turn preserves motion magnitude and gaze for any approach angle", () => {
  for (const yaw of [
    -5 * Math.PI,
    -Math.PI,
    -0.4,
    0,
    0.37,
    Math.PI,
    5 * Math.PI,
  ]) {
    const incoming = motion({ yaw, vx: 0.73, vz: 1.28 }),
      result = backDoorPose(incoming);
    close(
      Math.hypot(result.vx, result.vz),
      Math.hypot(incoming.vx, incoming.vz),
    );
    close(Math.sin(result.yaw), -Math.sin(incoming.yaw));
    close(Math.cos(result.yaw), -Math.cos(incoming.yaw));
    assert.ok(result.yaw >= -Math.PI && result.yaw <= Math.PI);
  }
});
test("both sides of the rear doorway retain distinct lateral positions", () => {
  const left = backDoorPose(motion({ x: EXIT.x - 0.21 })),
    right = backDoorPose(motion({ x: EXIT.x + 0.21 }));
  close(left.x, 0.21);
  close(right.x, -0.21);
  close(left.z, right.z);
});
test("walking through the glass preserves overshoot and continuous held movement", () => {
  const incoming = motion({
      x: MIRROR.x + 0.033,
      z: MIRROR.z + 0.16,
      yaw: -Math.PI / 2,
      vx: 1.85,
      vz: 0.1,
    }),
    result = mirrorPose(incoming);
  close(result.x, MIRROR.x - 0.513);
  close(result.z, MIRROR.z - 0.16);
  close(result.yaw, Math.PI / 2);
  close(result.vx, -1.85);
  close(result.vz, -0.1);
  for (const key of ["pitch", "speed", "distance", "bobOffset", "keys"])
    assert.deepEqual(result[key], incoming[key]);
});
