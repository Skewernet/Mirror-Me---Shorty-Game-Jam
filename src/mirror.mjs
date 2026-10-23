import * as T from "three";
import { Reflector } from "../vendor/Reflector.js";
import { MIRROR } from "./layout.mjs";
import { createFigure } from "./figure.mjs";
export class Mirror {
  constructor(scene, house) {
    this.surface = new Reflector(new T.PlaneGeometry(1.36, 2.04), {
      color: 0x898e8c,
      textureWidth: 512,
      textureHeight: 768,
      clipBias: 0.003,
      multisample: 0,
    });
    this.surface.position.set(MIRROR.x, MIRROR.y, MIRROR.z);
    this.surface.rotation.y = Math.PI / 2;
    this.surface.camera.layers.enable(1);
    scene.add(this.surface);
    const frame = new T.Group();
    frame.position.copy(this.surface.position);
    frame.rotation.copy(this.surface.rotation);
    scene.add(frame);
    for (const x of [-0.735, 0.735]) {
      house.box(0.09, 2.26, 0.11, x, 0, -0.01, house.wood, false, frame, 0.018);
      house.box(
        0.017,
        2.2,
        0.03,
        x - Math.sign(x) * 0.026,
        0,
        0.05,
        house.brass,
        false,
        frame,
        0.006,
      );
    }
    for (const y of [-1.09, 1.09]) {
      house.box(1.56, 0.09, 0.11, 0, y, -0.01, house.wood, false, frame, 0.018);
      house.box(
        1.43,
        0.017,
        0.025,
        0,
        y - Math.sign(y) * 0.027,
        0.05,
        house.brass,
        false,
        frame,
        0.006,
      );
    }
    const stainCanvas = document.createElement("canvas");
    stainCanvas.width = 128;
    stainCanvas.height = 256;
    const g = stainCanvas.getContext("2d"),
      grad = g.createLinearGradient(0, 0, 128, 0);
    grad.addColorStop(0, "rgba(12,17,13,.55)");
    grad.addColorStop(0.08, "rgba(10,12,8,.06)");
    grad.addColorStop(0.86, "rgba(10,12,8,.02)");
    grad.addColorStop(1, "rgba(12,17,13,.5)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 20; i++) {
      g.fillStyle = "#4b483622";
      g.fillRect(i % 2 ? 120 : 0, i * 13, 5 + (i % 3) * 2, 8);
    }
    const grime = new T.Mesh(
      new T.PlaneGeometry(1.36, 2.04),
      new T.MeshBasicMaterial({
        map: new T.CanvasTexture(stainCanvas),
        transparent: true,
        depthWrite: false,
      }),
    );
    grime.position.z = 0.008;
    grime.castShadow = false;
    frame.add(grime);
    house.interactables.push({
      id: "mirror",
      mesh: this.surface,
      label: "LOOK INTO THE GLASS",
      range: 2.8,
    });
    this.figure = createFigure(house, 1);
    this.body = this.figure.body;
    this.head = this.figure.head;
    scene.add(this.body);
    this.replacement = createFigure(house, 0);
    this.replacement.body.visible = false;
    scene.add(this.replacement.body);
    this.reset();
  }
  reset() {
    this.history = [];
    this.heldPose = null;
    this.lastLooking = null;
    this.body.visible = true;
    this.body.position.set(0, 0, 6.7);
    this.body.rotation.set(0, 0, 0);
    this.head.rotation.set(0, 0, 0);
    this.replacement.body.visible = false;
  }
  looking(player, camera) {
    if (
      player.x < -1.64 ||
      player.x > 1.6 ||
      Math.hypot(player.x - MIRROR.x, player.z - MIRROR.z) > 3.2
    )
      return false;
    const to = this.surface.position.clone().sub(camera.position).normalize(),
      dir = new T.Vector3();
    camera.getWorldDirection(dir);
    return dir.dot(to) > 0.9;
  }
  update(time, player, story, looking) {
    const pose = player.pose();
    this.history.push({ time, ...pose });
    while (this.history.length > 2 && this.history[1].time < time - 1.7)
      this.history.shift();
    if (looking && !story.frozen) this.lastLooking = { ...pose };
    if (story.frozen && !this.heldPose)
      this.heldPose = { ...(this.lastLooking || pose), x: -1.18 };
    let shown = pose;
    if (story.frozen) shown = this.heldPose;
    else if (story.stage >= 1) {
      shown = this.history[0];
      for (const sample of this.history) {
        if (sample.time > time - 0.68) break;
        shown = sample;
      }
    }
    if (story.stage === 4)
      shown = { x: -1.12, z: MIRROR.z, yaw: Math.PI / 2, pitch: 0 };
    this.body.visible = story.stage !== 3;
    this.body.position.set(shown.x, 0, shown.z);
    this.body.rotation.y = shown.yaw;
    this.head.rotation.x = shown.pitch;
    if (story.frozen || story.stage === 4) {
      const vx = 2 * MIRROR.x - player.x,
        facing = Math.atan2(-(vx - shown.x), -(player.z - shown.z));
      this.head.rotation.y = T.MathUtils.clamp(
        Math.atan2(Math.sin(facing - shown.yaw), Math.cos(facing - shown.yaw)),
        -1.12,
        1.12,
      );
      this.head.rotation.x = 0.01;
      this.head.rotation.z = 0.035;
    } else this.head.rotation.set(shown.pitch, 0, 0);
    this.figure.animate(time, player.speed, story.frozen || story.stage === 4);
    if (story.stage === 4) this.figure.arms[0].rotation.x = -0.8;
    this.surface.visible =
      player.x > -1.64 && player.x < 1.65 && Math.abs(player.z - MIRROR.z) < 10;
  }
  finale(time) {
    this.body.visible = false;
    this.replacement.body.visible = true;
    this.replacement.body.position.set(0, 0, 6.6 - Math.min(time, 5) * 0.62);
    this.replacement.body.rotation.y = 0;
    this.replacement.animate(time, 1.2, false);
  }
}
