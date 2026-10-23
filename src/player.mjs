import * as T from "three";
import { wishDirection, moveWithCollision } from "./physics.mjs";
import { SPAWN } from "./layout.mjs";
export class Player {
  constructor(camera) {
    this.camera = camera;
    this.keys = new Set();
    this.sensitivity = 1;
    this.bob = false;
    this.reset();
  }
  reset() {
    this.x = SPAWN.x;
    this.z = SPAWN.z;
    this.yaw = SPAWN.yaw;
    this.pitch = 0;
    this.distance = 0;
    this.bobOffset = 0;
    this.clear();
    this.syncCamera();
  }
  clear() {
    this.keys.clear();
    this.vx = 0;
    this.vz = 0;
    this.speed = 0;
  }
  look(dx, dy) {
    this.yaw -= dx * 0.0018 * this.sensitivity;
    this.pitch = T.MathUtils.clamp(
      this.pitch - dy * 0.0018 * this.sensitivity,
      -1.25,
      1.25,
    );
  }
  update(dt, colliders) {
    const forward =
      Number(this.keys.has("KeyW") || this.keys.has("ArrowUp")) -
      Number(this.keys.has("KeyS") || this.keys.has("ArrowDown"));
    const strafe =
      Number(this.keys.has("KeyD") || this.keys.has("ArrowRight")) -
      Number(this.keys.has("KeyA") || this.keys.has("ArrowLeft"));
    const direction = wishDirection(forward, strafe, this.yaw),
      blend = 1 - Math.exp(-dt * (forward || strafe ? 15 : 22));
    this.vx += (direction.x * 1.85 - this.vx) * blend;
    this.vz += (direction.z * 1.85 - this.vz) * blend;
    const bx = this.x,
      bz = this.z;
    moveWithCollision(this, this.vx * dt, this.vz * dt, colliders);
    const travelled = Math.hypot(this.x - bx, this.z - bz);
    this.distance += travelled;
    this.speed = travelled / Math.max(dt, 0.001);
    const targetBob =
      this.bob && this.speed > 0.1 ? Math.sin(this.distance * 8) * 0.012 : 0;
    this.bobOffset += (targetBob - this.bobOffset) * (1 - Math.exp(-dt * 12));
    this.syncCamera();
  }
  syncCamera() {
    this.camera.position.set(this.x, 1.64 + this.bobOffset, this.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
    this.camera.updateMatrixWorld();
  }
  pose() {
    return {
      x: this.x,
      z: this.z,
      yaw: this.yaw,
      pitch: this.pitch,
      distance: this.distance,
      speed: this.speed,
      vx: this.vx,
      vz: this.vz,
    };
  }
}
