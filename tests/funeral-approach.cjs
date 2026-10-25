// Actual parlor collision, casket framing and exclusive camera handoff.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const url = (process.env.MIRROR_TEST_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const out = process.env.MIRROR_TEST_OUTPUT || "/tmp/mirror-me-funeral-approach";
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"] });
  const errors = [], failed = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.setDefaultTimeout(180000);
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    page.on("requestfailed", request => failed.push(request.url()));
    await page.route("**/__funeral-approach__", route => route.fulfill({ contentType: "text/html",
      body: '<!doctype html><style>body{margin:0}</style><link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>' }));
    await page.goto(url + "/__funeral-approach__");
    const result = await page.evaluate(async () => {
      const T = await import("three");
      const { buildHouse } = await import("/src/house.mjs");
      const { preloadCharacterAssets } = await import("/src/figure.mjs");
      const { preloadEvelynAssets } = await import("/src/evelyn.mjs");
      const { FuneralApproach } = await import("/src/funeral-approach.mjs");
      const { overlaps } = await import("/src/physics.mjs");
      const { Story } = await import("/src/story.mjs");
      const { Player } = await import("/src/player.mjs");
      const check = (ok, label) => { if (!ok) throw new Error(label); };
      await Promise.all([preloadCharacterAssets(), preloadEvelynAssets()]);
      const scene = new T.Scene(); scene.background = new T.Color(0x101417);
      const house = await buildHouse(scene), wake = house.wake;
      wake.prepare();
      const camera = new T.PerspectiveCamera(65, 1280 / 800, .055, 65);
      const player = new Player(camera);
      Object.assign(player, { x: .18, z: 8.36, yaw: Math.PI, pitch: -.08 });
      player.syncCamera();
      const state = new Story();
      state.stage = 6; state.inverted = state.frontOpen = state.wakeEntered = true;
      wake.begin(0, player); wake.beginReport(1.8);
      let samples = 0;
      for (const x of [-.2, 0, .2]) for (const z of [8.36, 8.45, 8.6]) {
        const controller = new FuneralApproach(wake.bounds, wake.colliders);
        controller.begin(0, { x, z, yaw: Math.PI, pitch: 0 });
        for (let time = 0; time <= 24; time += .04) {
          const pose = controller.update(time);
          check(pose.routeSafe, "Actual casket route is unexpectedly blocked");
          check(!wake.colliders.some(collider => overlaps(pose.x, pose.z, collider)), "Scripted approach clips the parlor");
          samples++;
        }
      }
      const renderer = new T.WebGLRenderer({ antialias: false });
      renderer.setSize(1280, 800); renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.13;
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
      document.body.append(renderer.domElement);
      window.drawApproach = age => {
        const pose = wake.approachCamera(age);
        Object.assign(player, { x: pose.x, z: pose.z, yaw: pose.yaw, pitch: pose.pitch, bobOffset: 0 });
        player.syncCamera();
        house.animate(age, 1 / 60, state, player);
        renderer.render(scene, camera);
        return { ...pose };
      };
      window.approachFixture = { wake, player, camera };
      return { result: "PASS", samples };
    });
    for (const [name, time] of [["entry", 0], ["survey-left", 2.4], ["survey-right", 5], ["aisle", 12], ["casket", 18.5]]) {
      await page.evaluate(time => window.drawApproach(time), time);
      await page.screenshot({ path: `${out}/${name}.png` });
    }
    const handoff = await page.evaluate(() => {
      const { wake, player, camera } = window.approachFixture;
      const check = (ok, label) => { if (!ok) throw new Error(label); };
      const hold = window.drawApproach(60);
      check(hold.holding, "Casket gaze was not held for the complete report");
      const head = wake.casketBody.getObjectByName("head").getWorldPosition(camera.position.clone()).project(camera);
      check(Math.abs(head.x) < .65 && Math.abs(head.y) < .6 && head.z < 1, "Mum's actual head is outside the final casket framing");
      check(wake.beginAttack(61, player, { enabled: true }), "Final strike did not receive camera ownership");
      check(!wake.approachCamera(61).active && wake.approachCamera(61).yaw === undefined,
        "Approach retained camera control during the final strike");
      check(wake.snapshot().attack.enabled, "Casket destination leaves no safe final lunge path");
      wake.reset();
      check(!wake.snapshot().approach.active && !wake.snapshot().attack.active, "Reset retained funeral camera control");
      return { finalPose: hold, casketHeadNdc: [head.x, head.y, head.z] };
    });
    assert.deepEqual(errors, []); assert.deepEqual(failed, []);
    console.log(JSON.stringify({ ...result, ...handoff, errors, failed, output: out }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
