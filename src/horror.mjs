import * as T from "three";
import { createDemon } from "./demon.mjs";
import { CEILING_HEIGHT } from "./layout.mjs";
import { CREATURE_STEP_METERS } from "./figure-motion.mjs";
import { CRAWLER_FLICKER, crawlerFlickerAt } from "./crawler-flicker.mjs";

// One body, six authored sightings. Every encounter starts from a visible,
// unobstructed sightline and withdraws into a real room or behind its dressing.
// None is an objective, a timer gate, or a collision obstacle.
const CEILING = CEILING_HEIGHT - 0.08;
const UP = new T.Vector3(0, 1, 0);
const SIGHTINGS = [
  {
    id: "bedroom-fold",
    stages: [2],
    mode: "twisted",
    lightSource: "bedroom",
    cue: "joint-fold",
    duration: 3.3,
    hold: 0.68,
    orient: 0.42,
    gazeDot: 0.8,
    premonition: "demon-inhale",
    intensity: 0.8,
    headHeight: 1.12,
    minDistance: 1.05,
    path: [
      [7.4, 0, -0.98],
      [7.4, 0, -1.35],
      [7.4, 0, -2.4],
    ],
    pulses: [[0.45, 0.72, 0.4]],
    eligible: (s, p) =>
      s.hasDiary &&
      s.doors?.bedroom &&
      Math.abs(p.z) < 0.48 &&
      p.x > 6.4 &&
      p.x < 8.4,
  },
  {
    id: "bathroom-ceiling",
    stages: [2, 3],
    mode: "ceiling",
    lightSource: "bathroom",
    cue: "ceiling-breath",
    duration: 4.4,
    hold: 1.05,
    orient: 0.35,
    gazeDot: 0.84,
    premonition: null,
    intensity: 0.84,
    headHeight: -0.38,
    minDistance: 0.8,
    path: [
      [3.1, CEILING, 2.2],
      [3.15, CEILING, 2.65],
      [3.15, CEILING, 3.45],
    ],
    pulses: [
      [0.2, 0.47, 0.36],
      [1.1, 1.38, 0.5],
    ],
    eligible: (s, p) =>
      s.hasTimeClue &&
      s.doors?.bathroom &&
      p.x > 1.1 &&
      p.x < 2.35 &&
      p.z > 1.8 &&
      p.z < 3.45,
  },
  {
    id: "far-hall-crawler",
    stages: [3],
    mode: "crawl",
    lightSource: "far-hall",
    cue: "crawl-arrival",
    duration: 4.6,
    hold: 0.72,
    orient: 0.4,
    gazeDot: 0.74,
    premonition: "demon-inhale",
    intensity: 0.9,
    headHeight: 0.44,
    minDistance: 2.0,
    path: [
      [5.75, 0, 0],
      [6.55, 0, 0],
      [7.4, 0, 0],
      [7.4, 0, -1.72],
    ],
    pulses: [
      [0.16, 0.46, 0.3],
      [1.04, 1.35, 0.22],
      [2.1, 2.34, 0.52],
    ],
    eligible: (s, p) =>
      s.doors?.bedroom && Math.abs(p.z) < 0.42 && p.x > 0.6 && p.x < 3.7,
  },
  {
    id: "sitting-room-return",
    stages: [4],
    mode: "crawl",
    lightSource: "entry",
    cue: "crawl-arrival",
    duration: 3.4,
    hold: 0.32,
    orient: 0.22,
    gazeDot: 0.7,
    premonition: null,
    intensity: 0.95,
    headHeight: 0.44,
    minDistance: 2.0,
    path: [
      [0, 0, 4.3],
      [0, 0, 5.1],
      [-1.55, 0, 5.1],
    ],
    pulses: [
      [0.25, 0.56, 0.3],
      [1.2, 1.52, 0.42],
    ],
    eligible: (s, p) =>
      s.echoIndex >= 1 &&
      !s.silenceComplete &&
      s.echoIndex < 3 &&
      s.doors?.lounge &&
      Math.abs(p.x) < 0.46 &&
      p.z > -0.3 &&
      p.z < 2.3,
  },
  {
    id: "last-ceiling",
    stages: [5],
    mode: "ceiling",
    lightSource: "far-hall",
    cue: "ceiling-breath",
    duration: 3.5,
    hold: 0.55,
    orient: 0.3,
    gazeDot: 0.76,
    premonition: "demon-inhale",
    intensity: 1,
    headHeight: -0.38,
    minDistance: 1.65,
    path: [
      [7.3, CEILING, 0],
      [7.4, 2.0, -0.45],
      [7.4, 2.0, -1.85],
    ],
    pulses: [[0.38, 0.85, 0.3]],
    eligible: (s, p) =>
      s.doors?.bedroom && Math.abs(p.z) < 0.42 && p.x > 3.1 && p.x < 6.4,
  },
  {
    id: "inverted-witness",
    stages: [6],
    mode: "twisted",
    lightSource: null,
    cue: "witness-breath",
    duration: 4.8,
    hold: 1.05,
    orient: 0.5,
    gazeDot: 0.82,
    premonition: null,
    intensity: 1,
    headHeight: 1.12,
    minDistance: 1.05,
    path: [
      [1.24, 0, 2.5],
      [1.24, 0, 2.5],
      [2.0, 0, 2.8],
    ],
    pulses: [],
    eligible: (s, p) =>
      s.farewellSaid &&
      s.lampOff &&
      s.doors?.bathroom &&
      Math.abs(p.x) < 0.45 &&
      p.z > 1.5 &&
      p.z < 3.45,
  },
];

