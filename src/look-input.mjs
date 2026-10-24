export const LOOK_RADIANS_PER_PIXEL = 0.0018;
const CONFIRM_WINDOW_MS = 50;

const magnitude = (packet) => Math.hypot(packet.x, packet.y);
function consistent(a, b) {
  const am = magnitude(a), bm = magnitude(b);
  return am > 0 && bm > 0 && bm >= am / 4 && bm <= am * 4 &&
    (a.x * b.x + a.y * b.y) / (am * bm) > 0.8;
}

// Pointer lock can occasionally deliver a cursor-recentering discontinuity as
// relative movement. One such packet used to turn the player half a revolution.
// Confirm unusually large *individual packets* against adjacent motion rather
// than capping turn speed: a continuous fast/high-DPI sweep retains its full sum.
export class LookInput {
  constructor() {
    this.reset();
  }
  reset(time = -Infinity) {
    this.previous = null;
    this.pending = null;
    this.latestTime = Number.isFinite(time) ? time : -Infinity;
    this.discarded = 0;
  }
  read(event, sensitivity = 1) {
    const packet = { x: event.movementX, y: event.movementY, time: event.timeStamp };
    if (![packet.x, packet.y, packet.time, sensitivity].every(Number.isFinite) ||
        sensitivity <= 0 || packet.time < this.latestTime) {
      this.discarded++;
      return null;
    }
    this.latestTime = packet.time;
    if (this.pending) {
      const pending = this.pending;
      this.pending = null;
      if (packet.time - pending.time <= CONFIRM_WINDOW_MS) {
        const sum = { x: pending.x + packet.x, y: pending.y + packet.y };
        // Some recentering bugs deliver a compensating reverse packet. Apply
        // only its small net movement, without showing either false turn.
        const residual = Math.hypot(sum.x, sum.y);
        if (residual <= (magnitude(pending) + magnitude(packet)) * .10 &&
            residual * LOOK_RADIANS_PER_PIXEL * sensitivity <= .035) {
          this.discarded += 2;
          this.previous = null;
          return sum.x || sum.y ? sum : null;
        }
        if (consistent(pending, packet)) {
          this.previous = packet;
          return sum;
        }
      }
      this.discarded++;
    }
    const large = magnitude(packet) * LOOK_RADIANS_PER_PIXEL * sensitivity > Math.PI / 2;
    const continued = this.previous && packet.time - this.previous.time <= CONFIRM_WINDOW_MS &&
      consistent(this.previous, packet);
    if (large && !continued) {
      this.pending = packet;
      return null;
    }
    this.previous = packet;
    return { x: packet.x, y: packet.y };
  }
  snapshot() {
    return { discarded: this.discarded, pending: this.pending !== null };
  }
}
