import * as T from "three";
import { mergeGeometries } from "../vendor/BufferGeometryUtils.js";
import { createFigure } from "./figure.mjs";

export const FIRST_PERSON_LAYER = 2;
export const FLASHLIGHT_DRAW_SECONDS = .36;
export const INTERACTION_SECONDS = .58;
const FORWARD = new T.Vector3(0, 0, -1);
const smooth = value => T.MathUtils.smoothstep(value, 0, 1);

function flashlightModel() {
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
    object.layers.set(FIRST_PERSON_LAYER);
    if (object.isMesh) {
      object.castShadow = object.receiveShadow = false;
      object.userData.firstPerson = true;
    }
  });
  return { root, beam, lens };
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
  const torch = flashlightModel();
  const hand = rig.joint("hand_r").bone;
  const restWrist = rig.restPoint("hand_r");
  const gripAnchor = hand.worldToLocal(body.localToWorld(restWrist.add(new T.Vector3(-.010, -.090, -.006))));
  hand.add(torch.root);
  torch.root.position.copy(gripAnchor);
  torch.root.visible = false;
  const rightSide = rig.sides.find(side => side.side === "r");
  const leftSide = rig.sides.find(side => side.side === "l");
  const currentHand = new T.Vector3(), currentLeft = new T.Vector3();
  const targetHand = new T.Vector3(), pole = new T.Vector3(), offset = new T.Vector3();
  const handQuaternion = new T.Quaternion(), parentQuaternion = new T.Quaternion();
  const gripRotation = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), .08);
  const beamPosition = new T.Vector3(), beamDirection = new T.Vector3();
  let draw = 0, time = 0, interactionAge = INTERACTION_SECONDS;
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
    const targetDraw = options.flashlightOn ? 1 : 0;
    draw = targetDraw > draw
      ? Math.min(targetDraw, draw + delta / FLASHLIGHT_DRAW_SECONDS)
      : Math.max(targetDraw, draw - delta / FLASHLIGHT_DRAW_SECONDS);
    const raised = smooth(draw);
    // The eye is just forward of the shoulder line, as on the source anatomy.
    // Keeping the torso under the eye puts the camera inside the shirt collar
    // when looking down; a small rear offset keeps its complete neckline intact.
    const lean = .14 + T.MathUtils.smoothstep(-(player.pitch || 0), .45, 1.25) * .10;
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
      ? Math.min(.35, Math.max(-.22, options.clearance - .27)) : .35;
    currentHand.copy(rig.point("hand_r"));
    // The barrel remains below the centre of the view; pitch follows the eye,
    // while a near wall lowers and pulls the physical arm back into the body.
    worldFromCamera(.20 + blocked * .035, -.14 - blocked * .15 + sway, -handDepth, targetHand);
    currentHand.lerp(targetHand, raised);
    worldFromCamera(.44, -.36, -.04, pole);
    rig.solveLimb("upperarm_r", "lowerarm_r", "hand_r", currentHand, pole, rightSide.upperArm, rightSide.lowerArm);
    handQuaternion.copy(camera.quaternion).multiply(gripRotation).multiply(rig.joint("hand_r").bodyQuaternion);
    const naturalHand = rig.joint("hand_r").bone.getWorldQuaternion(parentQuaternion);
    naturalHand.slerp(handQuaternion, raised);
    rig.setWorldQuaternion("hand_r", naturalHand);
    for (const finger of ["index", "middle", "ring", "pinky"])
      for (let segment = 1; segment <= 3; segment++)
        rig.rotate(`${finger}_0${segment}_r`, 0, 0, -raised * (segment === 1 ? 1.13 : segment === 2 ? 1.28 : .88));
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
      const maxReach = side.upperArm + side.lowerArm - .022;
      if (offset.length() > maxReach) offset.setLength(maxReach);
      targetHand.copy(shoulder).add(offset);
      // Keep reaching fingers in front of the chest, out of the camera plane.
      currentLeft.lerp(targetHand, reach);
      worldFromCamera(side.side === "l" ? -.43 : .43, -.32, -.17, pole);
      rig.solveLimb(`upperarm_${side.side}`, `lowerarm_${side.side}`, `hand_${side.side}`, currentLeft, pole, side.upperArm, side.lowerArm);
      const rest = rig.bodyQuaternion(rig.joint(`hand_${side.side}`).bodyQuaternion);
      rig.setWorldQuaternion(`hand_${side.side}`, rest);
      for (const finger of ["index", "middle", "ring", "pinky"])
        for (let segment = 1; segment <= 3; segment++)
          rig.rotate(`${finger}_0${segment}_${side.side}`, 0, 0, (side.side === "l" ? 1 : -1) * .24 * reach);
    }
    rig.update();
    torch.root.visible = draw > .015;
    // Palm translation is truly bone-attached; counter-rotate the barrel from
    // its hand parent so its beam follows the eye without rolling with gait.
    hand.getWorldQuaternion(parentQuaternion).invert();
    torch.root.quaternion.copy(parentQuaternion.multiply(camera.quaternion));
    torch.root.updateMatrixWorld(true);
    torch.lens.emissiveIntensity = targetDraw ? .5 * smooth((draw - .35) / .35) : 0;
    torch.beam.getWorldPosition(beamPosition);
    beamDirection.copy(FORWARD).applyQuaternion(camera.quaternion).normalize();
    beamState.visibility = targetDraw ? smooth((draw - .28) / .42) : 0;
  }

  return {
    body, rig, figure, flashlight: torch.root,
    update,
    prepare(player) { draw = 1; update(0, player, { flashlightOn: true }); },
    interact(point, kind = "use") {
      const source = point?.isVector3 ? point : point?.position || point;
      if (!source || ![source.x, source.y, source.z].every(Number.isFinite)) return false;
      interactionTarget = new T.Vector3(source.x, source.y, source.z);
      interactionSide = draw > .15 ? "l" : "r";
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