function visibleInTree(object) {
  for (let current = object; current; current = current.parent)
    if (!current.visible) return false;
  return true;
}

function pathPoint(points, progress, output = new T.Vector3()) {
  // Distance-based interpolation prevents a tiny bend from using as much time
  // as a long hall segment, and keeps the gait tied to actual travelled metres.
  const lengths = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    lengths.push(length);
    total += length;
  }
  let distance = T.MathUtils.clamp(progress, 0, 1) * total;
  for (let i = 0; i < lengths.length; i++) {
    if (distance <= lengths[i] || i === lengths.length - 1) {
      const a = points[i],
        b = points[i + 1];
      const blend = lengths[i] ? distance / lengths[i] : 0;
      return output.set(
        T.MathUtils.lerp(a[0], b[0], blend),
        T.MathUtils.lerp(a[1], b[1], blend),
        T.MathUtils.lerp(a[2], b[2], blend),
      );
    }
    distance -= lengths[i];
  }
  return output.fromArray(points[points.length - 1]);
}

function tailOfPath(points, position, progress) {
  const lengths = points
    .slice(1)
    .map((point, index) =>
      Math.hypot(...point.map((value, axis) => value - points[index][axis])),
    );
  let distance =
    lengths.reduce((sum, length) => sum + length, 0) *
    T.MathUtils.clamp(progress, 0, 1);
  let segment = 0;
  while (segment < lengths.length - 1 && distance > lengths[segment])
    distance -= lengths[segment++];
  return [position.toArray(), ...points.slice(segment + 1)];
}

function blendYaw(from, to, amount) {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + delta * T.MathUtils.smoothstep(amount, 0, 1);
}
function facingFor(definition, position, player) {
  const viewer = Math.atan2(-(player.x - position.x), -(player.z - position.z));
  // Long bodies turn BEFORE reaching a narrow doorway; keeping them aimed at
  // the viewer throughout a corner would push their torso through the jamb.
  switch (definition.id) {
    case "bedroom-fold":
      return 0;
    case "inverted-witness":
      return -Math.PI / 2;
    case "last-ceiling":
      return Math.PI;
    case "far-hall-crawler":
      return blendYaw(viewer, Math.PI, (position.x - 6.25) / 0.85);
    case "sitting-room-return":
      return blendYaw(viewer, -Math.PI / 2, (position.z - 4.45) / 0.55);
    case "bathroom-ceiling":
      return blendYaw(viewer, Math.PI, (position.z - 2.35) / 0.55);
    default:
      return viewer;
  }
}

