import * as T from "three";
import { mergeGeometries } from "../vendor/BufferGeometryUtils.js";
import { createFigure } from "./figure.mjs";
import { createPoseCapture } from "./reflection-pose.mjs";

export const FIRST_PERSON_LAYER = 2;
export const FLASHLIGHT_DRAW_SECONDS = .36;
export const INTERACTION_SECONDS = .58;
const FORWARD = new T.Vector3(0, 0, -1);
const GRIP_ROLL = -2.40;
const FINGERS = ["index", "middle", "ring", "pinky"];
const smooth = value => T.MathUtils.smoothstep(value, 0, 1);

export function createFlashlightModel(layer = FIRST_PERSON_LAYER) {
  const root = new T.Group();
  root.name = "Mara's handheld flashlight";
  const metal = new T.MeshStandardMaterial({ color: 0x343c35, roughness: .34, metalness: .78 });
  const grip = new T.MeshStandardMaterial({ color: 0x151a17, roughness: .87, metalness: .08 });
  const edge = new T.MeshStandardMaterial({ color: 0x6c7267, roughness: .31, metalness: .9 });
  const reflector = new T.MeshStandardMaterial({ color: 0xaab4ab, roughness: .18, metalness: .95 });
  const lens = new T.MeshStandardMaterial({ color: 0x9ba79c, roughness: .16, metalness: .3, emissive: 0xe9e0b7, emissiveIntensity: 0 });
  const cylinder = (radius, length, z, material) => {
    const geometry = new T.CylinderGeometry(radius, radius, length, 24);
    geometry.rotateX(Math.PI / 2);
    geometry.translate(0, 0, z);
    const mesh = new T.Mesh(geometry, material);
    root.add(mesh);
    return mesh;
  };
  cylinder(.021, .15, .006, grip);
  const rings = [];
  for (let index = 0; index < 10; index++) {
    const ring = new T.TorusGeometry(.021, .0012, 4, 24);
    ring.translate(0, 0, -.053 + index * .012);
    rings.push(ring);
  }
  root.add(new T.Mesh(mergeGeometries(rings), metal));
  for (const geometry of rings) geometry.dispose();
  cylinder(.0235, .014, .087, edge);
  cylinder(.022, .018, -.076, edge);
  const headPoints = [
    [.021, .086], [.023, .095], [.027, .11], [.036, .13],
    [.039, .137], [.039, .177], [.0365, .184], [.032, .184],
  ].map(([radius, distance]) => new T.Vector2(radius, distance));
  const housing = new T.LatheGeometry(headPoints, 24);
  housing.rotateX(-Math.PI / 2);
  root.add(new T.Mesh(housing, metal));
  cylinder(.0335, .003, -.182, reflector);
  const glass = new T.Mesh(new T.CircleGeometry(.0305, 24), lens);
  glass.rotation.y = Math.PI;
  glass.position.z = -.185;
  root.add(glass);
  const button = new T.Mesh(new T.BoxGeometry(.014, .006, .027), grip);
  button.position.set(0, .023, -.014);
  root.add(button);
  const clip = new T.Mesh(new T.BoxGeometry(.006, .009, .11), edge);
  clip.position.set(.023, 0, .008);
  root.add(clip);
  const beam = new T.Object3D();
  beam.name = "Flashlight lens / beam origin";
  beam.position.z = -.19;
  root.add(beam);
  root.traverse(object => {
    object.layers.set(layer);
    if (object.isMesh) {
      object.castShadow = object.receiveShadow = false;
      object.userData.firstPerson = layer === FIRST_PERSON_LAYER;
    }
  });
  return { root, beam, lens };
}

export function attachFlashlight(figure, layer = FIRST_PERSON_LAYER) {
  const { body, anatomy: rig } = figure;
  const torch = createFlashlightModel(layer);
  const hand = rig.joint("hand_r").bone;
  const restWrist = rig.restPoint("hand_r");
  // Locate the barrel across the curled palm, rather than through the finger
  // roots. The calibrated middle knuckle rests one finger radius off its axis.
  const palm = rig.restPoint("middle_01_r").sub(restWrist);
  const radial = new T.Vector3(-.029, 0, 0).applyAxisAngle(new T.Vector3(0, 0, 1), -GRIP_ROLL);
  const centre = palm.sub(radial); centre.z = -.006;
  const gripAnchor = hand.worldToLocal(body.localToWorld(restWrist.add(centre)));
  hand.add(torch.root);
  torch.root.position.copy(gripAnchor);
  torch.root.visible = false;
  return { ...torch, hand };
}

