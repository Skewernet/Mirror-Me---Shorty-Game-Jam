import * as T from "three";

// Domestic clutter is authored at the new house's actual dimensions. It never
// adds invisible navigation obstacles or changes a story interaction's target.
export function dressHouse(b, m, surfaces, furnishings) {
  const { box, cylinder, sphere, lathe, tube, group, plane, contact, scene } =
    b;
  const events = [],
    groups = Object.fromEntries(
      ["entry", "lounge", "kitchen", "bathroom", "bedroom", "utility"].map(
        (id) => [id, group()],
      ),
    );
  const { entry, lounge, kitchen, bathroom, bedroom, utility } = groups;
  const cloth = surfaces.material("linen", 1.5, 2, 0x73776b);
  cloth.side = T.DoubleSide;
  const shoeMaterial = new T.MeshStandardMaterial({
    color: 0x382b25,
    roughness: 0.72,
  });
  const blueCeramic = new T.MeshStandardMaterial({
    color: 0x6b827d,
    roughness: 0.31,
  });
  const terracotta = new T.MeshStandardMaterial({
    color: 0x80624d,
    roughness: 0.92,
  });
  const leafMaterial = new T.MeshStandardMaterial({
    color: 0x414e38,
    roughness: 0.9,
    side: T.DoubleSide,
  });

  // The coat hangs against the entry wall: sleeves, seams, drape and boots
  // suggest a resident without consuming the centre of a 1.28m passage.
  const rack = group(0.52, 1.98, 6.16, -Math.PI / 2, entry);
  box(0.62, 0.09, 0.035, 0, 0, 0, m.wood, false, rack, 0.012);
  for (const x of [-0.22, 0, 0.22])
    tube(
      [
        [x, 0.025, 0.02],
        [x, -0.035, 0.065],
        [x, -0.015, 0.09],
      ],
      0.006,
      m.brass,
      rack,
    );
  const coat = group(0, -0.11, 0.07, 0, rack);
  const coatGeo = new T.PlaneGeometry(0.41, 0.84, 16, 22),
    a = coatGeo.attributes.position;
  for (let i = 0; i < a.count; i++)
    a.setZ(
      i,
      Math.sin(a.getX(i) * 43) * 0.018 + Math.cos(a.getY(i) * 8) * 0.01,
    );
  coatGeo.computeVertexNormals();
  const coatMesh = new T.Mesh(coatGeo, cloth);
  coatMesh.position.y = -0.42;
  coatMesh.castShadow = coatMesh.receiveShadow = true;
  coat.add(coatMesh);
  for (const side of [-1, 1]) {
    const sleeve = box(
      0.105,
      0.53,
      0.09,
      side * 0.225,
      -0.31,
      0,
      cloth,
      false,
      coat,
      0.04,
    );
    sleeve.rotation.z = side * 0.18;
  }
  for (const y of [-0.2, -0.34, -0.48])
    sphere(0.008, 0.008, 0.006, 0.02, y, 0.038, m.black, coat);
  for (const side of [-1, 1]) {
    const boot = sphere(
      0.075,
      0.085,
      0.16,
      0.42,
      0.09,
      6.95 + side * 0.1,
      shoeMaterial,
      entry,
    );
    boot.rotation.y = Math.PI / 2 + side * 0.1;
  }
  contact(0.34, 0.5, 0.42, 6.95, 0.4, entry);

  // Small original studies avoid multiplying the story's family photograph.
  const botanical = botanicalTexture(),
    gallery = [];
  for (const [x, y, z, rot, w, h] of [
    [-0.55, 1.66, 6.07, Math.PI / 2, 0.32, 0.46],
    [0.53, 1.73, 4.05, -Math.PI / 2, 0.3, 0.41],
    [3.55, 1.62, 0.535, Math.PI, 0.32, 0.45],
    [5.93, 1.58, 0.535, Math.PI, 0.34, 0.48],
    [-3.15, 1.6, 7.38, Math.PI, 0.36, 0.48],
    [5.3, 1.63, -4.49, 0, 0.34, 0.43],
  ])
    gallery.push(furnishings.frame(x, y, z, rot, botanical, scene, w, h));
  const fallingFrame = gallery[3].group,
    frameStart = fallingFrame.position.clone(),
    frameRotation = fallingFrame.rotation.clone();

  function vase(x, y, z, parent, material = blueCeramic) {
    const g = group(x, y, z, 0, parent);
    lathe(
      [
        [0.05, 0],
        [0.065, 0.025],
        [0.095, 0.12],
        [0.058, 0.21],
        [0.038, 0.24],
        [0.04, 0.25],
      ],
      0,
      0,
      0,
      material,
      g,
    );
    for (let i = 0; i < 3; i++) {
      const tip = [(i - 1) * 0.075, 0.43 + (i % 2) * 0.06, 0.02 * (i - 1)];
      tube([[0, 0.18, 0], [(i - 1) * 0.03, 0.3, 0.015], tip], 0.003, m.wood, g);
      const leaf = new T.Mesh(new T.SphereGeometry(1, 12, 8), leafMaterial);
      leaf.position.set(tip[0] + 0.025, tip[1] - 0.07, tip[2]);
      leaf.scale.set(0.06, 0.014, 0.024);
      leaf.rotation.z = i * 0.5;
      g.add(leaf);
    }
    return g;
  }
  const loungeVase = vase(-2.83, 0.48, 5.12, lounge);
  loungeVase.scale.setScalar(0.68);
  for (let i = 0; i < 3; i++) {
    const magazine = box(
      0.23,
      0.008,
      0.28,
      -2.66,
      0.48 + i * 0.01,
      5.71,
      [m.paper, m.fabric, m.linen][i],
      false,
      lounge,
      0.003,
    );
    magazine.rotation.y = -0.09 + i * 0.12;
  }
  // Visible pleated shade matches the sitting room's second practical light.
  const floorLamp = group(-4.04, 0, 7.02, 0, lounge);
  lathe(
    [
      [0, 0],
      [0.19, 0.015],
      [0.2, 0.035],
      [0.17, 0.06],
      [0, 0.06],
    ],
    0,
    0,
    0,
    m.brass,
    floorLamp,
  );
  cylinder(0.015, 0.018, 1.55, 0, 0.82, 0, m.brass, floorLamp);
  lathe(
    [
      [0.27, 0],
      [0.265, 0.025],
      [0.17, 0.31],
      [0.165, 0.325],
    ],
    0,
    1.46,
    0,
    m.shade,
    floorLamp,
  );
  sphere(0.028, 0.035, 0.028, 0, 1.66, 0, m.bulb, floorLamp);
  const fern = vase(-4.18, 0.99, 4.43, lounge, terracotta);
  fern.scale.set(0.8, 0.85, 0.8);

  // The radio and black rotary telephone remain visually different objects in
  // different rooms. Small kitchen details frame the radio without hiding it.
  furnishings.frame(
    4.39,
    1.55,
    -2.5,
    -Math.PI / 2,
    calendarTexture(),
    kitchen,
    0.34,
    0.45,
  );
  for (let i = 0; i < 3; i++) {
    const h = 0.13 + i * 0.03,
      x = 3.3 + i * 0.2;
    cylinder(0.053, 0.053, h, x, 0.95 + h / 2, -4.36, m.ceramic, kitchen);
    cylinder(0.056, 0.056, 0.018, x, 0.959 + h, -4.36, m.wood, kitchen);
  }
  const rackBase = box(
    0.42,
    0.025,
    0.25,
    3.65,
    0.967,
    -4.11,
    m.steel,
    false,
    kitchen,
    0.008,
  );
  for (let i = 0; i < 4; i++) {
    const plate = cylinder(
      0.105,
      0.105,
      0.012,
      3.49 + i * 0.09,
      1.06,
      -4.11,
      m.ceramic,
      kitchen,
    );
    plate.rotation.z = Math.PI * 0.4;
    tube(
      [
        [3.47 + i * 0.09, 0.98, -4.23],
        [3.47 + i * 0.09, 1.1, -4.16],
        [3.47 + i * 0.09, 0.98, -3.99],
      ],
      0.003,
      m.steel,
      kitchen,
    );
  }
  const teaTowel = furnishings.cloth(
    0.29,
    0.43,
    1.44,
    0.95,
    -3.03,
    surfaces.material("linen", 1, 1, 0xb0aa91),
    kitchen,
    0.006,
  );
  const looseCup = furnishings.mug(1.41, 0.95, -1.53, kitchen, blueCeramic),
    cupStart = looseCup.position.clone();
  const breadBoard = box(
    0.24,
    0.015,
    0.32,
    4.09,
    0.782,
    -2.93,
    m.wood,
    false,
    kitchen,
    0.018,
  );
  breadBoard.rotation.y = 0.13;
  for (let i = 0; i < 3; i++) {
    const slice = box(
      0.09,
      0.016,
      0.11,
      4.09 + i * 0.008,
      0.8 + i * 0.017,
      -2.93,
      m.paper,
      false,
      kitchen,
      0.025,
    );
    slice.rotation.y = 0.13;
  }

  // Fittings carry plausible personal objects, all clear of the sink's clue and
  // taps. Nothing occupies the narrow approach through the bathroom doorway.
  cylinder(0.045, 0.037, 0.105, 2.7, 1.035, 1.31, blueCeramic, bathroom);
  for (let i = 0; i < 2; i++) {
    const brush = cylinder(
      0.004,
      0.004,
      0.18,
      2.69 + i * 0.026,
      1.15,
      1.31,
      m.enamel,
      bathroom,
      10,
    );
    brush.rotation.z = (i - 0.5) * 0.17;
    box(
      0.014,
      0.035,
      0.01,
      2.69 + i * 0.026,
      1.23,
      1.31,
      m.linen,
      false,
      bathroom,
      0.003,
    );
  }
  box(
    0.13,
    0.025,
    0.075,
    2.25,
    0.998,
    1.3,
    m.lampGlaze,
    false,
    bathroom,
    0.025,
  );
  const rail = group(0.87, 1.05, 3.48, Math.PI / 2, bathroom);
  tube(
    [
      [-0.26, 0, 0],
      [-0.26, 0, 0.05],
      [0.26, 0, 0.05],
      [0.26, 0, 0],
    ],
    0.009,
    m.steel,
    rail,
  );
  const towelGeo = new T.PlaneGeometry(0.39, 0.55, 16, 20),
    ta = towelGeo.attributes.position;
  for (let i = 0; i < ta.count; i++)
    ta.setZ(i, Math.sin(ta.getX(i) * 38) * 0.009);
  towelGeo.computeVertexNormals();
  const towel = new T.Mesh(towelGeo, m.linen);
  towel.material.side = T.DoubleSide;
  towel.position.set(0, -0.26, 0.065);
  towel.castShadow = true;
  rail.add(towel);
  cylinder(0.035, 0.035, 0.075, 1.45, 0.99, 3.98, m.paper, bathroom);
  cylinder(0.038, 0.038, 0.012, 1.45, 1.034, 3.98, m.enamel, bathroom);

  for (const x of [8.59, 8.76])
    sphere(0.066, 0.032, 0.14, x, 0.038, -2.23, cloth, bedroom);
  cylinder(0.035, 0.03, 0.1, 8.76, 0.773, -3.38, blueCeramic, bedroom);
  for (let i = 0; i < 2; i++) {
    const book = box(
      0.17,
      0.034,
      0.24,
      5.5,
      0.769 + i * 0.034,
      -3.87,
      [m.book, m.linen][i],
      false,
      bedroom,
      0.003,
    );
    book.rotation.y = -0.09 + i * 0.1;
  }
  const sparePillow = box(
    0.4,
    0.13,
    0.31,
    5.15,
    2.05,
    -1.65,
    m.linen,
    false,
    bedroom,
    0.055,
  );
  sparePillow.rotation.z = 0.04;
  for (let i = 0; i < 2; i++) {
    box(
      0.12,
      0.22,
      0.09,
      -2.27 + i * 0.18,
      0.43,
      1.01,
      [m.enamel, terracotta][i],
      false,
      utility,
      0.016,
    );
    cylinder(
      0.021,
      0.021,
      0.025,
      -2.27 + i * 0.18,
      0.552,
      1.01,
      m.black,
      utility,
    );
  }
  const laundry = lathe(
    [
      [0.18, 0],
      [0.19, 0.025],
      [0.22, 0.34],
      [0.23, 0.36],
      [0.215, 0.37],
      [0.205, 0.06],
    ],
    -1.15,
    0,
    2.85,
    surfaces.material("linen", 2, 1, 0x938e78),
    utility,
  );
  const laundryCloth = furnishings.cloth(
    0.38,
    0.37,
    -1.15,
    0.34,
    2.85,
    m.linen,
    utility,
    0.035,
  );
  laundryCloth.rotation.z = 0.1;

  // A small section of the EXISTING south wall becomes a photographic negative.
  // This is a local change on a continuous L-shaped hall, never a return lane or
  // fullscreen flash. It is left of the exit's clear opening.
  const negative = group();
  plane(
    1.22,
    1.22,
    6.03,
    1.64,
    0.553,
    negativeMaterial(surfaces.maps.wallpaper, 1.4, 1),
    Math.PI,
    negative,
  );
  plane(
    1.22,
    0.77,
    6.03,
    0.405,
    0.553,
    negativeMaterial(surfaces.maps.panel, 1.8, 1),
    Math.PI,
    negative,
  );
  const negativeRunner = plane(
    1.5,
    0.57,
    6,
    0.011,
    0,
    negativeMaterial(surfaces.maps.fabric, 2, 1),
    0,
    negative,
  );
  negativeRunner.rotation.x = -Math.PI / 2;
  negativeRunner.castShadow = false;
  const underlight = new T.PointLight(0xa7c7d5, 0, 2.1, 2);
  underlight.position.set(6, 0.22, 0.43);
  scene.add(underlight);
  negative.visible = false;
  let frameAt = null,
    cupAt = null,
    frameImpact = false,
    cupImpact = false,
    lastTime = -1,
    lastStage = 0;
  function reset() {
    events.length = 0;
    frameAt = cupAt = null;
    frameImpact = cupImpact = false;
    lastTime = -1;
    lastStage = 0;
    fallingFrame.position.copy(frameStart);
    fallingFrame.rotation.copy(frameRotation);
    looseCup.position.copy(cupStart);
    looseCup.rotation.set(0, 0, 0);
    loungeVase.rotation.z = 0;
    loungeVase.position.y = 0.48;
    Object.values(groups).forEach((g) => (g.visible = true));
    gallery.forEach((f) => f.face.material.color.set(0xffffff));
    negative.visible = false;
    underlight.intensity = 0;
  }
  function animate(time, state, player) {
    if (time < lastTime || (state.stage === 0 && lastStage > 0)) reset();
    lastTime = time;
    lastStage = state.stage;
    const inverted = state.stage >= 3;
    negative.visible = inverted;
    underlight.intensity = inverted ? 0.8 : 0;
    loungeVase.rotation.z = inverted ? Math.PI : 0;
    loungeVase.position.y = inverted ? 1.0 : 0.48;
    gallery.forEach((f, i) =>
      f.face.material.color.set(inverted && i % 2 ? 0x91a6b2 : 0xffffff),
    );
    if (player) {
      if (
        frameAt === null &&
        state.stage >= 2 &&
        player.x > 4.85 &&
        player.x < 6.6 &&
        Math.abs(player.z) < 0.64
      ) {
        frameAt = time;
        events.push({ id: "frame-shift", x: 5.93, y: 1.58, z: 0.51 });
      }
      if (
        cupAt === null &&
        state.stage >= 3 &&
        player.x > 1.75 &&
        player.x < 3.4 &&
        player.z < -1.1 &&
        player.z > -2.9
      ) {
        cupAt = time;
        events.push({ id: "cup-slide", x: 1.41, y: 0.97, z: -1.53 });
      }
    }
    if (frameAt !== null) {
      const t = Math.max(0, time - frameAt),
        fall = T.MathUtils.clamp((t - 0.18) / 0.64, 0, 1);
      fallingFrame.rotation.order = "YXZ";
      fallingFrame.rotation.x = (-fall * Math.PI) / 2;
      fallingFrame.rotation.z = 0.025 * Math.sin(t * 16) * (1 - fall);
      fallingFrame.position.y =
        frameStart.y - (frameStart.y - 0.042) * fall * fall;
      fallingFrame.position.z = frameStart.z - 0.3 * fall;
      if (fall >= 1 && !frameImpact) {
        frameImpact = true;
        events.push({ id: "frame-fall", x: 5.93, y: 0.08, z: 0.235 });
      }
    }
    if (cupAt !== null) {
      const t = Math.max(0, time - cupAt),
        fall = T.MathUtils.clamp((t - 0.28) / 0.48, 0, 1);
      looseCup.position.x =
        cupStart.x + 0.19 * Math.min(t / 0.28, 1) + 0.11 * fall;
      looseCup.position.y = cupStart.y - (cupStart.y - 0.048) * fall * fall;
      looseCup.rotation.z = -fall * Math.PI * 0.57;
      if (fall >= 1 && !cupImpact) {
        cupImpact = true;
        events.push({ id: "cup-fall", x: 1.71, y: 0.06, z: -1.53 });
      }
    }
  }
  return {
    animate,
    reset,
    drainEvents: () => events.splice(0),
    snapshot: () => ({
      frameFallen: frameImpact,
      cupFallen: cupImpact,
      inverted: negative.visible,
    }),
    fallingFrame,
    looseCup,
    negative,
  };
}

