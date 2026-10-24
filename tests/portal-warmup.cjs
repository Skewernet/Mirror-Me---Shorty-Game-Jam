const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const url = (process.env.MIRROR_TEST_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
    await page.route("**/__portal-warmup__", route => route.fulfill({
      contentType: "text/html",
      body: '<link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>',
    }));
    await page.goto(url + "/__portal-warmup__");
    const result = await page.evaluate(async () => {
      const T = await import("three");
      const { ThresholdPortal } = await import("/src/portal.mjs");
      const scene = new T.Scene();
      scene.background = new T.Color(0x29362f);
      const portal = new ThresholdPortal(scene, {});
      portal.setQuality(720);
      const camera = new T.PerspectiveCamera(65, 1.6, .055, 30);
      camera.position.set(0, 1.64, 6.7);
      const renderer = new T.WebGLRenderer();
      renderer.setSize(64, 64);
      const target = new T.WebGLRenderTarget(64, 64);
      renderer.setRenderTarget(target);
      const position = camera.position.clone(), quaternion = camera.quaternion.clone();
      const start = performance.now();
      if (!portal.warmup(renderer, camera)) throw Error("portal target was not warmed");
      const firstMs = performance.now() - start;
      if (renderer.getRenderTarget() !== target || portal.enabled || portal.surface.visible || portal.frames !== 0)
        throw Error("preparation changed game visibility or renderer target");
      if (!position.equals(camera.position) || !quaternion.equals(camera.quaternion))
        throw Error("portal warmup moved the player camera");
      const pixels = new Uint16Array(portal.target.width * portal.target.height * 4);
      renderer.readRenderTargetPixels(portal.target, 0, 0, portal.target.width, portal.target.height, pixels);
      if (!pixels.some(value => value > 0)) throw Error("portal target was not populated");
      const again = performance.now();
      if (!portal.warmup(renderer, camera)) throw Error("repeat warmup failed");
      const repeatMs = performance.now() - again;
      renderer.setRenderTarget(null);
      target.dispose(); portal.dispose(); renderer.dispose();
      return { status: "PASS", firstMs, repeatMs, checks: ["target allocation", "projected render", "camera preserved", "renderer target restored", "portal remains hidden", "repeatable"] };
    });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify(result));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
