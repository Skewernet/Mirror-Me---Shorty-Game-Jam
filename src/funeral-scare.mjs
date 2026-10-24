import * as T from "three";
import { createFigure } from "./figure.mjs";
import { FigureRig } from "./figure-motion.mjs";
import { FuneralAttack } from "./funeral-attack.mjs";

// An owned human variant of the credited rig: elderly Evelyn, still visibly
// wounded from the bathroom/bedroom attack. It never borrows the demon facade.
export function createFuneralScare(parent, bounds, colliders) {
  const attack = new FuneralAttack(bounds, colliders);
  const figure = createFigure({}, 0);
  const body = figure.body;
  const visual = body.children[0];
  const rig = new FigureRig(body, visual);
  body.name = "Evelyn — the wound that will not stay covered";
  body.userData.funeralMother = true;
  body.visible = false;
  parent.add(body);
  figure.setEvidenceBlood(.90);
  let skin;
  body.traverse(object => {
    object.userData.wake = true;
    if (!object.isMesh) return;
    object.castShadow = false;
    if (/Skin/.test(object.name)) skin = object;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      material.userData.wake = true;
      material.envMapIntensity = .045;
      if (/Hair|Brows/.test(material.name)) material.color.set(0x777a72);
      if (/Skin/.test(material.name)) { material.color.set(0xb2b2a1); material.roughness = .77; }
      if (/Eyes/.test(material.name)) { material.color.set(0xc7cec3); material.roughness = .28; }
      if (/Clothes/.test(material.name)) { material.color.set(0xa9a99a); material.roughness = .92; }
      if (!/Skin|Clothes/.test(material.name)) continue;
      const previous = material.onBeforeCompile;
      const previousKey = material.customProgramCacheKey();
      const flesh = /Skin/.test(material.name);
      material.onBeforeCompile = function(shader, renderer) {
        previous.call(this, shader, renderer);
        // vMaraEvidenceRest is the shared rest-space position from the human
        // blood shader: the wounds follow the skin and clothing through IK.
        shader.fragmentShader = shader.fragmentShader.replace("#include <alphamap_fragment>", `
          vec3 ep=vMaraEvidenceRest;
          ${flesh ? "" : "float linenValue=.12+dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))*.55; diffuseColor.rgb=vec3(linenValue)*vec3(.84,.83,.71);"}
          float front=smoothstep(.015,.070,ep.z);
          float neckBlood=exp(-pow((ep.y-1.48)/.15,2.))*exp(-pow((ep.x+.026)/.13,2.))*front;
          float wound1=exp(-pow((ep.x+.075+(ep.y-1.39)*.19)/.012,2.)-pow((ep.y-1.39)/.044,2.))*front;
          float wound2=exp(-pow((ep.x-.075-(ep.y-1.25)*.34)/.015,2.)-pow((ep.y-1.25)/.049,2.))*front;
          float wound3=exp(-pow((ep.x+.03+(ep.y-1.14)*.45)/.013,2.)-pow((ep.y-1.14)/.052,2.))*front;
          float run=exp(-pow((ep.x+.065+sin(ep.y*31.)*.008)/.027,2.))*smoothstep(.88,1.00,ep.y)*(1.-smoothstep(1.38,1.43,ep.y))*front;
          float mouthRun=exp(-pow((ep.x+.018+sin(ep.y*71.)*.004)/.021,2.))*smoothstep(1.43,1.50,ep.y)*(1.-smoothstep(1.55,1.58,ep.y))*front;
          float bruise=exp(-pow((ep.x-.035)/.039,2.)-pow((ep.y-1.61)/.031,2.))*front;
          float cheekTrack=exp(-pow((ep.x-.047-sin(ep.y*57.)*.004)/.019,2.))*smoothstep(1.49,1.53,ep.y)*(1.-smoothstep(1.62,1.65,ep.y))*front;
          float chestSoak=exp(-pow((ep.x+.015)/.115,2.)-pow((ep.y-1.34)/.115,2.))*front*(.72+.28*sin(ep.y*157.+ep.x*211.));
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.085,.041,.048),bruise*.56);
          float smear=clamp(neckBlood*.72+(wound1+wound2+wound3)*1.8+run*.9+mouthRun*.95+cheekTrack*.94+chestSoak*.72,0.,1.);
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.105,.0025,.0018),smear);
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.009,.0004,.0002),clamp(wound1+wound2+wound3,0.,1.));
          float ageLines=(.5+.5*sin(ep.y*810.+sin(ep.x*77.)*2.))*exp(-pow((ep.y-1.60)/.055,2.))*front;
          diffuseColor.rgb*=1.-ageLines*.11;
          #include <alphamap_fragment>
        `);
        shader.fragmentShader = shader.fragmentShader.replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.24,smear*.75);");
      };
      material.customProgramCacheKey = () => previousKey + "|evelyn-wounds-v1";
    }
  });

  function update(time) {
    const state = attack.update(time);
    body.visible = Boolean(state.enabled && !state.done);
    if (!body.visible) return state;
    body.position.set(state.x, 0, state.z);
    body.rotation.y = state.figureYaw;
    rig.reset();
    const reach = T.MathUtils.smoothstep(state.lunge, .04, .82);
    rig.rotate("spine_01", -.08 - reach * .12, 0, .025);
    rig.rotate("spine_03", -.04 - reach * .12, 0, -.035);
    rig.rotate("neck_01", .04 + reach * .12, 0, -.02);
    rig.rotate("head", .035, 0, .045 * (1 - reach));
    // Arms move from wounded self-protection to a measured two-handed grab.
    for (const side of rig.sides) {
      const sign = side.side === "l" ? -1 : 1;
      const wrist = rig.bodyPoint(new T.Vector3(sign * (.16 + reach * .06), 1.18 + reach * .29, -.13 - reach * .41));
      const pole = rig.bodyPoint(new T.Vector3(sign * .47, 1.10 + reach * .07, -.2));
      rig.solveLimb(`upperarm_${side.side}`, `lowerarm_${side.side}`, `hand_${side.side}`, wrist, pole, side.upperArm, side.lowerArm);
      for (const finger of ["index", "middle", "ring", "pinky"])
        for (let segment = 1; segment <= 3; segment++)
          rig.rotate(`${finger}_0${segment}_${side.side}`, -.10 - reach * .09 * segment, 0, 0);
      const step = Math.sin(state.lunge * Math.PI) * .10;
      const ankle = rig.bodyPoint(side.ankle.clone().add(new T.Vector3(0, side.side === "l" ? step : 0, sign * step * 1.5)));
      const knee = rig.bodyPoint(new T.Vector3(sign * .11, .45, -.48));
      rig.solveLimb(`thigh_${side.side}`, `calf_${side.side}`, `foot_${side.side}`, ankle, knee, side.upperLeg, side.lowerLeg);
    }
    const jaw = skin?.morphTargetDictionary?.Mara_Jaw_Open;
    if (jaw !== undefined) skin.morphTargetInfluences[jaw] = .28 + reach * .62;
    rig.update();
    return state;
  }
  return {
    body,
    begin(time, player, options) { const began = attack.begin(time, player, options); update(time); return began; },
    update,
    camera: time => attack.update(time),
    reduce(time) { const changed = attack.reduce(time); update(time); return changed; },
    reset() {
      attack.reset();
      body.visible = false;
      rig.reset();
      const jaw = skin?.morphTargetDictionary?.Mara_Jaw_Open;
      if (jaw !== undefined) skin.morphTargetInfluences[jaw] = 0;
      figure.setEvidenceBlood(.90);
    },
    snapshot: () => ({ ...attack.snapshot(), visible: body.visible, woundedHuman: true }),
  };
}
