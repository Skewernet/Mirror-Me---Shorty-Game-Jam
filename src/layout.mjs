// One connected L-shaped house. The return is a spatial discontinuity at the
// rear-door threshold, not a second corridor around a partition.
import { RADIUS } from "./physics.mjs";
export const CEILING_HEIGHT = 2.32;
export const HALL_WIDTH = 1.28;
export const SPAWN = { x: 0, z: 6.7, yaw: 0 };
export const FRONT_DOOR = { x: 0, z: 7.5, rotation: Math.PI };
export const EXIT = { x: 7.4, z: 0.64, rotation: Math.PI };
export const BACK_DOOR = EXIT;
export const MIRROR = { x: 9.08, y: 1.35, z: 0, rotation: -Math.PI / 2 };
export const HALL_CLOCK = { x: 5.05, y: 1.83, z: 0.55, rotation: Math.PI };
export const HALLS = [
  { minX: -0.64, maxX: 0.64, minZ: -0.64, maxZ: 7.5 },
  { minX: -0.64, maxX: 9.2, minZ: -0.64, maxZ: 0.64 },
];
export const PORTAL = {
  minX: 6.88,
  maxX: 7.92,
  thresholdZ: 0.95,
  yawDelta: Math.PI,
  returnX: 0,
  returnZ: 6.7,
};
export const ROOMS = [
  {
    id: "lounge",
    name: "SITTING ROOM",
    minX: -4.5,
    maxX: -0.76,
    minZ: 3.4,
    maxZ: 7.5,
    doorX: -0.7,
    doorZ: 5.1,
    doorRotation: Math.PI / 2,
    doorWidth: 0.9,
  },
  {
    id: "utility",
    name: "UTILITY ROOM",
    minX: -3.4,
    maxX: -0.76,
    minZ: 0.76,
    maxZ: 3.2,
    doorX: -0.7,
    doorZ: 1.8,
    doorRotation: Math.PI / 2,
    doorWidth: 0.84,
  },
  {
    id: "bathroom",
    name: "BATHROOM",
    minX: 0.76,
    maxX: 3.8,
    minZ: 0.9,
    maxZ: 4.2,
    doorX: 0.7,
    doorZ: 2.5,
    doorRotation: -Math.PI / 2,
    doorWidth: 0.86,
  },
  {
    id: "kitchen",
    name: "KITCHEN",
    minX: 0.9,
    maxX: 4.5,
    minZ: -4.6,
    maxZ: -0.76,
    doorX: 2.4,
    doorZ: -0.7,
    doorRotation: 0,
    doorWidth: 0.9,
  },
  {
    id: "bedroom",
    name: "BEDROOM",
    minX: 4.7,
    maxX: 9.2,
    minZ: -4.6,
    maxZ: -0.76,
    doorX: 7.4,
    doorZ: -0.7,
    doorRotation: 0,
    doorWidth: 0.88,
  },
];
// All story targets and spatial sound positions share these measured locations.
export const TARGETS = {
  "keepsake-watch": { x: 3.58, y: 0.795, z: -2.95 },
  "keepsake-ring": { x: -2.85, y: 0.91, z: 2.62 },
  "keepsake-ribbon": { x: -2.65, y: 0.515, z: 5.12 },
  "radio-altar": { x: 1.45, y: 1.0, z: -2.7 },
  "bath-dish": { x: 2.25, y: 1.02, z: 1.3 },
  "musicbox-base": { x: 5.51, y: 0.8, z: -3.83 },
  "bed-farewell": { x: 7.4, y: 0.76, z: -2.55 },
  "bedside-lamp": { x: 8.64, y: 1.05, z: -3.65 },
  telephone: { x: -1.45, y: 0.89, z: 6.75 },
  letter: { x: -2.55, y: 0.48, z: 5.5 },
  radio: { x: 1.22, y: 1.1, z: -2.15 },
  fuse: { x: 1.45, y: 0.99, z: -3.85 },
  panel: { x: -3.26, y: 1.48, z: 1.85 },
  diary: { x: 8.58, y: 0.73, z: -3.45 },
  musicbox: { x: 5.25, y: 0.81, z: -3.95 },
  tap: { x: 2.48, y: 1.08, z: 1.36 },
  "bath-clue": { x: 2.15, y: 1.7, z: 1.015 },
  note: { x: 4.7, y: 0.86, z: 0.4 },
  drawer: { x: 4.7, y: 0.62, z: 0.35 },
  photo: { x: 0, y: 1.66, z: -0.615 },
  mirror: MIRROR,
  clock: HALL_CLOCK,
  door: { x: EXIT.x, y: 1.1, z: EXIT.z },
  "front-door": { x: FRONT_DOOR.x, y: 1.1, z: FRONT_DOOR.z },
};
export const ECHO_ORDER = ["musicbox", "tap", "radio"];
export const CLOCK_SOLUTION = { hour: 3, minute: 17 };
export function roomAt(x, z) {
  return (
    ROOMS.find((r) => x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ)
      ?.id || "hall"
  );
}
export function inHall(x, z) {
  return HALLS.some(
    (r) => x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ,
  );
}
export function atBackThreshold(x, z) {
  return x > PORTAL.minX && x < PORTAL.maxX && z > PORTAL.thresholdZ;
}

// Crossing planes are tested after actual collision movement, never interaction
// clicks. These bounds keep room exploration from triggering a spatial return.
export function atMirrorThreshold(x, z) {
  // Cross when the leading edge reaches the glass. Waiting for the camera's
  // centre puts it inside the frame/backing before the world can change.
  return x >= MIRROR.x - RADIUS && Math.abs(z - MIRROR.z) < 0.5;
}
export function atFrontThreshold(x, z) {
  return Math.abs(x - FRONT_DOOR.x) < 0.48 && z > 8.14;
}
