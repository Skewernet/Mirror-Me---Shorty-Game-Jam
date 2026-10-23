import * as T from "three";
import { builders } from "./builders.mjs";
import { createSurfaces, photoTextures, writingTexture } from "./surfaces.mjs";
import { furnish } from "./props.mjs";
import { dressHouse } from "./dressing.mjs";
import { ThresholdPortal } from "./portal.mjs";
import { buildWake } from "./wake.mjs";
import { WRITINGS } from "./story.mjs";
import {
  ROOMS,
  roomAt,
  MIRROR,
  EXIT,
  FRONT_DOOR,
  HALL_CLOCK,
  TARGETS,
  CEILING_HEIGHT,
} from "./layout.mjs";

// The traversable building is one narrow L. Leaving its rear porch is handled by
// the authored threshold transition; there is no second corridor around a wall.
export async function buildHouse(scene) {
  const b = builders(scene),
    { box, cylinder, sphere, group, target, contact } = b;
  const worldMaterials = new Set();
  const worldMaterial = (material) => {
    worldMaterials.add(material);
    return material;
  };
  const [surfaces, photos] = await Promise.all([
    createSurfaces(),
    photoTextures(),
  ]);
  scene.environment = surfaces.environment;
  const basic = (color, roughness = 0.85, metalness = 0) =>
    new T.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      envMapIntensity: 0.06,
    });
  const m = {
    wood: worldMaterial(surfaces.material("wood", 1, 1, 0xa9987d)),
    black: basic(0x171914),
    brass: basic(0x8c7852, 0.43, 0.72),
    steel: basic(0xa0aaa8, 0.26, 0.84),
    ceramic: basic(0xbebfb0, 0.25),
    enamel: basic(0x929e8d, 0.42),
    fabric: surfaces.material("fabric", 1.4, 1.4),
    linen: surfaces.material("linen", 1.2, 1.2),
    blanket: surfaces.material("fabric", 1.7, 1.8, 0x9c9b8c),
    rust: surfaces.material("rust"),
    paper: basic(0xc2b99d),
    cabinet: basic(0x717969),
    cabinetFront: surfaces.material("panel", 1, 1, 0xb9c0ac),
    counter: surfaces.material("concrete", 1, 1, 0xb7b8ad),
    windowTrim: basic(0x929486),
    curtain: surfaces.material("linen", 1, 1, 0xb7b29e),
    shade: surfaces.material("linen", 1, 1, 0xc2b598),
    bulb: new T.MeshBasicMaterial({ color: 0xffd9a0 }),
    redBulb: new T.MeshBasicMaterial({ color: 0xa1422b }),
    greenBulb: new T.MeshBasicMaterial({ color: 0xabc082 }),
    book: basic(0x564837),
    tvBody: basic(0x373a34),
    foggedGlass: basic(0x71817a, 0.23, 0.62),
    water: new T.MeshPhysicalMaterial({
      color: 0x334a41,
      roughness: 0.13,
      metalness: 0.25,
      transparent: true,
      opacity: 0.58,
    }),
    invisible: new T.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
    photos,
    surfaces,
  };
  m.curtain.side = m.shade.side = m.steel.side = T.DoubleSide;
  m.shade.emissive.set(0x674526);
  m.shade.emissiveIntensity = 0.2;
  m.lampGlaze = basic(0x65584b, 0.35);
  const paint = worldMaterial(surfaces.material("plaster", 1, 1, 0xd4d0b9));
  const darkPaint = worldMaterial(surfaces.material("panel", 1, 1, 0x899080));
  const H = CEILING_HEIGHT,
    wallThickness = 0.12;

  function wall(w, d, x, z, kind = "wallpaper", height = H, bottom = 0) {
    const mesh = box(
      w,
      height,
      d,
      x,
      bottom + height / 2,
      z,
      worldMaterial(
        surfaces.material(kind, Math.max(w, d) / 1.8, height / 1.8),
      ),
      bottom < 0.1,
    );
    if (bottom < 0.1) {
      // Real skirting/cornice and a shallow dado give close walls scale.
      for (const [y, h, extra] of [
        [0.055, 0.1, 0.025],
        [0.78, 0.035, 0.018],
        [H - 0.045, 0.07, 0.025],
      ])
        box(w + extra, h, d + extra, x, y, z, m.wood);
      if (kind !== "tile")
        box(
          w + 0.008,
          0.72,
          d + 0.008,
          x,
          0.36,
          z,
          worldMaterial(
            surfaces.material("panel", Math.max(w, d) / 1.1, 0.8, 0x9b9e87),
          ),
        );
    }
    return mesh;
  }
  function captureArchitecture(build) {
    const firstObject = scene.children.length,
      firstCollider = b.colliders.length;
    build();
    const objects = scene.children.slice(firstObject),
      wallGroup = new T.Group();
    scene.add(wallGroup);
    objects.forEach((object) => wallGroup.add(object));
    return { group: wallGroup, colliders: b.colliders.slice(firstCollider) };
  }
  function wallRange(axis, fixed, from, to, kind = "wallpaper", holes = []) {
    let cursor = from;
    const openingHeight = 2.08;
    for (const hole of [...holes].sort((a, b) => a.center - b.center)) {
      const start = hole.center - hole.width / 2,
        end = hole.center + hole.width / 2;
      if (start > cursor) {
        const n = start - cursor;
        axis === "x"
          ? wall(wallThickness, n, fixed, (cursor + start) / 2, kind)
          : wall(n, wallThickness, (cursor + start) / 2, fixed, kind);
      }
      axis === "x"
        ? wall(
            wallThickness,
            hole.width,
            fixed,
            hole.center,
            kind,
            H - openingHeight,
            openingHeight,
          )
        : wall(
            hole.width,
            wallThickness,
            hole.center,
            fixed,
            kind,
            H - openingHeight,
            openingHeight,
          );
      cursor = end;
    }
    if (cursor < to) {
      const n = to - cursor;
      axis === "x"
        ? wall(wallThickness, n, fixed, (cursor + to) / 2, kind)
        : wall(n, wallThickness, (cursor + to) / 2, fixed, kind);
    }
  }
  function floor(minX, maxX, minZ, maxZ, kind = "floor") {
    const w = maxX - minX,
      d = maxZ - minZ,
      x = (minX + maxX) / 2,
      z = (minZ + maxZ) / 2;
    box(
      w,
      0.13,
      d,
      x,
      -0.071,
      z,
      worldMaterial(
        surfaces.material(
          kind,
          w / 1.8,
          d / 1.8,
          kind === "floor" ? 0x8f7355 : 0xffffff,
        ),
      ),
    );
    const ceiling = box(
      w,
      0.11,
      d,
      x,
      H + 0.055,
      z,
      worldMaterial(surfaces.material("plaster", w / 2, d / 2, 0xc6c6b5)),
    );
    ceiling.castShadow = false;
  }
  floor(-0.7, 0.7, -0.7, 7.56);
  floor(0.7, 9.26, -0.7, 0.7);
  for (const r of ROOMS)
    floor(
      r.minX - 0.06,
      r.maxX + 0.06,
      r.minZ - 0.06,
      r.maxZ + 0.06,
      ["kitchen", "bathroom"].includes(r.id)
        ? "tile"
        : r.id === "utility"
          ? "concrete"
          : "floor",
    );
  floor(6.78, 8.02, 0.7, 2.76, "concrete");
  // The two open legs meet once at (0,0). There is no partition to orbit.
  wallRange("x", -0.7, -0.7, 7.56, "wallpaper", [
    { center: 5.1, width: 1.0 },
    { center: 1.8, width: 0.94 },
  ]);
  wallRange("x", 0.7, 0.7, 7.56, "wallpaper", [{ center: 2.5, width: 0.96 }]);
  wallRange("z", -0.7, -0.7, 9.26, "wallpaper", [
    { center: 2.4, width: 1.0 },
    { center: 7.4, width: 0.98 },
  ]);
  const southWall = captureArchitecture(() =>
    wallRange("z", 0.7, 0.7, 9.26, "wallpaper", [
      { center: EXIT.x, width: 1.04 },
    ]),
  );
  const lostDoorWall = captureArchitecture(() =>
    wallRange("z", 0.7, 0.7, 9.26, "wallpaper"),
  );
  lostDoorWall.group.visible = false;
  lostDoorWall.colliders.forEach((collider) => (collider.disabled = true));
  const mirrorWall = captureArchitecture(() =>
    wallRange("x", 9.26, -0.7, 0.7, "plaster"),
  );
  const mirrorBarrier = mirrorWall.colliders[0];
  wallRange("z", 7.56, -0.7, 0.7, "plaster", [
    { center: FRONT_DOOR.x, width: 1.02 },
  ]);
  // Room envelopes share corridor walls above; their other three walls are closed.
  for (const r of ROOMS) {
    const kind =
      r.id === "bathroom"
        ? "tile"
        : r.id === "utility"
          ? "plaster"
          : "wallpaper";
    const west = r.minX - 0.06,
      east = r.maxX + 0.06,
      north = r.minZ - 0.06,
      south = r.maxZ + 0.06;
    if (r.id === "lounge" || r.id === "utility") {
      wallRange("x", west, north, south, kind);
      wallRange("z", north, west, -0.7, kind);
      wallRange("z", south, west, -0.7, kind);
    } else if (r.id === "bathroom") {
      wallRange("x", east, north, south, kind);
      wallRange("z", north, 0.7, east, kind);
      wallRange("z", south, 0.7, east, kind);
    } else {
      wallRange("x", west, north, -0.7, kind);
      wallRange("x", east, north, -0.7, kind);
      wallRange("z", north, west, east, kind);
    }
  }
  // A tiny rear vestibule is deep enough to step through the door before the cut.
  wallRange("x", 6.78, 0.7, 2.76, "plaster");
  wallRange("x", 8.02, 0.7, 2.76, "plaster");
  wallRange("z", 2.76, 6.78, 8.02, "plaster");
  const runnerMat = surfaces.material("fabric", 1, 7, 0x989180);
  const runner1 = box(0.61, 0.008, 7.7, 0, 0.001, 3.35, runnerMat);
  runner1.castShadow = false;
  const runner2 = box(
    8.1,
    0.008,
    0.61,
    4.63,
    0.001,
    0,
    surfaces.material("fabric", 7, 1, 0x989180),
  );
  runner2.castShadow = false;

  const roomDoors = {};
  function makeDoor(id, x, z, rotation, width = 0.9) {
    const g = group(x, 0, z, rotation),
      pivot = group(-width / 2, 0, 0, 0, g);
    const doorPaint =
      id === "kitchen"
        ? basic(0xb8b8a2, 0.66)
        : id === "back"
          ? basic(0x78877d, 0.59)
          : paint;
    const leaf = box(
      width,
      2.055,
      0.053,
      width / 2,
      1.0275,
      0,
      doorPaint,
      false,
      pivot,
      0.008,
    );
    for (const y of [0.51, 1.49])
      for (const side of [-1, 1]) {
        box(
          width - 0.16,
          0.78,
          0.009,
          width / 2,
          y,
          side * 0.031,
          id === "kitchen" ? doorPaint : darkPaint,
          false,
          pivot,
          0.006,
        );
        for (const sx of [-1, 1])
          box(
            0.022,
            0.81,
            0.014,
            width / 2 + sx * (width / 2 - 0.071),
            y,
            side * 0.039,
            doorPaint,
            false,
            pivot,
            0.004,
          );
        for (const sy of [-1, 1])
          box(
            width - 0.12,
            0.022,
            0.014,
            width / 2,
            y + sy * 0.4,
            side * 0.039,
            doorPaint,
            false,
            pivot,
            0.004,
          );
      }
    for (const side of [-1, 1]) {
      const escutcheon = cylinder(
        0.034,
        0.034,
        0.011,
        width - 0.12,
        1.0,
        side * 0.044,
        m.brass,
        pivot,
      );
      escutcheon.rotation.x = Math.PI / 2;
      box(
        0.1,
        0.022,
        0.031,
        width - 0.15,
        1.0,
        side * 0.067,
        m.brass,
        false,
        pivot,
        0.009,
      );
    }
    for (const side of [-1, 1])
      box(
        0.048,
        2.13,
        0.14,
        side * (width / 2 + 0.016),
        1.065,
        0.005,
        m.wood,
        false,
        g,
        0.004,
      );
    box(width + 0.13, 0.055, 0.14, 0, 2.12, 0.005, m.wood, false, g, 0.005);
    // Door label faces the corridor and is readable at its own practical light.
    if (id === "kitchen" || id === "back") {
      const label = basic(0xbcb89a, 0.72);
      label.map = writingTexture([id === "back" ? "GARDEN" : "KITCHEN"], {
        background: "#beb99e",
        color: "#393d32",
        font: 62,
      });
      box(
        0.27,
        0.085,
        0.008,
        width / 2,
        1.55,
        0.057,
        label,
        false,
        pivot,
        0.003,
      );
    }
    const proxy = box(width, 2.07, 0.12, 0, 1.035, 0, m.invisible, false, g),
      collider = b.solid(proxy);
    const targetId =
      id === "back" ? "door" : id === "front" ? "front-door" : "room-" + id;
    target(
      targetId,
      leaf,
      id === "back"
        ? "OPEN BACK DOOR"
        : id === "front"
          ? "TRY FRONT DOOR"
          : "OPEN " + id.toUpperCase(),
      2.15,
      pivot,
    );
    const result = {
      pivot,
      leaf,
      collider,
      x,
      z,
      width,
      rotation,
      group: g,
      containsThreshold(px, pz, padding = 0.27) {
        const dx = px - x,
          dz = pz - z;
        return (
          Math.abs(dx * Math.sin(rotation) + dz * Math.cos(rotation)) <
            padding &&
          Math.abs(dx * Math.cos(rotation) - dz * Math.sin(rotation)) <
            width * 0.65
        );
      },
    };
    if (!["front", "back"].includes(id)) roomDoors[id] = result;
    return result;
  }
  for (const r of ROOMS)
    makeDoor(r.id, r.doorX, r.doorZ, r.doorRotation, r.doorWidth);
  const front = makeDoor(
    "front",
    FRONT_DOOR.x,
    FRONT_DOOR.z,
    FRONT_DOOR.rotation,
    0.92,
  );
  const back = makeDoor("back", EXIT.x, EXIT.z, EXIT.rotation, 0.94);
  const frontNumber = basic(0xb6a582, 0.45, 0.5);
  frontNumber.map = writingTexture(["04"], {
    background: "#30362e",
    color: "#b5a780",
    font: 92,
  });
  box(0.16, 0.11, 0.008, 0.46, 1.7, 0.035, frontNumber, false, front.pivot);
  box(
    0.21,
    0.035,
    0.035,
    0.22,
    1.36,
    0.048,
    m.brass,
    false,
    front.pivot,
    0.006,
  );

  const furnishings = furnish(b, m),
    dressing = dressHouse(b, m, surfaces, furnishings);
  const wake = buildWake(b, m, surfaces, photos);
  const portal = new ThresholdPortal(scene, back);
  // Shallow hall console. Its drawer travels toward the hall but never occupies
  // the centre line, which remains navigable in this 1.28m-wide corridor.
  const console = group(4.7, 0, 0.47),
    consoleBody = box(
      0.68,
      0.4,
      0.2,
      0,
      0.63,
      0,
      m.wood,
      false,
      console,
      0.014,
    );
  box(0.73, 0.035, 0.24, 0, 0.835, 0, m.wood, false, console, 0.012);
  for (const x of [-0.27, 0.27])
    for (const z of [-0.065, 0.065])
      cylinder(0.013, 0.018, 0.43, x, 0.235, z, m.wood, console);
  b.solid(box(0.73, 0.87, 0.24, 0, 0.435, 0, m.invisible, false, console));
  contact(0.88, 0.4, 4.7, 0.47, 0.7);
  const drawerSlide = group(0, 0.63, -0.11, 0, console),
    drawerFace = box(
      0.63,
      0.19,
      0.026,
      0,
      0,
      0,
      m.wood,
      false,
      drawerSlide,
      0.008,
    );
  box(0.12, 0.018, 0.027, 0, 0, -0.026, m.brass, false, drawerSlide, 0.006);
  box(0.56, 0.012, 0.15, 0, -0.084, 0.07, m.black, false, drawerSlide);
  target("drawer", consoleBody, "OPEN CONSOLE DRAWER", 1.8, console);
  target("drawer", drawerFace, "OPEN CONSOLE DRAWER", 1.8, console);
  const key = group(0.07, -0.055, 0.055, 0, drawerSlide),
    keyRing = new T.Mesh(new T.TorusGeometry(0.025, 0.005, 8, 24), m.brass);
  keyRing.rotation.x = Math.PI / 2;
  key.add(keyRing);
  box(0.009, 0.012, 0.08, 0, 0, 0.055, m.brass, false, key);
  box(0.032, 0.012, 0.012, 0.01, 0, 0.095, m.brass, false, key);
  key.visible = false;
  const note = box(
    0.19,
    0.005,
    0.15,
    TARGETS.note.x,
    TARGETS.note.y,
    TARGETS.note.z,
    new T.MeshStandardMaterial({
      map: writingTexture(WRITINGS.note.split("\n").filter(Boolean), {
        font: 18,
      }),
      roughness: 1,
    }),
  );
  note.rotation.y = 0.12;
  target("note", note, "READ FOLDED NOTE", 1.7);
  // Small, familiar wall clock at the narrow last stretch.
  const clock = group(
    HALL_CLOCK.x,
    HALL_CLOCK.y - 0.15,
    HALL_CLOCK.z,
    HALL_CLOCK.rotation,
  );
  box(0.38, 0.69, 0.065, 0, 0, 0, m.wood, false, clock, 0.016);
  const clockFace = new T.Mesh(
    new T.CircleGeometry(0.16, 64),
    new T.MeshStandardMaterial({ map: clockTexture(), roughness: 0.82 }),
  );
  clockFace.position.set(0, 0.15, 0.04);
  clock.add(clockFace);
  const hourHand = group(0, 0.15, 0.051, 0, clock),
    minuteHand = group(0, 0.15, 0.056, 0, clock),
    secondHand = group(0, 0.15, 0.06, 0, clock);
  box(0.011, 0.1, 0.005, 0, 0.04, 0, m.black, false, hourHand);
  box(0.007, 0.14, 0.004, 0, 0.06, 0, m.black, false, minuteHand);
  box(0.004, 0.15, 0.003, 0, 0.06, 0, m.brass, false, secondHand);
  sphere(0.012, 0.012, 0.008, 0, 0.15, 0.066, m.brass, clock);
  const pendulum = group(0, -0.08, 0.05, 0, clock);
  cylinder(0.004, 0.004, 0.18, 0, -0.08, 0, m.brass, pendulum);
  const weight = cylinder(0.043, 0.043, 0.012, 0, -0.16, 0, m.brass, pendulum);
  weight.rotation.x = Math.PI / 2;
  target("clock", clockFace, "SET HALL CLOCK", 1.9, clock);
  function clockTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const g = c.getContext("2d");
    g.fillStyle = "#c8c1a8";
    g.fillRect(0, 0, 512, 512);
    g.fillStyle = "#34372f";
    g.font = "39px Georgia";
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (let i = 1; i <= 12; i++) {
      const a = (i / 6) * Math.PI;
      g.fillText(String(i), 256 + Math.sin(a) * 202, 256 - Math.cos(a) * 202);
    }
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    return t;
  }

  const lights = [];
  function point(color, intensity, distance, x, y, z) {
    const l = new T.PointLight(color, intensity, distance, 2);
    l.position.set(x, y, z);
    l.userData.base = intensity;
    scene.add(l);
    lights.push(l);
    return l;
  }
  function spot(
    color,
    intensity,
    distance,
    angle,
    x,
    y,
    z,
    tx,
    ty,
    tz,
    shadowed = false,
  ) {
    const l = new T.SpotLight(color, intensity, distance, angle, 0.78, 2);
    l.position.set(x, y, z);
    l.userData.base = intensity;
    l.target.position.set(tx, ty, tz);
    scene.add(l, l.target);
    lights.push(l);
    if (shadowed) {
      l.castShadow = true;
      l.shadow.mapSize.set(1536, 1536);
      l.shadow.bias = -0.00025;
      l.shadow.normalBias = 0.018;
      l.shadow.camera.near = 0.1;
      l.shadow.camera.far = distance;
      l.shadow.autoUpdate = false;
      l.shadow.needsUpdate = true;
    }
    return l;
  }
  function pendant(x, z) {
    cylinder(0.046, 0.046, 0.045, x, H - 0.032, z, m.brass);
    cylinder(0.006, 0.006, 0.1, x, H - 0.103, z, m.black);
    const shade = b.lathe(
      [
        [0.16, 0],
        [0.16, 0.012],
        [0.068, 0.13],
        [0.063, 0.145],
      ],
      x,
      H - 0.29,
      z,
      m.shade,
    );
    sphere(0.024, 0.028, 0.024, x, H - 0.282, z, m.bulb);
    return shade;
  }
  pendant(0, 5.9);
  pendant(0, 1.0);
  pendant(4.9, 0);
  const hallHero = spot(
    0xffd4a7,
    15,
    9,
    0.69,
    0,
    H - 0.325,
    5.9,
    0,
    0.8,
    1.4,
    true,
  );
  const entryFill = point(0xe9cda8, 1.2, 4, 0, H - 0.36, 5.9);
  const cornerFill = point(0xe7cda7, 4.8, 4.5, 0, H - 0.28, 1.0);
  const mirrorHero = spot(
    0xf0d6b7,
    5.5,
    5,
    0.77,
    8.86,
    2.08,
    0.32,
    7.7,
    1.0,
    0,
    true,
  );
  box(0.055, 0.27, 0.015, 8.89, 1.91, 0.615, m.brass, false, scene, 0.006);
  cylinder(0.035, 0.035, 0.25, 8.89, 1.91, 0.57, m.shade);
  for (const y of [1.777, 2.043])
    cylinder(0.04, 0.04, 0.018, 8.89, y, 0.57, m.brass);
  const mirrorLight = point(0xd7e4de, 1.0, 3, 8.97, 1.9, 0.3);
  const kitchenDoorLight = point(0xe7d3b1, 3.2, 3.3, 2.4, 1.97, -0.4);
  box(0.27, 0.1, 0.055, 2.4, 2.12, -0.57, m.brass);
  box(0.21, 0.06, 0.04, 2.4, 2.105, -0.532, m.shade);
  const kitchenLight = point(0xe4e4cb, 0.1, 4.1, 2.7, 2.15, -2.6);
  const utilityLight = point(0xe1e4d8, 1.3, 3.6, -2.0, 2.16, 1.8);
  const bathLight = point(0xd7ded0, 6.2, 3.2, 2.15, 2.02, 1.2);
  point(0xffd2a4, 5.3, 3.1, -1.22, 1.165, 6.78);
  point(0xffd5af, 3.5, 3.0, -4.04, 1.62, 7.02);
  const bedsideLight = point(0xffd2ab, 4.1, 2.6, 8.64, 1.05, -3.65);
  const loungeWindow = spot(
    0x8ea8b8,
    7,
    4.3,
    0.85,
    -4.35,
    1.6,
    4.1,
    -2.1,
    1.0,
    4.3,
  );
  const kitchenWindow = spot(
    0x92adbc,
    6,
    4.4,
    0.9,
    2.65,
    1.55,
    -4.4,
    2.6,
    0.8,
    -1.3,
  );
  const bathWindow = spot(
    0x9bb2bd,
    4,
    3.2,
    0.85,
    3.6,
    1.55,
    2.9,
    1.6,
    0.8,
    2.9,
  );
  const bedWindow = spot(0x91abb9, 5, 4.4, 0.9, 7.4, 1.6, -4.4, 7.4, 0.8, -1.2);
  const ambient = new T.HemisphereLight(0xa7bac0, 0x30271e, 0.19);
  scene.add(ambient);
  const exitLight = point(0xb9d1db, 0, 3.8, 7.4, 2.04, 2.4);
  // Small material accents created by the furnishing helpers should share the
  // restrained image-based fill used by the architectural PBR surfaces.
  scene.traverse((object) => {
    if (object.isMesh)
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material])
        if (material.envMapIntensity === 1) material.envMapIntensity = 0.06;
  });
  const worldUniforms = [];
  for (const material of worldMaterials) {
    const uniform = { value: 0 },
      previousCompile = material.onBeforeCompile,
      previousKey = material.customProgramCacheKey();
    material.onBeforeCompile = function (shader, renderer) {
      previousCompile.call(this, shader, renderer);
      shader.uniforms.mirrorWorld = uniform;
      shader.fragmentShader =
        "uniform float mirrorWorld;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        float drainedLuma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
        vec3 drainedColor=vec3(.84,.91,.96)*(.20+.80*drainedLuma);
        diffuseColor.rgb=mix(diffuseColor.rgb,drainedColor,mirrorWorld);`,
      );
    };
    material.customProgramCacheKey = () => previousKey + "|mirror-world-v1";
    worldUniforms.push(uniform);
  }
  const lightGroups = {
    entry: [hallHero, entryFill, cornerFill],
    bathroom: [bathLight, bathWindow],
    "far-hall": [mirrorHero, mirrorLight, kitchenDoorLight],
    bedroom: [bedsideLight, bedWindow],
  };
  for (const [zone, members] of Object.entries(lightGroups))
    for (const light of members) light.userData.zone = zone;
  for (const light of lights) {
    light.userData.originalColor = light.color.clone();
    light.userData.currentColor = light.color.clone();
    light.userData.currentBase = light.intensity;
  }
  let wakeSealed = false;
  let previousArchitecture = "";
  function applyHorrorLighting(envelope = {}) {
    for (const light of lights) {
      light.intensity = light.userData.currentBase;
      light.color.copy(light.userData.currentColor);
    }
    const multiplier = T.MathUtils.clamp(
      envelope.lightMultiplier ?? 1,
      0.08,
      1.3,
    );
    const affected =
      envelope.lightSource === "all"
        ? lights
        : lightGroups[envelope.lightSource] || [];
    for (const light of affected)
      light.intensity = light.userData.currentBase * multiplier;
  }
  function setStage(stage) {
    mirrorLight.color.set(stage >= 6 ? 0xdceef6 : 0xd7e4de);
    hallHero.color.set(stage >= 6 ? 0xc7dce9 : 0xffd4a7);
  }
  function updateDoor(d, opened, dt, rate = 5) {
    const desired = opened ? Math.PI * 0.5 : 0;
    const moving = Math.abs(d.pivot.rotation.y - desired) > 0.015;
    d.pivot.rotation.y = T.MathUtils.damp(
      d.pivot.rotation.y,
      desired,
      rate,
      dt,
    );
    d.collider.disabled = opened && d.pivot.rotation.y > 1.18;
    if (moving) {
      hallHero.shadow.needsUpdate = true;
      mirrorHero.shadow.needsUpdate = true;
    }
  }
  function animate(time, dt, state, player) {
    drawerSlide.position.z = T.MathUtils.damp(
      drawerSlide.position.z,
      state.drawerOpen ? -0.21 : -0.11,
      8,
      dt,
    );
    key.visible = state.keyAvailable && !state.hasKey;
    const backdoorGone = !!state.backdoorGone || state.stage >= 5;
    back.group.visible = !backdoorGone;
    southWall.group.visible = !backdoorGone;
    lostDoorWall.group.visible = backdoorGone;
    southWall.colliders.forEach(
      (collider) => (collider.disabled = backdoorGone),
    );
    lostDoorWall.colliders.forEach(
      (collider) => (collider.disabled = !backdoorGone),
    );
    updateDoor(back, !backdoorGone && !!state.doorOpen, dt, 4.5);
    if (backdoorGone) back.collider.disabled = true;
    const mirrorPassable = !!state.mirrorReady;
    mirrorWall.group.visible = !mirrorPassable;
    mirrorWall.colliders.forEach(
      (collider) => (collider.disabled = mirrorPassable),
    );
    const architectureState = `${backdoorGone}:${mirrorPassable}:${!!state.inverted}`;
    if (architectureState !== previousArchitecture) {
      hallHero.shadow.needsUpdate = mirrorHero.shadow.needsUpdate = true;
      previousArchitecture = architectureState;
    }
    if (state.wakeEntered && player?.z > 8.8) wakeSealed = true;
    updateDoor(front, !!state.frontOpen && !wakeSealed, dt, 3.3);
    portal.sync(state);
    for (const [id, door] of Object.entries(roomDoors))
      updateDoor(door, !!state.doors?.[id], dt);
    secondHand.rotation.z = (state.stage >= 1 ? 1 : -1) * time * 0.9;
    minuteHand.rotation.z = (-state.clockMinute / 60) * Math.PI * 2;
    hourHand.rotation.z =
      -(state.clockHour / 12 + state.clockMinute / 720) * Math.PI * 2;
    pendulum.rotation.z =
      Math.sin(time * 2.3) * (state.clockSolved ? 0.018 : 0.075);
    const inverted = !!state.inverted || state.stage >= 6;
    for (const uniform of worldUniforms) uniform.value = inverted ? 1 : 0;
    const previousExitIntensity = exitLight.intensity;
    for (const light of lights) {
      light.intensity = light.userData.base;
      light.color.copy(light.userData.originalColor);
    }
    hallHero.color.set(inverted ? 0xc7dce9 : 0xffd4a7);
    hallHero.intensity = inverted ? 18 : 15;
    entryFill.color.set(inverted ? 0xd5e5ee : 0xe9cda8);
    entryFill.intensity = inverted ? 2.2 : 1.2;
    cornerFill.color.set(inverted ? 0xd2e6f1 : 0xe7cda7);
    cornerFill.intensity = inverted ? 7.0 : 4.8;
    mirrorHero.color.set(inverted ? 0xd2e5ee : 0xf0d6b7);
    mirrorHero.intensity = inverted ? 7 : 5.5;
    mirrorLight.color.set(inverted ? 0xdceef6 : 0xd7e4de);
    mirrorLight.intensity = inverted ? 1.2 : 1.0;
    kitchenLight.intensity = state.power ? (inverted ? 12 : 7.5) : 0.1;
    kitchenLight.color.set(inverted ? 0xe1f1fb : 0xe4e4cb);
    utilityLight.intensity = state.power ? (inverted ? 6.5 : 4.5) : 1.3;
    utilityLight.color.set(inverted ? 0xc8deeb : 0xe1e4d8);
    kitchenDoorLight.color.set(inverted ? 0xe1f3ff : 0xe7d3b1);
    kitchenDoorLight.intensity = inverted ? 4.8 : 3.2;
    bathLight.color.set(inverted ? 0xd1e8f4 : 0xd7ded0);
    bathLight.intensity = inverted ? 9 : state.stage === 2 ? 4.2 : 6.2;
    bedsideLight.color.set(inverted ? 0xd7e7ef : 0xffd2ab);
    bedsideLight.intensity = state.lampOff ? 0 : inverted ? 2.6 : 4.1;
    for (const light of [loungeWindow, kitchenWindow, bathWindow, bedWindow])
      if (inverted) {
        light.color.set(0xe4f1fb);
        light.intensity = light.userData.base * 1.7;
      }
    ambient.color.set(inverted ? 0xd8e8ef : 0xa7bac0);
    ambient.groundColor.set(inverted ? 0x6b7376 : 0x30271e);
    ambient.intensity = inverted ? 0.45 : 0.19;
    exitLight.intensity = T.MathUtils.damp(
      previousExitIntensity,
      state.doorOpen && !backdoorGone ? 5 : 0,
      5,
      dt,
    );
    furnishings.animate?.(time, state, player);
    dressing.animate?.(time, state, player);
    if (wake.update) wake.update(time, dt, state, player);
    else wake.animate?.(time, state);
    for (const light of lights) {
      light.userData.currentBase = light.intensity;
      light.userData.currentColor.copy(light.color);
    }
  }
  function reset(state) {
    furnishings.reset?.();
    dressing.reset?.();
    for (const d of Object.values(roomDoors)) {
      d.pivot.rotation.y = 0;
      d.collider.disabled = false;
    }
    back.pivot.rotation.y = 0;
    back.collider.disabled = false;
    front.pivot.rotation.y = 0;
    front.collider.disabled = false;
    wakeSealed = false;
    previousArchitecture = "";
    wake.reset();
    portal.reset();
    drawerSlide.position.z = -0.11;
    key.visible = false;
    note.visible = true;
    setStage(0);
    animate(0, 0, state);
    hallHero.shadow.needsUpdate = mirrorHero.shadow.needsUpdate = true;
  }
  return {
    ...b,
    ...m,
    materials: m,
    surfaces,
    photos,
    roomDoors,
    doorPivot: back.pivot,
    doorCollider: back.collider,
    door: back.leaf,
    backDoor: back,
    frontDoor: front,
    mirrorBarrier,
    mirrorWall,
    lostDoorWall,
    portal,
    wake,
    drawer: consoleBody,
    drawerFace,
    drawerSlide,
    key,
    note,
    clock,
    lights,
    mirrorLight,
    exitLight,
    props: furnishings,
    furnishings,
    dressing,
    drainEvents: () => dressing.drainEvents?.() || [],
    roomAt,
    setStage,
    animate,
    reset,
    applyHorrorLighting,
    lightingGroups: lightGroups,
    architecture: {
      ceilingHeight: H,
      hallWidth: 1.28,
      frontDoor: FRONT_DOOR,
      backDoor: EXIT,
      shadowLights: [hallHero, mirrorHero],
    },
  };
}
