import * as T from "three";
import { builders } from "./builders.mjs";
import {
  createSurfaces,
  photoTextures,
  writingTexture,
  grimeTexture,
} from "./surfaces.mjs";
import { furnish } from "./props.mjs";
import { dressHouse } from "./dressing.mjs";
import { ROOMS, roomAt, MIRROR, EXIT, HALL_CLOCK } from "./layout.mjs";
export async function buildHouse(scene) {
  const b = builders(scene),
    { box, cylinder, sphere, group, target, contact } = b;
  const [surfaces, photos] = await Promise.all([
    createSurfaces(),
    photoTextures(),
  ]);
  const basic = (color, roughness = 0.85, metalness = 0) =>
    new T.MeshStandardMaterial({ color, roughness, metalness });
  const m = {
    wood: surfaces.material("wood", 1, 1, 0x8d795f),
    black: basic(0x141916),
    brass: basic(0x8f7a51, 0.47, 0.62),
    steel: basic(0x8d9793, 0.27, 0.84),
    ceramic: basic(0xbdbcb0, 0.22),
    enamel: basic(0x939d8b, 0.42),
    fabric: surfaces.material("fabric", 1.4, 1.4),
    linen: surfaces.material("linen", 1.2, 1.2),
    blanket: surfaces.material("fabric", 1.7, 1.8, 0x969d91),
    rust: surfaces.material("rust"),
    paper: basic(0xb8ac8b),
    cabinet: basic(0x596957),
    cabinetFront: surfaces.material("panel", 1, 1, 0x9dada0),
    counter: surfaces.material("concrete", 1, 1, 0xa9aaa3),
    windowTrim: basic(0x656b5d),
    curtain: surfaces.material("linen", 1, 1, 0x92927d),
    shade: surfaces.material("linen", 1, 1, 0xa69c7c),
    bulb: new T.MeshBasicMaterial({ color: 0xffd596 }),
    redBulb: new T.MeshBasicMaterial({ color: 0x9b301e }),
    greenBulb: new T.MeshBasicMaterial({ color: 0x9ba969 }),
    book: basic(0x4f4033),
    tvBody: basic(0x393831),
    foggedGlass: basic(0x5e706b, 0.25, 0.6),
    water: new T.MeshPhysicalMaterial({
      color: 0x293d35,
      roughness: 0.16,
      metalness: 0.35,
      transparent: true,
      opacity: 0.6,
    }),
    invisible: new T.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
    photos,
  };
  m.curtain.side = m.shade.side = m.steel.side = T.DoubleSide;
  m.shade.emissive.set(0x674526);
  m.shade.emissiveIntensity = 0.28;
  m.lampGlaze = new T.MeshStandardMaterial({
    color: 0x584b3e,
    roughness: 0.38,
  });
  function wall(w, d, x, z, kind = "wallpaper", height = 2.85, bottom = 0) {
    const mesh = box(
      w,
      height,
      d,
      x,
      bottom + height / 2,
      z,
      surfaces.material(kind, Math.max(w, d) / 1.8, height / 2),
      bottom < 0.2,
    );
    if (bottom < 0.2 && kind !== "tile") {
      box(
        w + 0.016,
        0.83,
        d + 0.016,
        x,
        0.415,
        z,
        surfaces.material("panel", Math.max(w, d) / 1.2, 1, 0x6f7468),
      );
      for (const [y, h] of [
        [0.07, 0.11],
        [0.85, 0.065],
        [2.76, 0.09],
      ])
        box(w + 0.04, h, d + 0.04, x, y, z, m.wood);
    }
    return mesh;
  }
  function wallRange(axis, fixed, from, to, kind = "wallpaper", holes = []) {
    let cursor = from;
    for (const hole of holes.sort((a, b) => a.center - b.center)) {
      const start = hole.center - hole.width / 2,
        end = hole.center + hole.width / 2;
      if (start > cursor) {
        const len = start - cursor;
        axis === "x"
          ? wall(0.18, len, fixed, (cursor + start) / 2, kind)
          : wall(len, 0.18, (cursor + start) / 2, fixed, kind);
      }
      axis === "x"
        ? wall(0.18, hole.width, fixed, hole.center, kind, 0.6, 2.25)
        : wall(hole.width, 0.18, hole.center, fixed, kind, 0.6, 2.25);
      cursor = end;
    }
    if (cursor < to) {
      const len = to - cursor;
      axis === "x"
        ? wall(0.18, len, fixed, (cursor + to) / 2, kind)
        : wall(len, 0.18, (cursor + to) / 2, fixed, kind);
    }
  }
  // The real floor plan. The central partition hides authored changes on each pass.
  box(7, 0.15, 18, 1.75, -0.08, -0.5, surfaces.material("floor", 3.5, 8));
  box(7, 0.12, 18, 1.75, 2.91, -0.5, surfaces.material("plaster", 3, 7));
  for (const r of ROOMS) {
    const w = r.maxX - r.minX + 0.18,
      d = r.maxZ - r.minZ + 0.18,
      cx = (r.minX + r.maxX) / 2,
      cz = (r.minZ + r.maxZ) / 2;
    box(
      w,
      0.15,
      d,
      cx,
      -0.08,
      cz,
      surfaces.material(
        ["bathroom", "kitchen"].includes(r.id)
          ? "tile"
          : r.id === "utility"
            ? "concrete"
            : "floor",
        w / 2,
        d / 2,
      ),
    );
    box(w, 0.12, d, cx, 2.91, cz, surfaces.material("plaster", w / 2, d / 2));
  }
  wallRange("x", -1.75, -9.5, 8.5, "wallpaper", [
    { center: -5.5, width: 1.25 },
    { center: 4, width: 1.4 },
  ]);
  wallRange("x", 5.25, -9.5, 8.5, "plaster", [
    { center: -7.2, width: 1.25 },
    { center: -0.2, width: 1.4 },
    { center: 6.1, width: 1.3 },
  ]);
  wallRange("x", 1.75, -6.2, 5.2);
  wallRange("z", -9.5, -7.1, 11.8);
  wallRange("z", 8.5, -8.1, 11.8, "wallpaper", [
    { center: EXIT.x, width: 1.3 },
  ]);
  wallRange("x", -8.1, 1.7, 8.5);
  wallRange("z", 1.7, -8.1, -1.75);
  wallRange("x", -7.1, -9.5, -2.9, "tile");
  wallRange("z", -2.9, -7.1, -1.75, "tile");
  wallRange("x", 11.8, -9.5, 8.5, "plaster");
  wallRange("z", -4.1, 5.25, 11.8, "plaster");
  wallRange("z", 3.6, 5.25, 11.8);
  box(
    1.2,
    0.015,
    15.3,
    0,
    0.008,
    -0.2,
    surfaces.material("fabric", 1, 10, 0x97816b),
  );
  box(
    0.86,
    0.012,
    14,
    3.5,
    0.008,
    -0.1,
    surfaces.material("fabric", 1, 9, 0x7c8278),
  );
  const roomDoors = {};
  const kitchenPaint = new T.MeshStandardMaterial({
    color: 0xb3b39b,
    roughness: 0.65,
  });
  const kitchenPanelPaint = new T.MeshStandardMaterial({
    color: 0x929a84,
    roughness: 0.71,
  });
  function makeDoor(id, x, z, rotation, width = 1.25) {
    const g = group(x, 0, z, rotation),
      pivot = group(-width / 2, 0, 0, 0, g),
      leaf = box(
        width,
        2.2,
        0.07,
        width / 2,
        1.1,
        0,
        id === "kitchen" ? kitchenPaint : m.wood,
        false,
        pivot,
        0.018,
      );
    for (const y of [0.58, 1.6]) {
      box(
        width - 0.18,
        0.82,
        0.025,
        width / 2,
        y,
        0.05,
        id === "kitchen" ? kitchenPanelPaint : surfaces.material("panel"),
        false,
        pivot,
      );
      box(
        width - 0.18,
        0.82,
        0.025,
        width / 2,
        y,
        -0.05,
        id === "kitchen" ? kitchenPanelPaint : surfaces.material("panel"),
        false,
        pivot,
      );
    }
    const handle = cylinder(
      0.04,
      0.04,
      0.13,
      width - 0.14,
      1.02,
      0.09,
      m.brass,
      pivot,
    );
    handle.rotation.x = Math.PI / 2;
    box(
      0.12,
      0.025,
      0.045,
      width - 0.18,
      1.02,
      0.16,
      m.brass,
      false,
      pivot,
      0.01,
    );
    for (const sx of [-1, 1])
      box(
        0.075,
        2.3,
        0.16,
        sx * (width / 2 + 0.025),
        1.15,
        0,
        m.wood,
        false,
        g,
      );
    box(width + 0.18, 0.09, 0.17, 0, 2.28, 0, m.wood, false, g);
    if (id === "kitchen") {
      const label = new T.MeshStandardMaterial({
        map: writingTexture(["KITCHEN"], {
          background: "#b0ad91",
          color: "#383e32",
          font: 78,
        }),
        roughness: 0.8,
      });
      box(0.4, 0.12, 0.015, width / 2, 1.63, 0.068, label, false, pivot, 0.006);
    }
    const dummy = box(width, 2.23, 0.12, 0, 1.11, 0, m.invisible, false, g);
    const collider = b.solid(dummy);
    const mesh = target(
      id === "front" ? "door" : "room-" + id,
      leaf,
      id === "front" ? "TRY FRONT DOOR" : "OPEN " + id.toUpperCase(),
      2.45,
      pivot,
    );
    if (id !== "front")
      roomDoors[id] = { pivot, leaf, collider, x, z, width, rotation };
    return { pivot, leaf, collider, group: g };
  }
  makeDoor("lounge", -1.75, 4, Math.PI / 2, 1.35);
  makeDoor("bathroom", -1.75, -5.5, Math.PI / 2, 1.2);
  makeDoor("kitchen", 5.25, -0.2, -Math.PI / 2, 1.35);
  makeDoor("bedroom", 5.25, 6.1, -Math.PI / 2, 1.25);
  makeDoor("utility", 5.25, -7.2, -Math.PI / 2, 1.2);
  const front = makeDoor("front", EXIT.x, EXIT.z, Math.PI, 1.25);
  box(1.7, 0.15, 3.5, EXIT.x, -0.08, 10.25, surfaces.material("floor", 1, 2));
  box(1.7, 0.12, 3.5, EXIT.x, 2.91, 10.25, m.black);
  wallRange("x", EXIT.x - 0.85, 8.5, 12);
  wallRange("x", EXIT.x + 0.85, 8.5, 12);
  wallRange("z", 12, EXIT.x - 0.85, EXIT.x + 0.85);
  const frontNumber = box(
    0.21,
    0.14,
    0.008,
    EXIT.x,
    1.77,
    8.35,
    new T.MeshStandardMaterial({
      map: writingTexture(["04"], {
        background: "#2c3027",
        color: "#b5a27a",
        font: 90,
      }),
      roughness: 0.7,
    }),
  );
  b.plane(5.1, 2.67, -4.4, 1.37, -9.395, surfaces.material("tile", 2.5, 1.35));
  const furnishings = furnish(b, m);
  const dressing = dressHouse(b, m, surfaces, furnishings);
  // Hall console and a practical lamp.
  const hallTable = furnishTable();
  function furnishTable() {
    const g = group(1.25, 0, 0.9);
    box(0.6, 0.48, 1.12, 0, 0.59, 0, m.wood, false, g, 0.025);
    box(0.7, 0.055, 1.22, 0, 0.86, 0, m.wood, false, g, 0.025);
    for (const x of [-0.2, 0.2])
      for (const z of [-0.45, 0.45])
        cylinder(0.025, 0.045, 0.39, x, 0.2, z, m.wood, g);
    b.solid(box(0.74, 0.9, 1.25, 0, 0.45, 0, m.invisible, false, g));
    contact(1.05, 1.6, 1.25, 0.9, 0.85);
    return g;
  }
  const drawer = hallTable.children[0],
    drawerSlide = group(-0.32, 0.63, 0, 0, hallTable);
  const drawerFace = box(
    0.055,
    0.25,
    0.98,
    0,
    0,
    0,
    m.wood,
    false,
    drawerSlide,
    0.014,
  );
  box(0.08, 0.028, 0.12, -0.05, 0, 0, m.brass, false, drawerSlide, 0.012);
  box(0.44, 0.02, 0.94, 0.2, -0.11, 0, m.black, false, drawerSlide);
  target("drawer", drawer, "OPEN DRAWER", 1.9, hallTable);
  target("drawer", drawerFace, "OPEN DRAWER", 1.9, hallTable);
  const key = group(0.17, -0.07, 0, 0, drawerSlide);
  const keyRing = new T.Mesh(new T.TorusGeometry(0.04, 0.009, 8, 24), m.brass);
  keyRing.rotation.x = Math.PI / 2;
  key.add(keyRing);
  box(0.014, 0.016, 0.14, 0, 0, 0.09, m.brass, false, key);
  box(0.055, 0.02, 0.02, 0.02, 0, 0.15, m.brass, false, key);
  key.visible = false;
  furnishings.lamp(1.24, 0.9, 1.24);
  const note = box(
    0.29,
    0.006,
    0.22,
    1.09,
    0.9,
    0.65,
    new T.MeshStandardMaterial({
      map: writingTexture(
        [
          "IF THE HALL RETURNS,",
          "WATCH THE GLASS.",
          "WHEN IT LEADS,",
          "YOU LEAVE.",
        ],
        { font: 26 },
      ),
      roughness: 1,
    }),
  );
  target("note", note, "READ FOLDED NOTE", 1.9);
  const hallFrame = furnishings.frame(
    -1.64,
    1.72,
    2.3,
    Math.PI / 2,
    photos[0],
    scene,
    0.72,
    0.85,
  );
  target("photo", hallFrame.face, "EXAMINE PHOTOGRAPH", 2.1, hallFrame.group);
  // Readable analog clock, used by a real reversed-time puzzle.
  const clock = group(
    HALL_CLOCK.x - 0.06,
    HALL_CLOCK.y - 0.2,
    HALL_CLOCK.z,
    Math.PI / 2,
  );
  box(0.66, 1.14, 0.12, 0, 0, 0, m.wood, false, clock, 0.025);
  const clockFace = new T.Mesh(
    new T.CircleGeometry(0.27, 48),
    new T.MeshStandardMaterial({ map: clockTexture(), roughness: 0.9 }),
  );
  clockFace.position.set(0, 0.2, 0.08);
  clock.add(clockFace);
  const hourHand = group(0, 0.2, 0.095, 0, clock),
    minuteHand = group(0, 0.2, 0.1, 0, clock);
  box(0.018, 0.16, 0.008, 0, 0.065, 0, m.black, false, hourHand);
  box(0.012, 0.24, 0.008, 0, 0.105, 0, m.black, false, minuteHand);
  sphere(0.023, 0.023, 0.012, 0, 0.2, 0.115, m.brass, clock);
  const secondHand = group(0, 0.2, 0.115, 0, clock);
  box(0.007, 0.25, 0.006, 0, 0.09, 0, m.brass, false, secondHand);
  const pendulum = group(0, -0.12, 0.09, 0, clock);
  cylinder(0.006, 0.006, 0.27, 0, -0.12, 0, m.brass, pendulum);
  const weight = cylinder(0.07, 0.07, 0.02, 0, -0.26, 0, m.brass, pendulum);
  weight.rotation.x = Math.PI / 2;
  target("clock", clockFace, "SET HALL CLOCK", 2.0, clock);
  function clockTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    g.fillStyle = "#c0b99b";
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = "#35392f";
    g.font = "21px Georgia";
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (let i = 1; i <= 12; i++) {
      const a = (i / 6) * Math.PI;
      g.fillText(String(i), 128 + Math.sin(a) * 99, 128 - Math.cos(a) * 99);
    }
    return new T.CanvasTexture(c);
  }
  // Spatial light sources. Only one static hero lamp and the player's flashlight cast shadows.
  const lights = [];
  function point(color, intensity, distance, x, y, z) {
    const l = new T.PointLight(color, intensity, distance, 2);
    l.position.set(x, y, z);
    scene.add(l);
    l.userData.base = intensity;
    lights.push(l);
    return l;
  }
  function ceilingLamp(x, z, intensity = 14, color = 0xffd29a) {
    cylinder(0.065, 0.065, 0.12, x, 2.74, z, m.brass);
    cylinder(0.008, 0.008, 0.2, x, 2.59, z, m.black);
    const shade = b.lathe(
      [
        [0.28, 0],
        [0.24, 0.05],
        [0.11, 0.2],
        [0.09, 0.22],
      ],
      x,
      2.35,
      z,
      m.shade,
    );
    sphere(0.035, 0.04, 0.035, x, 2.37, z, m.bulb);
    return point(color, intensity, 7, x, 2.34, z);
  }
  const hallLamp = ceilingLamp(0, 4.7, 16);
  ceilingLamp(0, -6.9, 14);
  const returnLamp = ceilingLamp(3.5, 6.7, 11);
  ceilingLamp(3.5, -8, 11);
  const kitchenLight = ceilingLamp(8.5, -0.7, 17, 0xcbd5c8);
  const utilityLight = ceilingLamp(8.5, -7.4, 14, 0xc6d1ca);
  const bathLight = point(0xb9c9b7, 12, 6, -3.5, 2.45, -8.8);
  box(0.55, 0.08, 0.08, -3.5, 2.47, -9.2, m.bulb);
  point(0xffc888, 8, 5, 1.2, 1.52, 1.3);
  point(0xffca8e, 10, 5, -2.8, 1.42, 6.8);
  point(0x6e96a8, 4, 5, -7.7, 1.8, 5.1);
  point(0x7a9da9, 5, 6, 11.2, 1.85, -1.3);
  point(0x7d9dab, 4, 5, 11.2, 1.8, 5.4);
  const bedsideLight = point(0xffcb94, 7, 4, 7.95, 1.4, 7.5);
  const ambient = new T.HemisphereLight(0x8fa7b5, 0x29201a, 0.23);
  scene.add(ambient);
  const mirrorLight = point(0x9ab2b3, 3.5, 5, MIRROR.x, 2.2, MIRROR.z + 0.8);
  const kitchenDoorLight = point(0xf0d1a1, 7, 5, 4.72, 2.25, -0.2);
  box(0.07, 0.25, 0.52, 5.13, 2.36, -0.2, m.black);
  box(0.065, 0.17, 0.38, 5.08, 2.36, -0.2, m.shade);
  box(0.02, 0.035, 0.28, 5.035, 2.28, -0.2, m.bulb);
  const shadow = new T.SpotLight(0xf3cb94, 25, 15, Math.PI * 0.3, 0.65, 2);
  shadow.position.set(0, 2.57, 4.7);
  shadow.target.position.set(0, 0.6, -1.5);
  shadow.castShadow = true;
  shadow.shadow.autoUpdate = false;
  shadow.shadow.needsUpdate = true;
  shadow.shadow.mapSize.set(1024, 1024);
  shadow.shadow.bias = -0.0005;
  shadow.shadow.normalBias = 0.025;
  scene.add(shadow, shadow.target);
  const exitLight = point(0xb4cfd8, 0, 5, EXIT.x, 2, 10.5);
  const grimeMap = grimeTexture();
  for (const [x, z, rot] of [
    [-1.63, -8.2, Math.PI / 2],
    [-1.63, 5.6, Math.PI / 2],
    [5.14, -5, -Math.PI / 2],
    [11.67, 1.7, -Math.PI / 2],
  ]) {
    const mat = new T.MeshBasicMaterial({
      map: grimeMap,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });
    const stain = b.plane(1.7, 2.6, x, 1.35, z, mat, rot);
    stain.castShadow = false;
  }
  // The ending turns the exit into the glass; it is not present during normal play.
  const endingGlass = b.plane(
    1.5,
    2.65,
    EXIT.x,
    1.35,
    9.5,
    new T.MeshPhysicalMaterial({
      color: 0x8eaea7,
      metalness: 0.25,
      roughness: 0.12,
      transparent: true,
      opacity: 0.15,
      side: T.DoubleSide,
    }),
  );
  endingGlass.visible = false;
  function setStage(stage) {
    hallFrame.face.material.map = photos[stage >= 2 ? 1 : 0];
    hallFrame.group.rotation.z = stage >= 1 ? Math.PI : 0;
    mirrorLight.color.set(stage >= 3 ? 0xc3aaa0 : 0x9ab2b3);
  }
  function animate(time, dt, state, player) {
    drawerSlide.position.x = T.MathUtils.damp(
      drawerSlide.position.x,
      state.drawerOpen ? -0.74 : -0.32,
      8,
      dt,
    );
    key.visible = state.keyAvailable && !state.hasKey;
    front.pivot.rotation.y = T.MathUtils.damp(
      front.pivot.rotation.y,
      state.doorOpen ? Math.PI * 0.5 : 0,
      3,
      dt,
    );
    front.collider.disabled = state.doorOpen && front.pivot.rotation.y > 1.05;
    for (const [id, door] of Object.entries(roomDoors)) {
      if (
        Math.abs(
          door.pivot.rotation.y - (state.doors?.[id] ? Math.PI * 0.52 : 0),
        ) > 0.02
      )
        shadow.shadow.needsUpdate = true;
      door.pivot.rotation.y = T.MathUtils.damp(
        door.pivot.rotation.y,
        state.doors?.[id] ? Math.PI * 0.52 : 0,
        5,
        dt,
      );
      door.collider.disabled =
        !!state.doors?.[id] && door.pivot.rotation.y > 0.95;
    }
    secondHand.rotation.z = (state.stage >= 1 ? 1 : -1) * time * 0.9;
    minuteHand.rotation.z = (-state.clockMinute / 60) * Math.PI * 2;
    hourHand.rotation.z =
      -(state.clockHour / 12 + state.clockMinute / 720) * Math.PI * 2;
    pendulum.rotation.z =
      Math.sin(time * 2.3) * (state.clockSolved ? 0.02 : 0.12);
    kitchenLight.intensity = state.power ? (state.stage >= 3 ? 10 : 17) : 0.3;
    utilityLight.intensity = state.power ? 14 : 3;
    const inverted = state.stage >= 3;
    ambient.color.set(inverted ? 0x9c8982 : 0x8fa7b5);
    ambient.intensity = inverted ? 0.17 : 0.23;
    hallLamp.color.set(inverted ? 0xa6c3ca : 0xffd29a);
    returnLamp.intensity = (inverted ? 6 : 11) + Math.sin(time * 7.1) * 0.16;
    bathLight.intensity = state.stage === 2 ? 9 : 12;
    bedsideLight.intensity = inverted ? 1.8 : 7;
    exitLight.intensity = T.MathUtils.damp(
      exitLight.intensity,
      state.doorOpen ? 11 : 0,
      3,
      dt,
    );
    kitchenDoorLight.color.set(inverted ? 0xa9cad2 : 0xf0d1a1);
    furnishings.animate(time, state, player);
    dressing.animate(time, state, player);
    if (player)
      for (const [id, g] of Object.entries(furnishings.roomGroups)) {
        const r = ROOMS.find((r) => r.id === id);
        g.visible =
          Math.hypot(
            player.x - (r.minX + r.maxX) / 2,
            player.z - (r.minZ + r.maxZ) / 2,
          ) < 16;
      }
  }
  function reset(state) {
    dressing.reset();
    for (const d of Object.values(roomDoors)) {
      d.pivot.rotation.y = 0;
      d.collider.disabled = false;
    }
    front.pivot.rotation.y = 0;
    front.collider.disabled = false;
    drawerSlide.position.x = -0.32;
    key.visible = false;
    note.visible = true;
    endingGlass.visible = false;
    setStage(0);
    animate(0, 0, state);
  }
  return {
    ...b,
    ...m,
    materials: m,
    surfaces,
    photos,
    roomDoors,
    doorPivot: front.pivot,
    doorCollider: front.collider,
    door: front.leaf,
    drawer,
    drawerFace,
    drawerSlide,
    key,
    note,
    lights,
    mirrorLight,
    exitLight,
    endingGlass,
    props: furnishings,
    dressing,
    drainEvents: dressing.drainEvents,
    roomAt,
    setStage,
    animate,
    reset,
  };
}
