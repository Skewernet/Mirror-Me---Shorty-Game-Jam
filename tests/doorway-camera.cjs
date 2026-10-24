// Door collision/animation is never a source of look input. Exercise both sides
// of all ordinary doors with the real house at three simulation frame rates.
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
    const errors = [], failed = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("requestfailed", request => failed.push(request.url()));
    await page.route("**/__doorway-camera__", route => route.fulfill({
      contentType: "text/html",
      body: '<link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>',
    }));
    await page.goto(url + "/__doorway-camera__");
    const report = await page.evaluate(async () => {
      const T = await import("three");
      const { Player } = await import("/src/player.mjs");
      const { buildHouse } = await import("/src/house.mjs");
      const { Story } = await import("/src/story.mjs");
      const { ROOMS, atBackThreshold, atMirrorThreshold } = await import("/src/layout.mjs");
      const house = await buildHouse(new T.Scene());
      const state = new Story(), camera = new T.PerspectiveCamera(), player = new Player(camera);
      const check = (value, label) => { if (!value) throw Error(label); };
      state.power = state.doorOpen = true;
      const cases = [];
      for (const dt of [1 / 120, 1 / 60, .05]) {
        for (const room of ROOMS) {
          for (const open of [false, true]) {
            for (const leaving of [false, true]) {
              for (const id in state.doors) state.doors[id] = id === room.id && open;
              const horizontal = ["lounge", "utility", "bathroom"].includes(room.id);
              let yaw = horizontal ? (room.id === "bathroom" ? -Math.PI / 2 : Math.PI / 2) : 0;
              player.reset();
              const side = room.id === "bathroom" ? 1 : -1;
              Object.assign(player, {
                x: horizontal ? (leaving ? side * 1.3 : 0) : room.doorX,
                z: horizontal ? room.doorZ : (leaving ? -1.3 : 0),
                yaw: leaving ? yaw + Math.PI : yaw,
                pitch: .17,
              });
              yaw = player.yaw;
              player.syncCamera();
              const quaternion = camera.quaternion.clone();
              // Let the previous case's leaf return before testing this state.
              for (let t = 0; t < 2; t += dt) house.animate(t, dt, state, player);
              player.keys.add("KeyW");
              const start = player.pose();
              for (let t = 0; t < (leaving ? 1 : 1.7); t += dt) {
                house.animate(2 + t, dt, state, player);
                player.update(dt, house.colliders);
                check(player.yaw === yaw && player.pitch === .17, `${room.id} collision changed look`);
                check(quaternion.angleTo(camera.quaternion) < 1e-7, `${room.id} changed camera orientation`);
                check(!atBackThreshold(player.x, player.z), `${room.id} falsely triggered the rear portal`);
                check(!atMirrorThreshold(player.x, player.z), `${room.id} falsely triggered the mirror portal`);
              }
              if (open) {
                const inside = horizontal ? side * player.x > .82 : player.z < -.82;
                check(leaving ? !inside : inside, `${room.id} did not cross the open doorway`);
              }
              cases.push({ room: room.id, dt, open, leaving,
                travelled: Math.hypot(player.x - start.x, player.z - start.z), yawDelta: player.yaw - yaw });
            }
          }
        }
      }
      return { status: "PASS", cases: cases.length, roomDoors: ROOMS.length,
        checks: ["open-door passage both ways", "closed-door contact both ways", "no yaw/pitch change", "camera quaternion stable", "no false portal activation"] };
    });
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
    assert.equal(report.cases, 60);
    console.log(JSON.stringify(report));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
