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
    p.setDefaultTimeout(120000);
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
      check(wake.casketBody.scale.equals(new T.Vector3(1, 1, 1)), "Attacker framing changed the clean casket mother's size");
      const body = wake.attackBody, skin = body.getObjectByName("Evelyn_Skin"), eyes = body.getObjectByName("Evelyn_Eyes");
      check(body.scale.x === 1.12 && body.scale.y === 1.12 && body.scale.z === 1.12,
        "The attacking apparition does not have its separate natural-height reach");
      const rest = skin.geometry.getAttribute("evelynWoundRest");
      const headRestY = body.worldToLocal(body.getObjectByName("head").getWorldPosition(new T.Vector3())).y;
      const used = new Set(skin.geometry.index.array);
      // Sample rendered facial triangles, not a head-bone estimate or unused
      // vertices inside the actual openings cut from the wounded mesh.
      const faceIndices = [...used].filter(i => rest.getY(i) > headRestY - .12 &&
        rest.getY(i) < headRestY + .15 && Math.abs(rest.getX(i)) < .11 && rest.getZ(i) < -.035);
      check(faceIndices.length > 100, "Actual face sampling found too few rendered vertices");
      const faceWounds = [];
      body.traverse(mesh => {
        if (mesh.isMesh && mesh.userData.evelynWound &&
          ["head", "neck_01"].includes(mesh.userData.attachmentBone)) faceWounds.push(mesh);
      });
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
      window.drawAttack = (time, render = true) => {
        wake.update(time, 1 / 60, state, player);
        const attack = wake.attackCamera(time);
        camera.rotation.set(attack.pitch || 0, attack.yaw || 0, 0, "YXZ");
        camera.updateMatrixWorld(true);
        if (render) renderer.render(scene, camera);
        else body.updateMatrixWorld(true);
        const head = wake.attackBody.getObjectByName("head").getWorldPosition(new T.Vector3());
        if (head.distanceTo(camera.position) < .23)
          throw new Error("Mother's head crosses the camera near plane at impact");
        eyes.skeleton.update();
        skin.skeleton.update();
        const eyeBox = new T.Box3(), point = new T.Vector3();
        for (let i = 0; i < eyes.geometry.attributes.position.count; i++)
          eyeBox.expandByPoint(eyes.localToWorld(eyes.getVertexPosition(i, point)));
        const eyePosition = eyeBox.getCenter(new T.Vector3());
        const eyeNdc = eyePosition.clone().project(camera);
        const faceNdc = new T.Box3();
        let nearestFace = Infinity;
        for (const i of faceIndices) {
          skin.localToWorld(skin.getVertexPosition(i, point));
          nearestFace = Math.min(nearestFace, -point.clone().applyMatrix4(camera.matrixWorldInverse).z);
          faceNdc.expandByPoint(point.clone().project(camera));
        }
        for (const mesh of faceWounds) for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
          mesh.localToWorld(mesh.getVertexPosition(i, point));
          nearestFace = Math.min(nearestFace, -point.clone().applyMatrix4(camera.matrixWorldInverse).z);
        }
        const visibleFaceFraction = Math.max(0, Math.min(1, faceNdc.max.y) - Math.max(-1, faceNdc.min.y)) / 2;
        if (attack.lunge > 0) {
          check(Math.abs(eyePosition.y - camera.position.y) < .01, "Mother's actual eyes do not meet the player's eye line");
          check(Math.abs(eyeNdc.y) < .05 && Math.abs(eyeNdc.x) < .08, "Mother's actual eyes miss the centre of the impact frame");
          check(nearestFace > camera.near + .08, "The actual facial surface clips the camera at impact");
          check(wake.casketBody.scale.equals(new T.Vector3(1, 1, 1)), "The clean casket mother was enlarged by the attack");
        }
        if (attack.phase === "impact")
          check(visibleFaceFraction >= .3, "Mother's face occupies less than 30 percent of the impact frame");
        return { ...wake.snapshot().attack, framing: { eyePosition: eyePosition.toArray(), eyeNdc: eyeNdc.toArray(), visibleFaceFraction, nearestFace } };
      };
      window.wakeFixture = { wake, state, player };
      return { status: "PASS", model: wake.attackBody.name, humanIsolated: true };
    });
    const approachSamples = await p.evaluate(() => {
      const samples = [];
      for (let elapsed = .205; elapsed <= .38; elapsed += 1 / 120) {
        const attack = window.drawAttack(10 + elapsed, false);
        samples.push({ elapsed, ...attack.framing });
      }
      return {
        samples: samples.length,
        maxEyeHeightError: Math.max(...samples.map(s => Math.abs(s.eyePosition[1] - 1.64))),
        maxEyeNdcOffset: Math.max(...samples.map(s => Math.hypot(s.eyeNdc[0], s.eyeNdc[1]))),
        minFacialClearance: Math.min(...samples.map(s => s.nearestFace)),
      };
    });
    const framing = [];
    for (const [name, time] of [["turn", 10.10], ["lunge", 10.29], ["impact", 10.50]]) {
      const attack = await p.evaluate(time => window.drawAttack(time), time);
      assert.equal(attack.visible, true);
      framing.push({ phase: name, ...attack.framing });
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
    console.log(JSON.stringify({ ...result, checks: ["owned wounded-human materials", "hidden before final voice", "single finite lunge", "actual wake collision clearance", "turn/lunge/impact shader renders", "actual face projection and near-plane clearance", "clean casket scale preserved", "reduced-scare cancellation", "reset"], approachSamples, framing, errors, failed }));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
