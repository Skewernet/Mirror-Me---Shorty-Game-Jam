import { overlaps } from "./physics.mjs";

const clamp = (x, min = 0, max = 1) => Math.max(min, Math.min(max, x));
const smooth = (x) => { const t = clamp(x); return t * t * (3 - 2 * t); };
const wrap = (x) => Math.atan2(Math.sin(x), Math.cos(x));

// The reveal is a sudden interruption, rather than a slow approach after the
// accusation. Keep these phase boundaries shared with controller/render tests.
export const FUNERAL_ATTACK_TIMING = Object.freeze({
  turn: .20,
  lunge: .18,
  impact: .30,
  total: .68,
  fadeStart: .365,
});
const IMPACT_AT = FUNERAL_ATTACK_TIMING.turn + FUNERAL_ATTACK_TIMING.lunge;

// The controller supplies its paused simulation clock. A single immutable
// player pose owns the turn/lunge so mouse input cannot move the destination.
export class FuneralAttack {
  constructor(bounds, colliders = []) {
    this.bounds = bounds;
    this.colliders = colliders;
    this.reset();
  }
  reset() {
    this.startedAt = null;
    this.enabled = false;
    this.origin = null;
    this.spawn = null;
    this.destination = null;
    this.fadeFrom = 0;
    this.result = { active: false, phase: "idle", progress: 0, fade: 0, done: false };
  }
  clear(x, z) {
    const b = this.bounds, radius = .23;
    return x > b.minX + radius && x < b.maxX - radius &&
      z > b.minZ + radius && z < b.maxZ - radius &&
      !this.colliders.some((c) => overlaps(x, z, c, radius));
  }
  begin(time, player, { enabled = true, focusHeight = 1.49 } = {}) {
    if (this.startedAt !== null) return false;
    this.startedAt = time;
    this.origin = { x: player.x, z: player.z, yaw: player.yaw, pitch: player.pitch || 0 };
    this.focusHeight = focusHeight;
    if (enabled) {
      // Prefer directly behind. Near a wall/chair, find the nearest viable
      // direction instead of introducing a body through solid furniture.
      const offsets = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6].map(n => n * Math.PI / 6);
      search: for (const offset of offsets) {
        const angle = player.yaw + Math.PI + offset;
        const dx = -Math.sin(angle), dz = -Math.cos(angle);
        for (const distance of [2.1, 1.7, 1.3, .95]) {
          let valid = true;
          for (let d = .72; d <= distance + .001; d += .06) {
            if (!this.clear(player.x + dx * d, player.z + dz * d)) { valid = false; break; }
          }
          if (!valid || !this.clear(player.x + dx * distance, player.z + dz * distance)) continue;
          this.spawn = { x: player.x + dx * distance, z: player.z + dz * distance };
          this.destination = { x: player.x + dx * .72, z: player.z + dz * .72 };
          this.facing = Math.atan2(-dx, -dz);
          this.distance = distance - .72;
          this.enabled = true;
          break search;
        }
      }
    }
    this.update(time);
    return true;
  }
  update(time) {
    if (this.startedAt === null) return this.result;
    const elapsed = Math.max(0, time - this.startedAt);
    if (!this.enabled) {
      this.result = { active: elapsed < 1.1, enabled: false, phase: "quiet-fade", progress: clamp(elapsed / 1.1), fade: this.fadeFrom + (1 - this.fadeFrom) * smooth(elapsed / 1.1), done: elapsed >= 1.1 };
      return this.result;
    }
    const turn = smooth(elapsed / FUNERAL_ATTACK_TIMING.turn);
    const lunge = clamp((elapsed - FUNERAL_ATTACK_TIMING.turn) / FUNERAL_ATTACK_TIMING.lunge);
    const travel = lunge * lunge * (2 - lunge);
    const yaw = this.origin.yaw + wrap(this.facing - this.origin.yaw) * turn;
    this.result = {
      active: elapsed < FUNERAL_ATTACK_TIMING.total,
      enabled: true,
      phase: elapsed < FUNERAL_ATTACK_TIMING.turn ? "turn" : elapsed < IMPACT_AT ? "lunge" : elapsed < FUNERAL_ATTACK_TIMING.total ? "impact" : "done",
      progress: clamp(elapsed / FUNERAL_ATTACK_TIMING.total),
      strike: elapsed >= IMPACT_AT,
      strikeAt: this.startedAt + IMPACT_AT,
      lunge,
      x: this.spawn.x + (this.destination.x - this.spawn.x) * travel,
      z: this.spawn.z + (this.destination.z - this.spawn.z) * travel,
      yaw,
      pitch: this.origin.pitch * (1 - turn) + Math.atan2(
        this.focusHeight - .04 * travel - 1.64,
        Math.hypot(this.spawn.x - this.origin.x, this.spawn.z - this.origin.z) - this.distance * travel,
      ) * turn,
      figureYaw: wrap(this.facing + Math.PI),
      distance: this.distance * travel,
      fade: smooth((elapsed - FUNERAL_ATTACK_TIMING.fadeStart) /
        (FUNERAL_ATTACK_TIMING.total - FUNERAL_ATTACK_TIMING.fadeStart)),
      done: elapsed >= FUNERAL_ATTACK_TIMING.total,
    };
    return this.result;
  }
  snapshot() {
    return { startedAt: this.startedAt, ...this.result, spawn: this.spawn, destination: this.destination };
  }
  reduce(time) {
    if (this.startedAt === null || !this.enabled) return false;
    const state = this.update(time);
    if (state.done) return false;
    this.fadeFrom = state.fade;
    this.startedAt = time;
    this.enabled = false;
    this.update(time);
    return true;
  }
}
