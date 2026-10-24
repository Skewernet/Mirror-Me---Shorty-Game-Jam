const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const base = (process.env.MIRROR_TEST_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const out = process.env.MIRROR_TEST_OUTPUT || "/tmp/mirror-kitchen-frequency";
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"] });
  const errors = [], failed = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
    page.setDefaultTimeout(120000);
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    page.on("requestfailed", request => failed.push(request.url()));
    await page.route("**/__kitchen-frequency__", route => route.fulfill({ contentType: "text/html",
      body: '<!doctype html><style>body{margin:0}</style><link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>' }));
    await page.goto(base + "/__kitchen-frequency__");
    const report = await page.evaluate(async () => {
      const T = await import("three");
      const { buildHouse } = await import("/src/house.mjs");
      const { Story } = await import("/src/story.mjs");
      const { KITCHEN_FREQUENCY, KITCHEN_FREQUENCY_MARKS } = await import("/src/kitchen-frequency.mjs");
      const check = (condition, message) => { if (!condition) throw new Error(message); };
      const scene = new T.Scene(), house = await buildHouse(scene), state = new Story();
      state.power = true;
      const player = { x: 2.1, z: -2.15, yaw: Math.PI / 2, pitch: 0, speed: 0 };
      const clue = house.props.kitchenFrequency;
      check(clue && clue.markings.length === 9 && KITCHEN_FREQUENCY === "93.7", "The kitchen frequency artwork is incomplete");
      const textureIds = clue.textures.map(texture => texture.uuid);
      const targets = house.interactables.filter(item => item.id === "station-clue");
      check(targets.length === 9 && targets[0].mesh === clue.primary && targets.every(item => item.range === 2.4),
        "Station inspection does not use the authored surfaces/range");
      const visibleInTree = object => {
        for (let parent = object; parent; parent = parent.parent) if (!parent.visible) return false;
        return true;
      };
      const gateCases = [];
      for (const [stage, clockSolved, expected] of [[0,false,false],[1,true,false],[2,false,false],[2,true,true],[3,true,false],[6,true,false]]) {
        state.stage = stage; state.clockSolved = clockSolved;
        house.animate(1 + stage, 1 / 60, state, player);
        check(clue.root.visible === expected && targets.every(item => visibleInTree(item.mesh) === expected),
          `Station clue leaks before/after its chapter: ${stage}/${clockSolved}`);
        gateCases.push({ stage, clockSolved, visible: clue.root.visible });
      }
      state.stage = 2; state.clockSolved = true;
      house.animate(10, 1 / 60, state, player);
      scene.updateMatrixWorld(true);
      const normals = [];
      const wallFaces = { west: ["x", .9], east: ["x", 4.5], north: ["z", -4.6], entry: ["z", -.76] };
      const normal = new T.Vector3(), position = new T.Vector3(), local = new T.Vector3();
      const occluders = house.occluders.filter(visibleInTree);
      const furnishedSurfaces = [];
      scene.traverse(object => {
        if (object.isMesh && visibleInTree(object) && !object.userData.stationClue &&
          object.material?.opacity !== 0) furnishedSurfaces.push(object);
      });
      const camera = new T.PerspectiveCamera(65, 1100 / 800, .055, 65);
      for (const [index, mesh] of clue.markings.entries()) {
        const mark = KITCHEN_FREQUENCY_MARKS[index];
        const [axis, face] = wallFaces[mark.wall];
        normal.set(0, 0, 1).transformDirection(mesh.matrixWorld);
        mesh.getWorldPosition(position);
        const inward = new T.Vector3(2.7, 1.5, -2.6).sub(position);
        check(normal.dot(inward) > 0, "A frequency is backwards or facing outside the kitchen");
        check(mesh.material.side === T.FrontSide && !mesh.castShadow && !house.occluders.includes(mesh),
          "Blood writing adds a shadow/occlusion barrier or renders from behind");
        for (let vertex = 0; vertex < mesh.geometry.attributes.position.count; vertex++) {
          local.fromBufferAttribute(mesh.geometry.attributes.position, vertex).applyMatrix4(mesh.matrixWorld);
          check(Math.abs(Math.abs(local[axis] - face) - .003) < 1e-5, "Writing is not flush to its wall face");
          check(local.y > 1 && local.y < 2.24, "Writing crosses the counter or cornice");
        }
        const wallRay = new T.Raycaster(position.clone().addScaledVector(normal, .1), normal.clone().negate(), 0, .13);
        const wall = wallRay.intersectObjects(occluders, false)[0];
        check(wall && Math.abs(wall.distance - .103) < .006,
          `Writing is floating in front of a cupboard/window instead of its wall: ${index}`);
        for (const u of [-.4, 0, .4]) for (const v of [-.35, 0, .35]) {
          const point = mesh.localToWorld(new T.Vector3(mark.w * u, mark.h * v, 0));
          const sight = new T.Raycaster(point.clone().addScaledVector(normal, .4), normal.clone().negate(), 0, .43);
          const surface = sight.intersectObjects(furnishedSurfaces, false)[0];
          check(surface && Math.abs(surface.distance - .403) < .008,
            `Calendar, curtain or furnishing covers a writing patch: ${index}/${u}/${v}`);
        }
        camera.position.copy(position).addScaledVector(normal, 1.4);
        camera.lookAt(position); camera.updateMatrixWorld(true);
        const left = mesh.localToWorld(new T.Vector3(-mark.w / 2, 0, 0)).project(camera);
        const right = mesh.localToWorld(new T.Vector3(mark.w / 2, 0, 0)).project(camera);
        check(left.x < right.x, "Finger-written digits are mirrored from the room");
        normals.push({ wall: mark.wall, normal: normal.toArray() });
      }
      camera.position.set(player.x, 1.64, player.z);
      camera.lookAt(clue.primary.position); camera.updateMatrixWorld(true);
      const ray = new T.Raycaster(); ray.setFromCamera(new T.Vector2(), camera);
      const candidates = [...new Set([...targets.map(item => item.mesh), ...occluders])];
      const hit = ray.intersectObjects(candidates, false)[0];
      check(hit?.object === clue.primary && hit.distance < 2.4, "Radio-side viewpoint cannot inspect the primary wall clue");
      const ink = clue.textures.map(texture => {
        const canvas = texture.image, g = canvas.getContext("2d");
        const data = g.getImageData(0, 0, canvas.width, canvas.height).data;
        const ranges = [[100,310],[340,565],[585,630],[680,900]];
        const digits = ranges.map(([from, to]) => {
          let count = 0;
          for (let y = 40; y < 370; y++) for (let x = from; x < to; x++)
            if (data[(y * canvas.width + x) * 4 + 3] > 100) count++;
          return count;
        });
        check(digits.every(count => count > 350), "One finger-written digit or decimal is missing");
        check(data[3] === 0, "Blood writing has an opaque billboard background");
        return digits;
      });
      const renderer = new T.WebGLRenderer(); renderer.setSize(1100, 800);
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.13;
      document.body.append(renderer.domElement);
      await renderer.compileAsync(scene, camera);
      window.drawKitchenFrequency = view => {
        if (view === "primary") { camera.position.set(2.1, 1.64, -2.15); camera.lookAt(clue.primary.position); }
        else { camera.position.set(2.4, 1.64, -1.15); camera.lookAt(3.65, 1.55, -3.1); }
        camera.updateMatrixWorld(true); renderer.render(scene, camera);
      };
      window.drawKitchenFrequency("primary");
      house.reset(new Story());
      check(!clue.root.visible && targets.every(item => !visibleInTree(item.mesh)), "Reset leaves the frequency exposed");
      check(textureIds.every((id, index) => clue.textures[index].uuid === id), "Visibility changes regenerate the canvas textures");
      state.stage = 2; state.clockSolved = true;
      house.animate(12, 1 / 60, state, player);
      return { status: "PASS", text: KITCHEN_FREQUENCY, markings: clue.markings.length,
        textures: clue.textures.length, gateCases, normals, ink, primaryHitDistance: hit.distance,
        checks: ["actual chapter/clock visibility", "single-sided correctly oriented writing", "wall/counter/cornice contacts",
          "furnished room inspection sightline", "all four number components", "no new collision/occlusion", "reset and texture reuse"] };
    });
    for (const view of ["primary", "room"]) {
      await page.evaluate(view => window.drawKitchenFrequency(view), view);
      await page.screenshot({ path: `${out}/${view}.png`, timeout: 60000 });
    }
    assert.deepEqual(errors, []); assert.deepEqual(failed, []);
    fs.writeFileSync(`${out}/report.json`, JSON.stringify({ ...report, errors, failed }, null, 2));
    console.log(JSON.stringify({ ...report, errors, failed }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