// Solve the real phalanges around a 21 mm barrel. Bone rolls are measured
// from the imported rig; each joint follows a chord outside the tube instead
// of closing through it. Scratch storage and bind measurements are leased once.
function createBarrelGrip(rig, torch) {
  const records = FINGERS.map((name, index) => {
    const names = [1, 2, 3].map(n => `${name}_0${n}_r`);
    const points = names.map(n => rig.restPoint(n));
    return { bones: names.map(n => rig.joint(n).bone), full: names.map(() => new T.Quaternion()),
      first: points[0].distanceTo(points[1]), second: points[1].distanceTo(points[2]),
      radius: [.029, .0295, .0285, .026][index],
      tip: points[2].clone().sub(points[1]).normalize()
        .applyQuaternion(rig.joint(names[2]).bodyQuaternion.clone().invert()) };
  });
  const centre = new T.Vector3(), root = new T.Vector3(), pip = new T.Vector3(), dip = new T.Vector3();
  const a = new T.Vector3(), b = new T.Vector3(), position = new T.Vector3();
  const inverse = new T.Quaternion(), current = new T.Quaternion(), wanted = new T.Quaternion(), parent = new T.Quaternion();
  const setDirection = (bone, from, to, weight) => {
    if (from.lengthSq() < 1e-10 || to.lengthSq() < 1e-10) return;
    bone.getWorldQuaternion(current);
    wanted.setFromUnitVectors(from.normalize(), to.normalize()).multiply(current);
    current.slerp(wanted, weight);
    bone.parent.getWorldQuaternion(parent).invert();
    bone.quaternion.copy(parent.multiply(current)).normalize();
    bone.updateMatrixWorld(true);
  };
  const aim = (bone, child, target, weight) => {
    bone.getWorldPosition(position); child.getWorldPosition(a).sub(position);
    b.copy(target).sub(position); setDirection(bone, a, b, weight);
  };
  let compiled = false;
  return (cameraQuaternion, weight) => {
    if (weight <= 0) return;
    // The fully held grip has a fixed relationship to the hand and barrel.
    // Cache its local joint rotations during warmup; ordinary frames only
    // blend those rotations and update the hand subtree once.
    if (compiled) {
      for (const record of records) for (let index = 0; index < 3; index++)
        record.bones[index].quaternion.slerp(record.full[index], weight);
      torch.hand.updateMatrixWorld(true);
      return;
    }
    torch.root.getWorldPosition(centre); inverse.copy(cameraQuaternion).invert();
    for (const record of records) {
      const [first, second, third] = record.bones;
      first.getWorldPosition(root).sub(centre).applyQuaternion(inverse);
      const radius = record.radius, distance = Math.max(.001, Math.hypot(root.x, root.y));
      const theta = Math.atan2(root.y, root.x) - Math.acos(T.MathUtils.clamp(
        (distance * distance + radius * radius - record.first * record.first) / (2 * distance * radius), -1, 1));
      const next = theta - 2 * Math.asin(Math.min(.98, record.second / (2 * radius)));
      pip.set(Math.cos(theta) * radius, Math.sin(theta) * radius, root.z).applyQuaternion(cameraQuaternion).add(centre);
      dip.set(Math.cos(next) * radius, Math.sin(next) * radius, root.z).applyQuaternion(cameraQuaternion).add(centre);
      aim(first, second, pip, weight); aim(second, third, dip, weight);
      third.getWorldQuaternion(current);
      a.copy(record.tip).applyQuaternion(current);
      // The last phalanx continues over the front of the barrel; its pad
      // approaches the thumb rather than pointing rigidly out into space.
      const end = next - .40;
      b.set(Math.sin(end), -Math.cos(end), 0).applyQuaternion(cameraQuaternion);
      setDirection(third, a, b, weight);
      if (weight >= 1) for (let index = 0; index < 3; index++)
        record.full[index].copy(record.bones[index].quaternion);
    }
    compiled = weight >= 1;
  };
}

