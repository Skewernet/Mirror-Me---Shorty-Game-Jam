import * as T from "three";
import { createEvelyn } from "./evelyn.mjs";
import { FuneralAttack } from "./funeral-attack.mjs";

// The attacking mother and the clean casket body share Evelyn's independent
// elderly asset. Wound meshes/materials are owned only by this instance.
export function createFuneralScare(parent, bounds, colliders) {
  const attack = new FuneralAttack(bounds, colliders);
  const figure = createEvelyn({ wounded: true });
  const { body, rig } = figure;
  body.name = "Evelyn — the remembered attack";
  body.userData.funeralMother = true;
  body.visible = false;
  parent.add(body);
  body.traverse(object => {
    object.userData.wake = true;
    if (object.isMesh) object.castShadow = false;
  });
  const headHeight = rig.restPoint("head").y + .045;

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
        -.12 - reach * .42,
      ));
      const pole = rig.bodyPoint(new T.Vector3(sign * .43, headHeight - .43 + reach * .07, -.2));
      rig.solveLimb(`upperarm_${side.side}`, `lowerarm_${side.side}`, `hand_${side.side}`, wrist, pole, side.upperArm, side.lowerArm);
      for (const finger of ["index", "middle", "ring", "pinky"])
        for (let segment = 1; segment <= 3; segment++)
          rig.rotate(`${finger}_0${segment}_${side.side}`, -.10 - reach * .09 * segment, 0, 0);
      const step = Math.sin(state.lunge * Math.PI) * .10;
      const ankle = rig.bodyPoint(side.ankle.clone().add(new T.Vector3(0, side.side === "l" ? step : 0, sign * step * 1.5)));
      const knee = rig.bodyPoint(new T.Vector3(sign * .10, .42, -.45));
      rig.solveLimb(`thigh_${side.side}`, `calf_${side.side}`, `foot_${side.side}`, ankle, knee, side.upperLeg, side.lowerLeg);
    }
    figure.setMouthOpen(.28 + reach * .67);
    rig.update();
    return state;
  }
  return {
    body,
    begin(time, player, options) {
      const began = attack.begin(time, player, { ...options, focusHeight: headHeight });
      update(time);
      return began;
    },
    update,
    camera: time => attack.update(time),
    reduce(time) { const changed = attack.reduce(time); update(time); return changed; },
    reset() { attack.reset(); body.visible = false; figure.resetPose(); },
    snapshot: () => ({
      ...attack.snapshot(),
      visible: body.visible,
      woundedHuman: true,
      identity: figure.identity,
      characterAsset: body.userData.characterAsset,
      wounds: figure.wounds?.stats,
    }),
  };
}
