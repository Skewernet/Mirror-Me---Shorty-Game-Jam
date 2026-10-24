// Real funeral-room geometry, clean Evelyn identity, aisle collision and renders.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const url = (process.env.MIRROR_TEST_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const out = process.env.MIRROR_TEST_OUTPUT || "/tmp/mirror-me-parlor";
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  const errors = [], failed = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
    page.setDefaultTimeout(180000);
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
    page.on("requestfailed", r => failed.push(r.url()));
    await page.route("**/__parlor__", route => route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><style>body{margin:0}</style><link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>',
    }));
    await page.goto(url + "/__parlor__");
    const result = await page.evaluate(async () => {
      const T = await import("three");
      const { buildHouse } = await import("/src/house.mjs");
      const { preloadCharacterAssets, createFigure } = await import("/src/figure.mjs");
      const { preloadEvelynAssets } = await import("/src/evelyn.mjs");
      const { Story } = await import("/src/story.mjs");
      const { overlaps } = await import("/src/physics.mjs");
      const { Picture } = await import("/src/picture.mjs");
      const check = (v, message) => { if (!v) throw new Error(message); };
      await Promise.all([preloadCharacterAssets(), preloadEvelynAssets()]);
      const scene = new T.Scene();
      scene.background = new T.Color(0x101417);
      const house = await buildHouse(scene), wake = house.wake;
      wake.prepare();
      const state = new Story();
      house.reset(state);
      check(!wake.group.visible, "Funeral room leaks into the ordinary house");
      const normal = createFigure({}, 0);
      const maraGeometry = new Set();
      normal.body.traverse(o => { if (o.isMesh) maraGeometry.add(o.geometry); });
      const body = wake.casketBody;
      check(body && body !== wake.attackBody, "Clean mother is not an independently owned casket instance");
      check(/Evelyn/.test(body.name), "Casket does not contain Evelyn");
      check(body.userData.wounded === false, "Casket mother must retain her clean appearance");
      const skin = body.getObjectByName("Evelyn_Skin");
      for (const name of ["Evelyn_Eye_left_Closed", "Evelyn_Eye_right_Closed"]) {
        const index = skin?.morphTargetDictionary?.[name];
        check(index !== undefined && skin.morphTargetInfluences[index] > .99, "Casket mother's eyes are not closed");
      }
      let cleanMeshes = 0;
      body.traverse(o => { if (o.isMesh) { cleanMeshes++; check(!maraGeometry.has(o.geometry), "Casket mother still shares Mara's actual mesh"); } });
      check(cleanMeshes >= 4, "Detailed clean mother is missing her separate surfaces");
      check(wake.snapshot().roomArea > 65, "Parlor is still the small reception room");
      check(wake.chairs.length >= 10 && wake.snapshot().emptyChairs >= 2, "A funeral parlor needs rows with empty seats");
      check(wake.snapshot().casket.cleanMother, "Clean casket mother was not prepared");
      // The player can walk the full central aisle and approach the casket;
      // leaving a .22m body radius prevents decorative seats becoming traps.
      for (const x of [-.24,0,.24]) for (let z = 7.8; z < 8.2; z += .08)
        check(!wake.colliders.some(c => overlaps(x, z, c)), "Parlor front-door opening is obstructed");
      for (const x of [-.42, 0, .42]) for (let z = 8.2; z < 14.72; z += .08)
        check(!wake.colliders.some(c => overlaps(x, z, c)), "Parlor entrance/central aisle is obstructed");
      const bodyBounds = new T.Box3().setFromObject(body);
      check(bodyBounds.min.x > -1.2 && bodyBounds.max.x < 1.3, "Mother does not fit the casket length");
      check(bodyBounds.min.z > 15.15 && bodyBounds.max.z < 16.15, "Mother lies outside the casket sides");
      check(bodyBounds.min.y > .72 && bodyBounds.max.y < 1.32, "Mother is not lying on the casket lining");
      state.stage = 6;
      state.inverted = state.frontOpen = state.wakeEntered = true;
      house.animate(1, 0, state, { x:0,z:10,yaw:Math.PI });
      wake.begin(1, { x:0,z:10,yaw:Math.PI });
      const renderer = new T.WebGLRenderer({ antialias:false });
      renderer.setSize(1100,760);
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.13;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = T.PCFSoftShadowMap;
      document.body.append(renderer.domElement);
      const camera = new T.PerspectiveCamera(65,1100/760,.055,65);
      const picture = new Picture(renderer,camera);
      picture.resize(1100,760,1080);
      window.parlorView = (position, target) => {
        camera.position.set(...position);
        camera.lookAt(...target);
        camera.updateMatrixWorld(true);
        picture.render(scene,camera);
      };
      window.parlorFixture = {house,state};
      return { status:"PASS", area:wake.snapshot().roomArea, chairs:wake.chairs.length, emptyChairs:wake.snapshot().emptyChairs, cleanMeshes, casketBounds:{min:bodyBounds.min.toArray(),max:bodyBounds.max.toArray()} };
    });
    for (const [name, position, target] of [
      ["entrance", [0,1.64,8.6], [0,1.2,15.6]],
      ["aisle", [0,1.64,12.65], [0,1.05,15.65]],
      ["casket", [.7,1.64,14.8], [.45,1.02,15.65]],
    ]) {
      await page.evaluate(([position,target]) => window.parlorView(position,target),[position,target]);
      await page.screenshot({path:`${out}/${name}.png`});
    }
    await page.evaluate(() => {
      const {house,state}=window.parlorFixture;
      state.reset(); house.reset(state);
      if (house.wake.group.visible || house.wake.snapshot().attack.active)
        throw new Error("Restart retained funeral room or attack visibility");
    });
    assert.deepEqual(errors,[]);
    assert.deepEqual(failed,[]);
    console.log(JSON.stringify({...result,errors,failed}));
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
