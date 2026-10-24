// Actual GPU presentation: grades remain finite/readable, toggle is uniform-only,
// quality budgets stay bounded, and the primary-camera layer/target survives.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const url = (process.env.MIRROR_TEST_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const out = process.env.MIRROR_TEST_OUTPUT || "/tmp/mirror-me-picture";
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  const errors = [], failed = [];
  try {
    const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
    page.setDefaultTimeout(120000);
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    page.on("requestfailed", request => failed.push(request.url()));
    await page.route("**/__picture__", route => route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><style>body{margin:0;background:#080b09}</style><link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>',
    }));
    await page.goto(url + "/__picture__");
    const report = await page.evaluate(async () => {
      const T = await import("three");
      const { Picture } = await import("/src/picture.mjs");
      const check = (condition, message) => { if (!condition) throw new Error(message); };
      const renderer = new T.WebGLRenderer({ antialias: false });
      renderer.setSize(960, 640);
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.13;
      document.body.append(renderer.domElement);
      const camera = new T.PerspectiveCamera(65, 4 / 3, .055, 65);
      const picture = new Picture(renderer, camera);
      const output = new T.WebGLRenderTarget(128, 96);
      picture.resize(128, 96, 1080);
      renderer.setRenderTarget(output);
      await picture.warmup();
      check(renderer.getRenderTarget() === output, "Presentation warmup leaked render target");
      const scene = new T.Scene();
      scene.background = new T.Color(.18, .18, .18);
      const pixels = new Uint8Array(128 * 96 * 4);
      let calls = 0;
      const render = renderer.render.bind(renderer);
      renderer.render = (...args) => { calls++; return render(...args); };
      const draw = (post = true) => {
        picture.setOptions({ postProcessing: post });
        const before = calls;
        picture.render(scene, camera);
        check(calls - before === 2, "Presentation added an extra scene render");
        check(renderer.getRenderTarget() === output, "Presentation leaked render target");
        renderer.readRenderTargetPixels(output, 0, 0, 128, 96, pixels);
        return pixels.slice();
      };
      const at = (image, x, y) => Array.from(image.slice((y * 128 + x) * 4, (y * 128 + x) * 4 + 3));
      const center = image => at(image, 64, 48);
      const greyOff = draw(false), greyOn = draw(true);
      const flatCenter = center(greyOff), flatCorner = at(greyOff, 1, 1);
      check(flatCenter.every((value, channel) => Math.abs(value - flatCorner[channel]) <= 1), "Disabled post retains vignette");
      check(center(greyOn)[0] > at(greyOn, 1, 1)[0] + 4, "Enabled post lacks restrained edge shading");
      check(center(greyOn).some((value, channel) => value !== flatCenter[channel]), "Filmic response has no visible effect");
      check(center(greyOn).every((value, channel) => Math.abs(value - flatCenter[channel]) < 24), "Filmic response overwhelms source midtones");
      const programs = renderer.info.programs.length;
      for (let iteration = 0; iteration < 6; iteration++) draw(iteration % 2 === 0);
      check(renderer.info.programs.length === programs, "Post toggle recompiles a shader variant");
      scene.background.setRGB(0, 0, 0);
      for (const post of [true, false]) check(center(draw(post)).every(value => value === 0), "Post lifts exact black into a luminous field");
      scene.background.setRGB(.003, .003, .003);
      check(center(draw()).every(value => value > 0), "Post crushes low-light information");
      scene.background.setRGB(10, 10, 10);
      check(center(draw()).every(value => value >= 245 && value <= 255), "HDR highlight response is non-finite or clipped incorrectly");
      scene.background.setRGB(.25, .035, .02);
      const blood = center(draw());
      check(blood[0] > blood[1] * 1.6 && blood[1] > blood[2], "Filmic grade loses the authored blood hue");
      scene.background.setRGB(.18, .18, .18);
      renderer.toneMappingExposure = .8;
      const dim = center(draw(false))[0];
      renderer.toneMappingExposure = 1.6;
      check(center(draw(false))[0] > dim + 15, "Brightness stops working with cinematic post disabled");
      renderer.toneMappingExposure = 1.13;

      const profiles = [];
      for (const quality of [720, 1080, 1440]) {
        picture.resize(128, 96, quality);
        const image = draw();
        check(image.every(Number.isFinite), "A quality profile contains non-finite presentation output");
        profiles.push({ quality, samples: picture.target.samples, aoSamples: picture.uniforms.aoSampleCount.value, highlightGlow: picture.uniforms.highlightGlow.value });
      }
      check(profiles[0].samples === 0 && profiles[1].samples === 0 && profiles[2].samples <= 2, "Default HDR image retains multisample bandwidth");
      check(profiles.map(profile => profile.aoSamples).join(",") === "4,6,10", "Contact shade profile budgets differ from intent");
      check(profiles[0].highlightGlow === 0 && profiles[1].highlightGlow === 0 && profiles[2].highlightGlow === 1, "Performance profile spends extra highlight taps");

      // The scalar neighboring view-Z reconstruction must match the original
      // full inverse projection, including a non-centred camera projection.
      let maxDepthError = 0;
      for (const offset of [false, true]) {
        if (offset) camera.setViewOffset(1920, 1080, 100, 40, 1280, 800);
        else camera.clearViewOffset();
        for (const depth of [.01, .2, .5, .95, .999]) {
          const matrix = camera.projectionMatrixInverse.elements, z = depth * 2 - 1;
          const scalar = (matrix[10] * z + matrix[14]) / (matrix[11] * z + matrix[15]);
          const full = new T.Vector4(.2, -.3, z, 1).applyMatrix4(camera.projectionMatrixInverse);
          maxDepthError = Math.max(maxDepthError, Math.abs(scalar - full.z / full.w));
        }
      }
      check(maxDepthError < 1e-10, "Optimized view depth changes occlusion geometry");
      camera.clearViewOffset();
      camera.aspect = 4 / 3;
      camera.updateProjectionMatrix();
      picture.resize(128, 96, 1080);
      const greyMaterial = new T.MeshBasicMaterial({ color: 0x777777 });
      const floor = new T.Mesh(new T.PlaneGeometry(8, 8), greyMaterial);
      floor.rotation.x = -Math.PI / 2;
      const block = new T.Mesh(new T.BoxGeometry(.6, .6, .6), greyMaterial);
      block.position.y = .3;
      scene.add(floor, block);
      camera.position.set(1.6, 1.3, 1.8); camera.lookAt(0, .18, 0);
      picture.contactShadows = true;
      const contactOn = draw(false);
      picture.contactShadows = false;
      const contactOff = draw(false);
      let contactPixels = 0, maxContactDifference = 0;
      for (let index = 0; index < contactOn.length; index += 4) {
        const difference = contactOff[index] - contactOn[index];
        if (difference > 1) contactPixels++;
        maxContactDifference = Math.max(maxContactDifference, difference);
      }
      check(contactPixels > 12 && maxContactDifference > 5, "Optimized contact shade does not ground scene geometry");
      scene.remove(floor, block);
      floor.geometry.dispose(); block.geometry.dispose(); greyMaterial.dispose();
      picture.contactShadows = true;
      camera.position.set(0, 0, 3);
      camera.rotation.set(0, 0, 0);
      const red = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: 0xaa3311 }));
      red.layers.set(2);
      scene.add(red);
      camera.layers.enable(2);
      const signature = JSON.stringify([camera.position.toArray(), camera.quaternion.toArray(), camera.layers.mask, camera.projectionMatrix.toArray()]);
      const layerOn = center(draw());
      camera.layers.disable(2);
      const layerOff = center(draw());
      camera.layers.enable(2);
      check(layerOn[0] > layerOn[1] * 1.5 && Math.abs(layerOff[0] - layerOff[1]) < 8, "Primary-camera body layers are lost or forced into the world");
      check(signature === JSON.stringify([camera.position.toArray(), camera.quaternion.toArray(), camera.layers.mask, camera.projectionMatrix.toArray()]), "Presentation changed the source camera");
      check(renderer.getContext().getError() === 0, "Presentation generated a WebGL error");
      renderer.setRenderTarget(null);
      output.dispose();
      scene.remove(red);
      red.geometry.dispose(); red.material.dispose();
      window.pictureFixture = { T, renderer, camera, picture };
      return { result: "PASS", profiles, maxDepthError, uniformTogglePrograms: programs, greyOff: flatCenter, greyOn: center(greyOn), blood, contactPixels, maxContactDifference, checks: ["single beauty + single presentation", "warmup and render target restoration", "uniform-only post toggle", "finite HDR and low-light response", "brightness independent of post", "restrained grading and lens shading", "bounded AA/contact/highlight profile budgets", "scalar depth matches full inverse projection", "actual contact occlusion", "primary camera body layer preserved"] };
    });

    // Inspect the authored house through the real pass, not only a color chart.
    await page.evaluate(async () => {
      const { T, renderer, camera, picture } = window.pictureFixture;
      const { buildHouse } = await import("/src/house.mjs");
      const { Story } = await import("/src/story.mjs");
      const scene = new T.Scene(); scene.background = new T.Color(0x101417);
      const house = await buildHouse(scene), story = new Story();
      story.power = true; story.stage = 2; house.reset(story);
      picture.resize(960, 640, 1080);
      camera.aspect = 1.5; camera.updateProjectionMatrix();
      window.renderPictureHouse = (view, post) => {
        picture.postProcessing = post;
        if (view === "hall") { camera.position.set(0, 1.64, .8); camera.lookAt(4.2, 1.35, 0); }
        else { camera.position.set(2.12, 1.66, 2.12); camera.lookAt(2.15, 1.7, .995); house.props.bathroomMirror.setClueVisible(true); }
        camera.updateMatrixWorld(true);
        picture.render(scene, camera);
      };
    });
    for (const [name, view, post] of [["hall", "hall", true], ["mirror", "mirror", true], ["mirror-natural", "mirror", false]]) {
      await page.evaluate(([view, post]) => window.renderPictureHouse(view, post), [view, post]);
      await page.screenshot({ path: `${out}/${name}.png`, timeout: 60000 });
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
    console.log(JSON.stringify({ ...report, errors, failed }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
