import * as T from "three";

// Immutable per-frame data, rather than skeleton/material references. The held
// copy must not change when the player later moves a hand or stows the torch.
const scratchA = new T.Quaternion(), scratchB = new T.Quaternion();
const scratchBlend = new T.Quaternion();
const STRIDE = 10;
const writeTransform = (object, target, offset = 0) => {
  object.position.toArray(target, offset);
  object.quaternion.toArray(target, offset + 3);
  object.scale.toArray(target, offset + 7);
};
const readTransform = (object, source, offset = 0) => {
  object.position.fromArray(source, offset);
  object.quaternion.fromArray(source, offset + 3);
  object.scale.fromArray(source, offset + 7);
};

export function createPoseCapture(figure, torch) {
  // Keep the authored face/neck controls independent. Everything below them,
  // including the clavicles and all grip/reaching fingers, is sampled exactly.
  const joints = [...figure.anatomy.joints].filter(([name]) => !/^(head|neck_)/.test(name));
  const names = Object.freeze(joints.map(([name]) => name));
  return ({ draw = 0, visibility = 0, time = 0, bodyOffset = [0, 0, 0] } = {}) => {
    const transforms = new Float32Array(joints.length * STRIDE);
    for (let index = 0; index < joints.length; index++)
      writeTransform(joints[index][1].bone, transforms, index * STRIDE);
    const visual = new Float32Array(STRIDE), flashlight = new Float32Array(STRIDE);
    writeTransform(figure.anatomy.visual, visual);
    writeTransform(torch.root, flashlight);
    return Object.freeze({
      names, transforms, visual, flashlight,
      bodyOffset: new Float32Array(bodyOffset),
      draw, visibility, time,
      emissive: torch.lens.emissiveIntensity,
    });
  };
}

function blendTransforms(a, b, t) {
  const result = new Float32Array(a.length);
  for (let offset = 0; offset < a.length; offset += STRIDE) {
    for (const component of [0, 1, 2, 7, 8, 9])
      result[offset + component] = T.MathUtils.lerp(a[offset + component], b[offset + component], t);
    scratchA.fromArray(a, offset + 3);
    scratchB.fromArray(b, offset + 3);
    scratchBlend.slerpQuaternions(scratchA, scratchB, t).normalize().toArray(result, offset + 3);
  }
  return result;
}

export function interpolateReflectionPose(a, b, t) {
  if (!a) return b || null;
  if (!b || t <= 0) return a;
  if (t >= 1) return b;
  return Object.freeze({
    names: a.names,
    transforms: blendTransforms(a.transforms, b.transforms, t),
    visual: blendTransforms(a.visual, b.visual, t),
    flashlight: blendTransforms(a.flashlight, b.flashlight, t),
    bodyOffset: new Float32Array(a.bodyOffset.map((value, index) => T.MathUtils.lerp(value, b.bodyOffset[index], t))),
    draw: T.MathUtils.lerp(a.draw, b.draw, t),
    visibility: T.MathUtils.lerp(a.visibility, b.visibility, t),
    emissive: T.MathUtils.lerp(a.emissive, b.emissive, t),
    time: T.MathUtils.lerp(a.time, b.time, t),
  });
}

export function applyReflectionPose(figure, torch, pose) {
  if (!pose) { torch.root.visible = false; return false; }
  readTransform(figure.anatomy.visual, pose.visual);
  for (let index = 0; index < pose.names.length; index++) {
    const joint = figure.anatomy.joints.get(pose.names[index]);
    if (joint) readTransform(joint.bone, pose.transforms, index * STRIDE);
  }
  readTransform(torch.root, pose.flashlight);
  torch.root.visible = pose.draw > .015;
  torch.lens.emissiveIntensity = pose.emissive;
  figure.anatomy.update();
  return true;
}
