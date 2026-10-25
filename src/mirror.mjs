import * as T from "three";
import { Reflector } from "../vendor/Reflector.js";
import { MIRROR, SPAWN, CEILING_HEIGHT } from "./layout.mjs";
import { createFigure } from "./figure.mjs";
import { singleBounce } from "./reflection.mjs";
import { attachFlashlight } from "./first-person.mjs";
import { applyReflectionPose, interpolateReflectionPose } from "./reflection-pose.mjs";

function ownEyeBleeding(figure, uniform) {
  const skin = figure.body.getObjectByName("Mara_Skin");
  const material = skin.material;
  const original = material.onBeforeCompile, key = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    original.call(material, shader, renderer);
    shader.uniforms.reflectionEyeBleed = uniform;
    shader.fragmentShader = `uniform float reflectionEyeBleed;
      float mirrorTear(vec2 uv,float eye,float seed){
        float down=uv.x-.849;
        float extent=.085*reflectionEyeBleed;
        float path=eye+sin(down*137.+seed)*.0017+sin(down*371.-seed)*.0006;
        float width=.0015+.0012*(1.-clamp(down/.09,0.,1.));
        float across=(uv.y-path)/width;
        float track=exp(-across*across);
        float edge=smoothstep(-.003,.002,down)*(1.-smoothstep(max(.001,extent-.009),max(.002,extent),down));
        vec2 orbit=vec2((uv.x-.847)/.009,(uv.y-eye)/.016);
        vec2 droplet=vec2((uv.x-(.849+extent))/.003,(uv.y-path)/.0037);
        float socket=exp(-dot(orbit,orbit));
        float bead=exp(-dot(droplet,droplet));
        return clamp((track*edge+socket*.45+bead*.65)*smoothstep(0.,.08,reflectionEyeBleed),0.,1.);
      }\n` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <alphamap_fragment>",
      `float mirrorBleeding=max(mirrorTear(vMapUv,.478,1.7),mirrorTear(vMapUv,.564,4.2));
       diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.105,.0022,.0012),mirrorBleeding*.94);
       #include <alphamap_fragment>`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <roughnessmap_fragment>",
      "#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.19,mirrorBleeding*.8);",
    );
  };
  material.customProgramCacheKey = () => key + "|mirror-eye-bleeding-v1";
  material.needsUpdate = true;
  return skin;
}

