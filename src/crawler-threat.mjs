import { RADIUS } from "./physics.mjs";

const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

// Closest points between two finite line segments. The vertical player capsule
// and measured, posed bone capsules share this distance test at any frame rate.
export function segmentDistance(a, b, c, d) {
  const u = sub(b, a), v = sub(d, c), w = sub(a, c);
  const aa = dot(u, u), bb = dot(u, v), cc = dot(v, v), dd = dot(u, w), ee = dot(v, w);
  let s = 0, t = 0;
  if (aa < 1e-12 && cc < 1e-12) return { distance: Math.hypot(...w), point: [...c] };
  if (aa < 1e-12) t = clamp(ee / cc);
  else if (cc < 1e-12) s = clamp(-dd / aa);
  else {
    const denominator = aa * cc - bb * bb;
    s = denominator > 1e-12 ? clamp((bb * ee - cc * dd) / denominator) : 0;
    t = (bb * s + ee) / cc;
    if (t < 0) { t = 0; s = clamp(-dd / aa); }
    else if (t > 1) { t = 1; s = clamp((bb - dd) / aa); }
  }
  const left = a.map((value, axis) => value + u[axis] * s);
  const right = c.map((value, axis) => value + v[axis] * t);
  return { distance: Math.hypot(...sub(left, right)), point: right };
}

function bodyDistance(position, shape, radius, height) {
  return segmentDistance([position.x, radius, position.z],
    [position.x, height - radius, position.z], shape.a, shape.b);
}

// The crawler is fixed at its PREVIOUS posed location during this query.
// Only resolved player movement can close this distance: actor motion cannot
// kill a stationary person, and moving away never becomes an attack trigger.
export function playerInitiatedContact(previous, current, shapes, {
  radius = RADIUS, height = 1.74, maxTravel = .4,
} = {}) {
  if (!previous || !current || ![previous.x, previous.z, current.x, current.z].every(Number.isFinite)) return null;
  const travelled = Math.hypot(current.x - previous.x, current.z - previous.z);
  if (travelled < .0001 || travelled > maxTravel) return null; // pause/teleport, not a chase
  const steps = Math.max(2, Math.ceil(travelled / .045));
  let nearest = null;
  for (const shape of shapes) {
    if (!shape.a?.every(Number.isFinite) || !shape.b?.every(Number.isFinite) || !Number.isFinite(shape.radius)) continue;
    const before = bodyDistance(previous, shape, radius, height);
    const combined = radius + shape.radius;
    // A creature that already moved across the body must not punish the next
    // ordinary step. Crossing a fresh contact surface is the actionable event.
    if (before.distance < combined - .015 || before.distance > combined + travelled) continue;
    for (let index = 1; index <= steps; index++) {
      const fraction = index / steps;
      const at = { x: previous.x + (current.x - previous.x) * fraction,
        z: previous.z + (current.z - previous.z) * fraction };
      const candidate = bodyDistance(at, shape, radius, height);
      // A sideways graze can enter and leave within one resolved frame. Check
      // closure at the swept point, not just the endpoint on its far side.
      if (candidate.distance > combined || candidate.distance >= before.distance - .00001) continue;
      if (!nearest || fraction < nearest.fraction)
        nearest = { point: candidate.point, fraction, name: shape.name,
          distance: candidate.distance, radius: combined };
      break;
    }
  }
  return nearest;
}

export function crawlerThreatTarget({ visible = false, gaze = 0, distance = Infinity } = {}) {
  if (!visible || !Number.isFinite(gaze) || !Number.isFinite(distance)) return 0;
  const attention = smooth((gaze - .86) / .12);
  const proximity = 1 - smooth((distance - .8) / 6.7);
  return attention * (.12 + .88 * proximity);
}

export const CRAWLER_FAILURE_SECONDS = 1.12;

// A finite consequence of contact, never an encounter timer or automatic
// pursuit. The controller owns its paused simulation clock and retry state.
export class CrawlerFailure {
  constructor() { this.reset(); }
  reset() { this.startedAt = null; this.origin = null; }
  begin(time, player) {
    if (this.startedAt !== null || !Number.isFinite(time)) return false;
    this.startedAt = time;
    const eyeHeight = player.camera?.position.y ?? player.eyeHeight;
    this.origin = { yaw: Number.isFinite(player.yaw) ? player.yaw : 0,
      pitch: Number.isFinite(player.pitch) ? player.pitch : 0,
      eyeHeight: Number.isFinite(eyeHeight) ? eyeHeight : 1.64 };
    return true;
  }
  update(time) {
    if (this.startedAt === null) return { active: false, done: false, phase: "idle", progress: 0, fade: 0, strike: 0 };
    const elapsed = Math.max(0, (Number.isFinite(time) ? time : this.startedAt) - this.startedAt);
    const fall = smooth((elapsed - .12) / .70);
    const hit = Math.exp(-elapsed * 11);
    return {
      active: elapsed < CRAWLER_FAILURE_SECONDS, done: elapsed >= CRAWLER_FAILURE_SECONDS,
      phase: elapsed < .16 ? "hit" : elapsed < .88 ? "fall" : elapsed < CRAWLER_FAILURE_SECONDS ? "black" : "done",
      progress: clamp(elapsed / CRAWLER_FAILURE_SECONDS),
      yaw: this.origin.yaw + Math.sin(elapsed * 57) * hit * .032,
      pitch: this.origin.pitch * (1 - fall) - .78 * fall + Math.sin(elapsed * 73) * hit * .027,
      eyeHeight: this.origin.eyeHeight + (.62 - this.origin.eyeHeight) * fall,
      fade: smooth((elapsed - .36) / .62),
      strike: smooth(elapsed / .10) * (1 - smooth((elapsed - .13) / .25)),
    };
  }
}
