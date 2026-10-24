export const LOOK_RADIANS_PER_PIXEL = 0.0018;
export const MAX_LOOK_FRAME_ANGLE = Math.PI / 9;
export const MAX_LOOK_RATE = Math.PI * 6;
const MAX_PACKET_AGE_MS = 100;

// Queue relative motion, then consume once per simulation/render frame. A
// packet-only filter cannot stop a coherent burst accumulating during a stall.
// Discard excess now: never replay a delayed spin over subsequent frames.
export class LookInput {
  constructor() { this.reset(); }
  reset(time = -Infinity) {
    this.latestTime = Number.isFinite(time) ? time : -Infinity;
    this.x = this.y = this.samples = 0;
    this.discarded = this.clampedFrames = 0;
  }
  enqueue(event, now = event.timeStamp) {
    const x = event.movementX, y = event.movementY, time = event.timeStamp;
    if (![x, y, time, now].every(Number.isFinite) || time < this.latestTime ||
        now - time > MAX_PACKET_AGE_MS) {
      this.discarded++;
      return false;
    }
    this.latestTime = time;
    if (!Number.isFinite(this.x + x) || !Number.isFinite(this.y + y)) {
      this.x = this.y = this.samples = 0;
      this.discarded++;
      return false;
    }
    this.x += x;
    this.y += y;
    this.samples++;
    return true;
  }
  consume(dt = 1 / 60, sensitivity = 1) {
    const x = this.x, y = this.y, samples = this.samples;
    this.x = this.y = this.samples = 0;
    if (!samples || !Number.isFinite(dt) || !Number.isFinite(sensitivity) ||
        dt <= 0 || sensitivity <= 0) return null;
    const counts = Math.hypot(x, y);
    if (!counts || !Number.isFinite(counts)) return null;
    const gain = LOOK_RADIANS_PER_PIXEL * sensitivity;
    const requested = counts * gain;
    const budget = Math.min(MAX_LOOK_FRAME_ANGLE, MAX_LOOK_RATE * Math.min(dt, .05));
    if (requested > budget) this.clampedFrames++;
    // A half-turn compressed into one rendered frame is a discontinuity, not
    // a useful flick. Normal fast turns spread across frames remain possible.
    if (requested > Math.PI / 2 && requested > budget * 4) {
      this.discarded += samples;
      return null;
    }
    const scale = Math.min(1, budget / requested);
    return { x: x * scale, y: y * scale };
  }
  snapshot() {
    return { discarded: this.discarded, clampedFrames: this.clampedFrames, pending: this.samples > 0 };
  }
}
