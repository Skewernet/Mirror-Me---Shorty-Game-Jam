import * as T from "three";
import { writingTexture, rainTexture } from "./surfaces.mjs";
export function furnish(b, m) {
  const { box, cylinder, sphere, tube, lathe, group, target, contact, scene } =
    b;
  const animated = [],
    roomGroups = {};
  const paper = (lines, font = 24, mirrored = false) =>
    new T.MeshStandardMaterial({
      map: writingTexture(lines, { font, mirrored }),
      roughness: 1,
      side: T.DoubleSide,
    });
  function slab(w, h, d, x, y, z, mat, parent, round = 0.035) {
    return box(w, h, d, x, y, z, mat, false, parent, round);
  }
  function table(x, z, w = 1.15, d = 0.7, h = 0.76, parent = scene) {
    const g = group(x, 0, z, 0, parent);
    slab(w, 0.08, d, 0, h, 0, m.wood, g);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        cylinder(
          0.025,
          0.04,
          h,
          sx * (w / 2 - 0.08),
          h / 2,
          sz * (d / 2 - 0.08),
          m.wood,
          g,
        );
    b.solid(box(w, h, d, 0, h / 2, 0, m.invisible, false, g));
    contact(w * 1.4, d * 1.5, x, z, 0.8, parent);
    return g;
  }
  function lamp(x, y, z, parent = scene) {
    const g = group(x, y, z, 0, parent);
    lathe(
      [
        [0, 0],
        [0.14, 0.02],
        [0.15, 0.05],
        [0.08, 0.1],
        [0.065, 0.24],
        [0.02, 0.29],
      ],
      0,
      0,
      0,
      m.lampGlaze,
      g,
    );
    cylinder(0.012, 0.012, 0.18, 0, 0.35, 0, m.brass, g);
    lathe(
      [
        [0.24, 0],
        [0.23, 0.025],
        [0.12, 0.31],
        [0.115, 0.32],
      ],
      0,
      0.35,
      0,
      m.shade,
      g,
    );
    sphere(0.035, 0.05, 0.035, 0, 0.42, 0, m.bulb, g);
    return g;
  }
  function chair(x, z, rotation, parent = scene) {
    const g = group(x, 0, z, rotation, parent);
    slab(0.46, 0.09, 0.48, 0, 0.48, 0, m.wood, g);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        cylinder(0.022, 0.028, 0.46, sx * 0.19, 0.23, sz * 0.19, m.wood, g);
    for (const sx of [-1, 1])
      cylinder(0.025, 0.025, 0.55, sx * 0.2, 0.78, 0.2, m.wood, g);
    for (let i = -1; i <= 1; i++)
      cylinder(0.012, 0.012, 0.4, i * 0.1, 0.8, 0.2, m.wood, g);
    slab(0.46, 0.08, 0.06, 0, 1.02, 0.2, m.wood, g, 0.02);
    g.userData.collider = b.solid(
      box(0.48, 0.8, 0.52, 0, 0.4, 0, m.invisible, false, g),
    );
    return g;
  }
  function window(x, y, z, rotation, parent = scene, w = 1.6, h = 1.45) {
    const g = group(x, y, z, rotation, parent);
    box(w + 0.15, h + 0.18, 0.08, 0, 0, 0, m.wood, false, g);
    const glass = new T.MeshBasicMaterial({
      map: rainTexture(),
      color: 0x6e858c,
    });
    box(w, h, 0.035, 0, 0, 0.055, glass, false, g);
    for (const sx of [-1, 0, 1])
      box(0.035, h, 0.08, (sx * w) / 2, 0, 0.09, m.windowTrim, false, g);
    for (const sy of [-1, 0, 1])
      box(w, 0.04, 0.08, 0, (sy * h) / 2, 0.09, m.windowTrim, false, g);
    box(w + 0.28, 0.065, 0.26, 0, -h / 2 - 0.06, 0.12, m.windowTrim, false, g);
    const rail = cylinder(
      0.015,
      0.015,
      w + 0.6,
      0,
      h / 2 + 0.17,
      0.15,
      m.brass,
      g,
    );
    rail.rotation.z = Math.PI / 2;
    for (const side of [-1, 1]) {
      const geometry = new T.PlaneGeometry(w * 0.33, h + 0.36, 12, 18),
        a = geometry.attributes.position;
      for (let i = 0; i < a.count; i++)
        a.setZ(
          i,
          Math.sin(a.getX(i) * 45) * 0.035 + 0.025 * Math.cos(a.getY(i) * 3),
        );
      geometry.computeVertexNormals();
      const mesh = new T.Mesh(geometry, m.curtain);
      mesh.position.set(side * w * 0.43, -0.04, 0.2);
      g.add(mesh);
      animated.push({ type: "curtain", mesh, side });
    }
    return g;
  }
  function frame(x, y, z, rotation, map, parent = scene, w = 0.65, h = 0.82) {
    const g = group(x, y, z, rotation, parent);
    box(w + 0.14, h + 0.14, 0.07, 0, 0, 0, m.wood, false, g);
    box(w + 0.04, h + 0.04, 0.025, 0, 0, 0.05, m.brass, false, g);
    const face = box(
      w,
      h,
      0.01,
      0,
      0,
      0.067,
      new T.MeshStandardMaterial({ map, roughness: 0.82 }),
      false,
      g,
    );
    return { group: g, face };
  }
  // Sitting room: soft furniture, old CRT, phone, family photograph.
  const lounge = group();
  roomGroups.lounge = lounge;
  const sofa = group(-5.75, 0, 6.85, 0, lounge);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      cylinder(0.05, 0.035, 0.18, sx * 1.0, 0.09, sz * 0.38, m.wood, sofa);
  slab(2.38, 0.3, 0.96, 0, 0.29, 0, m.fabric, sofa, 0.12);
  slab(2.4, 0.75, 0.24, 0, 0.79, 0.4, m.fabric, sofa, 0.1);
  for (const sx of [-1, 1]) {
    slab(0.25, 0.57, 1.0, sx * 1.16, 0.56, 0, m.fabric, sofa, 0.11);
    const pillow = slab(
      0.75,
      0.3,
      0.6,
      sx * 0.55,
      0.6,
      -0.06,
      m.fabric,
      sofa,
      0.14,
    );
    pillow.rotation.x = 0.06;
  }
  b.solid(box(2.65, 0.95, 1.15, 0, 0.48, 0.05, m.invisible, false, sofa));
  contact(3.2, 1.6, -5.75, 6.85, 0.85, lounge);
  const coffee = table(-5.7, 4.7, 1.7, 0.88, 0.42, lounge);
  slab(0.37, 0.035, 0.26, -0.4, 0.48, 0.06, m.paper, coffee, 0.01);
  cylinder(0.09, 0.08, 0.1, 0.4, 0.51, 0.12, m.ceramic, coffee);
  cylinder(0.03, 0.03, 0.06, -0.06, 0.49, -0.1, m.rust, coffee);
  const tvStand = table(-5.7, 2.35, 1.42, 0.6, 0.56, lounge);
  slab(0.95, 0.64, 0.48, 0, 0.95, 0, m.tvBody, tvStand, 0.065);
  const screenCanvas = document.createElement("canvas");
  screenCanvas.width = 128;
  screenCanvas.height = 96;
  const screenCtx = screenCanvas.getContext("2d"),
    screenMap = new T.CanvasTexture(screenCanvas);
  const tvScreen = box(
    0.71,
    0.48,
    0.025,
    -0.07,
    0.98,
    0.255,
    new T.MeshBasicMaterial({ map: screenMap, color: 0x6b7973 }),
    false,
    tvStand,
    0.07,
  );
  for (let i = 0; i < 2; i++) {
    const o = cylinder(
      0.035,
      0.035,
      0.03,
      0.38,
      0.87 + i * 0.19,
      0.27,
      m.black,
      tvStand,
    );
    o.rotation.x = Math.PI / 2;
  }
  tube(
    [
      [-0.2, 1.3, 0],
      [-0.35, 1.55, 0],
      [-0.6, 1.72, 0],
    ],
    0.008,
    m.steel,
    tvStand,
  );
  tube(
    [
      [0.15, 1.3, 0],
      [0.3, 1.55, 0],
      [0.6, 1.7, 0],
    ],
    0.008,
    m.steel,
    tvStand,
  );
  const phoneTable = table(-3.0, 6.75, 1.1, 0.68, 0.78, lounge),
    phone = group(0, 0.84, 0, 0, phoneTable);
  const phoneTarget = slab(0.39, 0.12, 0.3, 0, 0, 0, m.black, phone, 0.035);
  target("radio", phoneTarget, "LISTEN TO TELEPHONE", 2.3, phone);
  const dial = new T.Mesh(new T.TorusGeometry(0.07, 0.013, 8, 32), m.brass);
  dial.rotation.x = -Math.PI / 2;
  dial.position.set(0, 0.075, -0.02);
  phone.add(dial);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    cylinder(
      0.009,
      0.009,
      0.014,
      Math.cos(a) * 0.052,
      0.084,
      Math.sin(a) * 0.052 - 0.02,
      m.black,
      phone,
      8,
    );
  }
  tube(
    [
      [-0.17, 0.14, 0.08],
      [-0.15, 0.17, 0.08],
      [0, 0.2, 0.08],
      [0.15, 0.17, 0.08],
      [0.17, 0.14, 0.08],
    ],
    0.035,
    m.black,
    phone,
  );
  const cord = [];
  for (let i = 0; i < 100; i++) {
    const a = i * 0.65;
    cord.push([
      0.18 + Math.sin(a) * 0.015,
      0.11 - i * 0.0065,
      0.1 + Math.cos(a) * 0.015,
    ]);
  }
  tube(cord, 0.004, m.black, phone);
  const family = frame(
    -3.23,
    1.09,
    6.55,
    Math.PI,
    m.photos[0],
    lounge,
    0.28,
    0.32,
  );
  target("photo", family.face, "EXAMINE FAMILY PHOTOGRAPH", 2, family.group);
  lamp(-2.8, 0.83, 6.8, lounge);
  window(-7.95, 1.73, 5.1, Math.PI / 2, lounge, 1.8, 1.45);
  const bookcase = group(-2.25, 0, 2.3, 0, lounge);
  box(0.65, 1.9, 0.3, 0, 0.95, 0, m.wood, false, bookcase);
  for (let row = 0; row < 4; row++) {
    box(0.64, 0.035, 0.34, 0, 0.16 + row * 0.45, 0.02, m.wood, false, bookcase);
    for (let j = 0; j < 7; j++) {
      const book = box(
        0.055,
        0.2 + (j % 3) * 0.035,
        0.18,
        -0.25 + j * 0.074,
        0.29 + row * 0.45,
        0.08,
        [m.book, m.fabric, m.linen][j % 3],
        false,
        bookcase,
      );
      book.rotation.z = ((j % 3) - 1) * 0.035;
    }
  }
  // Kitchen: cabinetry with proper edge gaps, stainless basin, crockery.
  const kitchen = group();
  roomGroups.kitchen = kitchen;
  for (const z of [-3.25, -2.35, -0.15, 0.75, 1.65]) {
    const cabinet = group(11.1, 0, z, -Math.PI / 2, kitchen);
    box(0.83, 0.85, 0.65, 0, 0.44, 0, m.cabinet, false, cabinet, 0.02);
    box(0.79, 0.7, 0.035, 0, 0.45, 0.35, m.cabinetFront, false, cabinet, 0.012);
    box(0.16, 0.025, 0.06, 0, 0.7, 0.4, m.steel, false, cabinet);
    box(0.94, 0.07, 0.78, 0, 0.91, 0, m.counter, false, cabinet, 0.025);
    b.solid(box(0.93, 0.95, 0.82, 0, 0.47, 0, m.invisible, false, cabinet));
  }
  const sink = lathe(
    [
      [0, -0.22],
      [0.14, -0.21],
      [0.29, -0.1],
      [0.35, 0],
      [0.39, 0.025],
    ],
    10.95,
    0.95,
    -1.3,
    m.steel,
    kitchen,
  );
  sink.scale.set(0.8, 1, 1.05);
  cylinder(0.07, 0.07, 0.009, 10.95, 0.74, -1.3, m.black, kitchen);
  tube(
    [
      [11.32, 0.94, -1.3],
      [11.32, 1.25, -1.3],
      [11.13, 1.37, -1.3],
      [10.99, 1.3, -1.3],
      [10.99, 1.15, -1.3],
    ],
    0.021,
    m.steel,
    kitchen,
  );
  for (const z of [-1.75, -0.85])
    box(0.2, 0.07, 0.2, 11.15, 0.91, z, m.counter, false, kitchen);
  const fuseGroup = group(10.84, 0.975, -2.2, 0, kitchen);
  const fuse = cylinder(0.022, 0.022, 0.12, 0, 0, 0, m.ceramic, fuseGroup);
  fuse.rotation.z = Math.PI / 2;
  for (const x of [-0.06, 0.06]) {
    const cap = cylinder(0.024, 0.024, 0.02, x, 0, 0, m.brass, fuseGroup);
    cap.rotation.z = Math.PI / 2;
  }
  const fuseTarget = box(
    0.22,
    0.1,
    0.2,
    0,
    0.03,
    0,
    m.invisible,
    false,
    fuseGroup,
  );
  target("fuse", fuseTarget, "TAKE CERAMIC FUSE", 2.25, fuseGroup);
  const fridge = group(10.85, 0, 2.8, -Math.PI / 2, kitchen);
  box(0.85, 1.8, 0.75, 0, 0.91, 0, m.enamel, false, fridge, 0.055);
  box(0.8, 1.2, 0.045, 0, 1.16, 0.39, m.enamel, false, fridge, 0.025);
  box(0.8, 0.45, 0.045, 0, 0.31, 0.39, m.enamel, false, fridge, 0.025);
  box(0.035, 0.37, 0.08, -0.31, 1.24, 0.45, m.black, false, fridge, 0.012);
  b.solid(box(0.9, 1.8, 0.88, 0, 0.9, 0, m.invisible, false, fridge));
  box(
    0.36,
    0.4,
    0.006,
    0.08,
    1.22,
    0.425,
    paper(["SPARES", "BY THE SINK"], 42),
    false,
    fridge,
  );
  const dining = table(8.15, 1.6, 1.25, 1.05, 0.76, kitchen);
  chair(7.3, 1.6, Math.PI / 2, kitchen);
  const invertedChair = chair(8.95, 1.6, -Math.PI / 2, kitchen);
  for (const x of [-0.35, 0.35]) {
    cylinder(0.17, 0.17, 0.018, x, 0.813, 0, m.ceramic, dining);
    cylinder(0.065, 0.05, 0.12, x, 0.87, -0.28, m.ceramic, dining);
  }
  window(11.64, 1.83, -1.3, -Math.PI / 2, kitchen, 1.75, 1.25);
  // Bathroom: curved tub, wet ceramic, sink, obscured glass with mirrored writing.
  const bathroom = group();
  roomGroups.bathroom = bathroom;
  const tub = lathe(
    [
      [0, 0.12],
      [0.25, 0.12],
      [0.48, 0.2],
      [0.62, 0.5],
      [0.66, 0.6],
      [0.63, 0.66],
      [0.57, 0.64],
      [0.51, 0.49],
      [0.35, 0.24],
      [0, 0.23],
    ],
    -6.1,
    0,
    -6.0,
    m.ceramic,
    bathroom,
  );
  tub.scale.z = 2.05;
  b.solid(box(1.35, 0.65, 2.8, -6.1, 0.33, -6, m.invisible, false, bathroom));
  const water = new T.Mesh(new T.CircleGeometry(0.5, 48), m.water);
  water.rotation.x = -Math.PI / 2;
  water.scale.y = 2.05;
  water.position.set(-6.1, 0.38, -6);
  bathroom.add(water);
  tube(
    [
      [-6.1, 0.55, -7.2],
      [-6.1, 0.92, -7.2],
      [-6.1, 0.99, -6.99],
    ],
    0.024,
    m.steel,
    bathroom,
  );
  const curtainGeometry = new T.PlaneGeometry(2.5, 1.95, 30, 24),
    ca = curtainGeometry.attributes.position;
  for (let i = 0; i < ca.count; i++)
    ca.setZ(i, Math.sin(ca.getX(i) * 26) * 0.045);
  curtainGeometry.computeVertexNormals();
  const curtain = new T.Mesh(curtainGeometry, m.curtain);
  curtain.position.set(-5.24, 1.5, -6.9);
  curtain.rotation.y = Math.PI / 2;
  bathroom.add(curtain);
  tube(
    [
      [-5.25, 2.55, -8.3],
      [-5.25, 2.55, -4.6],
    ],
    0.015,
    m.steel,
    bathroom,
  );
  b.solid(box(0.75, 1.0, 0.6, -3.5, 0.5, -8.9, m.invisible, false, bathroom));
  const basin = lathe(
    [
      [0, -0.12],
      [0.14, -0.1],
      [0.27, 0],
      [0.36, 0.12],
      [0.35, 0.18],
      [0.31, 0.2],
      [0.25, 0.12],
      [0, 0.07],
    ],
    -3.5,
    0.83,
    -8.85,
    m.ceramic,
    bathroom,
  );
  basin.scale.z = 0.8;
  lathe(
    [
      [0.12, 0],
      [0.1, 0.3],
      [0.08, 0.6],
      [0.12, 0.74],
    ],
    -3.5,
    0,
    -8.85,
    m.ceramic,
    bathroom,
  );
  const stream = cylinder(
    0.004,
    0.003,
    0.2,
    -3.5,
    1.02,
    -8.88,
    m.water,
    bathroom,
    8,
  );
  const tap = tube(
    [
      [-3.5, 0.98, -9.02],
      [-3.5, 1.19, -9.02],
      [-3.5, 1.2, -8.87],
    ],
    0.018,
    m.steel,
    bathroom,
  );
  target("tap", tap, "INSPECT RUNNING TAP", 2.1);
  const tapTarget = box(
    0.35,
    0.27,
    0.28,
    -3.5,
    1.11,
    -8.96,
    m.invisible,
    false,
    bathroom,
  );
  target("tap", tapTarget, "INSPECT RUNNING TAP", 2.1);
  const bathroomGlass = box(
    1.1,
    0.96,
    0.03,
    -3.5,
    1.92,
    -9.34,
    m.foggedGlass,
    false,
    bathroom,
    0.03,
  );
  target("bath-clue", bathroomGlass, "WIPE THE FOGGED GLASS", 2.15);
  const clue = box(
    0.76,
    0.33,
    0.005,
    -3.5,
    1.97,
    -9.31,
    new T.MeshBasicMaterial({
      map: writingTexture(["03:17"], {
        background: "#858e88",
        color: "#3c423b",
        font: 96,
        mirrored: true,
      }),
      transparent: true,
      opacity: 0.6,
    }),
    false,
    bathroom,
  );
  clue.visible = false;
  lathe(
    [
      [0.14, 0],
      [0.11, 0.2],
      [0.24, 0.37],
      [0.25, 0.43],
      [0.2, 0.47],
    ],
    -6.1,
    0,
    -8.65,
    m.ceramic,
    bathroom,
  );
  const seat = new T.Mesh(new T.TorusGeometry(0.23, 0.035, 10, 32), m.ceramic);
  seat.rotation.x = Math.PI / 2;
  seat.scale.y = 1.25;
  seat.position.set(-6.1, 0.47, -8.65);
  bathroom.add(seat);
  box(0.5, 0.6, 0.23, -6.1, 0.76, -9.1, m.ceramic, false, bathroom, 0.07);
  const towelRail = tube(
    [
      [-2.05, 1.35, -7.4],
      [-2.18, 1.35, -7.4],
      [-2.18, 1.35, -8.1],
      [-2.05, 1.35, -8.1],
    ],
    0.015,
    m.steel,
    bathroom,
  );
  box(0.04, 0.65, 0.5, -2.2, 1.05, -7.7, m.linen, false, bathroom, 0.015);
  // Bedroom: creased bedding, diary, music box, wardrobe shadow.
  const bedroom = group();
  roomGroups.bedroom = bedroom;
  const bed = group(9.5, 0, 6.8, 0, bedroom);
  box(1.85, 0.3, 2.35, 0, 0.28, 0, m.wood, false, bed, 0.05);
  box(1.78, 0.23, 2.27, 0, 0.55, 0, m.linen, false, bed, 0.1);
  box(1.96, 1.15, 0.12, 0, 0.65, 1.15, m.wood, false, bed, 0.05);
  for (const x of [-0.47, 0.47]) {
    const pillow = slab(0.7, 0.17, 0.46, x, 0.74, 0.72, m.linen, bed, 0.08);
    pillow.rotation.y = x * 0.14;
  }
  const quiltGeo = new T.PlaneGeometry(2.04, 1.9, 32, 32),
    qa = quiltGeo.attributes.position;
  for (let i = 0; i < qa.count; i++) {
    const x = qa.getX(i),
      y = qa.getY(i);
    qa.setZ(
      i,
      0.008 * Math.sin(x * 35 + y * 7) +
        0.018 * Math.sin(y * 12) +
        0.015 * Math.cos(x * 18) -
        Math.max(0, Math.abs(x) - 0.89) * 1.8 -
        Math.max(0, y - 0.88) * 1.5,
    );
  }
  quiltGeo.computeVertexNormals();
  const quilt = new T.Mesh(quiltGeo, m.blanket);
  quilt.rotation.x = -Math.PI / 2;
  quilt.position.set(0, 0.755, -0.24);
  bed.add(quilt);
  const quiltBase = Float32Array.from(qa.array);
  b.solid(box(1.98, 0.85, 2.4, 0, 0.4, 0, m.invisible, false, bed));
  contact(2.8, 3.3, 9.5, 6.8, 0.85, bedroom);
  const nightstand = table(7.95, 7.5, 0.65, 0.6, 0.69, bedroom);
  lamp(7.95, 0.75, 7.5, bedroom);
  const diary = box(
    0.34,
    0.028,
    0.26,
    7.84,
    0.755,
    7.2,
    paper(["I REMEMBER", "RADIO", "WATER", "A LULLABY"], 32),
    false,
    bedroom,
    0.012,
  );
  diary.rotation.y = -0.15;
  target("diary", diary, "READ BEDSIDE DIARY", 2.15);
  const musicTable = table(10.65, 4.3, 1.15, 0.55, 0.7, bedroom),
    music = group(0, 0.8, 0, 0, musicTable);
  const musicBase = box(0.36, 0.15, 0.25, 0, 0, 0, m.wood, false, music, 0.025);
  target("musicbox", musicBase, "LISTEN TO MUSIC BOX", 2.1, music);
  const musicLid = group(-0.18, 0.08, 0, 0, music);
  box(0.36, 0.025, 0.25, 0.18, 0, 0, m.wood, false, musicLid, 0.01);
  musicLid.rotation.z = 0.55;
  cylinder(0.035, 0.035, 0.1, 0, 0.13, 0, m.brass, music);
  sphere(0.025, 0.025, 0.025, 0, 0.21, 0, m.ceramic, music);
  const wardrobe = group(6.25, 0, 7.7, 0, bedroom);
  box(1.1, 2.2, 0.65, 0, 1.1, 0, m.wood, false, wardrobe, 0.025);
  box(0.98, 2.03, 0.02, 0, 1.1, -0.35, m.black, false, wardrobe);
  const wardrobeDoor = group(-0.52, 0, -0.36, -0.45, wardrobe);
  box(0.49, 2.08, 0.035, 0.245, 1.1, 0, m.wood, false, wardrobeDoor, 0.015);
  b.solid(box(1.18, 2.25, 0.9, 0, 1.1, 0, m.invisible, false, wardrobe));
  window(11.64, 1.82, 5.4, -Math.PI / 2, bedroom, 1.5, 1.5);
  // Utility room: fuse board, conduit, laundry and storage.
  const utility = group();
  roomGroups.utility = utility;
  const panelGroup = group(11.6, 1.52, -6.9, -Math.PI / 2, utility);
  const panel = box(0.62, 0.8, 0.12, 0, 0, 0, m.rust, false, panelGroup, 0.025);
  target("panel", panel, "INSPECT FUSE BOX", 2.2, panelGroup);
  box(0.51, 0.66, 0.025, 0, 0, 0.075, m.black, false, panelGroup);
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 2; col++) {
      box(
        0.15,
        0.12,
        0.04,
        -0.14 + col * 0.28,
        0.2 - row * 0.2,
        0.105,
        m.enamel,
        false,
        panelGroup,
        0.01,
      );
      box(
        0.04,
        0.06,
        0.055,
        -0.14 + col * 0.28,
        0.2 - row * 0.2,
        0.13,
        m.black,
        false,
        panelGroup,
      );
    }
  const fuseGlow = sphere(
    0.018,
    0.018,
    0.008,
    0.22,
    -0.31,
    0.155,
    m.redBulb,
    panelGroup,
  );
  tube(
    [
      [11.62, 1.93, -6.9],
      [11.62, 2.65, -6.9],
      [9, 2.65, -6.9],
      [9, 2.65, -9.3],
    ],
    0.015,
    m.steel,
    utility,
  );
  box(0.9, 1.0, 0.85, 10.9, 0.51, -8.7, m.enamel, false, utility, 0.045);
  const machineDoor = new T.Mesh(
    new T.TorusGeometry(0.28, 0.05, 12, 32),
    m.steel,
  );
  machineDoor.position.set(10.9, 0.49, -8.25);
  utility.add(machineDoor);
  const machineGlass = new T.Mesh(
    new T.CircleGeometry(0.235, 32),
    m.foggedGlass,
  );
  machineGlass.position.set(10.9, 0.49, -8.24);
  utility.add(machineGlass);
  b.solid(box(0.95, 1.0, 0.95, 10.9, 0.5, -8.7, m.invisible, false, utility));
  const shelf = group(7, 0, -9.05, 0, utility);
  for (const x of [-0.8, 0.8])
    box(0.05, 2.3, 0.45, x, 1.15, 0, m.steel, false, shelf);
  for (let row = 0; row < 4; row++) {
    box(1.75, 0.04, 0.5, 0, 0.25 + row * 0.55, 0, m.wood, false, shelf);
    for (let col = 0; col < 3; col++)
      box(
        0.34,
        0.3,
        0.35,
        -0.55 + col * 0.54,
        0.42 + row * 0.55,
        0,
        [m.paper, m.rust, m.cabinet][col],
        false,
        shelf,
        0.015,
      );
  }
  function animate(time, state) {
    const frameNumber = Math.floor(time * 8);
    if (frameNumber !== animate.lastFrame) {
      animate.lastFrame = frameNumber;
      const im = screenCtx.createImageData(128, 96);
      for (let i = 0; i < im.data.length; i += 4) {
        const v = (Math.random() * 35 + 12) * (state.stage >= 3 ? 0.15 : 1);
        im.data[i] = v * 0.8;
        im.data[i + 1] = v;
        im.data[i + 2] = v * 0.95;
        im.data[i + 3] = 255;
      }
      screenCtx.putImageData(im, 0, 0);
      screenMap.needsUpdate = true;
    }
    for (const a of animated)
      a.mesh.rotation.y = Math.sin(time * 0.4 + a.side) * 0.016;
    invertedChair.position.y = state.stage >= 3 ? 2.8 : 0;
    invertedChair.rotation.z = state.stage >= 3 ? Math.PI : 0;
    invertedChair.userData.collider.disabled = state.stage >= 3;
    stream.visible = !(state.stage >= 3 && state.echoIndex >= 2);
    if (state.stage >= 2) {
      for (let i = 0; i < qa.count; i++) {
        const x = qa.getX(i),
          y = qa.getY(i),
          shape = Math.exp(-((x / 0.25) ** 2 + (y / 0.78) ** 2));
        qa.setZ(
          i,
          quiltBase[i * 3 + 2] + shape * (0.12 + Math.sin(time * 1.35) * 0.008),
        );
      }
      qa.needsUpdate = true;
      quiltGeo.computeVertexNormals();
    } else if (animate.quiltStage >= 2) {
      qa.array.set(quiltBase);
      qa.needsUpdate = true;
      quiltGeo.computeVertexNormals();
    }
    animate.quiltStage = state.stage;
    tvScreen.material.map = state.stage >= 3 ? m.photos[1] : screenMap;
    family.face.material.map = m.photos[state.stage >= 2 ? 1 : 0];
    clue.visible = state.stage >= 2;
    fuseGroup.visible = !state.hasFuse && !state.power;
    fuseGlow.material = state.power ? m.greenBulb : m.redBulb;
    musicLid.rotation.z =
      state.stage >= 3 && state.echoIndex >= 1
        ? 0
        : 0.55 + Math.sin(time * 1.1) * 0.015;
    water.material.opacity = 0.55 + Math.sin(time * 0.4) * 0.025;
    return { screen: tvScreen };
  }
  return {
    roomGroups,
    animated,
    animate,
    window,
    frame,
    lamp,
    table,
    family,
    diary,
    fuse: fuseTarget,
    panel,
    musicBase,
    tap,
    clue,
  };
}
