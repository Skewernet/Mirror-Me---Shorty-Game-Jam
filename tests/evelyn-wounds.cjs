// Actual independent model: physical cuts, owned surfaces and bone attachment.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const url = (process.env.MIRROR_TEST_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const out = process.env.MIRROR_TEST_OUTPUT || "/tmp/mirror-me-evelyn-wounds";
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox", "--enable-unsafe-swiftshader"] });
  const errors = [], failed = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    page.setDefaultTimeout(120000);
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    page.on("requestfailed", request => failed.push(request.url()));
    await page.route("**/__evelyn-wounds__", route => route.fulfill({ contentType: "text/html", body: '<!doctype html><style>body{margin:0}</style><link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>' }));
    await page.goto(url + "/__evelyn-wounds__");
    const report = await page.evaluate(async () => {
      const T = await import("three");
      const { preloadEvelynAssets, createEvelyn } = await import("/src/evelyn.mjs");
      const check = (ok, message) => { if (!ok) throw new Error(message); };
      await preloadEvelynAssets();
      const clean = createEvelyn(), skin = clean.visual.getObjectByName("Evelyn_Skin"), cloth = clean.visual.getObjectByName("Evelyn_Clothes");
      const original = { skinIndices: skin.geometry.index.count, clothIndices: cloth.geometry.index.count, skinGeometry: skin.geometry, clothGeometry: cloth.geometry, material: skin.material };
      const wounded = createEvelyn({ wounded: true });
      const woundSkin = wounded.visual.getObjectByName("Evelyn_Skin"), woundCloth = wounded.visual.getObjectByName("Evelyn_Clothes");
      const stats = wounded.wounds.stats;
      check(stats.wounds === 5 && stats.meshes >= 20, "The physical wound geometry is incomplete");
      check(stats.triangles > 3000 && stats.triangles < 10000, "Wound detail does not fit the intended model budget");
      check(stats.removedFaces > 20 && woundSkin.geometry.index.count < original.skinIndices && woundCloth.geometry.index.count < original.clothIndices, "Wounds are painted over intact skin/clothing instead of true openings");
      check(woundSkin.geometry !== original.skinGeometry && woundCloth.geometry !== original.clothGeometry, "Cut geometry is shared with the clean mother");
      check(skin.geometry.index.count === original.skinIndices && cloth.geometry.index.count === original.clothIndices && skin.material === original.material, "Creating wounded Evelyn changed the clean casket model");
      check(!skin.geometry.getAttribute("evelynWoundRest") && woundSkin.geometry.getAttribute("evelynWoundRest"), "The wound projection leaked into the clean model");
      const cheek = wounded.wounds.meshes.find(mesh => mesh.name.startsWith("Torn left cheek / ragged"));
      const head = wounded.rig.joint("head").bone;
      check(cheek.parent === head, "Cheek trauma is not attached to the head bone");
      const first = new T.Vector3().fromBufferAttribute(cheek.geometry.attributes.position, 0);
      wounded.body.updateMatrixWorld(true);
      const before = cheek.localToWorld(first.clone()), headBefore = head.getWorldPosition(new T.Vector3());
      wounded.rig.rotate("head", .12, .45, -.10);
      wounded.rig.update();
      const after = cheek.localToWorld(first.clone()), headAfter = head.getWorldPosition(new T.Vector3());
      check(Math.abs(before.distanceTo(headBefore) - after.distanceTo(headAfter)) < 1e-6 && before.distanceTo(after) > .005, "Wounds float or change radius when the mother turns her head");
      wounded.resetPose();
      const nextClean = createEvelyn();
      check(nextClean.visual.getObjectByName("Evelyn_Skin").geometry.index.count === original.skinIndices && !nextClean.wounds, "Template geometry was permanently wounded");
      const scene = new T.Scene();
      scene.background = new T.Color(0x141919);
      scene.add(new T.HemisphereLight(0xd8e1e1, 0x373029, 1.15));
      const key = new T.DirectionalLight(0xffe2c5, 2.5); key.position.set(-2, 3, -3); scene.add(key);
      const fill = new T.DirectionalLight(0x9cb3c1, .8); fill.position.set(2, 2, -1); scene.add(fill);
      clean.body.position.x = -.48;
      wounded.body.position.x = .48;
      scene.add(clean.body, wounded.body);
      const renderer = new T.WebGLRenderer({ antialias: true });
      renderer.setSize(1100, 900); renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
      document.body.append(renderer.domElement);
      const camera = new T.PerspectiveCamera(45, 1100 / 900, .04, 20);
      await renderer.compileAsync(scene, camera);
      window.captureEvelyn = view => {
        if (view === "comparison") { camera.position.set(0, 1.03, -3.0); camera.lookAt(0, .89, 0); }
        else if (view === "torso") { camera.position.set(.48, 1.12, -.83); camera.lookAt(.48, 1.10, -.05); }
        else { camera.position.set(.48, 1.49, -.65); camera.lookAt(.48, 1.46, -.08); }
        camera.updateMatrixWorld(true); renderer.render(scene, camera);
      };
      window.captureEvelyn("comparison");
      return { status: "PASS", ...stats, neck: wounded.rig.restPoint("neck_01").toArray(), head: wounded.rig.restPoint("head").toArray(), woundRegions: wounded.wounds.wounds.map(wound => ({ name: wound.name, x: wound.x, y: wound.y })) };
    });
    for (const view of ["comparison", "torso", "face"]) {
      await page.evaluate(view => window.captureEvelyn(view), view);
      await page.screenshot({ path: `${out}/${view}.png` });
    }
    assert.deepEqual(errors, []); assert.deepEqual(failed, []);
    console.log(JSON.stringify({ ...report, checks: ["independent clean geometry", "true skin and garment openings", "bone-following physical wounds", "clean template/material isolation", "finite geometry budget", "actual PBR model shader renders"], errors, failed }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
