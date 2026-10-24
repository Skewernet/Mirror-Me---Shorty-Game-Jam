import * as T from "three";
import { createEvelyn } from "./evelyn.mjs";
import { FuneralAttack } from "./funeral-attack.mjs";

// Only the attacking apparition is enlarged. The clean Evelyn in the casket
// keeps her natural 1.62 m size and never shares this root transform.
export const EVELYN_ATTACK_SCALE = 1.12;

// The attacking mother and the clean casket body share Evelyn's independent
// elderly asset. Wound meshes/materials are owned only by this instance.
export function createFuneralScare(parent, bounds, colliders) {
  const attack = new FuneralAttack(bounds, colliders);
  const figure = createEvelyn({ wounded: true });
  const { body, rig } = figure;
  body.scale.setScalar(EVELYN_ATTACK_SCALE);
  body.name = "Evelyn — the remembered attack";
  body.userData.funeralMother = true;
  body.visible = false;
  parent.add(body);
  body.traverse(object => {
    object.userData.wake = true;
    if (object.isMesh) object.castShadow = false;
  });
  const headHeight = rig.restPoint("head").y + .045;
  const head = rig.joint("head").bone;
  const eyes = body.getObjectByName("Evelyn_Eyes");
  body.updateMatrixWorld(true);
  eyes.skeleton.update();
  const eyeBounds = new T.Box3(), point = new T.Vector3();
  for (let index = 0; index < eyes.geometry.attributes.position.count; index++)
    eyeBounds.expandByPoint(eyes.localToWorld(eyes.getVertexPosition(index, point)));
  const eyeAnchor = head.worldToLocal(eyeBounds.getCenter(new T.Vector3()));
  let eyePosition = null;

  function update(time) {
    const state = attack.update(time);
    body.visible = Boolean(state.enabled && !state.done);
    if (!body.visible) return state;
    body.position.set(state.x, 0, state.z);
    body.rotation.y = state.figureYaw;
    rig.reset();
    const reach = T.MathUtils.smoothstep(state.lunge, .02, .78);
    rig.rotate("spine_01", -.09 - reach * .13, 0, .025);
    rig.rotate("spine_03", -.04 - reach * .14, 0, -.035);
    rig.rotate("neck_01", .04 + reach * .10, 0, -.02);
    rig.rotate("head", .03, 0, .045 * (1 - reach));
    for (const side of rig.sides) {
      const sign = side.side === "l" ? -1 : 1;
      const wrist = rig.bodyPoint(new T.Vector3(
        sign * (.15 + reach * .07),
        headHeight - .35 + reach * .24,
        -.10 - reach * .32,
      ));
      const pole = rig.bodyPoint(new T.Vector3(sign * .43, headHeight - .43 + reach * .07, -.2));
      rig.solveLimb(`upperarm_${side.side}`, `lowerarm_${side.side}`, `hand_${side.side}`, wrist, pole, side.upperArm * EVELYN_ATTACK_SCALE, side.lowerArm * EVELYN_ATTACK_SCALE);
      for (const finger of ["index", "middle", "ring", "pinky"])
        for (let segment = 1; segment <= 3; segment++)
          rig.rotate(`${finger}_0${segment}_${side.side}`, -.10 - reach * .09 * segment, 0, 0);
      const step = Math.sin(state.lunge * Math.PI) * .10;
      const ankle = rig.bodyPoint(side.ankle.clone().add(new T.Vector3(0, side.side === "l" ? step : 0, sign * step * 1.5)));
      const knee = rig.bodyPoint(new T.Vector3(sign * .10, .42, -.45));
      rig.solveLimb(`thigh_${side.side}`, `calf_${side.side}`, `foot_${side.side}`, ankle, knee, side.upperLeg * EVELYN_ATTACK_SCALE, side.lowerLeg * EVELYN_ATTACK_SCALE);
    }
    figure.setMouthOpen(.28 + reach * .67);
    rig.update();
    // A low root plus a forward bend used to put her eyes 22 cm below the
    // player and then pitch the camera down at her. This rising launch aligns
    // the measured eyes to the player's actual eye line after articulation.
    eyePosition = head.localToWorld(eyeAnchor.clone());
    body.position.y += state.eyeHeight - eyePosition.y;
    rig.update();
    eyePosition = head.localToWorld(eyeAnchor.clone());
    return state;
  }
  return {
    body,
    begin(time, player, options) {
      const began = attack.begin(time, player, options);
      update(time);
      return began;
    },
    update,
    camera: time => attack.update(time),
    reduce(time) { const changed = attack.reduce(time); update(time); return changed; },
    reset() { attack.reset(); body.visible = false; body.position.y = 0; eyePosition = null; figure.resetPose(); },
    snapshot: () => ({
      ...attack.snapshot(),
      visible: body.visible,
      woundedHuman: true,
      identity: figure.identity,
      characterAsset: body.userData.characterAsset,
      actorScale: EVELYN_ATTACK_SCALE,
      eyePosition: eyePosition?.toArray() || null,
      wounds: figure.wounds?.stats,
    }),
  };
}