// The optical image and Mara use the same room coordinates. The body is visible
// only to the reflector camera; lag and a held pose create the disobedience.
export class Mirror {
  constructor(scene, house) {
    this.house = house;
    this.surface = singleBounce(new Reflector(new T.PlaneGeometry(1.1, 2.08), {
      color: 0x929b98,
      textureWidth: 768,
      textureHeight: 1152,
      clipBias: 0.002,
      multisample: 0,
    }));
    this.uniforms = {
      dread: { value: 0 },
      glassTime: { value: 0 },
      emptyGlass: { value: 0 },
      otherSide: { value: 0 },
    };
    Object.assign(this.surface.material.uniforms, this.uniforms);
    this.surface.material.fragmentShader = this.surface.material.fragmentShader
      .replace(
        "uniform vec3 color;",
        "uniform vec3 color; uniform float dread, glassTime, emptyGlass, otherSide;",
      )
      .replace(
        "vec4 base = texture2DProj( tDiffuse, vUv );",
        `
        vec4 warped = vUv;
        vec2 screen = warped.xy / warped.w;
        float pulse = sin(screen.y * 31. + glassTime * .75) * .0013 * dread;
        warped.x += (pulse + emptyGlass * sin(screen.y * 19. - glassTime * .55) * .003) * warped.w;
        vec4 base = texture2DProj(tDiffuse, warped);
        base.rgb *= mix(vec3(1.),vec3(.91,.94,.92),dread);
        base.rgb *= mix(vec3(1.), vec3(.87,.95,1.02), otherSide * .32);
      `,
      );
    const centerY = CEILING_HEIGHT / 2 - 0.03;
    this.surface.position.set(MIRROR.x, centerY, MIRROR.z);
    this.surface.rotation.y = MIRROR.rotation;
    this.surface.userData.interactionId = "mirror";
    this.normal = new T.Vector3(
      Math.sin(MIRROR.rotation),
      0,
      Math.cos(MIRROR.rotation),
    );
    this.surface.camera.layers.enable(1);
    scene.add(this.surface);
    const frame = new T.Group();
    frame.position.copy(this.surface.position);
    frame.rotation.copy(this.surface.rotation);
    scene.add(frame);
    this.frame = frame;
    // The complete frame is 1.24m wide and 2.22m tall, fitted inside the hall.
    for (const x of [-0.585, 0.585]) {
      house.box(
        0.07,
        2.22,
        0.095,
        x,
        0,
        -0.01,
        house.wood,
        false,
        frame,
        0.012,
      );
      house.box(
        0.012,
        2.15,
        0.018,
        x - Math.sign(x) * 0.025,
        0,
        0.043,
        house.brass,
        false,
        frame,
        0.004,
      );
    }
    for (const y of [-1.075, 1.075]) {
      house.box(
        1.24,
        0.07,
        0.095,
        0,
        y,
        -0.01,
        house.wood,
        false,
        frame,
        0.012,
      );
      house.box(
        1.14,
        0.012,
        0.018,
        0,
        y - Math.sign(y) * 0.023,
        0.043,
        house.brass,
        false,
        frame,
        0.004,
      );
    }
    const stainCanvas = document.createElement("canvas");
    stainCanvas.width = 256;
    stainCanvas.height = 512;
    const g = stainCanvas.getContext("2d"),
      grad = g.createLinearGradient(0, 0, 256, 0);
    grad.addColorStop(0, "rgba(17,24,20,.32)");
    grad.addColorStop(0.07, "rgba(17,24,20,.025)");
    grad.addColorStop(0.9, "rgba(17,24,20,.01)");
    grad.addColorStop(1, "rgba(17,24,20,.28)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 33; i++) {
      const x = i % 2 ? 249 : 0;
      g.fillStyle = "#535a4433";
      g.fillRect(x, (i * 17) % 512, 2 + (i % 6), 2 + (i % 7));
    }
    const grime = new T.Mesh(
      new T.PlaneGeometry(1.1, 2.08),
      new T.MeshBasicMaterial({
        map: new T.CanvasTexture(stainCanvas),
        transparent: true,
        depthWrite: false,
      }),
    );
    grime.position.z = 0.005;
    grime.castShadow = false;
    frame.add(grime);
    house.interactables.push({
      id: "mirror",
      mesh: this.surface,
      label: "LOOK INTO THE GLASS",
      range: 2.8,
    });
    this.figure = createFigure(house, 1);
    this.flashlight = attachFlashlight(this.figure, 1);
    this.flashlight.root.name = "Held reflection's flashlight";
    this.eyeBleed = { value: 0 };
    this.skin = ownEyeBleeding(this.figure, this.eyeBleed);
    this.body = this.figure.body;
    this.head = this.figure.head;
    scene.add(this.body);
    this.occlusionRay = new T.Raycaster();
    this.gazeDirection = new T.Vector3();
    this.gazePoint = new T.Vector3();
    this.toGlass = new T.Vector3();
    this.reset();
  }
  setQuality(height = 900) {
    const width = height >= 900 ? 1024 : 768;
    const target = this.surface.getRenderTarget();
    if (target.width !== width) target.setSize(width, width * 1.5);
  }
  clearHistory() {
    this.history = [];
    this.lastLooking = null;
    this.lastShownPose = null;
    // A doorway can erase the player's route. It cannot release the held copy.
  }
  triggerShock(time) {
    if (this.shockPlayed) return false;
    this.shockAt = time;
    this.shockPlayed = true;
    return true;
  }
  reset() {
    this.clearHistory();
    this.heldPose = null;
    this.shockAt = -Infinity;
    this.shockPlayed = false;
    this.reactionAt = -Infinity;
    this.reactionIndex = 0;
    this.lastUpdateTime = 0;
    this.bleedStartedAt = null;
    this.bleedTarget = 0;
    this.eyeBleed.value = 0;
    this.embodiment = null;
    this.isHeld = false;
    this.flashlight.root.visible = false;
    this.body.visible = true;
    this.body.position.set(SPAWN.x, 0, SPAWN.z);
    this.figure.setUnease(0);
    this.figure.setHorror?.(0, 0);
    this.figure.resetMotion?.({
      distance: 0,
      x: SPAWN.x,
      z: SPAWN.z,
      yaw: SPAWN.yaw,
      time: 0,
    });
    this.body.rotation.set(0, 0, 0);
    this.head.rotation.set(0, 0, 0);
    this.surface.visible = true;
    for (const uniform of Object.values(this.uniforms)) uniform.value = 0;
  }
  react(time, index = 0, { enabled = true } = {}) {
    if (!enabled || !Number.isFinite(time) || time - this.reactionAt < 1.05) return false;
    this.reactionAt = time;
    this.reactionIndex = Math.abs(Math.trunc(index)) % 8;
    this.bleedStartedAt ??= time;
    this.bleedTarget = Math.min(.94, Math.max(.42, this.bleedTarget + .13));
    return true;
  }
  looking(player, camera) {
    const dx = player.x - MIRROR.x,
      dz = player.z - MIRROR.z;
    if (
      dx * this.normal.x + dz * this.normal.z < 0.1 ||
      Math.hypot(dx, dz) > 3.6
    )
      return false;
    // Judge a look at the upper glass, rather than requiring a downward glance
    // at the geometric centre of a full-height mirror.
    this.gazePoint.set(
      MIRROR.x,
      T.MathUtils.clamp(camera.position.y, 0.3, 2.05),
      MIRROR.z,
    );
    this.toGlass.copy(this.gazePoint).sub(camera.position);
    const distance = this.toGlass.length();
    this.toGlass.divideScalar(distance);
    camera.getWorldDirection(this.gazeDirection);
    if (this.gazeDirection.dot(this.toGlass) < 0.9) return false;
    this.occlusionRay.set(camera.position, this.toGlass);
    this.occlusionRay.far = Math.max(0, distance - 0.04);
    const occluders = this.house.occluders.filter((object) => {
      for (let current = object; current; current = current.parent)
        if (!current.visible) return false;
      return true;
    });
    return this.occlusionRay.intersectObjects(occluders, false).length === 0;
  }
  update(time, player, story, looking, embodiment = null) {
    const pose = { ...player.pose(), embodiment };
    this.lastUpdateTime = time;
    if (
      this.history.length &&
      this.history[this.history.length - 1].time > time
    )
      this.clearHistory();
    this.history.push({ time, ...pose });
    while (this.history.length > 2 && this.history[1].time < time - 1.7)
      this.history.shift();
    if (looking && !story.frozen) this.lastLooking = { ...pose };
    if (story.frozen && !story.inverted && !this.heldPose) {
      const capture = this.lastShownPose || this.lastLooking || pose;
      // The old unarmed copy could stand 42cm from the glass. A captured
      // outstretched torch needs its complete barrel to remain this side.
      const clearance = capture.embodiment ? .70 : .42;
      this.heldPose = {
        ...capture,
        x: MIRROR.x + this.normal.x * clearance,
        z: MIRROR.z + this.normal.z * clearance,
        yaw: MIRROR.rotation,
        speed: 0,
        vx: 0,
        vz: 0,
      };
    }
    let shown = pose;
    if (story.frozen && !story.inverted) shown = this.heldPose;
    else if (story.stage >= 1 && !story.inverted) {
      const delayedTime = time - 0.68;
      let before = this.history[0],
        after = before;
      for (const sample of this.history) {
        after = sample;
        if (sample.time >= delayedTime) break;
        before = sample;
      }
      const t =
        after.time === before.time
          ? 0
          : T.MathUtils.clamp(
              (delayedTime - before.time) / (after.time - before.time),
              0,
              1,
            );
      const yawDelta = Math.atan2(
        Math.sin(after.yaw - before.yaw),
        Math.cos(after.yaw - before.yaw),
      );
      shown = {
        x: T.MathUtils.lerp(before.x, after.x, t),
        z: T.MathUtils.lerp(before.z, after.z, t),
        yaw: before.yaw + yawDelta * t,
        pitch: T.MathUtils.lerp(before.pitch, after.pitch, t),
        distance: T.MathUtils.lerp(
          before.distance ?? 0,
          after.distance ?? 0,
          t,
        ),
        speed: T.MathUtils.lerp(before.speed ?? 0, after.speed ?? 0, t),
        vx: T.MathUtils.lerp(before.vx ?? 0, after.vx ?? 0, t),
        vz: T.MathUtils.lerp(before.vz ?? 0, after.vz ?? 0, t),
        embodiment: interpolateReflectionPose(before.embodiment, after.embodiment, t),
      };
    }
    const held = story.frozen && !story.inverted;
    this.isHeld = held;
    this.body.visible = story.stage < 5 || story.inverted;
    this.body.position.set(shown.x, 0, shown.z);
    // The last reflection turns its body away while its twisted neck keeps looking back.
    this.body.rotation.y = shown.yaw + (story.stage === 4 ? Math.PI : 0);
    if (shown.embodiment?.bodyOffset) {
      const offset = new T.Vector3().fromArray(shown.embodiment.bodyOffset);
      offset.applyAxisAngle(new T.Vector3(0, 1, 0), this.body.rotation.y);
      this.body.position.add(offset);
    }
    const dread =
      story.inverted || story.stage === 0
        ? 0
        : story.stage === 1
          ? held
            ? 0.16
            : 0.04
          : story.stage === 2
            ? 0.42
            : story.stage === 3
              ? 0.74
              : 0.98;
    this.figure.setUnease(
      story.inverted ? 0 : story.stage >= 2 ? 2 : held ? 1 : 0,
    );
    this.figure.animate(time, shown.speed ?? player.speed, held, {
      ...shown,
      time,
    });
    this.figure.setHorror?.(dread, time, { held, stage: story.stage });
    this.figure.setEvidenceBlood?.(
      story.inverted ? 1 : story.stage >= 3 ? 0.34 : 0,
    );
    applyReflectionPose(this.figure, this.flashlight, shown.embodiment);
    this.embodiment = shown.embodiment;
    if (story.stage === 4)
      this.figure.setCreaturePose?.(time, 0.5, {
        mode: "twisted",
        intensity: 0.9,
        reflection: true,
      });
    this.uniforms.dread.value = story.stage < 5 ? dread : 0;
    this.uniforms.glassTime.value = time;
    this.uniforms.emptyGlass.value = story.mirrorReady ? 1 : 0;
    this.uniforms.otherSide.value = story.inverted ? 1 : 0;
    this.head.rotation.set(shown.pitch, 0, 0);
    if (held) {
      const viewer = new T.Vector3(player.x, 0, player.z),
        planePoint = new T.Vector3(MIRROR.x, 0, MIRROR.z);
      viewer.addScaledVector(
        this.normal,
        -2 * viewer.clone().sub(planePoint).dot(this.normal),
      );
      const facing = Math.atan2(-(viewer.x - shown.x), -(viewer.z - shown.z));
      this.head.rotation.set(
        0.01,
        T.MathUtils.clamp(
          Math.atan2(
            Math.sin(facing - shown.yaw),
            Math.cos(facing - shown.yaw),
          ),
          -1.12,
          1.12,
        ),
        0.035,
      );
    }
    const shockTime = time - this.shockAt;
    if (shockTime >= 0 && shockTime < 0.35) {
      const amount =
        shockTime < 0.055
          ? shockTime / 0.055
          : Math.max(0, 1 - (shockTime - 0.055) / 0.295);
      this.head.rotation.x -= amount * 0.22;
      this.head.rotation.z -= amount * 0.31;
    }
    if (story.stage === 3 && this.figure.arms[0])
      this.figure.arms[0].rotation.x -= 0.6;
    // Three bounded, unequal catches disturb the held copy without resuming
    // the player's animation stream. The motion is silent unless the
    // controller separately schedules its original voice/contact performance.
    const age = time - this.reactionAt;
    if (age >= 0 && age < 1.05 && story.hasKey && !story.inverted) {
      const beat = Math.exp(-(((age - .052) / .027) ** 2))
        - .58 * Math.exp(-(((age - .245) / .039) ** 2))
        + .31 * Math.exp(-(((age - .613) / .052) ** 2));
      const sign = this.reactionIndex % 2 ? -1 : 1;
      this.head.rotation.x += beat * .17;
      this.head.rotation.z += beat * .23 * sign;
      this.figure.anatomy.rotate("spine_03", beat * .025, -beat * .018 * sign, beat * .032 * sign);
      for (const side of ["l", "r"])
        this.figure.anatomy.rotate(`lowerarm_${side}`, -beat * .12, 0, beat * .05 * sign);
      const jaw = this.skin.morphTargetDictionary?.Mara_Jaw_Open;
      if (jaw !== undefined)
        this.skin.morphTargetInfluences[jaw] = T.MathUtils.clamp(this.skin.morphTargetInfluences[jaw] + Math.abs(beat) * .14, 0, 1);
      this.figure.anatomy.update();
    }
    this.eyeBleed.value = this.bleedStartedAt !== null && story.hasKey && !story.inverted
      ? this.bleedTarget * T.MathUtils.smoothstep(time - this.bleedStartedAt, 0, 1.8) : 0;
    if (looking && !held) this.lastShownPose = shown;
    const planeDistance =
      (player.x - MIRROR.x) * this.normal.x +
      (player.z - MIRROR.z) * this.normal.z;
    this.surface.visible =
      planeDistance > 0.025 &&
      Math.hypot(player.x - MIRROR.x, player.z - MIRROR.z) < 24;
  }
  snapshot() {
    return {
      flashlightVisible: this.flashlight.root.visible,
      flashlightLayer: this.flashlight.root.layers.isEnabled(1) ? 1 : null,
      draw: this.embodiment?.draw ?? 0,
      sourceTime: this.embodiment?.time ?? null,
      held: this.isHeld,
      hand: this.figure.anatomy.point("hand_r").toArray(),
      flashlight: this.flashlight.root.getWorldPosition(new T.Vector3()).toArray(),
      reaction: this.lastUpdateTime - this.reactionAt >= 0 && this.lastUpdateTime - this.reactionAt < 1.05,
      eyeBleed: this.eyeBleed.value,
    };
  }
}