function canvas(w = 256, h = w) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")];
}
function map(c) {
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.minFilter = T.LinearMipmapLinearFilter;
  t.magFilter = T.LinearFilter;
  t.anisotropy = 4;
  return t;
}
function botanicalTexture() {
  const [c, g] = canvas(256, 384);
  g.fillStyle = "#a59e83";
  g.fillRect(0, 0, 256, 384);
  g.strokeStyle = "#3c4633";
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(126, 331);
  g.bezierCurveTo(105, 256, 147, 182, 128, 65);
  g.stroke();
  for (let i = 0; i < 7; i++) {
    const y = 103 + i * 30,
      side = i % 2 ? 1 : -1;
    g.beginPath();
    g.moveTo(129, y + 30);
    g.bezierCurveTo(
      129 + side * 78,
      y + 18,
      129 + side * 62,
      y - 17,
      129 + side * 12,
      y + 2,
    );
    g.bezierCurveTo(
      128 + side * 20,
      y + 17,
      128 + side * 20,
      y + 27,
      129,
      y + 30,
    );
    g.fillStyle = i % 2 ? "#687259" : "#59644b";
    g.fill();
    g.stroke();
  }
  g.font = "11px Georgia";
  g.textAlign = "center";
  g.fillStyle = "#4b4939";
  g.fillText("STUDY OF A QUIET GARDEN", 128, 361);
  return map(c);
}
function calendarTexture() {
  const [c, g] = canvas(256, 320);
  g.fillStyle = "#b9b095";
  g.fillRect(0, 0, 256, 320);
  g.fillStyle = "#5c5145";
  g.font = "24px Georgia";
  g.textAlign = "center";
  g.fillText("NOVEMBER", 128, 45);
  g.font = "13px Georgia";
  for (let i = 0; i < 35; i++) {
    const day = i - 2;
    if (day < 1 || day > 30) continue;
    const x = 30 + (i % 7) * 33,
      y = 92 + Math.floor(i / 7) * 35;
    g.fillText(String(day), x, y);
  }
  g.strokeStyle = "#675242";
  g.lineWidth = 2;
  g.beginPath();
  g.ellipse(96, 197, 14, 16, 0.3, 0, Math.PI * 2);
  g.stroke();
  return map(c);
}
function negativeMaterial(source, rx = 1, ry = 1) {
  const image = source.image,
    [c, g] = canvas(image.width, image.height);
  g.drawImage(image, 0, 0);
  const data = g.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < data.data.length; i += 4) {
    const r = data.data[i],
      gg = data.data[i + 1],
      b = data.data[i + 2];
    data.data[i] = (255 - r) * 0.7 + 42;
    data.data[i + 1] = (255 - gg) * 0.8 + 31;
    data.data[i + 2] = (255 - b) * 0.88 + 25;
  }
  g.putImageData(data, 0, 0);
  const texture = map(c);
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(rx, ry);
  return new T.MeshStandardMaterial({
    map: texture,
    roughness: 0.85,
    color: 0xa3acb2,
  });
}
