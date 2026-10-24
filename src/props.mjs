import * as T from "three";
import { writingTexture, rainTexture, radioGrille } from "./surfaces.mjs";
import { TARGETS } from "./layout.mjs";
import { addPuzzleProps } from "./puzzle-props.mjs";
import { WRITINGS } from "./story.mjs";
import { createBathroomMirror } from "./bathroom-mirror.mjs";
import { createKitchenFrequency } from "./kitchen-frequency.mjs";
import { createHallBlood } from "./hall-blood.mjs";

// Furnishings use measured human dimensions and the same coordinates as story
// targeting/audio. The tight floor plan is furnished deliberately, not scaled
// down from the earlier broad prototype rooms.
export function furnish(b, m) {
  const { box, cylinder, sphere, tube, lathe, group, target, contact, scene } =
    b;
  const roomGroups = Object.fromEntries(
    ["lounge", "utility", "bathroom", "kitchen", "bedroom"].map((id) => [
      id,
      group(),
    ]),
  );
  const animated = [];
  const paper = (lines, font = 24, mirrored = false) =>
    new T.MeshStandardMaterial({
      map: writingTexture(lines, { font, mirrored }),
      roughness: 0.97,
      side: T.DoubleSide,
    });
  const slab = (w, h, d, x, y, z, material, parent = scene, r = 0.025) =>
    box(w, h, d, x, y, z, material, false, parent, r);
  const collision = (w, h, d, x, y, z, parent = scene) =>
    b.solid(box(w, h, d, x, y, z, m.invisible, false, parent));
  function table(x, z, w = 1, d = 0.55, h = 0.75, parent = scene) {
    const g = group(x, 0, z, 0, parent);
    slab(w, 0.055, d, 0, h, 0, m.wood, g, 0.018);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const leg = cylinder(
          0.022,
          0.035,
          h,
          sx * (w / 2 - 0.065),
          h / 2,
          sz * (d / 2 - 0.065),
          m.wood,
          g,
        );
        leg.rotation.z = sx * 0.018;
      }
    collision(w, h, d, 0, h / 2, 0, g);
    contact(w * 1.3, d * 1.4, x, z, 0.65, parent);
    return g;
  }
  function lamp(x, y, z, parent = scene, size = 1) {
    const g = group(x, y, z, 0, parent);
    lathe(
      [
        [0, 0],
        [0.12, 0.02],
        [0.125, 0.045],
        [0.075, 0.1],
        [0.05, 0.21],
        [0.019, 0.25],
      ],
      0,
      0,
      0,
      m.lampGlaze,
      g,
    );
    cylinder(0.01, 0.01, 0.13, 0, 0.3, 0, m.brass, g);
    lathe(
      [
        [0.22, 0],
        [0.215, 0.018],
        [0.12, 0.27],
        [0.115, 0.28],
      ],
      0,
      0.31,
      0,
      m.shade,
      g,
    );
    sphere(0.025, 0.04, 0.025, 0, 0.36, 0, m.bulb, g);
    g.scale.setScalar(size);
    return g;
  }
  function frame(x, y, z, rotation, map, parent = scene, w = 0.45, h = 0.6) {
    const g = group(x, y, z, rotation, parent);
    slab(w + 0.105, h + 0.105, 0.045, 0, 0, 0, m.wood, g, 0.009);
    box(w + 0.028, h + 0.028, 0.012, 0, 0, 0.027, m.brass, false, g);
    const face = box(
      w,
      h,
      0.006,
      0,
      0,
      0.038,
      new T.MeshStandardMaterial({ map, roughness: 0.65 }),
      false,
      g,
    );
    return { group: g, face };
  }
  function window(x, y, z, rotation, parent = scene, w = 1.15, h = 0.95) {
    const g = group(x, y, z, rotation, parent);
    box(w + 0.13, h + 0.14, 0.07, 0, 0, 0, m.wood, false, g);
    const glassMaterial = new T.MeshPhysicalMaterial({
      map: rainTexture(),
      color: 0x8fa7aa,
      roughness: 0.22,
      metalness: 0.12,
      emissive: 0x243a42,
      emissiveIntensity: 0.2,
    });
    box(w, h, 0.02, 0, 0, 0.05, glassMaterial, false, g);
    for (const sx of [-1, 0, 1])
      box(0.027, h, 0.055, (sx * w) / 2, 0, 0.075, m.windowTrim, false, g);
    for (const sy of [-1, 1])
      box(w, 0.032, 0.055, 0, (sy * h) / 2, 0.075, m.windowTrim, false, g);
    slab(w + 0.2, 0.045, 0.22, 0, -h / 2 - 0.035, 0.11, m.windowTrim, g, 0.008);
    const rail = cylinder(
      0.012,
      0.012,
      w + 0.42,
      0,
      h / 2 + 0.11,
      0.15,
      m.brass,
      g,
    );
    rail.rotation.z = Math.PI / 2;
    for (const side of [-1, 1]) {
      const geometry = new T.PlaneGeometry(w * 0.29, h + 0.24, 14, 22),
        a = geometry.attributes.position;
      for (let i = 0; i < a.count; i++)
        a.setZ(
          i,
          Math.sin(a.getX(i) * 56) * 0.022 + Math.cos(a.getY(i) * 4) * 0.009,
        );
      geometry.computeVertexNormals();
      const curtain = new T.Mesh(geometry, m.curtain);
      curtain.position.set(side * w * 0.43, -0.035, 0.16);
      curtain.castShadow = true;
      g.add(curtain);
      animated.push({ mesh: curtain, side, base: curtain.rotation.y });
    }
    return g;
  }
  function mug(x, y, z, parent = scene, material = m.ceramic) {
    const g = group(x, y, z, 0, parent);
    lathe(
      [
        [0.043, 0],
        [0.05, 0.008],
        [0.055, 0.09],
        [0.052, 0.105],
        [0.045, 0.108],
        [0.043, 0.018],
      ],
      0,
      0,
      0,
      material,
      g,
    );
    const handle = new T.Mesh(
      new T.TorusGeometry(0.038, 0.009, 8, 20, Math.PI * 1.6),
      material,
    );
    handle.position.set(0.057, 0.058, 0);
    handle.rotation.y = Math.PI / 2;
    g.add(handle);
    return g;
  }
  function chair(x, z, rotation, parent = scene) {
    const g = group(x, 0, z, rotation, parent);
    slab(0.42, 0.06, 0.43, 0, 0.45, 0, m.wood, g, 0.025);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        cylinder(0.017, 0.025, 0.43, sx * 0.17, 0.215, sz * 0.17, m.wood, g);
    for (const sx of [-1, 1])
      cylinder(0.021, 0.021, 0.48, sx * 0.17, 0.72, 0.17, m.wood, g);
    for (const x of [-0.09, 0, 0.09])
      cylinder(0.011, 0.011, 0.32, x, 0.72, 0.17, m.wood, g);
    slab(0.42, 0.07, 0.045, 0, 0.94, 0.17, m.wood, g, 0.02);
    g.userData.collider = collision(0.45, 0.9, 0.47, 0, 0.45, 0, g);
    return g;
  }
  function cloth(w, d, x, y, z, material, parent = scene, fold = 0.012) {
    const geometry = new T.PlaneGeometry(w, d, 32, 32),
      a = geometry.attributes.position;
    for (let i = 0; i < a.count; i++)
      a.setZ(
        i,
        Math.sin(a.getX(i) * 31 + a.getY(i) * 5) * fold +
          Math.cos(a.getY(i) * 21) * fold * 0.55,
      );
    geometry.computeVertexNormals();
    const mesh = new T.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  // SITTING ROOM: a two-seat sofa and small furniture leave a narrow but real
  // path from the doorway to the telephone and hospital envelope.
  const lounge = roomGroups.lounge;
  const sofa = group(-3.96, 0, 5.75, -Math.PI / 2, lounge);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      cylinder(0.035, 0.025, 0.14, sx * 0.83, 0.07, sz * 0.32, m.wood, sofa);
  slab(2.02, 0.22, 0.84, 0, 0.24, 0, m.fabric, sofa, 0.095);
  slab(2.04, 0.64, 0.21, 0, 0.72, 0.31, m.fabric, sofa, 0.09);
  for (const side of [-1, 1]) {
    slab(0.19, 0.48, 0.87, side * 0.96, 0.49, 0, m.fabric, sofa, 0.08);
    const cushion = slab(
      0.79,
      0.18,
      0.65,
      side * 0.42,
      0.43,
      -0.055,
      m.fabric,
      sofa,
      0.075,
    );
    cushion.rotation.x = -0.025;
    tube(
      [
        [side * 0.8, 0.505, -0.33],
        [side * 0.04, 0.505, -0.33],
      ],
      0.003,
      m.linen,
      sofa,
    );
  }
  const throwPillow = slab(
    0.44,
    0.42,
    0.13,
    -0.56,
    0.72,
    0.11,
    m.linen,
    sofa,
    0.075,
  );
  throwPillow.rotation.z = -0.12;
  collision(2.16, 0.95, 0.96, 0, 0.48, 0.015, sofa);
  contact(1.3, 2.5, -3.96, 5.75, 0.75, lounge);
  const coffee = table(-2.55, 5.5, 0.82, 1.12, 0.44, lounge);
  const tableMat = cloth(0.56, 0.78, 0, 0.476, 0, m.linen, coffee, 0.003);
  tableMat.castShadow = false;
  const letter = box(
    0.27,
    0.008,
    0.33,
    TARGETS.letter.x,
    TARGETS.letter.y,
    TARGETS.letter.z,
    paper(writingExcerpt(WRITINGS.letter.split("\n\n")[0], 28, 7), 27),
    false,
    lounge,
  );
  letter.rotation.y = 0.07;
  target("letter", letter, "READ HOSPITAL LETTER", 2.35);
  mug(-2.53, 0.479, 5.83, lounge);
  const tvStand = table(-2.8, 3.76, 1.03, 0.48, 0.5, lounge);
  slab(0.7, 0.51, 0.4, 0, 0.805, 0, m.tvBody, tvStand, 0.065);
  const screenCanvas = document.createElement("canvas");
  screenCanvas.width = 192;
  screenCanvas.height = 144;
  const screenCtx = screenCanvas.getContext("2d"),
    screenMap = new T.CanvasTexture(screenCanvas);
  screenMap.colorSpace = T.SRGBColorSpace;
  const tvScreen = slab(
    0.51,
    0.36,
    0.035,
    -0.055,
    0.825,
    0.208,
    new T.MeshBasicMaterial({ map: screenMap, color: 0x728487 }),
    tvStand,
    0.045,
  );
  for (const y of [0.73, 0.9]) {
    const knob = cylinder(
      0.026,
      0.026,
      0.025,
      0.279,
      y,
      0.223,
      m.black,
      tvStand,
    );
    knob.rotation.x = Math.PI / 2;
  }
  tube(
    [
      [-0.15, 1.08, 0],
      [-0.27, 1.35, -0.04],
      [-0.45, 1.47, -0.06],
    ],
    0.005,
    m.steel,
    tvStand,
  );
  const phoneTable = table(
    TARGETS.telephone.x,
    TARGETS.telephone.z,
    0.65,
    0.43,
    0.8,
    lounge,
  );
  const phone = group(0, TARGETS.telephone.y, 0, 0, phoneTable);
  const phoneTarget = slab(0.36, 0.105, 0.27, 0, 0, 0, m.black, phone, 0.035);
  target("telephone", phoneTarget, "LIFT TELEPHONE RECEIVER", 2.3, phone);
  const dial = new T.Mesh(new T.TorusGeometry(0.062, 0.01, 10, 36), m.brass);
  dial.rotation.x = -Math.PI / 2;
  dial.position.set(0, 0.063, -0.015);
  phone.add(dial);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    cylinder(
      0.007,
      0.007,
      0.012,
      Math.cos(a) * 0.048,
      0.072,
      Math.sin(a) * 0.048 - 0.015,
      m.black,
      phone,
      10,
    );
  }
  const receiver = group(0, 0, 0, 0, phone);
  tube(
    [
      [-0.16, 0.12, 0.065],
      [-0.13, 0.16, 0.065],
      [0, 0.18, 0.065],
      [0.13, 0.16, 0.065],
      [0.16, 0.12, 0.065],
    ],
    0.029,
    m.black,
    receiver,
  );
  for (const side of [-1, 1])
    cylinder(0.045, 0.042, 0.035, side * 0.16, 0.115, 0.065, m.black, receiver);
  const cord = [];
  for (let i = 0; i < 96; i++)
    cord.push([
      0.17 + Math.sin(i * 0.67) * 0.012,
      0.1 - i * 0.0053,
      0.06 + Math.cos(i * 0.67) * 0.012,
    ]);
  tube(cord, 0.0035, m.black, phone);
  lamp(-1.22, 0.82, 6.78, lounge, 0.76);
  const family = frame(
    TARGETS.photo.x,
    TARGETS.photo.y,
    TARGETS.photo.z,
    0,
    m.photos[0],
    scene,
    0.62,
    0.72,
  );
  family.group.name = "Entrance-hall family photograph";
  target("photo", family.face, "EXAMINE FAMILY PHOTOGRAPH", 2.35, family.group);
  const photoInteraction = b.interactables.find((item) => item.id === "photo");
  window(-4.4, 1.51, 4.1, Math.PI / 2, lounge, 0.95, 1.05);
  const bookcase = group(-0.96, 0, 3.88, -Math.PI / 2, lounge);
  bookcase.name = "Sitting-room bookcase";
  // A full-depth solid cabinet used to fill the shelves, swallowing the books
  // and leaving their spines intersecting its front face. The actual case has
  // open bays, a thin back and separate stiles inside the same collision bounds.
  slab(0.572, 1.844, 0.018, 0, 0.95, -0.111, m.wood, bookcase, 0.003).name = "Bookcase back";
  for (const side of [-1, 1])
    slab(0.024, 1.9, 0.24, side * 0.298, 0.95, 0, m.wood, bookcase, 0.005).name = "Bookcase side";
  for (const y of [0.014, 1.886])
    slab(0.572, 0.028, 0.24, 0, y, 0, m.wood, bookcase, 0.004).name = "Bookcase cap";
  const bookCovers = [0x372d27, 0x58423b, 0x606050, 0x343f45, 0x887452, 0x4b343a].map(color => {
    const material = m.book.clone();
    material.color.set(color);
    material.roughness = 0.91;
    return material;
  });
  for (let row = 0; row < 4; row++) {
    const shelfY = 0.18 + row * 0.43;
    box(0.572, 0.022, 0.24, 0, shelfY, 0, m.wood, false, bookcase).name = `Bookcase shelf ${row}`;
    for (let i = 0; i < 6; i++) {
      const width = 0.045 + (i % 2) * 0.004;
      const height = 0.21 + (i % 3) * 0.026;
      const tilt = ((i % 3) - 1) * 0.045;
      // Tilting an upright book also lowers its outside corner. Seat that
      // corner on the shelf rather than intersecting the shelf by a centimetre.
      const halfHeight = (height * Math.cos(tilt) + width * Math.abs(Math.sin(tilt))) / 2;
      const book = box(
        width,
        height,
        0.17,
        -0.24 + i * 0.087,
        shelfY + 0.011 + halfHeight + 0.001,
        0.014 + (i % 2) * 0.004,
        bookCovers[(i + row * 2) % bookCovers.length],
        false,
        bookcase,
        0.002,
      );
      book.rotation.z = tilt;
      book.name = `Book ${row}-${i}`;
      // Keep upholstery checks off the book covers. A narrow inset paper edge
      // on top makes the depth of each volume readable from a standing view.
      const pages = box(width - 0.009, 0.0015, 0.144, 0, height / 2 + 0.0003, -0.003,
        m.paper, false, book);
      pages.name = "Book page edge";
      pages.castShadow = false;
    }
  }
  collision(0.66, 1.9, 0.3, 0, 0.95, 0, bookcase);

  // KITCHEN: full-height cupboards, stone worktops and a separate wooden radio.
  const kitchen = roomGroups.kitchen;
  const kitchenCabinets = [], kitchenCupboards = [];
  function cabinet(x, z, rotation, w = 0.72) {
    const g = group(x, 0, z, rotation, kitchen);
    slab(w, 0.84, 0.52, 0, 0.43, 0, m.cabinet, g, 0.012);
    slab(w + 0.035, 0.05, 0.58, 0, 0.92, 0, m.counter, g, 0.012);
    box(w - 0.05, 0.69, 0.018, 0, 0.45, 0.275, m.cabinetFront, false, g, 0.008);
    for (const sx of [-1, 1])
      box(
        0.035,
        0.64,
        0.025,
        sx * (w / 2 - 0.065),
        0.45,
        0.293,
        m.cabinetFront,
        false,
        g,
        0.004,
      );
    for (const sy of [-1, 1])
      box(
        w - 0.13,
        0.034,
        0.025,
        0,
        0.45 + sy * 0.285,
        0.293,
        m.cabinetFront,
        false,
        g,
        0.004,
      );
    box(0.13, 0.018, 0.044, 0, 0.7, 0.315, m.steel, false, g, 0.006);
    collision(w, 0.95, 0.59, 0, 0.47, 0, g);
    g.userData.cabinetWidth = w;
    kitchenCabinets.push(g);
    return g;
  }
  for (const z of [-3.85, -3.12, -2.39, -1.66]) cabinet(1.23, z, Math.PI / 2);
  for (const x of [2.0, 2.73, 3.46]) cabinet(x, -4.25, 0);
  cabinet(4.13, -4.25, 0, 0.61);
  const basin = lathe(
    [
      [0, -0.15],
      [0.15, -0.14],
      [0.27, -0.055],
      [0.32, 0.01],
      [0.335, 0.027],
    ],
    2.7,
    0.94,
    -4.22,
    m.steel,
    kitchen,
  );
  basin.scale.z = 0.74;
  cylinder(0.045, 0.045, 0.005, 2.7, 0.807, -4.22, m.black, kitchen);
  tube(
    [
      [2.7, 0.96, -4.43],
      [2.7, 1.21, -4.43],
      [2.7, 1.27, -4.23],
      [2.7, 1.13, -4.14],
    ],
    0.017,
    m.steel,
    kitchen,
  );
  window(2.65, 1.56, -4.49, 0, kitchen, 1.18, 0.94);
  slab(0.54, 0.055, 0.22, 2.7, 2.27, -2.6, m.enamel, kitchen, 0.02);
  const kitchenDiffuserMaterial = m.bulb.clone();
  slab(
    0.46,
    0.025,
    0.16,
    2.7,
    2.228,
    -2.6,
    kitchenDiffuserMaterial,
    kitchen,
    0.025,
  );
  for (const x of [1.22, 4.08]) {
    const cupboard = group(x, 1.72, -4.36, 0, kitchen);
    kitchenCupboards.push(cupboard);
    slab(0.64, 0.6, 0.29, 0, 0, 0, m.cabinet, cupboard, 0.018);
    box(0.59, 0.55, 0.02, 0, 0, 0.163, m.cabinetFront, false, cupboard, 0.01);
    box(
      0.09,
      0.015,
      0.035,
      0.15,
      -0.19,
      0.182,
      m.steel,
      false,
      cupboard,
      0.004,
    );
  }
  const radio = group(
    TARGETS.radio.x,
    TARGETS.radio.y,
    TARGETS.radio.z,
    Math.PI / 2,
    kitchen,
  );
  const radioBody = slab(0.61, 0.32, 0.23, 0, 0, 0, m.wood, radio, 0.045);
  target("radio", radioBody, "TURN KITCHEN RADIO OFF", 2.35, radio);
  const grille = new T.MeshStandardMaterial({
    map: radioGrille(),
    roughness: 0.94,
    color: 0xafa38a,
  });
  slab(0.31, 0.225, 0.014, -0.105, 0, 0.128, grille, radio, 0.012);
  const tuningMaterial = new T.MeshStandardMaterial({
    map: writingTexture(["FM · VALLEY SERVICE", "88    94    108", "88.0"], {
      background: "#30382e",
      color: "#c9b990",
      font: 34,
    }),
    roughness: 0.28,
    emissive: 0x776239,
    emissiveIntensity: 0,
  });
  box(0.19, 0.08, 0.012, 0.18, 0.06, 0.13, tuningMaterial, false, radio);
  const radioKnob = group(0.13, -0.073, 0.145, 0, radio);
  for (const x of [0, 0.1]) {
    const knob = cylinder(0.026, 0.026, 0.028, x, 0, 0, m.black, radioKnob);
    knob.rotation.x = Math.PI / 2;
    box(0.005, 0.017, 0.004, x, 0.011, 0.018, m.brass, false, radioKnob);
  }
  const aerial = cylinder(
    0.0035,
    0.0035,
    0.4,
    0.2,
    0.35,
    -0.07,
    m.steel,
    radio,
  );
  aerial.rotation.z = -0.17;
  const fuseGroup = group(
    TARGETS.fuse.x,
    TARGETS.fuse.y - 0.025,
    TARGETS.fuse.z,
    0,
    kitchen,
  );
  const fuse = cylinder(0.019, 0.019, 0.1, 0, 0, 0, m.ceramic, fuseGroup);
  fuse.rotation.z = Math.PI / 2;
  for (const x of [-0.05, 0.05]) {
    const cap = cylinder(0.021, 0.021, 0.018, x, 0, 0, m.brass, fuseGroup);
    cap.rotation.z = Math.PI / 2;
  }
  const fuseTarget = box(
    0.19,
    0.09,
    0.17,
    0,
    0.025,
    0,
    m.invisible,
    false,
    fuseGroup,
  );
  target("fuse", fuseTarget, "TAKE CERAMIC FUSE", 2.3, fuseGroup);
  const fridge = group(4.05, 0, -1.37, -Math.PI / 2, kitchen);
  slab(0.69, 1.7, 0.62, 0, 0.855, 0, m.enamel, fridge, 0.045);
  slab(0.655, 1.1, 0.035, 0, 1.095, 0.33, m.enamel, fridge, 0.024);
  slab(0.655, 0.45, 0.035, 0, 0.295, 0.33, m.enamel, fridge, 0.024);
  slab(0.024, 0.32, 0.065, -0.25, 1.2, 0.38, m.black, fridge, 0.01);
  box(
    0.25,
    0.29,
    0.004,
    0.04,
    1.18,
    0.354,
    paper(["SPARES", "BY THE SINK"], 40),
    false,
    fridge,
  );
  collision(0.72, 1.7, 0.7, 0, 0.85, 0, fridge);
  const dining = table(3.84, -3.0, 0.79, 0.67, 0.74, kitchen);
  const invertedChair = chair(3.0, -2.95, -Math.PI / 2, kitchen);
  cylinder(0.15, 0.15, 0.013, 0, 0.78, 0, m.ceramic, dining);
  mug(3.85, 0.78, -3.23, kitchen);
  const kitchenFrequency = createKitchenFrequency(kitchen, b, {
    fridge, cabinets: kitchenCabinets, cupboards: kitchenCupboards,
  });
  const hallBlood = createHallBlood(scene);

  // BATHROOM: sanitary fittings constrain movement naturally while the target
  // side of the sink and the mirror remain reachable from the room's centre.
  const bathroom = roomGroups.bathroom;
  const tub = lathe(
    [
      [0, 0.1],
      [0.2, 0.1],
      [0.37, 0.17],
      [0.45, 0.43],
      [0.48, 0.54],
      [0.455, 0.59],
      [0.42, 0.58],
      [0.37, 0.44],
      [0.24, 0.21],
      [0, 0.2],
    ],
    3.22,
    0,
    3.05,
    m.ceramic,
    bathroom,
  );
  tub.scale.set(0.94, 1, 1.9);
  collision(0.94, 0.6, 1.9, 3.22, 0.3, 3.05, bathroom);
  contact(1.15, 2.15, 3.22, 3.05, 0.5, bathroom);
  const water = new T.Mesh(new T.CircleGeometry(0.35, 64), m.water);
  water.rotation.x = -Math.PI / 2;
  water.scale.y = 2.1;
  water.position.set(3.22, 0.345, 3.05);
  bathroom.add(water);
  tube(
    [
      [3.22, 0.55, 3.92],
      [3.22, 0.85, 3.92],
      [3.22, 0.92, 3.71],
    ],
    0.018,
    m.steel,
    bathroom,
  );
  const curtainGeo = new T.PlaneGeometry(1.56, 1.38, 36, 36),
    ca = curtainGeo.attributes.position;
  for (let i = 0; i < ca.count; i++)
    ca.setZ(
      i,
      Math.sin(ca.getX(i) * 31) * 0.028 + Math.sin(ca.getY(i) * 6) * 0.008,
    );
  curtainGeo.computeVertexNormals();
  const curtainMat = m.curtain.clone();
  curtainMat.transparent = true;
  curtainMat.opacity = 0.88;
  curtainMat.side = T.DoubleSide;
  const bathCurtain = new T.Mesh(curtainGeo, curtainMat);
  bathCurtain.position.set(2.66, 1.46, 3.34);
  bathCurtain.rotation.y = Math.PI / 2;
  bathCurtain.castShadow = true;
  bathroom.add(bathCurtain);
  tube(
    [
      [2.67, 2.18, 2.55],
      [2.67, 2.18, 4.12],
    ],
    0.012,
    m.steel,
    bathroom,
  );
  for (let i = 0; i < 8; i++) {
    const ring = new T.Mesh(new T.TorusGeometry(0.023, 0.004, 6, 16), m.steel);
    ring.position.set(2.66, 2.16, 2.62 + i * 0.19);
    ring.rotation.y = Math.PI / 2;
    bathroom.add(ring);
  }
  const sink = lathe(
    [
      [0, -0.12],
      [0.13, -0.11],
      [0.24, -0.015],
      [0.32, 0.08],
      [0.33, 0.13],
      [0.295, 0.15],
      [0.24, 0.07],
      [0, 0.015],
    ],
    2.48,
    0.85,
    1.35,
    m.ceramic,
    bathroom,
  );
  sink.scale.z = 0.82;
  lathe(
    [
      [0.11, 0],
      [0.09, 0.3],
      [0.07, 0.59],
      [0.12, 0.73],
    ],
    2.48,
    0,
    1.35,
    m.ceramic,
    bathroom,
  );
  collision(0.69, 0.9, 0.65, 2.48, 0.45, 1.35, bathroom);
  const tap = tube(
    [
      [2.48, 1.0, 1.21],
      [2.48, 1.14, 1.21],
      [2.48, 1.16, 1.37],
    ],
    0.016,
    m.steel,
    bathroom,
  );
  target("tap", tap, "INSPECT RUNNING TAP", 2.3);
  const tapTarget = box(
    0.28,
    0.24,
    0.27,
    TARGETS.tap.x,
    TARGETS.tap.y,
    TARGETS.tap.z,
    m.invisible,
    false,
    bathroom,
  );
  target("tap", tapTarget, "INSPECT RUNNING TAP", 2.3);
  const stream = cylinder(
    0.0035,
    0.0025,
    0.15,
    2.48,
    1.045,
    1.365,
    m.water,
    bathroom,
    10,
  );
  // Thin backing and fitted rim meet the tiled wall; the live glass is flush
  // with the rim, with no floating opaque clue panel in front of it.
  box(
    0.97,
    0.78,
    0.02,
    2.15,
    1.7,
    0.98,
    m.steel,
    false,
    bathroom,
    0.009,
  );
  const bathroomMirror = createBathroomMirror(bathroom);
  const bathroomGlass = bathroomMirror.glass;
  target("bath-clue", bathroomGlass, "WIPE THE FOGGED GLASS", 2.35);
  slab(0.46, 0.055, 0.045, 2.15, 2.13, 1.01, m.steel, bathroom, 0.014);
  const sconce = cylinder(
    0.027,
    0.027,
    0.41,
    2.15,
    2.13,
    1.055,
    m.bulb,
    bathroom,
  );
  sconce.rotation.z = Math.PI / 2;
  for (const x of [1.94, 2.36])
    sphere(0.035, 0.035, 0.042, x, 2.13, 1.055, m.steel, bathroom);
  lathe(
    [
      [0.12, 0],
      [0.1, 0.16],
      [0.21, 0.32],
      [0.22, 0.39],
      [0.18, 0.43],
    ],
    1.38,
    0,
    3.55,
    m.ceramic,
    bathroom,
  );
  const toiletSeat = new T.Mesh(
    new T.TorusGeometry(0.205, 0.028, 12, 40),
    m.ceramic,
  );
  toiletSeat.rotation.x = Math.PI / 2;
  toiletSeat.scale.y = 1.18;
  toiletSeat.position.set(1.38, 0.445, 3.55);
  bathroom.add(toiletSeat);
  slab(0.43, 0.5, 0.2, 1.38, 0.69, 3.96, m.ceramic, bathroom, 0.055);
  collision(0.49, 0.9, 0.8, 1.38, 0.45, 3.64, bathroom);
  window(3.69, 1.55, 2.96, -Math.PI / 2, bathroom, 0.9, 0.82);

  // BEDROOM: single bed and fitted wardrobe, with room for Mara to approach
  // either bedside target and the final farewell at the foot of the bed.
  const bedroom = roomGroups.bedroom;
  const bed = group(7.4, 0, -3.28, 0, bedroom);
  slab(1.5, 0.24, 2.08, 0, 0.22, 0, m.wood, bed, 0.035);
  slab(1.43, 0.22, 2.0, 0, 0.45, 0, m.linen, bed, 0.095);
  slab(1.54, 0.98, 0.1, 0, 0.57, -1.03, m.wood, bed, 0.03);
  for (const x of [-0.36, 0.36]) {
    const pillow = slab(0.57, 0.16, 0.4, x, 0.64, -0.63, m.linen, bed, 0.075);
    pillow.rotation.y = x * 0.1;
  }
  const quiltGeo = new T.PlaneGeometry(1.67, 1.65, 40, 40),
    qa = quiltGeo.attributes.position;
  for (let i = 0; i < qa.count; i++) {
    const x = qa.getX(i),
      y = qa.getY(i);
    qa.setZ(
      i,
      0.011 * Math.sin(x * 29 + y * 7) +
        0.008 * Math.cos(y * 22) -
        Math.max(0, Math.abs(x) - 0.7) * 1.6 -
        Math.max(0, -y - 0.73) * 1.2,
    );
  }
  quiltGeo.computeVertexNormals();
  const quilt = new T.Mesh(quiltGeo, m.blanket);
  quilt.rotation.x = -Math.PI / 2;
  quilt.position.set(0, 0.67, 0.16);
  quilt.castShadow = quilt.receiveShadow = true;
  bed.add(quilt);
  const quiltBase = Float32Array.from(qa.array);
  const quiltWeight = Float32Array.from({ length: qa.count }, (_, i) =>
    Math.exp(-((qa.getX(i) / .23) ** 2 + ((qa.getY(i) + .1) / .68) ** 2)));
  collision(1.57, 0.8, 2.12, 0, 0.4, 0, bed);
  contact(1.9, 2.4, 7.4, -3.28, 0.65, bedroom);
  const nightstand = table(8.58, -3.45, 0.5, 0.5, 0.69, bedroom);
  const bedsideLamp = lamp(8.64, 0.72, -3.65, bedroom, 0.73);
  const diary = box(
    0.28,
    0.024,
    0.21,
    TARGETS.diary.x,
    TARGETS.diary.y,
    TARGETS.diary.z,
    paper(writingExcerpt(WRITINGS.diary, 30, 7), 26),
    false,
    bedroom,
    0.008,
  );
  diary.rotation.y = -0.12;
  target("diary", diary, "READ BEDSIDE DIARY", 2.35);
  const musicTable = table(5.25, -3.95, 0.72, 0.47, 0.71, bedroom),
    music = group(0, TARGETS.musicbox.y, 0, 0, musicTable);
  const musicBase = slab(0.32, 0.12, 0.22, 0, 0, 0, m.wood, music, 0.02);
  target("musicbox", musicBase, "LISTEN TO MUSIC BOX", 2.35, music);
  const musicLid = group(-0.16, 0.07, 0, 0, music);
  slab(0.32, 0.02, 0.22, 0.16, 0, 0, m.wood, musicLid, 0.008);
  const musicFigurine = group(0, 0, 0, 0, music);
  musicFigurine.name = "Music box figurine";
  cylinder(0.015, 0.023, 0.055, 0, 0.116, 0, m.ceramic, musicFigurine);
  cylinder(0.034, 0.02, 0.012, 0, 0.091, 0, m.linen, musicFigurine);
  sphere(0.014, 0.017, 0.014, 0, 0.159, 0, m.ceramic, musicFigurine);
  for (const side of [-1, 1])
    tube(
      [
        [side * 0.01, 0.133, 0],
        [side * 0.033, 0.143, 0],
        [side * 0.029, 0.164, 0],
      ],
      0.0035,
      m.ceramic,
      musicFigurine,
    );
  const wardrobe = group(5.14, 0, -1.65, Math.PI / 2, bedroom);
  slab(1.0, 1.98, 0.56, 0, 0.99, 0, m.wood, wardrobe, 0.025);
  box(0.9, 1.83, 0.015, 0, 1, 0.295, m.black, false, wardrobe);
  const wardrobeDoor = group(-0.46, 0, 0.3, 0.27, wardrobe);
  slab(0.445, 1.87, 0.028, 0.222, 1, 0, m.wood, wardrobeDoor, 0.015);
  slab(0.43, 1.87, 0.028, 0.23, 1, 0.31, m.wood, wardrobe, 0.012);
  box(0.02, 0.09, 0.035, 0.05, 1, 0.335, m.brass, false, wardrobe);
  collision(1.04, 1.98, 0.66, 0, 0.99, 0, wardrobe);
  window(7.4, 1.62, -4.49, 0, bedroom, 1.1, 0.94);

  // UTILITY: fuse board, conduit, washing machine and narrow storage shelving.
  const utility = roomGroups.utility;
  slab(0.29, 0.05, 0.23, -2, 2.27, 1.8, m.enamel, utility, 0.018);
  sphere(0.13, 0.055, 0.1, -2, 2.22, 1.8, m.bulb, utility);
  const panelGroup = group(
    TARGETS.panel.x,
    TARGETS.panel.y,
    TARGETS.panel.z,
    Math.PI / 2,
    utility,
  );
  const panel = slab(0.47, 0.65, 0.1, 0, 0, 0, m.rust, panelGroup, 0.02);
  target("panel", panel, "INSPECT FUSE BOX", 2.35, panelGroup);
  box(0.39, 0.55, 0.018, 0, 0, 0.064, m.black, false, panelGroup);
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 2; col++) {
      box(
        0.11,
        0.09,
        0.025,
        -0.11 + col * 0.22,
        0.16 - row * 0.16,
        0.085,
        m.enamel,
        false,
        panelGroup,
        0.007,
      );
      box(
        0.025,
        0.045,
        0.035,
        -0.11 + col * 0.22,
        0.16 - row * 0.16,
        0.11,
        m.black,
        false,
        panelGroup,
      );
    }
  const fuseGlow = sphere(
    0.014,
    0.014,
    0.006,
    0.17,
    -0.25,
    0.125,
    m.redBulb,
    panelGroup,
  );
  tube(
    [
      [-3.28, 1.84, 1.85],
      [-3.28, 2.18, 1.85],
      [-1.2, 2.18, 1.85],
      [-1.2, 2.18, 0.88],
    ],
    0.012,
    m.steel,
    utility,
  );
  const washer = group(-2.85, 0, 2.65, 0, utility);
  slab(0.65, 0.85, 0.64, 0, 0.43, 0, m.enamel, washer, 0.035);
  const washerRing = new T.Mesh(
    new T.TorusGeometry(0.205, 0.035, 14, 48),
    m.steel,
  );
  washerRing.position.set(0, 0.39, -0.337);
  washerRing.rotation.y = Math.PI;
  washer.add(washerRing);
  const washerGlass = new T.Mesh(
    new T.CircleGeometry(0.175, 48),
    m.foggedGlass,
  );
  washerGlass.position.set(0, 0.39, -0.343);
  washerGlass.rotation.y = Math.PI;
  washer.add(washerGlass);
  for (const x of [-0.2, 0.17]) {
    const knob = cylinder(
      0.024,
      0.024,
      0.02,
      x,
      0.745,
      -0.335,
      m.black,
      washer,
    );
    knob.rotation.x = Math.PI / 2;
  }
  collision(0.69, 0.86, 0.68, 0, 0.43, 0, washer);
  const shelf = group(-2.05, 0, 1.0, 0, utility);
  shelf.name = "Utility storage rack";
  for (const x of [-0.55, 0.55])
    box(0.025, 1.96, 0.3, x, 0.98, 0, m.steel, false, shelf);
  for (let row = 0; row < 4; row++) {
    const shelfY = 0.2 + row * 0.45;
    box(1.15, 0.023, 0.34, 0, shelfY, 0, m.wood, false, shelf).name = `Utility shelf ${row}`;
    for (let i = 0; i < 3; i++)
      slab(
        0.23,
        0.2,
        0.24,
        -0.37 + i * 0.36,
        shelfY + 0.0115 + 0.1 + 0.001,
        0,
        [m.paper, m.rust, m.cabinet][i],
        shelf,
        0.01,
      ).name = `Storage box ${row}-${i}`;
  }
  collision(1.18, 1.96, 0.36, 0, 0.98, 0, shelf);

  const puzzle = addPuzzleProps(b, m, roomGroups, { diary, bedsideLamp });
  let shownFrequency = 88,
    lastStage = 0,
    lastTime = 0,
    quiltFrame = -1,
    quiltAmplitude = null;
  const televisionNoise = screenCtx.createImageData(192, 144);
  function reset() {
    puzzle.reset();
    kitchenFrequency.reset();
    hallBlood.reset();
    receiver.position.set(0, 0, 0);
    receiver.rotation.set(0, 0, 0);
    radioKnob.rotation.z = 0;
    tuningMaterial.emissiveIntensity = 0;
    invertedChair.position.y = 0;
    invertedChair.rotation.z = 0;
    invertedChair.userData.collider.disabled = false;
    qa.array.set(quiltBase);
    qa.needsUpdate = true;
    quiltGeo.computeVertexNormals();
    bathCurtain.rotation.y = Math.PI / 2;
    musicFigurine.visible = true;
    family.group.rotation.z = 0;
    bathroomMirror.setClueVisible(false);
    lastStage = 0;
    lastTime = 0;
    quiltFrame = -1;
    quiltAmplitude = null;
  }
  function animate(time, state, player) {
    if (time < lastTime || (state.stage === 0 && lastStage > 0)) reset();
    const animationDt = Math.max(0, Math.min(time - lastTime, 0.1));
    if (state.stage === 1 && lastStage !== 1 && !state.photoStraightened)
      family.group.rotation.z = -0.135;
    lastTime = time;
    lastStage = state.stage;
    const frameNumber = Math.floor(time * 10);
    if (frameNumber !== animate.lastFrame) {
      animate.lastFrame = frameNumber;
      const im = televisionNoise;
      for (let i = 0; i < im.data.length; i += 4) {
        const v = (Math.random() * 22 + 5) * (state.stage >= 3 ? 0.1 : 1);
        im.data[i] = v * 0.8;
        im.data[i + 1] = v;
        im.data[i + 2] = v * 0.95;
        im.data[i + 3] = 255;
      }
      screenCtx.putImageData(im, 0, 0);
      screenMap.needsUpdate = true;
    }
    for (const a of animated)
      a.mesh.rotation.y = a.base + Math.sin(time * 0.23 + a.side) * 0.008;
    const inverted = state.inverted || state.stage >= 6;
    invertedChair.position.y = inverted ? 2.08 : 0;
    invertedChair.rotation.z = inverted ? Math.PI : 0;
    invertedChair.userData.collider.disabled = inverted;
    stream.visible = !(state.stage >= 4 && state.echoIndex >= 2);
    if (state.stage >= 2) {
      const frame = Math.floor(time * 30);
      const amplitude = state.farewellSaid ? 0 : .09 + Math.sin(time * 1.3) * .005;
      // This millimetre-scale breathing needs no per-frame exponentials or
      // repeated normal uploads after it has become still.
      if (frame !== quiltFrame && amplitude !== quiltAmplitude) {
        for (let i = 0; i < qa.count; i++)
          qa.setZ(i, quiltBase[i * 3 + 2] + quiltWeight[i] * amplitude);
        qa.needsUpdate = true;
        quiltGeo.computeVertexNormals();
        quiltFrame = frame;
        quiltAmplitude = amplitude;
      }
    }
    const on =
      state.power &&
      state.radioOn &&
      !(state.stage >= 4 && state.echoIndex >= 3);
    tuningMaterial.emissiveIntensity = on ? 0.6 : 0;
    const frequency = state.radioFrequency ?? 88;
    if (shownFrequency !== frequency) {
      const previous = tuningMaterial.map;
      tuningMaterial.map = writingTexture(
        ["FM · VALLEY SERVICE", "88    94    108", frequency.toFixed(1)],
        { background: "#30382e", color: "#c9b990", font: 34 },
      );
      previous.dispose();
      shownFrequency = frequency;
    }
    kitchenDiffuserMaterial.color.set(state.power ? 0xe6e2c8 : 0x101411);
    radioKnob.rotation.z = on ? ((frequency - 88) / 20 - 0.5) * 1.7 : 0.35;
    const offHook = time < state.phoneLiftUntil;
    receiver.position.set(
      offHook ? -0.05 : 0,
      offHook ? 0.23 : 0,
      offHook ? -0.02 : 0,
    );
    receiver.rotation.z = offHook ? -0.18 : 0;
    family.face.material.map = m.photos[state.stage >= 2 ? 1 : 0];
    // A real wall-mounted frame settles around its hanging point when fixed;
    // no screen overlay or instant texture substitution stands in for the act.
    family.group.rotation.z = T.MathUtils.damp(
      family.group.rotation.z,
      state.stage === 1 && !state.photoStraightened ? -0.135 : 0,
      5.5,
      animationDt,
    );
    photoInteraction.label = state.stage === 1 && !state.photoStraightened
      ? "STRAIGHTEN FAMILY PHOTOGRAPH"
      : "EXAMINE FAMILY PHOTOGRAPH";
    tvScreen.material.color.set(state.power ? 0x728487 : 0x030504);
    tvScreen.material.map = state.stage >= 4 ? m.photos[1] : screenMap;
    bathroomMirror.setClueVisible(state.stage >= 2);
    kitchenFrequency.animate(state);
    hallBlood.animate(state);
    fuseGroup.visible = !state.hasFuse && !state.power;
    fuseGlow.material = state.power ? m.greenBulb : m.redBulb;
    const musicClosed = state.stage >= 4 && state.echoIndex >= 1;
    musicFigurine.visible = !musicClosed;
    musicLid.rotation.z = musicClosed ? 0 : 0.58 + Math.sin(time * 0.7) * 0.008;
    water.material.opacity = 0.5 + Math.sin(time * 0.4) * 0.018;
    bathCurtain.rotation.y = Math.PI / 2 + Math.sin(time * 0.35) * 0.009;
    wardrobeDoor.rotation.y = state.stage >= 3 ? 0.38 : 0.27;
    puzzle.animate(time, state, player);
  }
  return {
    roomGroups,
    animated,
    animate,
    reset,
    window,
    frame,
    lamp,
    table,
    mug,
    cloth,
    telephone: phone,
    receiver,
    radio,
    kitchenFrequency,
    hallBlood,
    letter,
    family,
    diary,
    fuse: fuseTarget,
    panel,
    musicBase,
    tap,
    bathroomMirror,
    bathCurtain,
    wardrobeDoor,
    bed,
    puzzle,
    bedsideLamp,
  };
}

function writingExcerpt(text, width = 30, limit = 7) {
  const words = text.split(/\s+/),
    lines = [];
  let line = "";
  for (const word of words) {
    if (line.length + word.length + 1 > width) {
      lines.push(line);
      line = "";
    }
    line += (line ? " " : "") + word;
    if (lines.length >= limit) return lines;
  }
  if (line) lines.push(line);
  return lines.slice(0, limit);
}
