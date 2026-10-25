import { overlaps } from "./physics.mjs";

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const wrap = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
const mix = (from, to, amount) => from + (to - from) * amount;

// The radio report owns its existing duration. This camera only establishes
// the room and takes Mara to the casket; it never starts/skips a spoken line.
export const FUNERAL_APPROACH_TIMING = Object.freeze({
  surveyLeft: 2.4,
  surveyRight: 5.0,
  faceCasket: 7.0,
  walkStart: 6.0,
  arrive: 18.5,
});
export const FUNERAL_CASKET_STAND = Object.freeze({ x: .32, z: 14.48 });
export const FUNERAL_CASKET_FOCUS = Object.freeze({ x: .68, y: 1.02, z: 15.65 });

// A simulation-clock sequence: pausing, resizing or a slow frame cannot add
// distance, replay a pan or let mouse input move the final strike destination.
export class FuneralApproach {
  constructor(bounds, colliders = []) {
    this.bounds = bounds;
    this.colliders = colliders;
    this.reset();
  }
  reset() {
    this.startedAt = null;
    this.origin = null;
    this.released = false;
    this.routeSafe = false;
    this.focus = { ...FUNERAL_CASKET_FOCUS };
    this.result = { active: false, phase: "idle", holding: false, speed: 0 };
  }
  clear(x, z) {
    const b = this.bounds, radius = .22;
    return x > b.minX + radius && x < b.maxX - radius &&
      z > b.minZ + radius && z < b.maxZ - radius &&
      !this.colliders.some(collider => overlaps(x, z, collider, radius));
  }
  begin(time, player, focus = FUNERAL_CASKET_FOCUS) {
    if (this.startedAt !== null || !Number.isFinite(time) ||
        ![player.x, player.z, player.yaw].every(Number.isFinite)) return false;
    this.startedAt = time;
    this.origin = { x: player.x, z: player.z, yaw: player.yaw,
      pitch: player.pitch || 0, eyeHeight: 1.64 };
    this.focus = { ...focus };
    const yawTo = target => Math.atan2(-(target.x - player.x), -(target.z - player.z));
    const leftYaw = player.yaw + wrap(yawTo({ x: -2.4, z: 12.2 }) - player.yaw);
    const rightYaw = leftYaw + wrap(yawTo({ x: 2.4, z: 12.7 }) - leftYaw);
    this.casketYaw = rightYaw + wrap(yawTo(focus) - rightYaw);
    this.routeSafe = true;
    const distance = Math.hypot(FUNERAL_CASKET_STAND.x - player.x,
      FUNERAL_CASKET_STAND.z - player.z);
    const steps = Math.max(1, Math.ceil(distance / .04));
    for (let step = 0; step <= steps; step++) {
      const t = step / steps;
      if (!this.clear(mix(player.x, FUNERAL_CASKET_STAND.x, t),
        mix(player.z, FUNERAL_CASKET_STAND.z, t))) {
        // Defensive recovery for a restored/debug pose outside the aisle:
        // retain its valid starting location rather than cross furniture.
        this.routeSafe = false;
        break;
      }
    }
    this.update(time);
    return true;
  }
  release() {
    if (this.startedAt === null || this.released) return false;
    this.released = true;
    this.result = { active: false, phase: "released", holding: false, speed: 0 };
    return true;
  }
  update(time) {
    if (this.startedAt === null || this.released) return this.result;
    const age = Math.max(0, time - this.startedAt), t = FUNERAL_APPROACH_TIMING;
    const walk = this.routeSafe ? smooth((age - t.walkStart) / (t.arrive - t.walkStart)) : 0;
    const x = mix(this.origin.x, FUNERAL_CASKET_STAND.x, walk);
    const z = mix(this.origin.z, FUNERAL_CASKET_STAND.z, walk);
    const aim = target => ({
      yaw: Math.atan2(-(target.x - x), -(target.z - z)),
      pitch: Math.atan2(target.y - this.origin.eyeHeight,
        Math.hypot(target.x - x, target.z - z)),
    });
    const left = aim({ x: -2.4, y: 1.35, z: 12.2 });
    const right = aim({ x: 2.4, y: 1.30, z: 12.7 });
    const casket = aim(this.focus);
    // Keep a continuous numerical branch as well as a shortest visual turn;
    // crossing +/-PI must not look like a full revolution to body animation.
    left.yaw = this.origin.yaw + wrap(left.yaw - this.origin.yaw);
    right.yaw = left.yaw + wrap(right.yaw - left.yaw);
    casket.yaw = this.casketYaw + wrap(casket.yaw - this.casketYaw);
    let from, to, progress;
    if (age < t.surveyLeft) {
      from = this.origin; to = left; progress = smooth(age / t.surveyLeft);
    } else if (age < t.surveyRight) {
      from = left; to = right;
      progress = smooth((age - t.surveyLeft) / (t.surveyRight - t.surveyLeft));
    } else {
      from = right; to = casket;
      progress = smooth((age - t.surveyRight) / (t.faceCasket - t.surveyRight));
    }
    const walking = age > t.walkStart && age < t.arrive && this.routeSafe;
    const routeLength = Math.hypot(FUNERAL_CASKET_STAND.x - this.origin.x,
      FUNERAL_CASKET_STAND.z - this.origin.z);
    const u = clamp((age - t.walkStart) / (t.arrive - t.walkStart));
    this.result = {
      active: true,
      phase: age < t.walkStart ? "survey" : age < t.arrive ? "approach" : "hold",
      holding: age >= t.arrive,
      x, z,
      yaw: age >= t.faceCasket ? casket.yaw : mix(from.yaw, to.yaw, progress),
      pitch: mix(from.pitch, to.pitch, progress),
      eyeHeight: this.origin.eyeHeight,
      speed: walking ? routeLength * 6 * u * (1 - u) / (t.arrive - t.walkStart) : 0,
      routeSafe: this.routeSafe,
    };
    return this.result;
  }
  snapshot() {
    return { startedAt: this.startedAt, released: this.released, ...this.result };
  }
}
