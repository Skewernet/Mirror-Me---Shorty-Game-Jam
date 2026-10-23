export const SPAWN = { x: 3.5, z: 6.7, yaw: Math.PI / 2 };
export const MIRROR = { x: 0, y: 1.52, z: -9.34, rotation: 0 };
export const EXIT = { x: 3.5, z: 8.4 };
export const HALL_CLOCK = { x: -1.58, y: 1.96, z: -7.3 };
export const ROOMS = [
  {
    id: "lounge",
    name: "SITTING ROOM",
    minX: -8,
    maxX: -1.85,
    minZ: 1.8,
    maxZ: 8.4,
    doorZ: 4,
  },
  {
    id: "bathroom",
    name: "BATHROOM",
    minX: -7,
    maxX: -1.85,
    minZ: -9.4,
    maxZ: -3,
    doorZ: -5.5,
  },
  {
    id: "kitchen",
    name: "KITCHEN",
    minX: 5.35,
    maxX: 11.7,
    minZ: -4,
    maxZ: 3.5,
    doorZ: -0.2,
  },
  {
    id: "bedroom",
    name: "BEDROOM",
    minX: 5.35,
    maxX: 11.7,
    minZ: 3.7,
    maxZ: 8.4,
    doorZ: 6.1,
  },
  {
    id: "utility",
    name: "UTILITY ROOM",
    minX: 5.35,
    maxX: 11.7,
    minZ: -9.4,
    maxZ: -4.2,
    doorZ: -7.2,
  },
];
export function roomAt(x, z) {
  return (
    ROOMS.find((r) => x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ)
      ?.id || "hall"
  );
}
export const ECHO_ORDER = ["musicbox", "tap", "radio"];
export const CLOCK_SOLUTION = { hour: 3, minute: 17 };
