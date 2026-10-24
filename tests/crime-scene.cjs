// The remembered assault is attached to the same house and is absent before
// crossing the glass. Render review outputs stay outside the checkout.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const url = (process.env.MIRROR_TEST_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const out = process.env.MIRROR_TEST_OUTPUT || "/tmp/mirror-me-crime-scene";
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    const errors = [], failed = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
    page.on("requestfailed", r => failed.push(r.url()));
    await page.route("**/__crime-scene__", route => route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><style>body{margin:0}</style><link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>',
    }));
    await page.goto(url + "/__crime-scene__");
    const report = await page.evaluate(async () => {
      const T = await import("three");
      const { buildHouse } = await import("/src/house.mjs");
      const { preloadCharacterAssets } = await import("/src/figure.mjs");
      const { Story } = await import("/src/story.mjs");
      const { Picture } = await import("/src/picture.mjs");
      const { ROOMS } = await import("/src/layout.mjs");
      const check = (condition, message) => { if (!condition) throw new Error(message); };
      await preloadCharacterAssets();
      const scene = new T.Scene();
      scene.background = new T.Color(0x101417);
      scene.fog = new T.FogExp2(0x101417, .025);
      const house = await buildHouse(scene);
      house.revelation.prepare();
      const revelation = house.revelation;
      const state = new Story();
      const original = [...house.colliders];
      const water = [];
      scene.traverse(object => {
        if (object.geometry?.type === "CircleGeometry" && Math.abs(object.position.x - 3.22) < .001 && Math.abs(object.position.y - .345) < .001)
          water.push(object);
      });
      check(water.length === 1, "Original clean bathwater was not identified");
      house.reset(state);
      check(!revelation.snapshot().visible, "Blood leaked into the ordinary house");
      check(water[0].visible, "Ordinary bathroom lost its clean water");
      const evidence = house.interactables.filter(item => item.id.startsWith("evidence-"));
      check(evidence.length === 3, "Three physical evidence locations are required");
      check(evidence.every(item => {
        for (let parent = item.mesh; parent; parent = parent.parent) if (!parent.visible) return true;
        return false;
      }), "An evidence prompt is available before the revelation");
      state.stage = 6;
      state.inverted = state.power = true;
      state.backdoorGone = true;
      house.animate(1, 0, state, { x: 7.4, z: 0, yaw: 0 });
      const snapshot = revelation.snapshot();
      check(snapshot.visible && snapshot.origin === "bathroom", "The assault origin is missing");
      check(snapshot.escapeTrail === 21 && snapshot.bloodiedBath && snapshot.curtainPulledAside, "The bath-to-bed trail or exposed bath is incomplete");
      check(!water[0].visible, "Clean water remains above the bloodied bath");
      check(snapshot.bloodSurfaces >= 50, "Apartment-wide blood surfaces are missing");
      check(snapshot.newColliders === 0 && house.colliders.length === original.length, "Evidence changed house traversal collisions");
      const path = snapshot.trailRoute;
      check(path[0][0] > 2 && path[0][1] > 2, "Trail must start by the bath");
      check(path.at(-1)[0] > 7 && path.at(-1)[1] < -1.8, "Trail must finish at the bedroom bed");
      let maxGap = 0;
      for (let i = 1; i < path.length; i++) maxGap = Math.max(maxGap, Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
      check(maxGap < .9, "The fleeing victim's path has a disconnected gap");
      const bath = revelation.group.getObjectByName("Blood on the enamel bath");
      check(bath && bath.geometry.type === "LatheGeometry" && bath.scale.z === 1.9, "Blood does not conform to the actual bathtub");
      const coveredRooms = ROOMS.filter(room => revelation.group.children.some(object =>
        object.isMesh && /Blood|blood/.test(object.name) &&
        object.position.x > room.minX && object.position.x < room.maxX &&
        object.position.z > room.minZ && object.position.z < room.maxZ,
      )).map(room => room.id);
      check(coveredRooms.length === 5, "Blood evidence does not reach all five rooms");
      let meshes = 0;
      revelation.group.traverse(object => {
        if (!object.isMesh) return;
        meshes++;
        const position = object.geometry.attributes.position;
        for (let i = 0; i < position.array.length; i++) check(Number.isFinite(position.array[i]), "Crime-scene geometry contains a non-finite vertex");
      });
      const renderer = new T.WebGLRenderer({ antialias: false });
      renderer.setSize(1000, 700);
      renderer.setPixelRatio(1);
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.13;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = T.PCFSoftShadowMap;
      document.body.append(renderer.domElement);
      const camera = new T.PerspectiveCamera(65, 1000 / 700, .055, 65);
      const picture = new Picture(renderer, camera);
      picture.resize(1000, 700, 1080);
      window.fixture = { house, scene, renderer, camera, picture, state };
      window.crimeView = (position, target) => {
        camera.position.set(...position);
        camera.lookAt(...target);
        camera.updateMatrixWorld(true);
        picture.render(scene, camera);
      };
      window.crimeView([2, 1.64, 2.0], [3.22, .8, 3.05]);
      return { bloodSurfaces: snapshot.bloodSurfaces, trailPoints: path.length, maxGap, meshes, coveredRooms, evidence: evidence.map(item => item.id) };
    });
    for (const [name, position, target] of [
      ["bathroom-origin", [1.8, 1.64, 2.05], [3.22, .68, 3.05]],
      ["hall-trail", [6.8, 1.64, .15], [2.5, .75, 0]],
      ["kitchen-transfer", [2.6, 1.64, -2.95], [2.35, .94, -4.15]],
      ["bedroom", [7.8, 1.64, -1.3], [7.4, .8, -3.25]],
    ]) {
      await page.evaluate(([position, target]) => window.crimeView(position, target), [position, target]);
      await page.screenshot({ path: `${out}/${name}.png` });
    }
    await page.evaluate(() => {
      const { house, state } = window.fixture;
      state.reset(); house.reset(state);
      const snapshot = house.revelation.snapshot();
      if (snapshot.visible || snapshot.escapeTrail || snapshot.bloodiedBath || snapshot.evidence.length)
        throw new Error("Restart retained physical evidence or its prompts");
    });
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
    console.log(JSON.stringify({ status: "PASS", ...report, errors, failed }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
