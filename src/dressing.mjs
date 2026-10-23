import * as T from "three";

// Domestic evidence and a few authored disturbances. None of these decorations
// adds navigation collision or silently changes a puzzle's interaction target.
export function dressHouse(b, m, surfaces, furnishings) {
  const { box, cylinder, sphere, lathe, tube, group, plane, contact, scene } =
    b;
  const events = [];
  const groups = {};
  const room = (id) => (groups[id] = group());
  const entry = room("entry"),
    lounge = room("lounge"),
    kitchen = room("kitchen"),
    bathroom = room("bathroom"),
    bedroom = room("bedroom"),
    utility = room("utility");
  const cloth = surfaces.material("linen", 1.5, 2, 0x6c746c);
  const shoeMaterial = new T.MeshStandardMaterial({
    color: 0x382b25,
    roughness: 0.7,
  });
  const blueCeramic = new T.MeshStandardMaterial({
    color: 0x6b827d,
    roughness: 0.32,
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

  // The entry wing turns left into the mirror axis. Keep the centre of both
  // passages clear; coats and shoes live against the outside south wall.
  box(1.18, 0.13, 0.1, 0.2, 1.98, 8.31, m.wood, false, entry, 0.018);
  for (const x of [-0.24, 0.14, 0.54]) {
    const hook = new T.Mesh(
      new T.TorusGeometry(0.032, 0.007, 6, 12, Math.PI * 1.6),
      m.brass,
    );
    hook.position.set(x, 1.95, 8.23);
    entry.add(hook);
  }
  const coat = group(0.13, 1.87, 8.2, 0, entry);
  const coatGeo = new T.PlaneGeometry(0.53, 0.93, 10, 16);
  const a = coatGeo.attributes.position;
  for (let i = 0; i < a.count; i++)
    a.setZ(
      i,
      Math.sin(a.getX(i) * 31) * 0.021 + Math.cos(a.getY(i) * 9) * 0.009,
    );
  coatGeo.computeVertexNormals();
  const coatMesh = new T.Mesh(coatGeo, cloth);
  coatMesh.position.y = -0.46;
  coatMesh.castShadow = coatMesh.receiveShadow = true;
  coat.add(coatMesh);
  for (const side of [-1, 1]) {
    const sleeve = box(
      0.13,
      0.57,
      0.1,
      side * 0.26,
      -0.34,
      0.018,
      cloth,
      false,
      coat,
      0.04,
    );
    sleeve.rotation.z = side * 0.13;
    const boot = sphere(
      0.1,
      0.09,
      0.2,
      0.02 + side * 0.12,
      0.1,
      8.13,
      shoeMaterial,
      entry,
    );
    boot.rotation.y = side * 0.12;
  }
  const stand = lathe(
    [
      [0.13, 0],
      [0.15, 0.035],
      [0.12, 0.46],
      [0.14, 0.48],
    ],
    1.19,
    0.025,
    8.02,
    m.brass,
    entry,
  );
  for (const [i, x] of [
    [0, 1.16],
    [1, 1.24],
  ]) {
    const shaft = cylinder(
      0.008,
      0.008,
      0.75,
      x,
      0.48,
      8.02 + i * 0.05,
      m.wood,
      entry,
    );
    shaft.rotation.z = (i - 0.5) * 0.12;
    const handle = new T.Mesh(
      new T.TorusGeometry(0.045, 0.009, 6, 16, Math.PI * 1.4),
      m.wood,
    );
    handle.position.set(x + 0.02, 0.87, 8.02 + i * 0.05);
    entry.add(handle);
  }
  contact(0.55, 0.65, 1.2, 8.02, 0.4, entry);

  // Original botanical studies break up repeated wallpaper without introducing
  // another family photograph or a new story prop to confuse the player.
  const botanical = botanicalTexture();
  const gallery = [];
  for (const [x, y, z, rot, w, h] of [
    [-1.635, 1.85, 6.28, Math.PI / 2, 0.38, 0.55],
    [-1.635, 1.78, -2.5, Math.PI / 2, 0.33, 0.45],
    [5.135, 1.78, 3.25, -Math.PI / 2, 0.43, 0.56],
    [5.135, 1.9, -4.9, -Math.PI / 2, 0.32, 0.42],
    [-7.99, 1.76, 3.15, Math.PI / 2, 0.62, 0.76],
    [11.67, 1.82, 7.75, -Math.PI / 2, 0.43, 0.59],
  ])
    gallery.push(furnishings.frame(x, y, z, rot, botanical, scene, w, h));
  const fallingFrame = gallery[2].group;
  const frameStart = fallingFrame.position.clone();
  const frameRotation = fallingFrame.rotation.clone();

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
      const tip = [(i - 1) * 0.09, 0.48 + (i % 2) * 0.07, 0.025 * (i - 1)];
      tube(
        [[0, 0.18, 0], [(i - 1) * 0.03, 0.33, 0.015], tip],
        0.0035,
        m.wood,
        g,
      );
      const leaf = new T.Mesh(new T.SphereGeometry(1, 10, 6), leafMaterial);
      leaf.position.set(tip[0] + 0.028, tip[1] - 0.08, tip[2]);
      leaf.scale.set(0.065, 0.018, 0.025);
      leaf.rotation.z = i * 0.5;
      g.add(leaf);
    }
    return g;
  }
  const loungeVase = vase(-6.15, 0.46, 4.73, lounge);
  // A crocheted-looking mat and magazines already read as soft furniture clutter.
  const mat = plane(
    0.42,
    0.35,
    -6.15,
    0.467,
    4.73,
    surfaces.material("linen", 2, 2, 0xaba690),
    0,
    lounge,
  );
  mat.rotation.x = -Math.PI / 2;
  mat.castShadow = false;
  for (let i = 0; i < 3; i++) {
    const magazine = box(
      0.28,
      0.009,
      0.36,
      -5.16,
      0.466 + i * 0.012,
      4.61,
      [m.paper, m.fabric, m.linen][i],
      false,
      lounge,
    );
    magazine.rotation.y = -0.09 + i * 0.12;
  }

  // Kitchen: an old calendar, jars, a tea towel and a dish rack make this a
  // recognisable occupied room before the separate radio becomes significant.
  const calendar = furnishings.frame(
    8.0,
    1.83,
    -3.985,
    0,
    calendarTexture(),
    kitchen,
    0.5,
    0.62,
  );
  const calendarClip = box(
    0.08,
    0.035,
    0.02,
    8.0,
    2.17,
    -3.89,
    m.brass,
    false,
    kitchen,
  );
  for (let i = 0; i < 3; i++) {
    const jar = cylinder(
      0.055,
      0.055,
      0.14 + i * 0.035,
      11.15,
      1.04 + i * 0.0175,
      -3.38 + i * 0.2,
      m.ceramic,
      kitchen,
    );
    cylinder(
      0.057,
      0.057,
      0.018,
      11.15,
      1.115 + i * 0.035,
      -3.38 + i * 0.2,
      m.wood,
      kitchen,
    );
  }
  box(
    0.02,
    0.32,
    0.33,
    10.66,
    0.66,
    -0.13,
    surfaces.material("linen", 1, 1, 0x9b9277),
    false,
    kitchen,
    0.008,
  );
  for (let i = 0; i < 4; i++) {
    const plate = cylinder(
      0.13,
      0.13,
      0.012,
      11.08,
      0.99,
      -0.65 + i * 0.055,
      m.ceramic,
      kitchen,
    );
    plate.rotation.x = Math.PI * 0.4;
  }
  const looseCup = group(10.72, 0.98, 1.62, 0, kitchen);
  lathe(
    [
      [0.04, 0],
      [0.06, 0.015],
      [0.065, 0.13],
      [0.058, 0.14],
    ],
    0,
    0,
    0,
    blueCeramic,
    looseCup,
  );
  const cupHandle = new T.Mesh(
    new T.TorusGeometry(0.034, 0.009, 6, 16),
    blueCeramic,
  );
  cupHandle.rotation.y = Math.PI / 2;
  cupHandle.position.set(0.072, 0.075, 0);
  looseCup.add(cupHandle);
  const cupStart = looseCup.position.clone();

  // Ordinary personal objects: folded towels, a toothbrush glass, slippers,
  // bedside water and laundry soap. All remain outside the traversable routes.
  for (let i = 0; i < 3; i++)
    box(
      0.38,
      0.055,
      0.28,
      -6.48,
      0.18 + i * 0.055,
      -3.45,
      m.linen,
      false,
      bathroom,
      0.015,
    );
  cylinder(0.05, 0.04, 0.12, -3.12, 1.01, -8.96, blueCeramic, bathroom);
  for (let i = 0; i < 2; i++) {
    const brush = cylinder(
      0.005,
      0.005,
      0.2,
      -3.13 + i * 0.028,
      1.15,
      -8.96,
      m.enamel,
      bathroom,
      8,
    );
    brush.rotation.z = (i - 0.5) * 0.17;
  }
  for (const x of [8.13, 8.32])
    sphere(0.075, 0.035, 0.16, x, 0.046, 7.66, cloth, bedroom);
  cylinder(0.042, 0.035, 0.12, 7.73, 0.82, 7.64, blueCeramic, bedroom);
  const sparePillow = box(
    0.52,
    0.14,
    0.39,
    6.38,
    2.31,
    7.69,
    m.linen,
    false,
    bedroom,
    0.065,
  );
  sparePillow.rotation.z = 0.03;
  for (let i = 0; i < 2; i++) {
    box(
      0.14,
      0.27,
      0.1,
      7.19 + i * 0.19,
      1.23,
      -9.1,
      [m.enamel, terracotta][i],
      false,
      utility,
      0.018,
    );
    cylinder(
      0.025,
      0.025,
      0.025,
      7.19 + i * 0.19,
      1.377,
      -9.1,
      m.black,
      utility,
      12,
    );
  }

  // A bounded photographic-negative area on the return partition. It never
  // covers a door or applies flashing/fullscreen inversion to the player's view.
  const negative = group();
  const negativePaper = negativeMaterial(surfaces.maps.wallpaper, 3.6, 1.05);
  const negativeWood = negativeMaterial(surfaces.maps.panel, 5.4, 1);
  plane(6.6, 1.8, 1.847, 1.78, -1.5, negativePaper, Math.PI / 2, negative);
  plane(6.6, 0.8, 1.848, 0.44, -1.5, negativeWood, Math.PI / 2, negative);
  const negativeRunner = plane(
    0.85,
    6.6,
    3.5,
    0.025,
    -1.5,
    negativeMaterial(surfaces.maps.fabric, 1, 4),
    0,
    negative,
  );
  negativeRunner.rotation.x = -Math.PI / 2;
  negativeRunner.castShadow = false;
  const underlight = new T.PointLight(0xa7c7d5, 0, 4.8, 2);
  underlight.position.set(2.1, 0.22, -1.8);
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
    loungeVase.position.y = 0.46;
    Object.values(groups).forEach((g) => (g.visible = true));
    gallery.forEach((f) => {
      f.face.material.color.set(0xffffff);
    });
    negative.visible = false;
    underlight.intensity = 0;
  }
  function animate(time, state, player) {
    if (time < lastTime || (state.stage === 0 && lastStage > 0)) reset();
    lastTime = time;
    lastStage = state.stage;
    const inverted = state.stage >= 3;
    negative.visible = inverted;
    underlight.intensity = inverted ? 5 : 0;
    loungeVase.rotation.z = inverted ? Math.PI : 0;
    loungeVase.position.y = inverted ? 0.96 : 0.46;
    gallery.forEach((f, i) => {
      f.face.material.color.set(inverted && i % 2 ? 0x91b1c4 : 0xffffff);
    });
    if (player) {
      if (
        frameAt === null &&
        state.stage >= 2 &&
        player.x > 2.2 &&
        player.x < 5.15 &&
        Math.abs(player.z - 3.25) < 2.5
      ) {
        frameAt = time;
        events.push({ id: "frame-shift", x: 5.12, y: 1.6, z: 3.25 });
      }
      if (
        cupAt === null &&
        state.stage >= 3 &&
        player.x > 7.8 &&
        player.z > 0.1 &&
        player.z < 2.5
      ) {
        cupAt = time;
        events.push({ id: "cup-slide", x: 10.7, y: 1, z: 1.62 });
      }
    }
    if (frameAt !== null) {
      const t = Math.max(0, time - frameAt),
        fall = T.MathUtils.clamp((t - 0.18) / 0.64, 0, 1);
      fallingFrame.rotation.order = "YXZ";
      fallingFrame.rotation.x = (-fall * Math.PI) / 2;
      fallingFrame.rotation.z = 0.025 * Math.sin(t * 16) * (1 - fall);
      fallingFrame.position.y =
        frameStart.y - (frameStart.y - 0.045) * fall * fall;
      fallingFrame.position.x = frameStart.x - 0.3 * fall;
      if (fall >= 1 && !frameImpact) {
        frameImpact = true;
        events.push({ id: "frame-fall", x: 4.84, y: 0.1, z: 3.25 });
      }
    }
    if (cupAt !== null) {
      const t = Math.max(0, time - cupAt),
        fall = T.MathUtils.clamp((t - 0.28) / 0.48, 0, 1);
      looseCup.position.x =
        cupStart.x - 0.25 * Math.min(t / 0.28, 1) - 0.12 * fall;
      looseCup.position.y = cupStart.y - (cupStart.y - 0.08) * fall * fall;
      looseCup.rotation.z = -fall * Math.PI * 0.62;
      if (fall >= 1 && !cupImpact) {
        cupImpact = true;
        events.push({ id: "cup-fall", x: 10.35, y: 0.08, z: 1.62 });
      }
    }
    // Culling follows the same coarse room distance used for the main furnishings.
    if (player)
      for (const [id, g] of Object.entries(groups)) {
        const centers = {
          entry: [1.75, 7.2],
          lounge: [-5, 5.1],
          kitchen: [8.5, -0.2],
          bathroom: [-4.5, -6.4],
          bedroom: [8.5, 6.2],
          utility: [8.5, -6.8],
        };
        const [x, z] = centers[id];
        g.visible = Math.hypot(player.x - x, player.z - z) < 16;
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
