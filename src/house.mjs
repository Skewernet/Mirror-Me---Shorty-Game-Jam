import * as T from "three";
import {
  createSurfaces,
  paintingTexture,
  writingTexture,
} from "./surfaces.mjs";
export function buildHouse(scene) {
  const colliders = [],
    interactables = [],
    occluders = [],
    surfaces = createSurfaces();
  const wood = new T.MeshStandardMaterial({ color: 0x302c20, roughness: 0.85 }),
    brass = new T.MeshStandardMaterial({
      color: 0x9e8151,
      metalness: 0.65,
      roughness: 0.55,
    }),
    black = new T.MeshStandardMaterial({ color: 0x161d19, roughness: 0.8 }),
    cream = new T.MeshStandardMaterial({ color: 0xb7ad86, roughness: 1 });
  function box(
    w,
    h,
    d,
    x,
    y,
    z,
    material = wood,
    solid = false,
    parent = scene,
  ) {
    const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    if (solid) {
      colliders.push({
        minX: x - w / 2,
        maxX: x + w / 2,
        minZ: z - d / 2,
        maxZ: z + d / 2,
      });
      occluders.push(mesh);
    }
    return mesh;
  }
  function cylinder(
    r1,
    r2,
    h,
    x,
    y,
    z,
    material = wood,
    parent = scene,
    segments = 10,
  ) {
    const o = new T.Mesh(new T.CylinderGeometry(r1, r2, h, segments), material);
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  }
  function wall(w, d, x, z) {
    box(
      w,
      3,
      d,
      x,
      1.5,
      z,
      surfaces.material("wallpaper", Math.max(w, d) * 1.4, 2.8),
      true,
    );
    box(
      w + 0.025,
      0.95,
      d + 0.025,
      x,
      0.475,
      z,
      surfaces.material("panel", Math.max(w, d) * 0.85, 1),
    );
    for (const [y, h] of [
      [0.09, 0.13],
      [0.96, 0.065],
      [1.02, 0.025],
      [2.92, 0.12],
    ])
      box(w + 0.05, h, d + 0.05, x, y, z, wood);
  }
  box(7, 0.15, 15.2, 1.75, -0.08, 0, surfaces.material("floor", 5, 9));
  box(7, 0.15, 15.2, 1.75, 3.05, 0, surfaces.material("ceiling", 4, 8));
  wall(0.2, 15.2, -1.75, 0);
  wall(0.2, 15.2, 5.25, 0);
  wall(7.2, 0.2, 1.75, -7.6);
  wall(1.1, 0.2, -1.2, 7.6);
  wall(4.65, 0.2, 2.975, 7.6);
  wall(0.2, 8.4, 1.75, 0);
  box(1.12, 0.018, 12.8, 0, 0.01, 0, surfaces.material("rug", 1, 7));
  box(0.85, 0.016, 8, 3.5, 0.01, 0, surfaces.material("rug", 1, 5, 0x6a755f));
  // Front door and narrow exit space.
  const doorCollider = { minX: -0.65, maxX: 0.65, minZ: 7.4, maxZ: 7.75 };
  colliders.push(doorCollider);
  const doorPivot = new T.Group();
  doorPivot.position.set(-0.65, 0, 7.5);
  scene.add(doorPivot);
  const door = box(1.3, 2.62, 0.12, 0.65, 1.31, 0, black, false, doorPivot);
  for (const x of [0.3, 1])
    for (const y of [0.65, 1.8]) {
      box(0.48, 0.88, 0.025, x, y, -0.075, wood, false, doorPivot);
      box(0.4, 0.8, 0.025, x, y, -0.095, black, false, doorPivot);
    }
  const handle = cylinder(0.05, 0.05, 0.12, 1.1, 1.08, -0.15, brass, doorPivot);
  handle.rotation.x = Math.PI / 2;
  box(0.15, 0.035, 0.05, 1.04, 1.08, -0.2, brass, false, doorPivot);
  for (const x of [-0.72, 0.72]) box(0.12, 2.76, 0.18, x, 1.38, 7.46, wood);
  box(1.55, 0.14, 0.18, 0, 2.75, 7.46, wood);
  box(1.3, 0.4, 0.2, 0, 2.84, 7.6, surfaces.material("wallpaper", 2, 0.5));
  box(1.7, 0.15, 3, 0, -0.08, 9, surfaces.material("floor", 1, 2));
  wall(0.2, 3, -0.85, 9);
  wall(0.2, 3, 0.85, 9);
  wall(1.9, 0.2, 0, 10.5);
  box(1.7, 0.15, 3, 0, 3.05, 9, black);
  const number = box(
    0.32,
    0.18,
    0.02,
    0,
    2.02,
    7.42,
    new T.MeshStandardMaterial({
      map: writingTexture(["04"], {
        background: "#222a23",
        color: "#c1aa77",
        font: 72,
      }),
      roughness: 0.7,
    }),
  );
  // Console table: the drawers really move and the key sits inside.
  const consoleGroup = new T.Group();
  consoleGroup.position.set(1.26, 0, 1.05);
  scene.add(consoleGroup);
  const drawer = box(0.62, 0.56, 1.18, 0, 0.62, 0, wood, false, consoleGroup);
  for (const z of [-0.47, 0.47])
    for (const x of [-0.2, 0.2])
      box(0.07, 0.4, 0.07, x, 0.2, z, black, false, consoleGroup);
  box(0.72, 0.08, 1.28, 0, 0.94, 0, black, false, consoleGroup);
  const drawerSlide = new T.Group();
  drawerSlide.position.set(-0.32, 0.64, 0);
  consoleGroup.add(drawerSlide);
  const drawerFace = box(0.07, 0.3, 1.05, 0, 0, 0, wood, false, drawerSlide);
  box(0.09, 0.045, 0.16, -0.07, 0, 0, brass, false, drawerSlide);
  box(0.47, 0.025, 0.94, 0.25, -0.12, 0, black, false, drawerSlide);
  colliders.push({ minX: 0.6, maxX: 1.62, minZ: 0.4, maxZ: 1.7 });
  const key = new T.Group();
  key.position.set(0.18, -0.08, 0);
  drawerSlide.add(key);
  key.visible = false;
  const ring = new T.Mesh(new T.TorusGeometry(0.055, 0.012, 4, 10), brass);
  ring.rotation.x = Math.PI / 2;
  key.add(ring);
  box(0.025, 0.022, 0.18, 0, 0, 0.1, brass, false, key);
  box(0.07, 0.025, 0.025, 0.02, 0, 0.18, brass, false, key);
  occluders.push(drawer);
  interactables.push({
    id: "drawer",
    mesh: drawer,
    label: "OPEN DRAWER",
    range: 1.9,
  });
  // A folded instruction; it is collected into the pocket.
  const note = box(
    0.3,
    0.008,
    0.23,
    1.08,
    1,
    0.78,
    new T.MeshStandardMaterial({
      map: writingTexture(["IF THE HALL", "RETURNS,", "WATCH THE GLASS."], {
        font: 22,
      }),
      roughness: 1,
    }),
  );
  note.rotation.y = 0.2;
  interactables.push({
    id: "note",
    mesh: note,
    label: "READ FOLDED NOTE",
    range: 1.8,
  });
  // Ceramic table lamp.
  cylinder(0.11, 0.16, 0.16, 1.29, 1.06, 1.37, cream);
  cylinder(0.025, 0.025, 0.25, 1.29, 1.22, 1.37, brass);
  cylinder(
    0.16,
    0.27,
    0.3,
    1.29,
    1.46,
    1.37,
    new T.MeshStandardMaterial({
      color: 0xb09b6f,
      emissive: 0x8a572b,
      emissiveIntensity: 0.35,
    }),
  );
  const tableLight = new T.PointLight(0xffc077, 5, 4, 2);
  tableLight.position.set(1.15, 1.55, 1.35);
  scene.add(tableLight);
  interactables.push({
    id: "door",
    mesh: door,
    label: "TRY FRONT DOOR",
    range: 2.5,
  });
  // Framed original landscape. The second pass turns it upside down.
  const painting = new T.Group();
  painting.position.set(-1.61, 1.94, 3.15);
  painting.rotation.y = Math.PI / 2;
  scene.add(painting);
  box(0.91, 1.12, 0.07, 0, 0, 0, wood, false, painting);
  box(0.81, 1.02, 0.025, 0, 0, 0.05, brass, false, painting);
  box(
    0.72,
    0.93,
    0.025,
    0,
    0,
    0.07,
    new T.MeshStandardMaterial({ map: paintingTexture(), roughness: 1 }),
    false,
    painting,
  );
  // Side doors make the hallway domestic without adding rooms.
  function sideDoor(x, z, rotation) {
    const g = new T.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotation;
    scene.add(g);
    box(0.99, 2.48, 0.07, 0, 1.24, 0, wood, false, g);
    for (const y of [0.65, 1.73])
      box(0.77, 0.83, 0.03, 0, y, 0.055, black, false, g);
    box(0.085, 0.085, 0.1, 0.34, 1.06, 0.09, brass, false, g);
    for (const sx of [-0.57, 0.57])
      box(0.12, 2.63, 0.12, sx, 1.3, 0, black, false, g);
    box(1.25, 0.12, 0.12, 0, 2.6, 0, black, false, g);
    return g;
  }
  sideDoor(-1.61, -4.65, Math.PI / 2);
  sideDoor(1.61, -2.75, -Math.PI / 2);
  sideDoor(5.11, 2.5, -Math.PI / 2);
  // Pendulum clock, visible on approach to the first corner.
  const clock = new T.Group();
  clock.position.set(0.6, 1.88, -7.44);
  scene.add(clock);
  box(0.67, 1.14, 0.16, 0, 0, 0, wood, false, clock);
  const face = new T.Mesh(new T.CircleGeometry(0.265, 20), cream);
  face.position.set(0, 0.2, 0.091);
  clock.add(face);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    box(
      0.025,
      0.04,
      0.009,
      Math.sin(a) * 0.22,
      0.2 + Math.cos(a) * 0.22,
      0.1,
      black,
      false,
      clock,
    );
  }
  const hands = new T.Group();
  hands.position.set(0, 0.2, 0.11);
  clock.add(hands);
  box(0.02, 0.19, 0.01, 0, 0.08, 0, black, false, hands);
  box(0.14, 0.02, 0.01, 0.055, 0, 0.005, black, false, hands);
  const pendulum = new T.Group();
  pendulum.position.set(0, -0.12, 0.1);
  clock.add(pendulum);
  box(0.015, 0.3, 0.015, 0, -0.14, 0, brass, false, pendulum);
  const bob = cylinder(0.08, 0.08, 0.025, 0, -0.32, 0, brass, pendulum);
  bob.rotation.x = Math.PI / 2;
  // Narrow transom with impossible cold night light.
  box(0.05, 0.75, 1.22, 5.12, 2, -3.2, wood);
  box(
    0.055,
    0.61,
    1.08,
    5.08,
    2,
    -3.2,
    new T.MeshBasicMaterial({ color: 0x526e6b }),
  );
  box(0.07, 0.04, 1.1, 5.04, 2, -3.2, black);
  box(0.07, 0.65, 0.035, 5.04, 2, -3.2, black);
  const nightLight = new T.PointLight(0x8cb8bb, 4.5, 6, 2);
  nightLight.position.set(4.7, 2, -3.2);
  scene.add(nightLight);
  const lights = [tableLight];
  for (const [x, z] of [
    [0, 4.65],
    [0, -4.9],
    [3.5, -6],
    [3.5, 5.9],
  ]) {
    cylinder(0.08, 0.08, 0.16, x, 2.87, z, brass);
    cylinder(0.015, 0.015, 0.24, x, 2.65, z, black);
    cylinder(0.15, 0.32, 0.23, x, 2.44, z, wood);
    const bulb = new T.Mesh(
      new T.SphereGeometry(0.075, 8, 6),
      new T.MeshBasicMaterial({ color: 0xffd496 }),
    );
    bulb.position.set(x, 2.34, z);
    scene.add(bulb);
    const light = new T.PointLight(0xffcc8b, 17, 8, 2);
    light.position.set(x, 2.26, z);
    scene.add(light);
    lights.push(light);
  }
  const ambient = new T.HemisphereLight(0x9da99b, 0x30291e, 0.65);
  scene.add(ambient);
  const mirrorLight = new T.PointLight(0xc5d2c7, 3.8, 4.5, 2);
  mirrorLight.position.set(-0.7, 2.1, -0.3);
  scene.add(mirrorLight);
  const exitLight = new T.PointLight(0xa7ced2, 0, 5);
  exitLight.position.set(0, 2, 9);
  scene.add(exitLight);
  // Small authored clutter: umbrella stand, phone, coat hooks, skirting stains.
  cylinder(0.18, 0.14, 0.55, -1.22, 0.28, 5.8, black);
  for (let i = 0; i < 3; i++) {
    const o = cylinder(0.015, 0.015, 1.05, -1.2 + i * 0.055, 0.9, 5.8, wood);
    o.rotation.z = (i - 1) * 0.1;
  }
  box(0.14, 0.22, 0.55, 1.25, 1.08, 0.7, black);
  box(0.17, 0.06, 0.64, 1.25, 1.21, 0.7, black);
  for (let i = 0; i < 3; i++) {
    box(0.08, 0.06, 0.12, -1.56, 1.7, 5 + i * 0.26, brass);
  }
  function setStage(stage) {
    painting.rotation.z = stage >= 1 ? Math.PI : 0;
    mirrorLight.color.set(stage >= 1 ? 0xb0c9c8 : 0xc5d2c7);
  }
  function animate(time, dt, state) {
    hands.rotation.z = time * (state.stage > 0 ? 0.06 : -0.06);
    pendulum.rotation.z = Math.sin(time * 2.2) * 0.14;
    drawerSlide.position.x = T.MathUtils.damp(
      drawerSlide.position.x,
      state.drawerOpen ? -0.74 : -0.32,
      8,
      dt,
    );
    key.visible = state.keyAvailable && !state.hasKey;
    doorPivot.rotation.y = T.MathUtils.damp(
      doorPivot.rotation.y,
      state.doorOpen ? -Math.PI * 0.51 : 0,
      2.2,
      dt,
    );
    doorCollider.disabled = state.doorOpen && doorPivot.rotation.y < -0.95;
    exitLight.intensity = T.MathUtils.damp(
      exitLight.intensity,
      state.doorOpen ? 13 : 0,
      3,
      dt,
    );
    // One sick bulb; irregular low-amplitude flutter rather than flashing the room.
    lights[3].intensity =
      16 + Math.sin(time * 7.3) * 0.45 + Math.sin(time * 11.1) * 0.25;
  }
  return {
    colliders,
    interactables,
    occluders,
    box,
    cylinder,
    wood,
    brass,
    black,
    cream,
    drawer,
    drawerFace,
    drawerSlide,
    key,
    note,
    doorPivot,
    doorCollider,
    door,
    lights,
    mirrorLight,
    exitLight,
    setStage,
    animate,
  };
}
