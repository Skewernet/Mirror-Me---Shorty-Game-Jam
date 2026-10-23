import { EXIT, MIRROR, PORTAL } from "./layout.mjs";

const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

// An exact rigid half turn preserves momentum, overshoot, gaze, gait distance
// and held inputs. The controller applies this result without clear() or a fade.
export function backDoorPose(pose) {
  return {
    ...pose,
    x: PORTAL.returnX - (pose.x - EXIT.x),
    z: PORTAL.returnZ - (pose.z - PORTAL.thresholdZ),
    yaw: wrap(pose.yaw + PORTAL.yawDelta),
    vx: -pose.vx,
    vz: -pose.vz,
  };
}

// The empty glass deposits Mara just inside its opposite side, looking down the
// same hall. The world changes around her; the camera remains under her control.
export function mirrorPose(pose) {
  return {
    ...pose,
    x: MIRROR.x - 0.48 - Math.max(0, pose.x - MIRROR.x),
    z: MIRROR.z - (pose.z - MIRROR.z),
    yaw: wrap(pose.yaw + Math.PI),
    vx: -pose.vx,
    vz: -pose.vz,
  };
}