export class HorrorDirector {
  constructor(scene, house, { figureFactory = createDemon } = {}) {
    this.scene = scene;
    this.house = house;
    this.figure = figureFactory(house, 0);
    this.figure.body.name = "The Unkept";
    this.figure.body.visible = false;
    scene.add(this.figure.body);
    this.ray = new T.Raycaster();
    this.frustum = new T.Frustum();
    this.projection = new T.Matrix4();
    this.target = new T.Vector3();
    this.direction = new T.Vector3();
    this.viewDirection = new T.Vector3();
    this.previousPosition = new T.Vector3();
    this.headBone = this.figure.body.getObjectByName("head");
    this.headLocal = {};
    if (this.headBone && this.figure.setCreaturePose) {
      // Cache the real rig's head location for each hidden starting pose. This
      // keeps the face in view even when anatomy/height changes during polish.
      for (const mode of ["crawl", "ceiling", "twisted", "retreat"]) {
        this.figure.setCreaturePose(0, 0, { mode, intensity: 1, distance: 0 });
        this.figure.body.updateMatrixWorld(true);
        this.headLocal[mode] = this.figure.body.worldToLocal(
          this.headBone.getWorldPosition(new T.Vector3()),
        );
      }
    }
    this.reset();
  }

  reset() {
    this.events = [];
    this.completed = Object.fromEntries(SIGHTINGS.map((s) => [s.id, false]));
    this.attention = Object.fromEntries(SIGHTINGS.map((s) => [s.id, 0]));
    this.anticipated = Object.fromEntries(SIGHTINGS.map((s) => [s.id, false]));
    this.anticipationStarted = {};
    this.active = null;
    this.lastTime = -1;
    this.lastStage = 0;
    this.cooldownUntil = 0;
    this.light = { lightMultiplier: 1, lightSource: null };
    this.figure.body.visible = false;
    this.figure.body.position.set(0, 0, 0);
    this.figure.body.rotation.set(0, 0, 0);
    this.figure.resetPose?.();
    this.figure.resetMotion?.();
    this.updateShadows(0);
  }

  hasLineOfSight(point, camera, minDistance = 1.1, maxDistance = 8.5) {
    this.direction.copy(point).sub(camera.position);
    const distance = this.direction.length();
    if (distance < minDistance || distance > maxDistance) return false;
    this.direction.divideScalar(distance);
    this.scene.updateMatrixWorld(true);
    this.ray.set(camera.position, this.direction);
    this.ray.far = Math.max(0, distance - 0.06);
    const occluders = (this.house.occluders || []).filter(visibleInTree);
    return this.ray.intersectObjects(occluders, false).length === 0;
  }

  canSee(point, camera, minDistance = 1.1, maxDistance = 8.5, gazeDot = 0.84) {
    if (!this.hasLineOfSight(point, camera, minDistance, maxDistance))
      return false;
    camera.getWorldDirection(this.viewDirection);
    // Check both the actual camera frustum and gaze. A floor/ceiling glance
    // cannot consume an unseen body just because its horizontal bearing matches.
    if (this.viewDirection.dot(this.direction) < gazeDot) return false;
    this.projection.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    this.frustum.setFromProjectionMatrix(this.projection);
    return this.frustum.containsPoint(point);
  }

  start(definition, time, player) {
    const origin = new T.Vector3().fromArray(definition.path[0]);
    this.active = {
      definition,
      mode: definition.mode,
      started: time,
      progress: 0,
      travelled: 0,
      nextStepDistance: 0.18,
      relays: new Set(),
      closeRetreat: false,
      retreatStarted: null,
      retreatOrigin: null,
      seen: 0,
      away: 0,
      phase: "still",
      oriented: false,
      withdrew: false,
      lastCueAt: definition.premonition
        ? (this.anticipationStarted[definition.id] ?? -Infinity)
        : -Infinity,
    };
    this.completed[definition.id] = true;
    this.figure.resetPose?.();
    this.figure.resetMotion?.();
    this.figure.body.position.copy(origin);
    this.previousPosition.copy(origin);
    this.figure.body.visible = true;
    this.figure.body.rotation.y = facingFor(definition, origin, player);
  }

