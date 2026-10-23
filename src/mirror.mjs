import * as T from "three";
import { Reflector } from "../vendor/Reflector.js";
export class Mirror {
  constructor(scene, house) {
    this.surface = new Reflector(new T.PlaneGeometry(1.22, 1.96), {
      color: 0x858d88,
      textureWidth: 384,
      textureHeight: 512,
      clipBias: 0.003,
      multisample: 0,
    });
    this.surface.position.set(-1.595, 1.55, -0.45);
    this.surface.rotation.y = Math.PI / 2;
    // The player proxy exists only in the reflected camera's layer.
    this.surface.camera.layers.enable(1);
    scene.add(this.surface);
    const frame = new T.Group();
    frame.position.copy(this.surface.position);
    frame.rotation.copy(this.surface.rotation);
    scene.add(frame);
    for (const x of [-0.68, 0.68]) {
      house.box(0.105, 2.2, 0.1, x, 0, -0.02, house.wood, false, frame);
      house.box(
        0.018,
        2.13,
        0.025,
        x - Math.sign(x) * 0.035,
        0,
        0.045,
        house.brass,
        false,
        frame,
      );
    }
    for (const y of [-1.065, 1.065]) {
      house.box(1.45, 0.1, 0.1, 0, y, -0.02, house.wood, false, frame);
      house.box(
        1.32,
        0.018,
        0.025,
        0,
        y - Math.sign(y) * 0.035,
        0.045,
        house.brass,
        false,
        frame,
      );
    }
    const label = new T.Mesh(
      new T.PlaneGeometry(0.48, 0.07),
      new T.MeshBasicMaterial({ color: 0x6a674f }),
    );
    label.position.set(0, -1.14, 0.01);
    frame.add(label);
    // A few tarnish marks at the glass edge, leaving its center readable.
    const tarnish = new T.MeshBasicMaterial({
      color: 0x3e453b,
      transparent: true,
      opacity: 0.6,
    });
    for (let i = 0; i < 10; i++)
      house.box(
        0.015 + (i % 3) * 0.012,
        0.08 + (i % 4) * 0.04,
        0.004,
        -0.59 + (i % 2) * 1.18,
        -0.85 + (i % 5) * 0.41,
        0.007,
        tarnish,
        false,
        frame,
      );
    house.interactables.push({
      id: "mirror",
      mesh: this.surface,
      label: "LOOK INTO THE GLASS",
      range: 2.7,
    });
    const shirt = new T.MeshStandardMaterial({ color: 0x6d796e, roughness: 1 }),
      skin = new T.MeshStandardMaterial({ color: 0xb3ac91, roughness: 1 }),
      trousers = new T.MeshStandardMaterial({ color: 0x232b26, roughness: 1 });
    this.body = new T.Group();
    scene.add(this.body);
    const limb = (w, h, d, x, y, z, mat, parent = this.body) =>
      house.box(w, h, d, x, y, z, mat, false, parent);
    const torso = new T.Mesh(
      new T.CylinderGeometry(0.235, 0.18, 0.61, 8),
      shirt,
    );
    torso.scale.z = 0.6;
    torso.position.y = 1.08;
    this.body.add(torso);
    const neck = new T.Mesh(
      new T.CylinderGeometry(0.065, 0.075, 0.12, 8),
      skin,
    );
    neck.position.y = 1.44;
    this.body.add(neck);
    for (const side of [-1, 1]) {
      const collar = limb(0.12, 0.035, 0.12, side * 0.07, 1.38, -0.09, shirt);
      collar.rotation.z = side * 0.3;
    }
    limb(0.39, 0.16, 0.22, 0, 0.76, 0, trousers);
    for (const s of [-1, 1]) {
      limb(0.14, 0.7, 0.17, s * 0.115, 0.39, 0, trousers);
      limb(0.17, 0.12, 0.28, s * 0.115, 0.08, -0.04, house.black);
      limb(0.13, 0.51, 0.14, s * 0.285, 1.01, 0, shirt);
      limb(0.115, 0.17, 0.12, s * 0.285, 0.69, 0, skin);
    }
    this.head = new T.Group();
    this.head.position.set(0, 1.58, 0);
    this.body.add(this.head);
    const skull = new T.Mesh(new T.SphereGeometry(0.17, 10, 7), skin);
    skull.scale.set(0.86, 1.22, 0.93);
    this.head.add(skull);
    // Recessed eyes, hair and a small nose; no bright glowing eyes or monster mask.
    const hair = new T.Mesh(
      new T.SphereGeometry(0.175, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.46),
      trousers,
    );
    hair.scale.set(0.87, 1.22, 0.94);
    this.head.add(hair);
    limb(0.2, 0.18, 0.08, 0, 0.03, 0.12, trousers, this.head);
    for (const s of [-1, 1]) {
      limb(
        0.047,
        0.017,
        0.017,
        s * 0.06,
        0.012,
        -0.145,
        house.black,
        this.head,
      );
      limb(0.045, 0.018, 0.016, s * 0.06, 0.036, -0.14, trousers, this.head);
    }
    limb(0.03, 0.065, 0.045, 0, -0.027, -0.164, skin, this.head);
    limb(0.065, 0.009, 0.012, 0, -0.085, -0.147, trousers, this.head);
    this.body.traverse((o) => o.layers.set(1));
    this.reset();
  }
  reset() {
    this.history = [];
    this.heldPose = null;
    this.lastLooking = null;
    this.body.position.set(0, 0, 5.2);
    this.body.rotation.set(0, 0, 0);
    this.head.rotation.set(0, 0, 0);
  }
  looking(player, camera) {
    if (player.x > 1.6 || Math.hypot(player.x + 1.595, player.z + 0.45) > 3.1)
      return false;
    const toGlass = this.surface.position
        .clone()
        .sub(camera.position)
        .normalize(),
      direction = new T.Vector3();
    camera.getWorldDirection(direction);
    return direction.dot(toGlass) > 0.87;
  }
  update(time, player, story, looking) {
    const pose = player.pose();
    this.history.push({ time, ...pose });
    while (this.history.length > 2 && this.history[1].time < time - 1.5)
      this.history.shift();
    if (looking && !story.frozen) this.lastLooking = { ...pose };
    if (story.frozen && !this.heldPose)
      this.heldPose = { ...(this.lastLooking || pose), x: -1.18 };
    let shown = pose;
    if (story.frozen) shown = this.heldPose;
    else if (story.stage >= 1) {
      shown = this.history[0];
      for (const sample of this.history) {
        if (sample.time > time - 0.55) break;
        shown = sample;
      }
    }
    this.body.position.set(shown.x, 0, shown.z);
    this.body.rotation.y = shown.yaw;
    this.head.rotation.x = shown.pitch;
    if (story.frozen) {
      // The held body stays fixed; its gaze follows the reflected viewer independently.
      const reflectedViewerX = 2 * this.surface.position.x - player.x;
      const facing = Math.atan2(
        -(reflectedViewerX - shown.x),
        -(player.z - shown.z),
      );
      this.head.rotation.y = T.MathUtils.clamp(
        Math.atan2(Math.sin(facing - shown.yaw), Math.cos(facing - shown.yaw)),
        -1.05,
        1.05,
      );
      this.head.rotation.x = 0.025;
      this.head.rotation.z = 0.055;
    } else {
      this.head.rotation.y = 0;
      this.head.rotation.z = 0;
    }
    this.surface.visible = player.x < 1.6 && Math.abs(player.z + 0.45) < 7;
  }
}
