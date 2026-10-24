const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const url = (process.env.MIRROR_TEST_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  const errors = [];
  try {
    const page = await browser.newPage();
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    await page.route("**/__portal-visibility__", route => route.fulfill({
      contentType: "text/html",
      body: '<link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>',
    }));
    await page.goto(url + "/__portal-visibility__");
    const result = await page.evaluate(async () => {
      const T = await import("three");
      const { ThresholdPortal } = await import("/src/portal.mjs");
      const { EXIT, PORTAL } = await import("/src/layout.mjs");
      const check = (value, message) => { if (!value) throw new Error(message); };
      const scene = new T.Scene();
      scene.background = new T.Color(0x406d38);
      const portal = new ThresholdPortal(scene, {});
      portal.target.setSize(64, 64);
      const renderer = new T.WebGLRenderer();
      renderer.setSize(64, 64);
      const destination = new T.WebGLRenderTarget(64, 64);
      renderer.setRenderTarget(destination);
      renderer.setViewport(2, 3, 60, 58);
      renderer.setScissor(3, 4, 59, 57);
      renderer.setScissorTest(true);
      const camera = new T.PerspectiveCamera(65, 1.6, .055, 30);
      const story = { stage: 2, doorOpen: true };
      let renders = 0;
      const actualRender = renderer.render.bind(renderer);
      renderer.render = (...args) => { renders++; return actualRender(...args); };
      const cases = [
        { name: "rear viewed from hallway", x: EXIT.x, z: 0, yaw: Math.PI, expected: true },
        { name: "rear viewed partly at screen edge", x: EXIT.x, z: 0, yaw: Math.PI + 1, expected: true },
        { name: "looking back toward entrance", x: EXIT.x, z: 0, yaw: 0, expected: false },
        { name: "looking east beside rear door", x: EXIT.x, z: 0, yaw: -Math.PI / 2, expected: false },
        { name: "kitchen doorway facing into room", x: 2.4, z: -.7, yaw: 0, expected: false },
        { name: "bedroom doorway facing into room", x: 7.4, z: -.7, yaw: 0, expected: false },
        { name: "rear outside horizontal frustum", x: EXIT.x, z: 0, yaw: Math.PI + 1.4, expected: false },
        { name: "close to rear but looking away", x: EXIT.x, z: PORTAL.thresholdZ - .07, yaw: 0, expected: false },
      ];
      let visible = 0, offscreen = 0;
      for (const item of cases) {
        camera.position.set(item.x, 1.64, item.z);
        camera.rotation.set(0, item.yaw, 0, "YXZ");
        camera.updateMatrixWorld(true);
        const signature = JSON.stringify([camera.position.toArray(), camera.quaternion.toArray(), camera.projectionMatrix.toArray()]);
        const frameBefore = portal.frames, rendersBefore = renders;
        const viewport = renderer.getViewport(new T.Vector4()).toArray();
        const scissor = renderer.getScissor(new T.Vector4()).toArray();
        const rendered = portal.render(renderer, camera, story);
        check(rendered === item.expected, item.name + ": unexpected visibility decision");
        check(renders - rendersBefore === (item.expected ? 1 : 0), item.name + ": offscreen GPU work was not skipped");
        check(portal.frames - frameBefore === (item.expected ? 1 : 0), item.name + ": incorrect frame counter");
        check(renderer.getRenderTarget() === destination && renderer.getScissorTest(), item.name + ": renderer state leaked");
        check(JSON.stringify(renderer.getViewport(new T.Vector4()).toArray()) === JSON.stringify(viewport), item.name + ": viewport changed");
        check(JSON.stringify(renderer.getScissor(new T.Vector4()).toArray()) === JSON.stringify(scissor), item.name + ": scissor changed");
        check(signature === JSON.stringify([camera.position.toArray(), camera.quaternion.toArray(), camera.projectionMatrix.toArray()]), item.name + ": source camera changed");
        if (item.expected) visible++; else offscreen++;
      }
      const pixels = new Uint16Array(64 * 64 * 4);
      renderer.readRenderTargetPixels(portal.target, 0, 0, 64, 64, pixels);
      check(pixels.some(value => value > 0), "Visible portal image is empty");
      portal.reset();
      check(portal.warmup(renderer, camera), "Startup warmup must still render the visible doorway");
      check(!portal.enabled && !portal.surface.visible && portal.frames === 0, "Warmup leaked game state");
      renderer.setRenderTarget(null);
      destination.dispose(); portal.dispose(); renderer.dispose();
      return { status: "PASS", visiblePasses: visible, offscreenPassesSkipped: offscreen, offscreenSceneRenders: 0, partialDoorwayPreserved: true, cameraAndRendererStatePreserved: true, warmupPreserved: true };
    });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ ...result, errors }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