// Keep the existing model's torso, legs and articulated hands. Only this
// instance receives a head/neck cut; the mirror and NPCs retain intact geometry.
function firstPersonGeometry(mesh, body, neckHeight) {
  const geometry = mesh.geometry.clone();
  const index = geometry.index;
  const keep = [];
  const point = new T.Vector3();
  const height = new Float32Array(geometry.attributes.position.count);
  mesh.skeleton.update();
  for (let vertex = 0; vertex < height.length; vertex++) {
    mesh.getVertexPosition(vertex, point);
    mesh.localToWorld(point);
    body.worldToLocal(point);
    height[vertex] = point.y;
  }
  const ceiling = neckHeight - (/Skin/.test(mesh.name) ? .035 : .015);
  for (let triangle = 0; triangle < index.count; triangle += 3) {
    const a = index.getX(triangle), b = index.getX(triangle + 1), c = index.getX(triangle + 2);
    if (height[a] > ceiling || height[b] > ceiling || height[c] > ceiling) continue;
    keep.push(a, b, c);
  }
  geometry.setIndex(keep);
  geometry.computeBoundingSphere();
  return geometry;
}

export function createFirstPerson(scene, camera) {
  const figure = createFigure(null, FIRST_PERSON_LAYER);
  const { body, anatomy: rig } = figure;
  body.name = "Mara — first-person body";
  body.userData.firstPerson = true;
  scene.add(body);
  const neckHeight = rig.restPoint("neck_01").y;
  let triangles = 0;
  body.traverse(mesh => {
    if (!mesh.isMesh) return;
    mesh.castShadow = mesh.receiveShadow = false;
    mesh.userData.firstPerson = true;
    if (!/Mara_(Skin|Clothes|Shoes)$/.test(mesh.name)) {
      mesh.visible = false;
      return;
    }
    if (/Skin$/.test(mesh.name)) mesh.geometry = firstPersonGeometry(mesh, body, neckHeight);
    // A tiny albedo-weighted adaptation fill belongs only to these materials;
    // no camera-only light brightens the house or changes mirror illumination.
    mesh.material.emissive.set(0xffffff);
    mesh.material.emissiveMap = mesh.material.map;
    mesh.material.emissiveIntensity = /Skin$/.test(mesh.name) ? .025 : .012;
    mesh.material.needsUpdate = true;
    triangles += mesh.geometry.index.count / 3;
  });
  const torch = attachFlashlight(figure);
  const hand = torch.hand;
  const capture = createPoseCapture(figure, torch);
  const poseGrip = createBarrelGrip(rig, torch);
  const rightSide = rig.sides.find(side => side.side === "r");
  const leftSide = rig.sides.find(side => side.side === "l");
  const currentHand = new T.Vector3(), currentLeft = new T.Vector3();
  const targetHand = new T.Vector3(), pole = new T.Vector3(), offset = new T.Vector3();
  const handQuaternion = new T.Quaternion(), parentQuaternion = new T.Quaternion();
  const gripRotation = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), GRIP_ROLL);
  const beamPosition = new T.Vector3(), beamDirection = new T.Vector3();
  const reachAxis = Object.fromEntries(["l", "r"].map(side => [side,
    rig.restPoint(`middle_01_${side}`).sub(rig.restPoint(`hand_${side}`)).normalize()]));
  const reachForward = new T.Vector3(), reachRest = new T.Vector3();
  const reachRotation = new T.Quaternion(), reachCurrent = new T.Quaternion(), bodyQuaternion = new T.Quaternion();
  let draw = 0, time = 0, interactionAge = INTERACTION_SECONDS, bodyLean = .14;
  let interactionTarget = null, interactionSide = "l", evidence = -1;
  const beamState = { position: beamPosition, direction: beamDirection, visibility: 0 };

  function worldFromCamera(x, y, z, result) {
    return result.set(x, y, z).applyQuaternion(camera.quaternion).add(camera.position);
  }

  function update(dt, player, options = {}) {
    const delta = Number.isFinite(dt) ? T.MathUtils.clamp(dt, 0, .05) : 0;
    body.visible = options.active !== false;
    if (!body.visible) { beamState.visibility = 0; return; }
    time = Number.isFinite(options.time) ? options.time : time + delta;
    // Finish a free right-hand reach before drawing into that same hand.
    const rightHandBusy = interactionSide === "r" && interactionAge < INTERACTION_SECONDS;
    const targetDraw = options.flashlightOn && !rightHandBusy ? 1 : 0;
    draw = targetDraw > draw
      ? Math.min(targetDraw, draw + delta / FLASHLIGHT_DRAW_SECONDS)
      : Math.max(targetDraw, draw - delta / FLASHLIGHT_DRAW_SECONDS);
    const raised = smooth(draw);
    // The eye is just forward of the shoulder line, as on the source anatomy.
    // Keeping the torso under the eye puts the camera inside the shirt collar
    // when looking down; a small rear offset keeps its complete neckline intact.
    const lean = .14 + T.MathUtils.smoothstep(-(player.pitch || 0), .45, 1.25) * .10;
    bodyLean = lean;
    body.position.set(player.x + Math.sin(player.yaw) * lean, 0, player.z + Math.cos(player.yaw) * lean);
    body.rotation.y = player.yaw;
    figure.animate(time, player.speed || 0, false, {
      distance: player.distance || 0, delta, yaw: player.yaw,
      vx: player.vx || 0, vz: player.vz || 0,
    });
    const blood = options.inverted ? 1 : 0;
    if (blood !== evidence) { figure.setEvidenceBlood(blood); evidence = blood; }
    const sway = Math.sin((player.distance || 0) * Math.PI * 2 / 1.24) * .007 * Math.min(1, player.speed || 0);
    const blocked = Number.isFinite(options.clearance)
      ? 1 - T.MathUtils.smoothstep(options.clearance, .22, .75) : 0;
    // The lens is 19 cm ahead of the wrist. Retraction must account for the
    // complete barrel, not just the hand, or it crosses a wall before the
    // player's capsule stops. A lowered wrist can pass behind the eye plane
    // safely below the view; the visible lens stays on our side of the wall.
    const handDepth = Number.isFinite(options.clearance)
      ? Math.min(.24, Math.max(-.22, options.clearance - .27)) : .24;
    currentHand.copy(rig.point("hand_r"));
    // The barrel remains below the centre of the view; pitch follows the eye,
    // while a near wall lowers and pulls the physical arm back into the body.
    worldFromCamera(.23 + blocked * .025, -.25 - blocked * .12 + sway, -handDepth, targetHand);
    currentHand.lerp(targetHand, raised);
    worldFromCamera(.44, -.52, .04, pole);
    rig.solveLimb("upperarm_r", "lowerarm_r", "hand_r", currentHand, pole, rightSide.upperArm, rightSide.lowerArm);
    handQuaternion.copy(camera.quaternion).multiply(gripRotation).multiply(rig.joint("hand_r").bodyQuaternion);
    const naturalHand = rig.joint("hand_r").bone.getWorldQuaternion(parentQuaternion);
    naturalHand.slerp(handQuaternion, raised);
    rig.setWorldQuaternion("hand_r", naturalHand);
    rig.rotate("thumb_01_r", -.10 * raised, -.38 * raised, .27 * raised);
    rig.rotate("thumb_02_r", 0, 0, .48 * raised);
    rig.rotate("thumb_03_r", 0, 0, .25 * raised);
    if (interactionTarget && interactionAge < INTERACTION_SECONDS) {
      interactionAge = Math.min(INTERACTION_SECONDS, interactionAge + delta);
      const phase = interactionAge / INTERACTION_SECONDS;
      const reach = phase < .38 ? smooth(phase / .38) : 1 - smooth((phase - .38) / .62);
      const side = interactionSide === "l" ? leftSide : rightSide;
      currentLeft.copy(rig.point(`hand_${side.side}`));
      const shoulder = rig.point(`upperarm_${side.side}`);
      offset.copy(interactionTarget).sub(shoulder);
      const maxReach = side.upperArm + side.lowerArm - .060;
      if (offset.length() > maxReach) offset.setLength(maxReach);
      targetHand.copy(shoulder).add(offset);
      // Keep reaching fingers in front of the chest, out of the camera plane.
      currentLeft.lerp(targetHand, reach);
      worldFromCamera(side.side === "l" ? -.43 : .43, -.32, -.17, pole);
      rig.solveLimb(`upperarm_${side.side}`, `lowerarm_${side.side}`, `hand_${side.side}`, currentLeft, pole, side.upperArm, side.lowerArm);
      body.getWorldQuaternion(bodyQuaternion);
      rig.joint(`hand_${side.side}`).bone.getWorldPosition(reachForward);
      rig.joint(`lowerarm_${side.side}`).bone.getWorldPosition(reachRest);
      reachForward.sub(reachRest).normalize();
      reachRest.copy(reachAxis[side.side]).applyQuaternion(bodyQuaternion);
      reachRotation.setFromUnitVectors(reachRest, reachForward)
        .multiply(bodyQuaternion).multiply(rig.joint(`hand_${side.side}`).bodyQuaternion);
      rig.joint(`hand_${side.side}`).bone.getWorldQuaternion(reachCurrent).slerp(reachRotation, reach);
      rig.setWorldQuaternion(`hand_${side.side}`, reachCurrent);
      for (const finger of FINGERS)
        for (let segment = 1; segment <= 3; segment++)
          rig.rotate(`${finger}_0${segment}_${side.side}`, 0, 0, (side.side === "l" ? 1 : -1) * .09 * reach);
    }
    rig.update();
    torch.root.visible = draw > .015;
    // Palm translation is truly bone-attached; counter-rotate the barrel from
    // its hand parent so its beam follows the eye without rolling with gait.
    hand.getWorldQuaternion(parentQuaternion).invert();
    torch.root.quaternion.copy(parentQuaternion.multiply(camera.quaternion));
    torch.root.updateMatrixWorld(true);
    poseGrip(camera.quaternion, raised);
    torch.lens.emissiveIntensity = targetDraw ? .5 * smooth((draw - .35) / .35) : 0;
    torch.beam.getWorldPosition(beamPosition);
    beamDirection.copy(FORWARD).applyQuaternion(camera.quaternion).normalize();
    beamState.visibility = targetDraw ? smooth((draw - .28) / .42) : 0;
  }

  return {
    body, rig, figure, flashlight: torch.root,
    capturePose: () => capture({ draw, visibility: beamState.visibility, time, bodyOffset: [0, 0, bodyLean] }),
    update,
    prepare(player) { draw = 1; update(0, player, { flashlightOn: true }); },
    interact(point, kind = "use") {
      const source = point?.isVector3 ? point : point?.position || point;
      if (!source || ![source.x, source.y, source.z].every(Number.isFinite)) return false;
      if (interactionAge < INTERACTION_SECONDS * .8) return false;
      interactionTarget = new T.Vector3(source.x, source.y, source.z);
      interactionSide = draw > .015 ? "l" : "r";
      interactionAge = 0;
      body.userData.interactionKind = kind;
      return true;
    },
    getBeam(position, direction) {
      if (position) position.copy(beamPosition);
      if (direction) direction.copy(beamDirection);
      return beamState;
    },
    reset() {
      draw = 0; time = 0; interactionAge = INTERACTION_SECONDS;
      interactionTarget = null; evidence = -1;
      delete body.userData.interactionKind;
      torch.root.visible = false; torch.lens.emissiveIntensity = 0;
      beamState.visibility = 0;
      figure.resetPose(); figure.resetMotion();
    },
    snapshot: () => ({
      visible: body.visible, layer: FIRST_PERSON_LAYER, identity: figure.identity,
      characterAsset: body.userData.characterAsset, triangles,
      draw, flashlightVisible: torch.root.visible, beamVisibility: beamState.visibility,
      beamPosition: beamPosition.toArray(), beamDirection: beamDirection.toArray(),
      handPosition: rig.point("hand_r").toArray(),
      interaction: interactionAge < INTERACTION_SECONDS ? { side: interactionSide, progress: interactionAge / INTERACTION_SECONDS } : null,
      evidenceBlood: body.userData.evidenceBlood,
    }),
  };
}
