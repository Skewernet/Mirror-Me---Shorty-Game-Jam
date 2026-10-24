const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const url = (process.env.MIRROR_TEST_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.route("**/__door-transitions__", route => route.fulfill({
      contentType: "text/html",
      body: '<link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>',
    }));
    await page.goto(url + "/__door-transitions__");
    const result = await page.evaluate(async () => {
      const T = await import("three");
      const { buildHouse } = await import("/src/house.mjs");
      const { Player } = await import("/src/player.mjs");
      const { Story } = await import("/src/story.mjs");
      const { EXIT, PORTAL, MIRROR, atBackThreshold } = await import("/src/layout.mjs");
      const { backDoorPose } = await import("/src/transitions.mjs");
      const { overlaps } = await import("/src/physics.mjs");
      const house = await buildHouse(new T.Scene());
      const player = new Player(new T.PerspectiveCamera());
      const check = (condition, label) => { if (!condition) throw Error(label); };
      const clear = () => !house.colliders.some(c => overlaps(player.x, player.z, c));
      let cases = 0;
      for (const dt of [1 / 120, 1 / 60, .05]) {
        for (const offset of [-.18, 0, .18]) {
          for (const direction of [-.08, 0, .08]) {
            const story = new Story();
            story.power = story.heardArrival = story.doorOpen = true;
            story.firstSeen = 2;
            house.reset(story);
            player.reset();
            Object.assign(player, { x: EXIT.x + offset, z: -.25, yaw: Math.PI + direction });
            player.keys.add("KeyW");
            let crossed = false;
            for (let time = 0; time < 3; time += dt) {
              house.animate(time, dt, story, player);
              const before = player.pose();
              player.update(dt, house.colliders);
              check(clear(), "rear approach overlaps the opening or leaf");
              if (house.doorCollider.disabled && Math.abs(before.x - EXIT.x) < .30)
                check(player.z > before.z, "open rear doorway dropped a held movement frame");
              if (!atBackThreshold(player.x, player.z)) continue;
              check(story.crossBackDoor(), "completed chapter did not consume rear crossing");
              const from = player.pose();
              Object.assign(player, backDoorPose(from));
              house.doorPivot.rotation.y = 0;
              house.doorCollider.disabled = false;
              house.animate(time, 0, story, player);
              check(clear(), "closed source door trapped player in destination");
              check(player.keys.has("KeyW"), "crossing cleared held movement");
              check(Math.abs(player.vz + from.vz) < 1e-9, "crossing lost momentum");
              for (let t = 0; t < .25; t += dt) {
                const z = player.z;
                player.update(dt, house.colliders);
                check(player.z < z, "first hall return snagged or stopped");
                check(clear(), "returned body overlaps first hall geometry");
              }
              check(player.z < PORTAL.returnZ - .3, "arrival did not continue walking");
              crossed = true;
              cases++;
              break;
            }
            check(crossed, "rear opening could not be crossed: " + JSON.stringify({dt,offset,direction,pose:player.pose(),doorOpen:story.doorOpen,angle:house.doorPivot.rotation.y,door:house.doorCollider,nearby:house.colliders.filter(c=>!c.disabled&&Math.hypot((c.minX+c.maxX)/2-player.x,(c.minZ+c.maxZ)/2-player.z)<1)}));
          }
        }
      }
      // Recovery from a closing/restored surface must begin on the very next
      // update, even if the capsule was a few centimeters inside its border.
      const story = new Story();
      house.reset(story);
      player.reset();
      Object.assign(player, { x: MIRROR.x - .20, z: 0, yaw: Math.PI / 2 });
      player.keys.add("KeyW");
      const x = player.x;
      check(!clear(), "fixture must begin with restored glass meeting shoulder");
      player.update(1 / 60, house.colliders);
      check(player.x < x, "restored mirror prevents immediate escape");
      for (let i = 0; i < 15; i++) player.update(1 / 60, house.colliders);
      check(clear(), "restored glass recovery remained wedged");
      player.reset();
      Object.assign(player, { x: EXIT.x, z: .64, yaw: Math.PI });
      player.keys.add("KeyW");
      check(!clear(), "fixture must begin with closing door meeting body");
      const z = player.z;
      player.update(1 / 60, house.colliders);
      check(player.z > z, "closed rear leaf prevents immediate escape");
      for (let i = 0; i < 15; i++) player.update(1 / 60, house.colliders);
      check(clear(), "rear leaf recovery remained wedged");
      return { status: "PASS", rearCases: cases, overlapRecoveryCases: 2, frameSteps: [1 / 120, 1 / 60, .05] };
    });
    assert.deepEqual(errors, []);
    assert.equal(result.rearCases, 27);
    console.log(JSON.stringify(result));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
