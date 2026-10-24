// Exercise real reflected room imagery, surface-space moisture and wiped glass.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const url = (process.env.MIRROR_TEST_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const out = process.env.MIRROR_TEST_OUTPUT || "/tmp/mirror-me-environment-pass-1";
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  const errors = [], failed = [];
  try {
    const p = await browser.newPage({ viewport: { width: 1000, height: 800 } });
    p.on("pageerror", e => errors.push(e.message));
    p.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
    p.on("requestfailed", r => failed.push(r.url()));
    await p.route("**/__bathroom-mirror__", route => route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><style>body{margin:0}</style><link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>',
    }));
    await p.goto(url + "/__bathroom-mirror__");
    const report = await p.evaluate(async () => {
      const T = await import("/vendor/three.module.js");
      const { buildHouse } = await import("/src/house.mjs");
      const { Mirror } = await import("/src/mirror.mjs");
      const { preloadCharacterAssets } = await import("/src/figure.mjs");
      const { Story } = await import("/src/story.mjs");
      const check = (value, message) => { if (!value) throw new Error(message); };
      const scene = new T.Scene();
      scene.background = new T.Color(0x101417);
      await preloadCharacterAssets();
      const house = await buildHouse(scene);
      const story = new Story();
      story.power = true;
      story.stage = 2;
      house.reset(story);
      const hall = new Mirror(scene, house);
      const camera = new T.PerspectiveCamera(65, 1.25, .055, 65);
      const renderer = new T.WebGLRenderer({ antialias: false });
      renderer.setSize(1000, 800);
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.13;
      document.body.append(renderer.domElement);
      const bath = house.props.bathroomMirror, glass = bath.glass;
      const uniforms = glass.material.uniforms;
      const canvas = uniforms.wipeMap.value.image;
      const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
      let cleared = 0, fogged = 0, feathered = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] > 230) cleared++;
        else if (pixels[i] === 0) fogged++;
        else feathered++;
      }
      check(cleared > 4000 && cleared < canvas.width * canvas.height * .08, "Finger marks must clear narrow paths, not a solid label panel");
      check(fogged > canvas.width * canvas.height * .85 && feathered > 500, "Fog must survive between strokes with irregular feathered edges");
      check(glass.position.z > .99 && glass.position.z < 1.001, "Moisture must be on the mounted mirror, not a floating clue box");
      const read = () => {
        const target = glass.getRenderTarget();
        const pixels = new Uint16Array(target.width * target.height * 4);
        renderer.readRenderTargetPixels(target, 0, 0, target.width, target.height, pixels);
        let min = Infinity, max = -Infinity, nonzero = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          const value = T.DataUtils.fromHalfFloat(pixels[i]);
          check(Number.isFinite(value), "Reflection contains a non-finite pixel");
          min = Math.min(min, value); max = Math.max(max, value);
          if (value > .001) nonzero++;
        }
        return { min, max, nonzero };
      };
      camera.position.set(2.12, 1.66, 2.12);
      camera.lookAt(2.15, 1.7, .995);
      camera.updateMatrixWorld(true);
      scene.updateMatrixWorld(true);
      bath.setClueVisible(false);
      renderer.render(scene, camera);
      const reflection = read();
      check(reflection.max - reflection.min > .02 && reflection.nonzero > 1000, "Bathroom must reflect actual furnished room imagery");
      window.fixture = { scene, house, camera, renderer, hall, story, bath };
      window.captureMirror = (revealed, oblique = false) => {
        bath.setClueVisible(revealed);
        camera.position.set(oblique ? 1.48 : 2.12, 1.66, oblique ? 1.92 : 2.12);
        camera.lookAt(2.15, 1.7, .995);
        camera.updateMatrixWorld(true);
        renderer.render(scene, camera);
      };
      return { cleared, fogged, feathered, reflection };
    });
    for (const [name, revealed, oblique] of [["fogged", false, false], ["finger-written", true, false], ["oblique", true, true]]) {
      await p.evaluate(([revealed, oblique]) => window.captureMirror(revealed, oblique), [revealed, oblique]);
      await p.screenshot({ path: `${out}/bathroom-${name}.png` });
    }
    await p.evaluate(async () => {
      const { renderer, scene, camera, bath, hall, house, story } = window.fixture;
      // Deliberately face both mirrors toward one another: this used to be an
      // unbounded recursive render when adding a second planar reflector.
      hall.surface.position.set(2.15, 1.7, 2.6);
      hall.surface.rotation.y = Math.PI;
      camera.position.set(2.12, 1.66, 2.12);
      camera.lookAt(2.15, 1.7, .995);
      scene.updateMatrixWorld(true);
      renderer.render(scene, camera);
      if (!Number.isFinite(renderer.info.render.calls) || renderer.info.render.calls > 10000)
        throw new Error("Facing mirrors caused excessive recursive rendering");
      bath.setClueVisible(true);
      story.stage = 0;
      house.reset(story);
      if (bath.glass.material.uniforms.revealed.value !== 0)
        throw new Error("New game retained the wiped clue");
      // A uniform reflected field isolates the actual moisture shader. Fog
      // must follow illumination instead of acting as a luminous label.
      const T = await import("/vendor/three.module.js");
      const { createBathroomMirror } = await import("/src/bathroom-mirror.mjs");
      const isolated = new T.Scene();
      createBathroomMirror(isolated);
      const output = new T.WebGLRenderTarget(64, 64);
      const samples = new Uint8Array(64 * 64 * 4);
      camera.position.set(2.15, 1.7, 2.12);
      camera.lookAt(2.15, 1.7, .995);
      const sample = (color) => {
        isolated.background = new T.Color(color);
        renderer.setRenderTarget(output);
        renderer.render(isolated, camera);
        renderer.readRenderTargetPixels(output, 0, 0, 64, 64, samples);
        return samples[(32 * 64 + 32) * 4];
      };
      const dark = sample(0x000000), lit = sample(0xaaaaaa);
      if (lit <= dark * 5 || dark >= 15)
        throw new Error(`Condensation ignores room illumination: dark=${dark}, lit=${lit}`);
      renderer.setRenderTarget(null);
      output.dispose();
    });
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
    console.log(JSON.stringify({ result: "PASS", ...report, checks: ["live room reflection", "narrow feathered finger wipes", "mounted surface", "front and oblique shader renders", "bounded facing reflections", "new-game moisture reset", "moisture follows reflected illumination"], errors, failed }));
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
