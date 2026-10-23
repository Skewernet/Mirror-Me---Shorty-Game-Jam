import * as T from "three";

const UP = new T.Vector3(0, 1, 0);
const RIGHT = new T.Vector3(1, 0, 0);
const FORWARD = new T.Vector3(0, 0, -1);
const TAU = Math.PI * 2;
export const HUMAN_STRIDE_METERS = 1.24;
export const HUMAN_STEP_METERS = HUMAN_STRIDE_METERS / 2;
export const HUMAN_FOOTFALL_OFFSET = 0.3348;
const clamp = T.MathUtils.clamp;
const smooth = (x) => {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};
const fraction = (x) => ((x % 1) + 1) % 1;

// glTF bone rolls differ between limbs. All articulation below is expressed in
// the character's body coordinates and converted through the actual bind pose.
// No animation assumes that an imported bone's local X is a knee hinge.
export class FigureRig {
  constructor(body, visual) {
    this.body = body;
    this.visual = visual;
    this.joints = new Map();
    body.updateMatrixWorld(true);
    const bodyQ = body.getWorldQuaternion(new T.Quaternion()).invert();
    visual.traverse((bone) => {
      if (!bone.isBone) return;
      this.joints.set(bone.name, {
        bone,
        position: bone.position.clone(),
        quaternion: bone.quaternion.clone().normalize(),
        scale: bone.scale.clone(),
        bodyQuaternion: bodyQ
          .clone()
          .multiply(bone.getWorldQuaternion(new T.Quaternion()))
          .normalize(),
        point: body.worldToLocal(bone.getWorldPosition(new T.Vector3())),
      });
    });
    const solePoints = [];
    const shoes = visual.getObjectByName("Mara_Shoes");
    if (shoes) {
      shoes.skeleton.update();
      for (let i = 0; i < shoes.geometry.attributes.position.count; i++)
        solePoints.push(
          body.worldToLocal(
            shoes.localToWorld(shoes.getVertexPosition(i, new T.Vector3())),
          ),
        );
    }
    this.sides = ["l", "r"].map((side) => {
      const hip = this.restPoint(`thigh_${side}`);
      const knee = this.restPoint(`calf_${side}`);
      const ankle = this.restPoint(`foot_${side}`);
      const shoulder = this.restPoint(`upperarm_${side}`);
      const elbow = this.restPoint(`lowerarm_${side}`);
      const wrist = this.restPoint(`hand_${side}`);
      const shoe = solePoints.filter((point) => point.x * ankle.x > 0);
      const heel = new T.Vector3(ankle.x, 0, ankle.z + 0.055);
      const toe = new T.Vector3(ankle.x, 0, ankle.z - 0.18);
      if (shoe.length) {
        const front = Math.min(...shoe.map((point) => point.z));
        const back = Math.max(...shoe.map((point) => point.z));
        const centre = (items) =>
          items
            .reduce((sum, point) => sum.add(point), new T.Vector3())
            .divideScalar(items.length);
        toe.copy(centre(shoe.filter((point) => point.z < front + 0.018)));
        toe.y = 0;
        heel.copy(centre(shoe.filter((point) => point.z > back - 0.018)));
        heel.y = 0;
      }
      const hinge = toe.clone().sub(heel).cross(UP).normalize();
      return {
        side,
        hip,
        knee,
        ankle,
        shoulder,
        elbow,
        wrist,
        heel,
        toe,
        hinge,
        upperLeg: hip.distanceTo(knee),
        lowerLeg: knee.distanceTo(ankle),
        upperArm: shoulder.distanceTo(elbow),
        lowerArm: elbow.distanceTo(wrist),
      };
    });
  }
  joint(name) {
    const result = this.joints.get(name);
    if (!result) throw new Error(`Mara's rig is missing ${name}.`);
    return result;
  }
  restPoint(name) {
    return this.joint(name).point.clone();
  }
  reset() {
    this.visual.position.set(0, 0, 0);
    this.visual.rotation.set(0, Math.PI, 0);
    this.visual.scale.set(1, 1, 1);
    for (const joint of this.joints.values()) {
      joint.bone.position.copy(joint.position);
      joint.bone.quaternion.copy(joint.quaternion);
      joint.bone.scale.copy(joint.scale);
    }
    this.update();
  }
  update() {
    this.body.updateMatrixWorld(true);
  }
  point(name) {
    return this.joint(name).bone.getWorldPosition(new T.Vector3());
  }
  bodyPoint(point) {
    return this.body.localToWorld(point.clone());
  }
  bodyVector(vector) {
    return vector
      .clone()
      .applyQuaternion(this.body.getWorldQuaternion(new T.Quaternion()));
  }
  bodyQuaternion(quaternion) {
    return this.body
      .getWorldQuaternion(new T.Quaternion())
      .multiply(quaternion);
  }
  setWorldQuaternion(name, quaternion) {
    const bone = this.joint(name).bone;
    const parentQ = bone.parent.getWorldQuaternion(new T.Quaternion()).invert();
    bone.quaternion.copy(parentQ.multiply(quaternion)).normalize();
    bone.updateMatrixWorld(true);
  }
  rotate(name, x = 0, y = 0, z = 0) {
    const joint = this.joint(name);
    const delta = new T.Quaternion().setFromEuler(new T.Euler(x, y, z, "YXZ"));
    // Conjugate body-space rotation into the bone's measured bind coordinates.
    const local = joint.bodyQuaternion
      .clone()
      .invert()
      .multiply(delta)
      .multiply(joint.bodyQuaternion);
    joint.bone.quaternion.multiply(local).normalize();
    joint.bone.updateMatrixWorld(true);
  }
  offset(name, vector) {
    const bone = this.joint(name).bone;
    const parentInverse = bone.parent.matrixWorld.clone().invert();
    const currentWorld = bone.getWorldPosition(new T.Vector3());
    currentWorld.add(this.bodyVector(vector));
    bone.position.copy(currentWorld.applyMatrix4(parentInverse));
    bone.updateMatrixWorld(true);
  }
  solveLimb(
    upperName,
    lowerName,
    endName,
    target,
    pole,
    upperLength,
    lowerLength,
  ) {
    const root = this.point(upperName);
    const toward = target.clone().sub(root);
    const distance = clamp(
      toward.length(),
      0.02,
      upperLength + lowerLength - 0.0005,
    );
    toward.normalize();
    const poleDirection = pole.clone().sub(root);
    poleDirection.addScaledVector(toward, -poleDirection.dot(toward));
    if (poleDirection.lengthSq() < 1e-7)
      poleDirection.copy(this.bodyVector(FORWARD));
    poleDirection.normalize();
    const along =
      (upperLength * upperLength -
        lowerLength * lowerLength +
        distance * distance) /
      (2 * distance);
    const height = Math.sqrt(
      Math.max(0, upperLength * upperLength - along * along),
    );
    const bend = root
      .clone()
      .addScaledVector(toward, along)
      .addScaledVector(poleDirection, height);
    const align = (name, from, to) => {
      if (from.lengthSq() < 1e-9 || to.lengthSq() < 1e-9) return;
      const delta = new T.Quaternion().setFromUnitVectors(
        from.normalize(),
        to.normalize(),
      );
      const current = this.joint(name).bone.getWorldQuaternion(
        new T.Quaternion(),
      );
      this.setWorldQuaternion(name, delta.multiply(current));
    };
    align(upperName, this.point(lowerName).sub(root), bend.clone().sub(root));
    const knee = this.point(lowerName);
    align(lowerName, this.point(endName).sub(knee), target.clone().sub(knee));
    return {
      root,
      bend,
      target: this.point(endName),
      requested: target.clone(),
    };
  }
}