  finish(time) {
    this.figure.body.visible = false;
    this.updateShadows(time);
    this.active = null;
    this.cooldownUntil = time + 7;
    this.light = { lightMultiplier: 1, lightSource: null };
  }

  updateShadows(time) {
    if (typeof this.house.invalidateShadows === "function") {
      this.house.invalidateShadows(time);
      return;
    }
    for (const light of this.house.architecture?.shadowLights || [])
      if (light.shadow) light.shadow.needsUpdate = true;
  }

  update(
    time,
    dt,
    story,
    player,
    camera,
    { enabled = true, flashes = true, dialogueBusy = false } = {},
  ) {
    if (time < this.lastTime || (story.stage === 0 && this.lastStage > 0))
      this.reset();
    this.lastTime = time;
    this.lastStage = story.stage;
    this.light = { lightMultiplier: 1, lightSource: null };
    if (!enabled || story.endingStarted || story.wakeEntered || story.ended) {
      if (this.active) this.finish(time);
      // Turning scares off cannot leave an already queued sound to play later.
      this.events.length = 0;
      this.attention = Object.fromEntries(SIGHTINGS.map((s) => [s.id, 0]));
      this.anticipated = Object.fromEntries(
        SIGHTINGS.map((s) => [s.id, false]),
      );
      this.anticipationStarted = {};
      return this.light;
    }
    if (this.active && !this.active.definition.stages.includes(story.stage))
      this.finish(time);
    if (!this.active && time >= this.cooldownUntil && !dialogueBusy) {
      for (const definition of SIGHTINGS) {
        if (
          this.completed[definition.id] ||
          !definition.stages.includes(story.stage) ||
          !definition.eligible(story, player)
        )
          continue;
        const origin = definition.path[0];
        if (this.headLocal[definition.mode]) {
          const facing = facingFor(
            definition,
            new T.Vector3().fromArray(origin),
            player,
          );
          this.target
            .copy(this.headLocal[definition.mode])
            .applyAxisAngle(UP, facing)
            .add(new T.Vector3().fromArray(origin));
        } else {
          this.target.fromArray(origin);
          this.target.y += definition.headHeight;
        }
        // An audible presence can precede seeing its owner, but never leaks
        // through a closed door/wall and never consumes the optional sighting.
        // It happens once, not as an endlessly repeating "look here" prompt.
        const clear = this.hasLineOfSight(
          this.target,
          camera,
          definition.minDistance,
        );
        if (clear && this.anticipationStarted[definition.id] === undefined)
          this.anticipationStarted[definition.id] = time;
        if (
          clear &&
          definition.premonition &&
          !this.anticipated[definition.id]
        ) {
          this.anticipated[definition.id] = true;
          this.events.push({
            id: definition.premonition,
            x: this.target.x,
            y: this.target.y,
            z: this.target.z,
            encounter: definition.id,
          });
        }
        const visible =
          clear &&
          this.canSee(
            this.target,
            camera,
            definition.minDistance,
            8.5,
            definition.gazeDot,
          );
        this.attention[definition.id] = visible
          ? this.attention[definition.id] + dt
          : 0;
        if (
          this.attention[definition.id] >= 0.08 &&
          time - (this.anticipationStarted[definition.id] ?? time) >=
            (definition.premonition ? 0.45 : 0)
        ) {
          this.start(definition, time, player);
          break;
        }
      }
    }
    if (!this.active) return this.light;

    const active = this.active,
      definition = active.definition;
    const age = Math.max(0, time - active.started);
    let progress = Math.min(1, age / definition.duration);
    const withdrawalAt = definition.hold + definition.orient;
    let pathProgress = T.MathUtils.smoothstep(
      age,
      withdrawalAt,
      definition.duration,
    );
    let travelPath = definition.path,
      travelProgress = pathProgress;
    active.phase =
      age < definition.hold
        ? "still"
        : age < withdrawalAt
          ? "orient"
          : "withdraw";
    const body = this.figure.body;
    // The first view lasts long enough to read a distorted anatomy. Closing on
    // it makes it retreat; the player can never walk through a stationary model.
    const playerDistance = Math.hypot(
      player.x - body.position.x,
      player.z - body.position.z,
    );
    if (
      playerDistance <
        (definition.mode === "twisted"
          ? 1.1
          : definition.mode === "ceiling"
            ? 0.95
            : 1.65) &&
      !active.closeRetreat &&
      age > 0.25
    ) {
      active.closeRetreat = true;
      active.retreatStarted = time;
      active.retreatOrigin = body.position.clone();
      active.retreatPath = tailOfPath(
        definition.path,
        body.position,
        pathProgress,
      );
      let remainingLength = 0;
      for (let i = 1; i < active.retreatPath.length; i++)
        remainingLength += new T.Vector3()
          .fromArray(active.retreatPath[i])
          .distanceTo(new T.Vector3().fromArray(active.retreatPath[i - 1]));
      active.retreatDuration = T.MathUtils.clamp(
        remainingLength / 1.7,
        0.65,
        2.8,
      );
    }
    if (active.closeRetreat) {
      const exit = definition.path[definition.path.length - 1];
      const retreatProgress = Math.min(
        1,
        (time - active.retreatStarted) / active.retreatDuration,
      );
      const distance = active.retreatOrigin.distanceTo(
        new T.Vector3().fromArray(exit),
      );
      // Continue through the remaining doorway path rather than cutting a
      // diagonal through a wall when the player walks toward the apparition.
      pathPoint(active.retreatPath, retreatProgress, body.position);
      travelPath = active.retreatPath;
      travelProgress = retreatProgress;
      progress = Math.max(progress, 0.65 + retreatProgress * 0.35);
      pathProgress = Math.max(pathProgress, retreatProgress);
      active.phase = "withdraw";
      if (distance < 0.5 || retreatProgress >= 1) progress = 1;
    } else {
      pathPoint(definition.path, pathProgress, body.position);
    }
    // Seed stationary contacts toward the upcoming real path, not toward the
    // body's gaze. A backward withdrawal must not plant a forward stride first.
    // This is intent only: vx/vz below remain measured world-space velocity.
    const remainingPath = tailOfPath(travelPath, body.position, travelProgress);
    const nextPoint = remainingPath
      .slice(1)
      .find(
        (point) =>
          Math.hypot(point[0] - body.position.x, point[2] - body.position.z) >
          0.00001,
      );
    const travelIntent = nextPoint
      ? [nextPoint[0] - body.position.x, nextPoint[2] - body.position.z]
      : [0, 0];
    this.updateShadows(time);
    const velocity = body.position
      .clone()
      .sub(this.previousPosition)
      .divideScalar(Math.max(dt, 0.001));
    active.travelled += body.position.distanceTo(this.previousPosition);
    this.previousPosition.copy(body.position);
    const desiredYaw = facingFor(definition, body.position, player);
    const turn = Math.atan2(
      Math.sin(desiredYaw - body.rotation.y),
      Math.cos(desiredYaw - body.rotation.y),
    );
    body.rotation.y += turn * (1 - Math.exp(-dt * 9));
    const mode =
      definition.mode === "twisted" && pathProgress > 0.035
        ? "crawl"
        : definition.mode;
    active.mode = mode;
    if (this.figure.setCreaturePose) {
      this.figure.setCreaturePose(time, progress, {
        mode,
        intensity: definition.intensity,
        distance: active.travelled,
        delta: dt,
        vx: velocity.x,
        vz: velocity.z,
        travelIntent,
        phase: active.phase,
        still: active.phase === "still",
        gazeTarget: [player.x, camera.position.y, player.z],
        gazeWeight: active.phase === "still" ? 0 : 1,
      });
    } else {
      // During asset development this legacy path keeps the app runnable. The
      // shipped figure module implements the actual low/ceiling rig posture.
      this.figure.setUnease(2);
      this.figure.animate(time, 0, true);
    }
    if (this.headBone) this.headBone.getWorldPosition(this.target);
    else {
      this.target.copy(body.position);
      this.target.y +=
        mode === "ceiling" ? -0.38 : mode === "twisted" ? 1.12 : 0.44;
    }
    const visible = this.canSee(this.target, camera, 0.2, 12);
    active.seen += visible ? dt : 0;
    active.away = visible ? 0 : active.away + dt;
    active.progress = progress;
    const emit = (id) => {
      if (!dialogueBusy && time - active.lastCueAt >= 0.7) {
        active.lastCueAt = time;
        this.events.push({
          id,
          x: this.target.x,
          y: this.target.y,
          z: this.target.z,
          encounter: definition.id,
        });
      }
    };
    if (active.phase !== "still" && !active.oriented) {
      active.oriented = true;
      // Ceiling breathing and the final witness stay restrained. The first
      // facial/body response is deliberately separate from the preceding cue.
      if (definition.id === "far-hall-crawler") emit("demon-reveal");
      else if (
        definition.mode === "ceiling" ||
        definition.id === "inverted-witness"
      )
        emit(definition.cue);
    }
    if (active.phase === "withdraw" && !active.withdrew) {
      active.withdrew = true;
      // A close safety withdrawal can skip orientation. Do not stack its
      // transient with an orientation sound in that same frame.
      if (age >= withdrawalAt && definition.id === "bedroom-fold")
        emit("joint-fold");
      else if (age >= withdrawalAt && definition.id === "sitting-room-return")
        emit("demon-withdraw");
    }
    if (active.travelled >= active.nextStepDistance && mode !== "twisted") {
      // The contact gait and scrape cadence use the same travelled stride.
      active.nextStepDistance = active.travelled + CREATURE_STEP_METERS;
      if (!dialogueBusy)
        this.events.push({
          id: "crawl-step",
          x: body.position.x,
          y: mode === "ceiling" ? 1.95 : 0.22,
          z: body.position.z,
          encounter: definition.id,
        });
    }
    if (flashes && !dialogueBusy) {
      const flicker = crawlerFlickerAt(definition.id, age);
      let multiplier = flicker.lightMultiplier;
      const relay = (index) => {
        if (active.relays.has(index)) return;
        active.relays.add(index);
        this.events.push({
          id: "light-relay",
          x: body.position.x,
          y: 2,
          z: body.position.z,
          encounter: definition.id,
        });
      };
      if (flicker.index >= 0) relay(flicker.index);
      // Floor/ceiling encounters have finite, irregular full power failures,
      // beginning after their first readable glimpse and continuing through
      // stillness/withdrawal. Keep the separate twisted sighting's old dim.
      if (!Object.hasOwn(CRAWLER_FLICKER, definition.id)) {
        for (let index = 0; index < definition.pulses.length; index++) {
          const [from, to, amount] = definition.pulses[index];
          if (age >= withdrawalAt + from && age < withdrawalAt + to) {
            multiplier = Math.min(multiplier, amount);
            relay(index);
          }
        }
      }
      this.light = {
        lightMultiplier: multiplier,
        lightSource: definition.lightSource,
      };
    }
    if (
      progress >= 1 ||
      (active.seen > 0.65 && active.away > 0.35 && age > 1.1)
    )
      this.finish(time);
    return this.light;
  }

  drainEvents() {
    return this.events.splice(0);
  }

  snapshot() {
    return {
      active: this.active?.definition.id || null,
      phase: this.active?.phase || null,
      intensity: this.active?.definition.intensity ?? 0,
      anticipated: { ...this.anticipated },
      visible: this.figure.body.visible,
      mode: this.active?.mode || null,
      progress: this.active?.progress || 0,
      seen: this.active?.seen || 0,
      position: this.figure.body.position.toArray(),
      completed: { ...this.completed },
      gait: this.figure.body.userData.creatureGait || null,
      ...this.light,
    };
  }
}
