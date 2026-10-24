import { overlaps } from "./physics.mjs";

const clamp = (x, min = 0, max = 1) => Math.max(min, Math.min(max, x));
const smooth = (x) => { const t = clamp(x); return t * t * (3 - 2 * t); };
const wrap = (x) => Math.atan2(Math.sin(x), Math.cos(x));

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
  begin(time, player, { enabled = true } = {}) {
    if (this.startedAt !== null) return false;
    this.startedAt = time;
    this.origin = { x: player.x, z: player.z, yaw: player.yaw, pitch: player.pitch || 0 };
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
    const turn = smooth(elapsed / .65);
    const lunge = clamp((elapsed - .65) / .70);
    const travel = lunge * lunge * (2 - lunge);
    const yaw = this.origin.yaw + wrap(this.facing - this.origin.yaw) * turn;
    this.result = {
      active: elapsed < 1.95,
      enabled: true,
      phase: elapsed < .65 ? "turn" : elapsed < 1.35 ? "lunge" : elapsed < 1.95 ? "impact" : "done",
      progress: clamp(elapsed / 1.95),
      lunge,
      x: this.spawn.x + (this.destination.x - this.spawn.x) * travel,
      z: this.spawn.z + (this.destination.z - this.spawn.z) * travel,
      yaw,
      pitch: this.origin.pitch * (1 - turn) + (.015 - lunge * .14) * turn,
      figureYaw: wrap(this.facing + Math.PI),
      distance: this.distance * travel,
      fade: smooth((elapsed - 1.31) / .64),
      done: elapsed >= 1.95,
    };
    return this.result;
  }
  snapshot() {
    return { startedAt: this.startedAt, ...this.result, spawn: this.spawn, destination: this.destination };
  }
  reduce(time) {
    if (this.startedAt === null || !this.enabled || this.result.done) return false;
    this.fadeFrom = this.update(time).fade;
    this.startedAt = time;
    this.enabled = false;
    this.update(time);
    return true;
  }
}