// Distance advances the stride; time only controls easing and the tiny idle
// breath. Planted ankle anchors stay in world coordinates until toe-off.
export class FigureGait {
  constructor(rig) {
    this.rig = rig;
    this.stride = HUMAN_STRIDE_METERS;
    this.stance = 0.6;
    this.reset();
  }
  reset(options = {}) {
    this.distance = Number.isFinite(options.distance) ? options.distance : 0;
    this.time = Number.isFinite(options.time) ? options.time : null;
    this.weight = 0;
    this.speed = 0;
    this.direction = new T.Vector3(0, 0, -1);
    this.previousRoot = null;
    this.previousMatrix = null;
    this.previousYaw = Number.isFinite(options.yaw) ? options.yaw : null;
    this.previousDistance = this.distance;
    this.frozen = false;
    this.hipTurn = 0;
    this.feet = this.rig.sides.map(() => ({
      anchor: null,
      swingStart: null,
      swingEnd: null,
      quaternion: null,
      frame: null,
      wasStance: true,
      contact: false,
      target: null,
      phase: 0,
    }));
    this.diagnostics = {
      distance: this.distance,
      phase: 0,
      weight: 0,
      feet: [],
    };
  }
  update(time, speed = 0, frozen = false, options = {}) {
    const rig = this.rig;
    const dt = clamp(
      Number.isFinite(options.delta)
        ? options.delta
        : this.time === null
          ? 1 / 60
          : time - this.time,
      0,
      0.08,
    );
    const root = rig.body.getWorldPosition(new T.Vector3());
    const yaw = Number.isFinite(options.yaw)
      ? options.yaw
      : rig.body.rotation.y;
    const moved = this.previousRoot
      ? root.clone().sub(this.previousRoot)
      : new T.Vector3();
    moved.y = 0;
    const teleported =
      moved.length() > Math.max(0.4, Math.abs(speed) * dt * 3 + 0.1);
    let distance = Number.isFinite(options.distance)
      ? options.distance
      : this.distance + (frozen ? 0 : Math.abs(speed) * dt);
    if (!Number.isFinite(distance)) distance = this.distance;
    // A captured pose is allowed to move back through history by a fraction of
    // a stride. A portal/new game should call resetMotion explicitly.
    if (Math.abs(distance - this.distance) > 2.0 && !frozen)
      this.reset({ distance, time, yaw });
    const travelled = Math.max(0, distance - this.distance);
    if (!frozen) this.distance = distance;
    else if (!this.frozen && Number.isFinite(options.distance))
      this.distance = distance;
    const actualSpeed =
      Number.isFinite(options.distance) && dt > 0 && !frozen
        ? clamp(travelled / dt, 0, 3.6)
        : Math.abs(speed);
    const wanted = frozen ? this.weight : smooth((actualSpeed - 0.035) / 0.55);
    if (!frozen)
      this.weight +=
        (wanted - this.weight) *
        (1 - Math.exp(-dt * (wanted > this.weight ? 13 : 9)));
    this.speed +=
      ((frozen ? 0 : actualSpeed) - this.speed) * (1 - Math.exp(-dt * 12));
    const velocity = new T.Vector3(
      Number.isFinite(options.vx)
        ? options.vx
        : dt > 0 && !teleported
          ? moved.x / dt
          : 0,
      0,
      Number.isFinite(options.vz)
        ? options.vz
        : dt > 0 && !teleported
          ? moved.z / dt
          : 0,
    );
    if (!frozen && velocity.lengthSq() > 0.0025) {
      velocity.normalize();
      // Normalizing a small lerp between opposite unit vectors never turns it
      // around; backward travel would retain a forward stride indefinitely.
      if (this.direction.dot(velocity) < -0.35) this.direction.copy(velocity);
      else this.direction.lerp(velocity, 1 - Math.exp(-dt * 18)).normalize();
    } else if (!this.previousRoot) this.direction.copy(rig.bodyVector(FORWARD));
    const cycle = this.distance / this.stride + 0.27;
    const weight = this.weight;
    const phase = cycle * TAU;
    const worldBodyQ = rig.body.getWorldQuaternion(new T.Quaternion());
    const forward = rig.bodyVector(FORWARD);
    const right = rig.bodyVector(RIGHT);
    const forwardAmount = this.direction.dot(forward);
    const strafeAmount = this.direction.dot(right);
    const desiredHipTurn = -Math.atan2(
      strafeAmount,
      Math.max(0.001, Math.abs(forwardAmount)),
    );
    if (!frozen)
      this.hipTurn +=
        (desiredHipTurn - this.hipTurn) * (1 - Math.exp(-dt * 12));
    const hipTurn = this.hipTurn * weight;
    const walkingFrame = worldBodyQ
      .clone()
      .multiply(new T.Quaternion().setFromAxisAngle(UP, hipTurn));
    const kneesForward = FORWARD.clone().applyQuaternion(walkingFrame);
    const kneesRight = RIGHT.clone().applyQuaternion(walkingFrame);
    const backward = forwardAmount < -0.4 && Math.abs(strafeAmount) < 0.7;
    const breath = frozen ? 0 : Math.sin(time * 1.15) * 0.004;
    // Shift weight over the supporting hip and let the pelvis settle rather
    // than lifting the entire model into a repeating floating sine wave.
    rig.visual.position.y = weight * (-0.029 - 0.009 * Math.cos(phase * 2));
    rig.update();
    rig.offset("pelvis", new T.Vector3(Math.sin(phase) * 0.012 * weight, 0, 0));
    rig.rotate(
      "pelvis",
      0,
      hipTurn + Math.sin(phase) * 0.022 * weight,
      Math.sin(phase) * 0.018 * weight,
    );
    rig.rotate(
      "spine_01",
      -0.026 * weight * forwardAmount,
      -hipTurn * 0.35,
      -Math.sin(phase) * 0.011 * weight,
    );
    rig.rotate(
      "spine_03",
      breath,
      -hipTurn * 0.2 - Math.sin(phase) * 0.018 * weight,
      0,
    );
    rig.rotate("neck_01", 0, -hipTurn * 0.45, 0);

    // If a held reflection is moved to the glass, move its foot anchors with
    // that discontinuity, preserving the captured silhouette rather than
    // stretching its legs across the hallway.
    if (teleported && this.previousMatrix) {
      const remap = rig.body.matrixWorld
        .clone()
        .multiply(this.previousMatrix.clone().invert());
      const rotationDelta = new T.Quaternion().setFromRotationMatrix(remap);
      for (const foot of this.feet) {
        for (const point of [foot.anchor, foot.swingStart, foot.swingEnd])
          point?.applyMatrix4(remap);
        foot.quaternion?.premultiply(rotationDelta);
        foot.frame?.premultiply(rotationDelta);
      }
    }
    const footReports = [];
    const requests = [];
    for (let i = 0; i < 2; i++) {
      const side = rig.sides[i];
      const foot = this.feet[i];
      const p = fraction(cycle + i * 0.5);
      const inStance = p < this.stance;
      const walkingAnkle = side.ankle.clone();
      walkingAnkle.x = T.MathUtils.lerp(walkingAnkle.x, side.hip.x, weight);
      walkingAnkle.applyAxisAngle(UP, hipTurn);
      const nominal = rig.bodyPoint(walkingAnkle);
      const restFootQ = walkingFrame
        .clone()
        .multiply(rig.joint(`foot_${side.side}`).bodyQuaternion);
      if (!foot.anchor) {
        foot.anchor = nominal.clone();
        foot.swingStart = nominal.clone();
        foot.swingEnd = nominal.clone();
        foot.quaternion = restFootQ.clone();
        foot.frame = walkingFrame.clone();
        foot.wasStance = inStance;
      }
      // Idle turning pivots/replants the feet; it must not wind the knees
      // around old anchors while the first-person camera turns on the spot.
      if (weight < 0.1) {
        foot.anchor.copy(nominal);
        foot.swingStart.copy(nominal);
        foot.swingEnd.copy(nominal);
        foot.quaternion.copy(restFootQ);
        foot.frame.copy(walkingFrame);
      }
      let flat,
        lift = 0,
        pitch = 0;
      if (inStance) {
        if (!foot.wasStance) {
          foot.anchor.copy(foot.swingEnd);
          foot.quaternion.copy(restFootQ);
          foot.frame.copy(walkingFrame);
        }
        flat = foot.anchor.clone();
        const stancePhase = p / this.stance;
        if (stancePhase < 0.16) pitch = 0.15 * (1 - smooth(stancePhase / 0.16));
        else if (stancePhase > 0.76)
          pitch = -0.36 * smooth((stancePhase - 0.76) / 0.24);
        if (backward) pitch *= -0.65;
      } else {
        const swingPhase = (p - this.stance) / (1 - this.stance);
        if (foot.wasStance) foot.swingStart.copy(foot.anchor);
        // Predict the body's remaining travel to land ahead of the pelvis.
        const remaining = (1 - p) * this.stride;
        foot.swingEnd
          .copy(nominal)
          .addScaledVector(
            this.direction,
            remaining + this.stride * this.stance * 0.5,
          );
        const lateralGuard = clamp(Math.abs(strafeAmount) - 0.3, 0, 1);
        foot.swingEnd.addScaledVector(
          right,
          (i ? 1 : -1) * lateralGuard * 0.035,
        );
        flat = foot.swingStart.clone().lerp(foot.swingEnd, smooth(swingPhase));
        lift =
          Math.sin(Math.PI * swingPhase) ** 1.2 *
          (forwardAmount < -0.4 ? 0.055 : 0.075);
        pitch =
          swingPhase < 0.35
            ? T.MathUtils.lerp(-0.36, -0.1, smooth(swingPhase / 0.35))
            : swingPhase < 0.7
              ? T.MathUtils.lerp(-0.1, 0.03, smooth((swingPhase - 0.35) / 0.35))
              : T.MathUtils.lerp(0.03, 0.15, smooth((swingPhase - 0.7) / 0.3));
        if (backward) pitch *= -0.65;
        if (!frozen) {
          foot.quaternion.slerp(restFootQ, 1 - Math.exp(-dt * 15));
          foot.frame.slerp(walkingFrame, 1 - Math.exp(-dt * 15));
        }
      }
      const target = nominal.clone().lerp(flat, weight);
      target.y += lift * weight;
      const hinge = side.hinge.clone().applyQuaternion(foot.frame);
      const pivot = side.ankle
        .clone()
        .sub(pitch >= 0 ? side.heel : side.toe)
        .applyQuaternion(foot.frame);
      const ankleRoll = pivot.clone().applyAxisAngle(hinge, pitch).sub(pivot);
      target.addScaledVector(ankleRoll, weight);
      requests.push({ side, foot, p, inStance, target, hinge, pitch, i });
    }
    // This model's standing legs are almost straight. Let the pelvis descend
    // by the amount its measured leg lengths require, rather than shortening
    // the legs or letting a planted shoe hover above an unreachable target.
    let pelvisDrop = 0;
    for (const { side, target } of requests) {
      const hip = rig.point(`thigh_${side.side}`);
      const horizontal = Math.hypot(hip.x - target.x, hip.z - target.z);
      const reach = side.upperLeg + side.lowerLeg - 0.002;
      const vertical = Math.sqrt(
        Math.max(0, reach * reach - horizontal * horizontal),
      );
      pelvisDrop = Math.max(pelvisDrop, hip.y - target.y - vertical);
    }
    pelvisDrop = clamp(pelvisDrop, 0, 0.13);
    if (pelvisDrop > 0) rig.offset("pelvis", new T.Vector3(0, -pelvisDrop, 0));
    for (const {
      side,
      foot,
      p,
      inStance,
      target,
      hinge,
      pitch,
      i,
    } of requests) {
      const pole = rig
        .point(`thigh_${side.side}`)
        .addScaledVector(kneesForward, 0.65)
        .addScaledVector(kneesRight, (i ? 1 : -1) * 0.025);
      const solution = rig.solveLimb(
        `thigh_${side.side}`,
        `calf_${side.side}`,
        `foot_${side.side}`,
        target,
        pole,
        side.upperLeg,
        side.lowerLeg,
      );
      const footQ = new T.Quaternion()
        .setFromAxisAngle(hinge, pitch * weight)
        .multiply(foot.quaternion);
      rig.setWorldQuaternion(`foot_${side.side}`, footQ);
      rig.rotate(`ball_${side.side}`, -Math.min(0, pitch) * weight, 0, 0);
      const counter =
        -Math.cos(phase + i * Math.PI) * (forwardAmount < 0 ? -1 : 1);
      rig.rotate(
        `upperarm_${side.side}`,
        counter * 0.18 * weight * (0.55 + 0.45 * Math.abs(forwardAmount)),
        0,
        (i ? -1 : 1) * 0.012 - strafeAmount * 0.025 * weight,
      );
      rig.rotate(
        `lowerarm_${side.side}`,
        -Math.max(0, counter) * 0.11 * weight,
        0,
        0,
      );
      foot.wasStance = inStance;
      foot.contact =
        inStance && p / this.stance > 0.16 && p / this.stance < 0.76;
      foot.target = solution.target.clone();
      foot.phase = p;
      footReports.push({
        side: side.side,
        phase: p,
        stance: inStance,
        contact: foot.contact,
        target: solution.target.toArray(),
        anchor: foot.anchor.toArray(),
        error: solution.target.distanceTo(target),
        pitch,
      });
    }
    this.time = time;
    this.previousRoot = root;
    this.previousMatrix = rig.body.matrixWorld.clone();
    this.previousYaw = yaw;
    this.frozen = frozen;
    this.diagnostics = {
      distance: this.distance,
      phase: fraction(cycle),
      weight,
      pelvisDrop,
      hipTurn,
      forward: forwardAmount,
      strafe: strafeAmount,
      feet: footReports,
    };
    return this.diagnostics;
  }
}
