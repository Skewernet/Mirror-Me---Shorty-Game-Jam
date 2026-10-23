// Actual WebGL scene captures for art review; no retouching or generated images.
// Requires a local source server and the prepared Playwright environment.
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const url = (process.env.MIRROR_TEST_URL || "http://127.0.0.1:8000").replace(
  /\/$/,
  "",
);
const out = process.env.MIRROR_TEST_OUTPUT || "/tmp/mirror-me-demon-art";
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  const errors = [],
    failed = [],
    shots = [];
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
    });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("requestfailed", (request) => failed.push(request.url()));
    await page.route("**/__demon-art-review__", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: '<!doctype html><link rel="icon" href="data:,"><style>body{margin:0;background:#101417}canvas{display:block}</style><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>',
      }),
    );
    await page.goto(url + "/__demon-art-review__");
    await page.evaluate(async () => {
      const T = await import("/vendor/three.module.js");
      const { buildHouse } = await import("/src/house.mjs");
      const { preloadCharacterAssets, createFigure } = await import(
        "/src/figure.mjs"
      );
      const { createDemon, preloadDemonAssets } = await import(
        "/src/demon.mjs"
      );
      const { Story } = await import("/src/story.mjs");
      const { Picture } = await import("/src/picture.mjs");
      const scene = new T.Scene();
      scene.background = new T.Color(0x101417);
      scene.fog = new T.FogExp2(0x101417, 0.025);
      const camera = new T.PerspectiveCamera(65, 1.6, 0.055, 65);
      const renderer = new T.WebGLRenderer({ antialias: false });
      renderer.setSize(1280, 800);
      renderer.setPixelRatio(1);
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.13;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = T.PCFSoftShadowMap;
      document.body.append(renderer.domElement);
      const [house] = await Promise.all([
        buildHouse(scene),
        preloadCharacterAssets(),
        preloadDemonAssets(),
      ]);
      const figure = createDemon(house, 0),
        before = createFigure(house, 0);
      scene.add(figure.body, before.body);
      const story = new Story();
      Object.assign(story, {
        stage: 3,
        power: true,
        hasDiary: true,
        hasTimeClue: true,
      });
      for (const id of Object.keys(story.doors)) story.doors[id] = true;
      const picture = new Picture(renderer, camera);
      picture.resize(1280, 800, 1080);
      const flashlight = new T.SpotLight(
        0xe2dfc5,
        0,
        13,
        Math.PI * 0.14,
        0.7,
        1.8,
      );
      scene.add(flashlight, flashlight.target);
      function render(spec) {
        const actor = spec.before ? before : figure;
        before.body.visible = !!spec.before;
        figure.body.visible = !spec.before;
        actor.resetPose();
        actor.body.position.set(...spec.body);
        actor.body.rotation.set(0, spec.yaw, 0);
        actor.resetMotion();
        const poseOptions = {
          mode: spec.mode,
          intensity: 1,
          distance: 0,
          delta: 1 / 60,
        };
        if (spec.phase) {
          const options = { ...poseOptions, gazeTarget: spec.camera };
          actor.setCreaturePose(0, 0, {
            ...options,
            phase: "still",
            still: true,
            gazeWeight: 0,
          });
          if (spec.phase !== "still") {
            actor.setCreaturePose(0.6, 0, {
              ...options,
              phase: "orient",
              gazeWeight: 1,
            });
            actor.setCreaturePose(1.1, 0, {
              ...options,
              phase: "orient",
              gazeWeight: 1,
            });
          }
        } else actor.setCreaturePose(4, 0, poseOptions);
        Object.assign(story, { stage: spec.stage ?? 3 });
        for (let i = 0; i < 90; i++)
          house.animate(i / 60, 1 / 60, story, {
            x: spec.camera[0],
            z: spec.camera[2],
          });
        scene.updateMatrixWorld(true);
        const head = actor.body
          .getObjectByName("head")
          .getWorldPosition(new T.Vector3());
        camera.position.set(...spec.camera);
        camera.lookAt(...(spec.look || head.toArray()));
        camera.updateMatrixWorld(true);
        flashlight.intensity = spec.flashlight ? 19 : 0;
        flashlight.position.copy(camera.position);
        flashlight.target.position.copy(head);
        for (const light of house.architecture?.shadowLights || [])
          if (light.shadow) light.shadow.needsUpdate = true;
        picture.render(scene, camera);
        return {
          head: head.toArray(),
          render: { ...renderer.info.render },
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures,
        };
      }
      window.demonReview = { render };
    });
    const specs = [
      {
        name: "01-hallway-before",
        caption: "0.7 figure in the unchanged house lighting",
        before: true,
        mode: "crawl",
        body: [5.75, 0, 0],
        yaw: Math.PI / 2,
        camera: [2.3, 1.64, 0],
        look: [5.75, 0.6, 0],
      },
      {
        name: "02-hallway-demon",
        caption: "New demon, same house lighting and camera",
        mode: "crawl",
        body: [5.75, 0, 0],
        yaw: Math.PI / 2,
        camera: [2.3, 1.64, 0],
        look: [5.75, 0.6, 0],
      },
      {
        name: "03-hallway-flashlight",
        caption: "New demon with the standard player flashlight",
        mode: "crawl",
        body: [5.75, 0, 0],
        yaw: Math.PI / 2,
        camera: [3.6, 1.64, 0],
        flashlight: true,
      },
      {
        name: "04-ceiling-demon",
        caption:
          "Ceiling pose in the bathroom, standard eye height and flashlight",
        mode: "ceiling",
        body: [3.1, 2.24, 2.2],
        yaw: Math.PI / 2,
        camera: [1.2, 1.64, 2.3],
        flashlight: true,
        stage: 2,
      },
      {
        name: "05-face-detail",
        caption:
          "Low camera model-detail study in the actual hallway; standard flashlight",
        mode: "crawl",
        body: [5.75, 0, 0],
        yaw: Math.PI / 2,
        camera: [4.4, 0.62, 0],
        flashlight: true,
      },
      {
        name: "06-bedroom-fold",
        caption: "Authored bedroom folding pose in house lighting",
        mode: "twisted",
        body: [7.4, 0, -1.15],
        yaw: 0,
        camera: [7.4, 1.64, 0.1],
        flashlight: true,
        stage: 2,
      },
      {
        name: "07-held-face",
        caption:
          "Held face before orientation; low-camera model-detail study with standard flashlight",
        phase: "still",
        mode: "crawl",
        body: [5.75, 0, 0],
        yaw: Math.PI / 2,
        camera: [4.4, 0.62, 0],
        flashlight: true,
      },
      {
        name: "08-face-response",
        caption:
          "One-time facial response during orientation; same model-detail camera and flashlight",
        phase: "orient",
        mode: "crawl",
        body: [5.75, 0, 0],
        yaw: Math.PI / 2,
        camera: [4.4, 0.62, 0],
        flashlight: true,
      },
    ];
    for (const spec of specs) {
      const result = await page.evaluate(
        (spec) => window.demonReview.render(spec),
        spec,
      );
      const file = spec.name + ".png";
      await page.screenshot({ path: path.join(out, file), timeout: 60000 });
      shots.push({
        ...spec,
        file,
        ...result,
        sha256: crypto
          .createHash("sha256")
          .update(fs.readFileSync(path.join(out, file)))
          .digest("hex"),
      });
    }
    const sources = {};
    for (const file of [
      "src/demon.mjs",
      "src/figure.mjs",
      "src/horror.mjs",
      "src/sound.mjs",
    ])
      sources[file] = crypto
        .createHash("sha256")
        .update(fs.readFileSync(path.join(root, file)))
        .digest("hex");
    const report = {
      revision: execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: root,
        encoding: "utf8",
      }).trim(),
      workingChanges: execFileSync("git", ["status", "--porcelain"], {
        cwd: root,
        encoding: "utf8",
      }).trim(),
      provenance:
        "Unedited local WebGL art-review fixtures using game modules, materials, house lighting and presentation pass. Camera and encounter states are authored fixtures, not a live playthrough.",
      sources,
      shots,
      errors,
      failed,
    };
    fs.writeFileSync(
      path.join(out, "capture-report.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    if (errors.length || failed.length)
      throw Error(JSON.stringify({ errors, failed }));
    console.log(
      JSON.stringify({
        result: "PASS",
        out,
        screenshots: shots.length,
        errors,
        failed,
      }),
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
