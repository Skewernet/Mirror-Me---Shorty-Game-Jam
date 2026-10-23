import * as T from "three";

// Mara Vale: an adult woman in ordinary clothes. Shared by the optical reflection,
// passage apparition and final replacement so her identity survives each reveal.
export function createFigure(house, layer = 1) {
  const body = new T.Group(),
    head = new T.Group(),
    arms = [],
    legs = [];
  body.name = "Mara Vale";
  const skinMap = skinTexture();
  const skin = new T.MeshStandardMaterial({
    color: 0xc4ac98,
    map: skinMap,
    roughness: 0.72,
    bumpMap: skinMap,
    bumpScale: 0.0006,
  });
  const hairMap = hairTexture();
  const hair = new T.MeshStandardMaterial({
    color: 0x33251e,
    map: hairMap,
    bumpMap: hairMap,
    bumpScale: 0.0012,
    roughness: 0.68,
  });
  const cardigan = house.surfaces.material("linen", 2, 3, 0x713e43);
  const trousers = house.surfaces.material("linen", 2, 3, 0x343b37);
  const blouse = house.surfaces.material("linen", 2, 3, 0xf1e8d6);
  blouse.side = T.DoubleSide;
  const lips = new T.MeshStandardMaterial({ color: 0x80605a, roughness: 0.8 });
  const eyes = new T.MeshStandardMaterial({ color: 0x8e8b7d, roughness: 0.25 });
  const iris = new T.MeshStandardMaterial({ color: 0x403a28, roughness: 0.35 });
  const shoe = new T.MeshStandardMaterial({ color: 0x211b17, roughness: 0.54 });
  function mesh(geometry, material, parent, x = 0, y = 0, z = 0) {
    const o = new T.Mesh(geometry, material);
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    parent.add(o);
    return o;
  }
  function ellipsoid(rx, ry, rz, x, y, z, material, parent = body) {
    const o = mesh(new T.SphereGeometry(1, 32, 24), material, parent, x, y, z);
    o.scale.set(rx, ry, rz);
    return o;
  }
  function tube(points, radius, material, parent = body) {
    return mesh(
      new T.TubeGeometry(
        new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p))),
        20,
        radius,
        8,
        false,
      ),
      material,
      parent,
    );
  }
  const torso = mesh(
    new T.LatheGeometry(
      [
        [0.157, 0.79],
        [0.177, 0.85],
        [0.158, 0.94],
        [0.136, 1.07],
        [0.151, 1.21],
        [0.185, 1.34],
        [0.157, 1.42],
        [0.062, 1.455],
      ].map((p) => new T.Vector2(...p)),
      40,
    ),
    cardigan,
    body,
  );
  torso.scale.z = 0.65;
  const hip = mesh(
    new T.LatheGeometry(
      [
        [0.166, 0.73],
        [0.16, 0.76],
        [0.151, 0.79],
        [0.162, 0.83],
        [0.152, 0.9],
      ].map((p) => new T.Vector2(...p)),
      32,
    ),
    trousers,
    body,
  );
  hip.scale.z = 0.65;
  mesh(
    new T.CylinderGeometry(0.047, 0.057, 0.105, 24),
    skin,
    body,
    0,
    1.477,
    0,
  );
  const inset = new T.BufferGeometry(),
    vertices = [],
    uvs = [],
    indices = [];
  const rows = [
    [1.448, 0.055],
    [1.42, 0.075],
    [1.38, 0.093],
    [1.335, 0.097],
    [1.25, 0.057],
    [1.15, 0.018],
  ];
  const profile = [
    [0.79, 0.157],
    [0.85, 0.177],
    [0.94, 0.158],
    [1.07, 0.136],
    [1.21, 0.151],
    [1.34, 0.185],
    [1.42, 0.157],
    [1.455, 0.062],
  ];
  function frontAt(x, y) {
    let radius = 0.062;
    for (let i = 1; i < profile.length; i++)
      if (y <= profile[i][0]) {
        const [y0, r0] = profile[i - 1],
          [y1, r1] = profile[i];
        radius = T.MathUtils.lerp(r0, r1, (y - y0) / (y1 - y0));
        break;
      }
    return -Math.sqrt(Math.max(0.0001, radius * radius - x * x)) * 0.65 - 0.006;
  }
  rows.forEach(([y, width], row) => {
    for (let col = 0; col <= 8; col++) {
      const x = (col / 4 - 1) * width;
      vertices.push(x, y, frontAt(x, y));
      uvs.push(col / 8, row / (rows.length - 1));
      if (row && col) {
        const i = row * 9 + col;
        indices.push(i - 10, i - 1, i - 9, i - 9, i - 1, i);
      }
    }
  });
  inset.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
  inset.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
  inset.setIndex(indices);
  inset.computeVertexNormals();
  mesh(inset, blouse, body);
  for (const side of [-1, 1]) {
    tube(
      rows.map(([y, w]) => [side * w, y, frontAt(side * w, y) - 0.002]),
      0.006,
      cardigan,
    );
    const arm = new T.Group();
    arm.position.set(side * 0.183, 1.34, 0);
    body.add(arm);
    arms.push(arm);
    const sleeve = new T.LatheGeometry(
      [
        [0, -0.55],
        [0.041, -0.55],
        [0.043, -0.49],
        [0.044, -0.4],
        [0.046, -0.32],
        [0.047, -0.25],
        [0.052, -0.13],
        [0.06, -0.02],
        [0.048, 0.025],
        [0, 0.045],
      ].map((p) => new T.Vector2(...p)),
      28,
    );
    const sa = sleeve.attributes.position;
    for (let i = 0; i < sa.count; i++) {
      const t = T.MathUtils.clamp(-sa.getY(i) / 0.55, 0, 1);
      sa.setX(i, sa.getX(i) + side * (0.012 + 0.023 * t));
      sa.setZ(i, sa.getZ(i) - 0.022 * t);
    }
    sleeve.computeVertexNormals();
    mesh(sleeve, cardigan, arm);
    mesh(
      new T.CylinderGeometry(0.043, 0.045, 0.045, 24),
      cardigan,
      arm,
      side * 0.034,
      -0.526,
      -0.025,
    );
    ellipsoid(0.033, 0.059, 0.019, side * 0.035, -0.59, -0.025, skin, arm);
    for (let f = 0; f < 4; f++) {
      const finger = mesh(
        new T.CapsuleGeometry(0.0065, 0.055 + (f === 1 ? 0.012 : 0), 4, 8),
        skin,
        arm,
        side * (0.012 + f * 0.014),
        -0.65,
        -0.026,
      );
      finger.rotation.x = -0.11;
    }
    const thumb = mesh(
      new T.CapsuleGeometry(0.008, 0.036, 4, 8),
      skin,
      arm,
      -side * 0.003,
      -0.6,
      -0.036,
    );
    thumb.rotation.z = side * 0.4;
    const leg = new T.Group();
    leg.position.set(side * 0.091, 0.77, 0);
    body.add(leg);
    legs.push(leg);
    const trouserLeg = new T.LatheGeometry(
      [
        [0.052, -0.69],
        [0.055, -0.6],
        [0.054, -0.47],
        [0.056, -0.41],
        [0.065, -0.31],
        [0.072, -0.2],
        [0.078, -0.05],
        [0.071, 0.06],
      ].map((p) => new T.Vector2(...p)),
      28,
    );
    mesh(trouserLeg, trousers, leg).scale.z = 0.93;
    ellipsoid(0.061, 0.062, 0.127, 0, -0.705, -0.045, shoe, leg);
    // Sleeves and trouser seams catch practical light without extra pattern noise.
    tube(
      [
        [side * 0.019, -0.02, 0.047],
        [side * 0.035, -0.26, 0.04],
        [side * 0.038, -0.52, 0.016],
      ],
      0.0025,
      cardigan,
      arm,
    );
  }
  for (const y of [1.11, 1.0, 0.89])
    ellipsoid(0.008, 0.008, 0.003, 0, y, -0.106, house.brass);
  tube(
    [
      [-0.048, 1.44, -0.068],
      [0, 1.34, -0.138],
      [0.048, 1.44, -0.068],
    ],
    0.0018,
    house.brass,
  );
  ellipsoid(0.012, 0.017, 0.003, 0, 1.325, -0.137, house.brass);
  head.position.y = 1.64;
  body.add(head);
  // Sculpt cheek, jaw, eye sockets and nose into a continuous surface.
  const face = new T.SphereGeometry(1, 64, 48),
    a = face.attributes.position;
  for (let i = 0; i < a.count; i++) {
    let x = a.getX(i) * 0.102,
      y = a.getY(i) * 0.139,
      z = a.getZ(i) * 0.108;
    x *= 1 - 0.22 * T.MathUtils.smoothstep(-y, 0.025, 0.125);
    if (z < 0) {
      const front = T.MathUtils.smoothstep(-z, 0.03, 0.09);
      const nose =
        0.024 * Math.exp(-((x / 0.015) ** 2 + ((y + 0.017) / 0.042) ** 2));
      const sockets =
        0.006 *
        (Math.exp(-(((x - 0.037) / 0.025) ** 2 + ((y - 0.017) / 0.014) ** 2)) +
          Math.exp(-(((x + 0.037) / 0.025) ** 2 + ((y - 0.017) / 0.014) ** 2)));
      z += (sockets - nose) * front;
    }
    a.setXYZ(i, x, y, z);
  }
  face.computeVertexNormals();
  const faceSkin = skin.clone();
  const damagedSkin = skinTexture(true);
  mesh(face, faceSkin, head);
  // Hair is a swept cap, back volume and curved locks; her face remains readable.
  const hairCap = new T.SphereGeometry(
    0.108,
    40,
    28,
    0,
    Math.PI * 2,
    0,
    Math.PI * 0.74,
  );
  const ha = hairCap.attributes.position;
  for (let i = 0; i < ha.count; i++) {
    const x = ha.getX(i),
      y = ha.getY(i),
      z = ha.getZ(i);
    const phi = Math.atan2(z, -x);
    const fraction =
      Math.acos(T.MathUtils.clamp(y / 0.108, -1, 1)) / (Math.PI * 0.74);
    // Raise only the frontal hairline above her brows; sides/back reach the ears.
    const front = Math.max(0, -Math.sin(phi));
    const theta = fraction * Math.PI * (0.74 - 0.4 * front ** 2);
    ha.setXYZ(
      i,
      -0.108 * Math.cos(phi) * Math.sin(theta),
      0.108 * Math.cos(theta),
      0.108 * Math.sin(phi) * Math.sin(theta),
    );
  }
  hairCap.computeVertexNormals();
  const cap = mesh(hairCap, hair, head, 0, 0.002, 0.006);
  cap.scale.set(1, 1.31, 1.04);
  ellipsoid(0.111, 0.213, 0.073, 0, -0.065, 0.07, hair, head);
  for (const side of [-1, 1]) {
    for (let j = 0; j < 5; j++) {
      const x = side * (0.081 + j * 0.007),
        z = 0.018 + j * 0.009;
      tube(
        [
          [x, 0.085, z],
          [x + side * 0.012, -0.025, z - 0.012],
          [x + side * 0.016, -0.13, z + 0.018],
          [x + side * 0.027, -0.235 - j * 0.003, z + 0.043],
        ],
        0.014 - j * 0.0013,
        hair,
        head,
      );
    }
    ellipsoid(0.015, 0.029, 0.013, side * 0.101, -0.005, 0, skin, head);
    ellipsoid(0.019, 0.008, 0.009, side * 0.037, 0.018, -0.101, eyes, head);
    ellipsoid(0.0065, 0.0065, 0.003, side * 0.037, 0.018, -0.109, iris, head);
    ellipsoid(
      0.003,
      0.004,
      0.002,
      side * 0.037,
      0.018,
      -0.111,
      house.black,
      head,
    );
    tube(
      [
        [side * 0.017, 0.021, -0.102],
        [side * 0.036, 0.026, -0.108],
        [side * 0.057, 0.02, -0.096],
      ],
      0.0028,
      skin,
      head,
    );
    tube(
      [
        [side * 0.018, 0.015, -0.104],
        [side * 0.037, 0.012, -0.108],
        [side * 0.056, 0.016, -0.098],
      ],
      0.002,
      skin,
      head,
    );
    tube(
      [
        [side * 0.018, 0.039, -0.098],
        [side * 0.037, 0.043, -0.102],
        [side * 0.059, 0.035, -0.091],
      ],
      0.0025,
      hair,
      head,
    );
    ellipsoid(0.0035, 0.002, 0.002, side * 0.009, -0.035, -0.126, lips, head);
    ellipsoid(
      0.003,
      0.005,
      0.003,
      side * 0.101,
      -0.035,
      -0.002,
      house.brass,
      head,
    );
  }
  // A side part breaks the helmet silhouette and frames one cheek.
  tube(
    [
      [-0.04, 0.132, -0.025],
      [-0.075, 0.092, -0.077],
      [-0.095, 0.025, -0.055],
      [-0.098, -0.085, -0.015],
    ],
    0.017,
    hair,
    head,
  );
  tube(
    [
      [0.025, 0.138, -0.008],
      [0.071, 0.1, -0.06],
      [0.101, 0.02, -0.025],
    ],
    0.014,
    hair,
    head,
  );
  ellipsoid(0.025, 0.0035, 0.002, 0, -0.06, -0.104, lips, head);
  ellipsoid(0.021, 0.003, 0.0025, 0, -0.066, -0.102, skin, head);
  body.traverse((o) => o.layers.set(layer));
  function animate(time, speed = 0, frozen = false) {
    const walking = frozen ? 0 : Math.min(speed / 2, 1),
      phase = time * 7.1;
    arms.forEach((arm, i) => {
      arm.rotation.x = Math.sin(phase + i * Math.PI) * 0.15 * walking;
      arm.rotation.z =
        (i === 0 ? -0.035 : 0.035) + Math.sin(time * 0.6) * 0.004;
    });
    legs.forEach(
      (leg, i) =>
        (leg.rotation.x = Math.sin(phase + (i + 1) * Math.PI) * 0.14 * walking),
    );
    torso.scale.x = 1 + (frozen ? 0 : Math.sin(time * 1.1) * 0.005);
  }
  let unease = -1;
  function setUnease(level) {
    if (unease === level) return;
    unease = level;
    faceSkin.map = level >= 2 ? damagedSkin : skinMap;
    faceSkin.color.set(level ? 0xa7b2ab : 0xc4ac98);
    faceSkin.needsUpdate = true;
    eyes.color.set(level >= 2 ? 0xbaa99e : 0x8e8b7d);
    iris.color.set(level >= 2 ? 0x281c19 : 0x403a28);
  }
  return { body, head, arms, legs, animate, setUnease, identity: "Mara Vale" };
}
function skinTexture(damaged = false) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#d1bcaa";
  g.fillRect(0, 0, 256, 256);
  let seed = 83;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 6500; i++) {
    g.fillStyle = i % 2 ? "#8e6c5d0c" : "#f5dfc80d";
    g.fillRect(random() * 256, random() * 256, 1, 1);
  }
  if (damaged) {
    // Front of the spherical UV lies at u=.75. One dried tear and a split lip;
    // the rest of the face remains recognizably Mara rather than a new monster.
    const wash = g.createRadialGradient(180, 125, 1, 180, 125, 16);
    wash.addColorStop(0, "#43252599");
    wash.addColorStop(1, "#623d3b00");
    g.fillStyle = wash;
    g.fillRect(161, 108, 40, 46);
    g.strokeStyle = "#652925b8";
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(181, 125);
    g.bezierCurveTo(178, 137, 185, 144, 181, 155);
    g.stroke();
    g.strokeStyle = "#54221fbd";
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(191, 165);
    g.lineTo(195, 175);
    g.stroke();
  }
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  return t;
}
function hairTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#9a846b";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 256; i++) {
    g.strokeStyle = i % 3 ? "#291e1745" : "#e6c59835";
    g.beginPath();
    g.moveTo(i, 0);
    g.bezierCurveTo(i + 9, 70, i - 7, 180, i, 256);
    g.stroke();
  }
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.wrapS = t.wrapT = T.RepeatWrapping;
  return t;
}
