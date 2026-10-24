// The photographed mother has an independently authored asset, not a Mara tint.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const url = (process.env.MIRROR_TEST_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const out = process.env.MIRROR_TEST_OUTPUT || "/tmp/mirror-evelyn-review";
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox", "--enable-unsafe-swiftshader"] });
  try {
    const p = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    const errors = [], failed = [];
    p.on("pageerror", e => errors.push(e.message));
    p.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
    p.on("requestfailed", r => failed.push(r.url()));
    await p.route("**/__evelyn-model__", route => route.fulfill({ contentType: "text/html", body: '<style>body{margin:0}</style><link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>' }));
    await p.goto(url + "/__evelyn-model__");
    const report = await p.evaluate(async () => {
      const T = await import("three");
      const { preloadEvelynAssets, createEvelyn } = await import("/src/evelyn.mjs");
      const { preloadCharacterAssets, createFigure } = await import("/src/figure.mjs");
      await Promise.all([preloadEvelynAssets(), preloadCharacterAssets()]);
      const check = (ok, message) => { if (!ok) throw new Error(message); };
      const mara = createFigure({}, 0);
      const clean = createEvelyn();
      const fingerprint = figure => {
        const skin = figure.body.getObjectByName("Evelyn_Skin") || figure.body.getObjectByName("Mara_Skin");
        const a = skin.geometry.attributes.position;
        return [a.count, ...Array.from({ length: Math.min(120, a.count) }, (_, i) => a.getY(i * 17 % a.count))].join("/");
      };
      const before = fingerprint(clean);
      const cleanGeometry = clean.skin.geometry;
      const wounded = createEvelyn({ wounded: true });
      check(before !== fingerprint(mara), "Evelyn reuses the daughter's vertex positions");
      check(clean.body.getObjectByName("Evelyn_Hair"), "Evelyn has no distinct short wavy hair");
      check(!clean.body.getObjectByName("Mara_Hair"), "Evelyn retains Mara's side-swept bob");
      check(clean.skin.material !== wounded.skin.material, "Wounded mother mutates clean casket materials");
      check(cleanGeometry === clean.skin.geometry && before === fingerprint(clean), "Wound topology changed the clean body");
      check(wounded.wounds?.stats?.wounds >= 5 || wounded.wounds?.wounds?.length >= 5, "The wounded model has no geometric injury variant");
      for (const name of ["head", "neck_01", "spine_03", "hand_l", "hand_r", "foot_l", "foot_r"])
        check(clean.rig.joint(name).bone.isBone, "Missing anatomical game rig bone " + name);
      clean.body.position.set(-.52, 0, 0);
      wounded.body.position.set(.52, 0, 0);
      clean.setEyesClosed(true);
      const eye = clean.skin.morphTargetDictionary.Evelyn_Eye_left_Closed;
      check(clean.skin.morphTargetInfluences[eye] === 1, "Casket eyelids do not close");
      clean.resetPose();
      check(clean.body.position.x === -.52, "Reset erased casket placement");
      const scene = new T.Scene();
      scene.background = new T.Color(0x282b25);
      scene.add(clean.body, wounded.body, new T.HemisphereLight(0xdde0d4, 0x32261e, 1.2));
      const key = new T.DirectionalLight(0xffdfbd, 3.2); key.position.set(-2, 3, -3); scene.add(key);
      const fill = new T.DirectionalLight(0xc8d4df, 1.5); fill.position.set(2, 2, -1); scene.add(fill);
      const renderer = new T.WebGLRenderer({ antialias: true }); renderer.setSize(1200, 900); renderer.toneMapping=T.ACESFilmicToneMapping; renderer.toneMappingExposure=1.0; renderer.outputColorSpace=T.SRGBColorSpace;
      document.body.append(renderer.domElement);
      const camera = new T.PerspectiveCamera(45, 1200/900, .04, 10);
      camera.position.set(0, 1.28, -3.25); camera.lookAt(0, .98, 0);
      renderer.render(scene, camera);
      window.evelynReview = { renderer, scene, camera, clean, wounded };
      window.evelynCloseup = woundedView => {
        clean.body.visible = !woundedView; wounded.body.visible = woundedView;
        const figure = woundedView ? wounded : clean;
        figure.body.position.x=0;
        figure.setMouthOpen(woundedView ? .8 : 0);
        camera.position.set(0,1.46,-.77); camera.lookAt(0,1.43,0);
        renderer.render(scene,camera);
      };
      return { status: "PASS", identity: clean.identity, newVertexFingerprint: true, shortWavyHair: true, geometryInjuries: wounded.wounds.stats, bones: clean.rig.joints.size };
    });
    await p.screenshot({ path: out + "/evelyn-clean-wounded.png" });
    await p.evaluate(() => window.evelynCloseup(false));
    await p.screenshot({ path: out + "/evelyn-clean-face.png" });
    await p.evaluate(() => window.evelynCloseup(true));
    await p.screenshot({ path: out + "/evelyn-wounded-face.png" });
    assert.deepEqual(errors, []); assert.deepEqual(failed, []);
    console.log(JSON.stringify({ ...report, errors, failed }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
