import * as T from "three";
import { mergeGeometries } from "../vendor/BufferGeometryUtils.js";

// Original measured domestic rotary telephone. Geometry and dial artwork are
// built once; lifting the receiver only moves its group and the cached cord.
export function createRotaryPhone(parent) {
  const root = new T.Group();
  root.name = "Bakelite rotary telephone";
  parent.add(root);
  const receiver = new T.Group();
  receiver.name = "Rotary telephone handset";
  root.add(receiver);
  const bakelite = new T.MeshStandardMaterial({ color: 0x111410, roughness: .44, metalness: .02 });
  const rubber = new T.MeshStandardMaterial({ color: 0x080b09, roughness: .83, metalness: 0 });
  const metal = new T.MeshStandardMaterial({ color: 0x645f4c, roughness: .37, metalness: .76 });
  const ivory = new T.MeshStandardMaterial({ color: 0xbab39a, roughness: .53, metalness: .03 });
  const parts = new Map();
  const add = (geometry, material, owner = root) => {
    let byMaterial = parts.get(owner);
    if (!byMaterial) parts.set(owner, byMaterial = new Map());
    let list = byMaterial.get(material);
    if (!list) byMaterial.set(material, list = []);
    list.push(geometry.index ? geometry.toNonIndexed() : geometry);
    if (geometry.index) geometry.dispose();
  };
  const cylinder = (top, bottom, height, x, y, z, material, owner = root, segments = 32) => {
    const geometry = new T.CylinderGeometry(top, bottom, height, segments);
    geometry.translate(x, y, z);
    add(geometry, material, owner);
  };
  const ring = (radius, tube, x, y, z, material, owner = root) => {
    const geometry = new T.TorusGeometry(radius, tube, 6, 48);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(x, y, z);
    add(geometry, material, owner);
  };
  function roundedCase() {
    const rings = [
      [.332, .250, .029, -.057, 0],
      [.349, .265, .038, -.050, 0],
      [.350, .267, .046, -.028, .05],
      [.343, .262, .050, .023, .19],
      [.323, .244, .048, .033, .19],
      [.292, .216, .046, .037, .19],
    ];
    const positions = [], indices = [], segments = 12, count = segments * 4;
    for (const [width, depth, radius, height, slope] of rings) {
      for (let corner = 0; corner < 4; corner++) {
        const angle = corner * Math.PI / 2;
        const sx = corner === 0 || corner === 3 ? 1 : -1;
        const sz = corner < 2 ? 1 : -1;
        for (let step = 0; step < segments; step++) {
          const a = angle + step / segments * Math.PI / 2;
          const x = sx * (width / 2 - radius) + Math.cos(a) * radius;
          const z = sz * (depth / 2 - radius) + Math.sin(a) * radius;
          positions.push(x, height + slope * z, z);
        }
      }
    }
    for (let level = 0; level < rings.length - 1; level++) {
      for (let i = 0; i < count; i++) {
        const n = (i + 1) % count, a = level * count + i, b = level * count + n;
        const c = a + count, d = b + count;
        indices.push(a, c, b, b, c, d);
      }
    }
    const top = positions.length / 3;
    positions.push(0, .037, 0);
    for (let i = 0; i < count; i++) indices.push(top, (rings.length - 1) * count + (i + 1) % count, (rings.length - 1) * count + i);
    const geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new T.Float32BufferAttribute(new Float32Array(positions.length / 3 * 2), 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    add(geometry, bakelite);
  }
  roundedCase();
  // Low contrasting seam and rubber feet anchor the case to the tabletop.
  for (const x of [-.125, .125]) for (const z of [-.085, .085])
    cylinder(.016, .016, .006, x, -.059, z, rubber, root, 16);

  const dial = new T.Group();
  dial.name = "Recessed rotary dial";
  dial.position.set(0, .034, -.037);
  dial.rotation.x = -Math.atan(.19);
  root.add(dial);
  cylinder(.086, .088, .006, 0, .003, 0, rubber, dial);
  cylinder(.082, .083, .003, 0, .007, 0, ivory, dial);
  ring(.082, .0018, 0, .0095, 0, metal, dial);
  const holes = new T.Shape();
  holes.absarc(0, 0, .068, 0, Math.PI * 2, false);
  const centerHole = new T.Path();
  centerHole.absarc(0, 0, .031, 0, Math.PI * 2, true);
  holes.holes.push(centerHole);
  const numberPositions = [];
  for (let i = 0; i < 10; i++) {
    const angle = -.22 + i * Math.PI * 1.72 / 10;
    const x = Math.cos(angle) * .052, z = Math.sin(angle) * .052;
    const hole = new T.Path();
    hole.absarc(x, -z, .0086, 0, Math.PI * 2, true);
    holes.holes.push(hole);
    cylinder(.0083, .0083, .001, x, .0103, z, rubber, dial, 20);
    numberPositions.push([Math.cos(angle) * .074, Math.sin(angle) * .074, String((i + 1) % 10)]);
  }
  const fingerPlate = new T.ExtrudeGeometry(holes, { depth: .0025, bevelEnabled: false, curveSegments: 16 });
  fingerPlate.rotateX(-Math.PI / 2);
  fingerPlate.translate(0, .012, 0);
  add(fingerPlate, metal, dial);
  ring(.031, .0014, 0, .012, 0, metal, dial);
  cylinder(.0295, .0295, .0025, 0, .010, 0, bakelite, dial);

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d");
  const s = canvas.width / .17;
  ctx.fillStyle = "#211e16";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = "500 24px Georgia, serif";
  for (const [x, z, number] of numberPositions) ctx.fillText(number, 256 + x * s, 256 + z * s);
  // Worn paper in the center, distinct from the story's station/time clues.
  ctx.fillStyle = "#bdb7a2";
  ctx.beginPath(); ctx.arc(256, 256, .027 * s, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#514e42"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(256, 256, .025 * s, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "#33372d"; ctx.font = "20px Georgia, serif";
  ctx.fillText("VALLEY", 256, 245);
  ctx.font = "12px sans-serif"; ctx.fillText("PRIVATE LINE", 256, 272);
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  const print = new T.MeshStandardMaterial({ map, transparent: true, alphaTest: .08, roughness: .7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  const printFace = new T.Mesh(new T.PlaneGeometry(.17, .17), print);
  printFace.name = "Rotary dial number ring and paper label";
  printFace.rotation.x = -Math.PI / 2;
  printFace.position.y = .015;
  dial.add(printFace);
  // Bent metal finger-stop sits outside the zero end of the finger plate.
  const stop = new T.BoxGeometry(.012, .006, .026);
  stop.rotateY(-.43); stop.translate(.060, .018, -.030); add(stop, metal, dial);
  const stopLip = new T.BoxGeometry(.010, .013, .006);
  stopLip.rotateY(-.43); stopLip.translate(.064, .025, -.020); add(stopLip, metal, dial);

  for (const x of [-.113, .113]) {
    cylinder(.016, .024, .032, x, .063, .075, bakelite);
    cylinder(.006, .006, .010, x, .081, .075, metal, root, 16);
  }
  const handlePath = new T.CatmullRomCurve3([
    new T.Vector3(-.129, .133, .075), new T.Vector3(-.095, .157, .075),
    new T.Vector3(0, .164, .075), new T.Vector3(.095, .157, .075), new T.Vector3(.129, .133, .075),
  ]);
  const handle = new T.TubeGeometry(handlePath, 48, .020, 12, false);
  add(handle, bakelite, receiver);
  for (const side of [-1, 1]) {
    const cup = new T.LatheGeometry([
      [.026, .083], [.034, .084], [.040, .091], [.041, .105],
      [.037, .121], [.029, .134], [.018, .140], [0, .140],
    ].map(p => new T.Vector2(...p)), 32);
    cup.translate(side * .129, 0, .075);
    add(cup, bakelite, receiver);
    cylinder(.030, .030, .002, side * .129, .082, .075, rubber, receiver);
    ring(.032, .0012, side * .129, .084, .075, metal, receiver);
    // Shallow inset perforations on the receiver's two underside caps.
    for (let i = 0; i < 7; i++) {
      const a = i * Math.PI * 2 / 7;
      cylinder(.0022, .0022, .0015, side * .129 + Math.cos(a) * .014, .0805,
        .075 + Math.sin(a) * .014, bakelite, receiver, 8);
    }
  }
  for (const [owner, byMaterial] of parts) for (const [material, geometries] of byMaterial) {
    const geometry = mergeGeometries(geometries);
    for (const part of geometries) part.dispose();
    const mesh = new T.Mesh(geometry, material);
    mesh.name = owner === receiver ? "Sculpted receiver" : owner === dial ? "Rotary dial metalwork" : "Molded telephone case and cradle";
    mesh.castShadow = mesh.receiveShadow = true;
    owner.add(mesh);
  }
  const receiverAnchor = new T.Vector3(-.167, .113, .081);
  const cordPoints = [receiverAnchor.clone(), new T.Vector3(-.193, .104, .083)];
  for (let i = 0; i <= 192; i++) {
    const t = i / 192, a = t * Math.PI * 2 * 23;
    cordPoints.push(new T.Vector3(-.217 + Math.cos(a) * .0065,
      .073 - Math.sin(t * Math.PI) * .235 + Math.sin(a) * .005,
      .084 - t * .053));
  }
  cordPoints.push(new T.Vector3(-.172, -.018, .035));
  const cordGeometry = new T.TubeGeometry(new T.CatmullRomCurve3(cordPoints), 256, .0024, 5, false);
  const cord = new T.Mesh(cordGeometry, rubber);
  cord.name = "Continuous coiled receiver cord";
  cord.castShadow = true;
  root.add(cord);
  const cordPosition = cordGeometry.attributes.position;
  const originalCord = cordPosition.array.slice();
  const anchor = new T.Vector3(), delta = new T.Vector3();
  cordGeometry.boundingSphere = new T.Sphere(new T.Vector3(-.12, .12, 0), .65);
  let lift = 0;
  function pose(value) {
    lift = value;
    receiver.position.set(-.052 * value, .265 * value, -.025 * value);
    receiver.rotation.set(-.07 * value, .12 * value, -.21 * value);
    receiver.updateMatrix();
    anchor.copy(receiverAnchor).applyMatrix4(receiver.matrix);
    delta.copy(anchor).sub(receiverAnchor);
    for (let ring = 0; ring <= 256; ring++) {
      const weight = (1 - ring / 256) ** 2;
      for (let vertex = 0; vertex <= 5; vertex++) {
        const offset = (ring * 6 + vertex) * 3;
        cordPosition.array[offset] = originalCord[offset] + delta.x * weight;
        cordPosition.array[offset + 1] = originalCord[offset + 1] + delta.y * weight;
        cordPosition.array[offset + 2] = originalCord[offset + 2] + delta.z * weight;
      }
    }
    cordPosition.needsUpdate = true;
    root.userData.receiverLift = value;
  }
  pose(0);
  return {
    root, receiver,
    // Existing interactions still target a stable case mesh, never the lifted
    // receiver or a cord outside the telephone's old furniture footprint.
    target: root.children.find(child => child.isMesh && child.material === bakelite),
    reset() { pose(0); },
    update(offHook, dt) {
      const target = offHook ? 1 : 0;
      const next = T.MathUtils.damp(lift, target, offHook ? 11 : 9, Math.max(0, dt));
      const settled = Math.abs(next - target) < .0001 ? target : next;
      if (settled !== lift) pose(settled);
    },
    snapshot() {
      return { lift, position: receiver.position.toArray(), rotation: receiver.rotation.toArray().slice(0, 3),
        cordStart: anchor.toArray(), cordEnd: [-.172, -.018, .035],
        cordVertices: cordPosition.count, numberCount: numberPositions.length };
    },
  };
}
