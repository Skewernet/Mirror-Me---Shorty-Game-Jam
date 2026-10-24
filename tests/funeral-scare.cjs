const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const url = (process.env.MIRROR_TEST_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const out = process.env.MIRROR_TEST_OUTPUT || "/tmp/mirror-me-funeral-scare";
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  const errors = [], failed = [];
  try {
    const p = await browser.newPage({ viewport: { width: 1000, height: 760 } });
    p.on("pageerror", e => errors.push(e.message));
    p.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
    p.on("requestfailed", r => failed.push(r.url()));
    await p.route("**/__funeral-scare__", route => route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><style>body{margin:0}</style><link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>',
    }));
    await p.goto(url + "/__funeral-scare__");
    const result = await p.evaluate(async () => {
      const T = await import("three");
      const { buildHouse } = await import("/src/house.mjs");
      const { preloadCharacterAssets, createFigure } = await import("/src/figure.mjs");
      const { preloadEvelynAssets } = await import("/src/evelyn.mjs");
      const { Story } = await import("/src/story.mjs");
      const { overlaps } = await import("/src/physics.mjs");
      const check = (ok, label) => { if (!ok) throw new Error(label); };
      await Promise.all([preloadCharacterAssets(), preloadEvelynAssets()]);
      const normal = createFigure({}, 0);
      const fingerprint = () => {
        const values = [];
        normal.body.traverse(o => { if (o.isMesh) values.push(o.material.color.getHex(), o.material.roughness, o.material.customProgramCacheKey()); });
        return JSON.stringify(values);
      };
      const before = fingerprint();
      const scene = new T.Scene();
      scene.background = new T.Color(0x101417);
      const house = await buildHouse(scene);
      house.wake.prepare();
      check(before === fingerprint(), "Mother variant changed ordinary Mara's materials");
      check(house.wake.attackBody.userData.characterAsset === "assets/character/evelyn.glb",
        "The mother must use her separate elderly character model");
      check(house.wake.snapshot().attack.wounds.removedFaces > 0,
        "The wounded model needs actual openings rather than surface paint alone");
      const state = new Story();
      state.stage = 6;
      state.inverted = state.frontOpen = state.wakeEntered = true;
      const player = { x: 0, z: 10.2, yaw: Math.PI, pitch: 0 };
      const wake = house.wake;
      wake.begin(0, player);
      check(wake.attackBody.visible === false, "Mother appears before final accusation");
      check(wake.beginAttack(10, player, { enabled: true }), "Attack did not start");
      check(!wake.beginAttack(10.1, player, { enabled: true }), "Attack was triggered twice");
      check(wake.snapshot().attack.enabled, "Clear central aisle has no lunge path");
      for (let t = 10; t <= 11.95; t += 1 / 120) {
        const attack = wake.attackCamera(t);
        check(!wake.colliders.some(c => overlaps(attack.x, attack.z, c, .23)), "Mother lunge crosses a chair/wall");
      }
      const renderer = new T.WebGLRenderer({ antialias: false });
      renderer.setSize(1000, 760);
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.13;
      renderer.outputColorSpace = T.SRGBColorSpace;
      document.body.append(renderer.domElement);
      const camera = new T.PerspectiveCamera(65, 1000 / 760, .055, 65);
      camera.rotation.order = "YXZ";
      camera.position.set(player.x, 1.64, player.z);
      await renderer.compileAsync(wake.attackBody, camera, scene);
      window.drawAttack = time => {
        wake.update(time, 1 / 60, state, player);
        const attack = wake.attackCamera(time);
        camera.rotation.set(attack.pitch || 0, attack.yaw || 0, 0, "YXZ");
        camera.updateMatrixWorld(true);
        renderer.render(scene, camera);
        const head = wake.attackBody.getObjectByName("head").getWorldPosition(new T.Vector3());
        if (head.distanceTo(camera.position) < .23)
          throw new Error("Mother's head crosses the camera near plane at impact");
        return wake.snapshot().attack;
      };
      window.wakeFixture = { wake, state, player };
      return { status: "PASS", model: wake.attackBody.name, humanIsolated: true };
    });
    for (const [name, time] of [["turn", 10.10], ["lunge", 10.29], ["impact", 10.50]]) {
      const attack = await p.evaluate(time => window.drawAttack(time), time);
      assert.equal(attack.visible, true);
      await p.screenshot({ path: `${out}/${name}.png`, timeout: 60000 });
    }
    await p.evaluate(() => {
      const { wake, player } = window.wakeFixture;
      wake.reduceAttack(10.50);
      if (wake.attackBody.visible || wake.attackCamera(10.50).yaw !== undefined)
        throw new Error("Disabling paused scare retained mother or camera control");
      if (!wake.attackCamera(11.61).done) throw new Error("Reduced ending failed to finish");
      wake.reset();
      if (wake.attackBody.visible || wake.snapshot().attack.active) throw new Error("Reset retained the attacker");
      wake.begin(20, player);
      wake.beginAttack(20, player, { enabled: false });
      if (wake.attackBody.visible || wake.attackCamera(20).enabled) throw new Error("Comfort mode exposed the attacker");
    });
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
    console.log(JSON.stringify({ ...result, checks: ["owned wounded-human materials", "hidden before final voice", "single finite lunge", "actual wake collision clearance", "turn/lunge/impact shader renders", "reduced-scare cancellation", "reset"], errors, failed }));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
