// Real house collider fixture: no WebGL rendering or test-only gameplay shortcuts.
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
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/mirror-transition-fixture.html", (route) => route.fulfill({
      contentType: "text/html",
      body: '<script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>',
    }));
    await page.goto(url + "/mirror-transition-fixture.html");
    const result = await page.evaluate(async () => {
      const T = await import("three");
      const { buildHouse } = await import("/src/house.mjs");
      const { Player } = await import("/src/player.mjs");
      const { Story } = await import("/src/story.mjs");
      const { MIRROR, atMirrorThreshold } = await import("/src/layout.mjs");
      const { mirrorPose } = await import("/src/transitions.mjs");
      const { overlaps, RADIUS } = await import("/src/physics.mjs");
      const house = await buildHouse(new T.Scene());
      const player = new Player(new T.PerspectiveCamera());
      const cases = [];
      const check = (condition, label) => { if (!condition) throw Error(label); };
      const clear = () => !house.colliders.some((c) => overlaps(player.x, player.z, c));
      for (const dt of [1 / 60, 0.05]) {
        for (const z of [-0.419, 0, 0.419]) {
          for (const direction of [-0.28, 0, 0.28]) {
            const story = new Story();
            story.stage = 5;
            story.backdoorGone = story.mirrorReady = true;
            player.reset();
            Object.assign(player, { x: 8.25, z, yaw: -Math.PI / 2 + direction });
            player.keys.add("KeyW");
            house.animate(0, 0, story, player);
            let crossing = null;
            for (let time = 0; time < 3; time += dt) {
              player.update(dt, house.colliders);
              check(clear(), "open-mirror approach overlaps geometry");
              if (atMirrorThreshold(player.x, player.z)) {
                const from = player.pose();
                check(from.x < MIRROR.x - 0.05, "camera entered the glass before transition");
                check(story.crossMirror() === "mirror-crossed", "mirror gate failed");
                Object.assign(player, mirrorPose(from));
                player.syncCamera();
                house.animate(time, 0, story, player);
                check(clear(), "restored mirror trapped the body");
                check(player.keys.has("KeyW"), "crossing lost held movement");
                const arrivalX = player.x;
                for (let t = 0; t < 0.2; t += dt) player.update(dt, house.colliders);
                check(clear(), "departure overlaps geometry");
                check(player.x < arrivalX - 0.2, "player stuck after crossing");
                crossing = { dt, z, direction, entryX: from.x, arrivalX };
                break;
              }
            }
            check(crossing, "approach could not cross the open mirror");
            // Turn back into the now-solid mirror. The body must stop before
            // the reflective surface instead of entering the backing-wall gap.
            player.yaw = -Math.PI / 2;
            for (let t = 0; t < 1; t += dt) player.update(dt, house.colliders);
            check(clear(), "closed mirror leaves player inside collision geometry");
            check(player.x + RADIUS <= MIRROR.x + 1e-6, "closed glass permits visual clipping");
            cases.push(crossing);
          }
        }
      }
      return { cases: cases.length, frameSteps: [1 / 60, 0.05], status: "PASS" };
    });
    assert.deepEqual(errors, []);
    assert.equal(result.cases, 18);
    console.log(JSON.stringify(result));
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exit(1); });
