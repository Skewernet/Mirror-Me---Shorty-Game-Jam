// Actual rig, collision-resolved player movement and authored retreat paths.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const base = process.env.MIRROR_TEST_URL || "http://127.0.0.1:8000";
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox"] });
  const errors = [], failed = [];
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(120000);
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
    page.on("requestfailed", r => failed.push(r.url()));
    await page.route("**/__crawler-threat__", route => route.fulfill({ contentType: "text/html",
      body: '<link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>' }));
    await page.goto(base + "/__crawler-threat__");
    const report = await page.evaluate(async () => {
      const T = await import("three");
      const { Player, WALK_SPEED, RUN_SPEED } = await import("/src/player.mjs");
      const { HorrorDirector } = await import("/src/horror.mjs");
      const { preloadCharacterAssets } = await import("/src/figure.mjs");
      const { preloadDemonAssets } = await import("/src/demon.mjs");
      const check = (value, text) => { if (!value) throw new Error(text); };
      await Promise.all([preloadCharacterAssets(), preloadDemonAssets()]);
      const camera = new T.PerspectiveCamera(65, 1.6, .055, 30);
      const player = new Player(camera);
      const resetPlayer = (x = 0, z = 0, yaw = 0) => {
        player.x = x; player.z = z; player.yaw = yaw; player.pitch = 0;
        player.distance = 0; player.clear(); player.syncCamera();
      };
      const movement = [];
      for (const hz of [20, 60, 120]) {
        resetPlayer(); player.keys.add("KeyW");
        for (let i = 0; i < hz; i++) player.update(1 / hz, []);
        const walk = player.distance;
        check(Math.abs(player.speed - WALK_SPEED) < .0001 && !player.sprinting, "Walk speed changed");
        resetPlayer(); player.keys.add("KeyW"); player.keys.add("ShiftLeft");
        for (let i = 0; i < hz; i++) player.update(1 / hz, []);
        const run = player.distance;
        check(Math.abs(player.speed - RUN_SPEED) < .0001 && player.sprinting, "Shift does not run");
        resetPlayer(); player.keys.add("KeyW"); player.keys.add("KeyD"); player.keys.add("ShiftRight");
        for (let i = 0; i < hz; i++) player.update(1 / hz, []);
        check(Math.abs(player.distance - run) < 1e-7, "Diagonal sprint gained speed");
        resetPlayer(); player.keys.add("KeyW"); player.keys.add("ShiftLeft");
        const wall = [{ minX: -2, maxX: 2, minZ: -1.1, maxZ: -1 }];
        for (let i = 0; i < hz; i++) player.update(1 / hz, wall);
        check(player.z > -.781 && player.z < -.77, "Sprint tunnels through a thin wall");
        player.clear();
        check(!player.sprinting && player.previousX === player.x && player.previousZ === player.z, "Capture reset retained sprint motion");
        movement.push({ hz, walk, run });
      }

      const scene = new T.Scene(), house = { occluders: [], colliders: [] };
      const director = new HorrorDirector(scene, house);
      const story = { stage: 3, doors: { bedroom: true }, hasDiary: true, hasTimeClue: true, echoIndex: 0 };
      let time = 0;
      const aim = () => {
        const target = director.active ? director.headBone.getWorldPosition(new T.Vector3()) : new T.Vector3(5.75, .44, 0);
        player.yaw = Math.atan2(-(target.x - player.x), -(target.z - player.z));
        player.pitch = T.MathUtils.clamp(Math.atan2(target.y - 1.64, Math.hypot(target.x - player.x, target.z - player.z)), -1.25, 1.25);
        player.syncCamera();
      };
      const update = (dt, options = {}) => {
        time += dt;
        director.update(time, dt, story, player, camera, options);
        return director.drainEvents();
      };
      const fresh = (hz = 60) => {
        director.reset(); time = 0; house.occluders.length = 0; house.colliders.length = 0;
        story.stage = 3; story.wakeEntered = story.ended = story.endingStarted = false;
        resetPlayer(2, 0, -Math.PI / 2);
        for (let i = 0; i < hz * 3 && !director.active; i++) { aim(); player.update(1 / hz, []); update(1 / hz); }
        check(director.active?.definition.id === "far-hall-crawler", "Actual floor crawler failed to reveal");
        check(director.contactShapes.length >= 12 && director.contactsReady, "Actual bone contact shapes were not prepared");
        check(director.updateFailure(time) === null, "Failure pose ran before legitimate contact");
      };
      const pursuits = [];
      for (const hz of [20, 60, 120]) {
        fresh(hz);
        player.keys.add("KeyW"); player.keys.add("ShiftLeft");
        let contacts = [], actorX = director.figure.body.position.x, monotone = true;
        for (let i = 0; i < hz * 5 && director.active && !contacts.length; i++) {
          aim(); player.update(1 / hz, []);
          const events = update(1 / hz);
          contacts.push(...events.filter(event => event.id === "crawler-contact"));
          monotone &&= director.figure.body.position.x >= actorX - .0001;
          actorX = director.figure.body.position.x;
        }
        check(contacts.length === 1 && contacts[0].playerInitiated, `Running could not catch the authored retreat at ${hz} Hz`);
        check(monotone, "Crawler changed its authored retreat into an incoming chase");
        const frozen = director.figure.body.position.clone();
        for (let i = 0; i < 10; i++) check(update(1 / hz).every(event => event.id !== "crawler-contact"), "Contact event repeated");
        check(frozen.equals(director.figure.body.position), "Contact fail did not hold its actual figure");
        const caughtHead = director.headBone.quaternion.clone(), contactTime = director.active.contactedAt;
        director.updateFailure(contactTime + .1);
        const struckHead = director.headBone.quaternion.clone();
        check(struckHead.angleTo(caughtHead) > .1, "Legitimate contact has no local actor response");
        director.updateFailure(contactTime + .1);
        check(struckHead.angleTo(director.headBone.quaternion) < 1e-7, "Paused failure pose accumulated rotation");
        check(director.updateFailure(contactTime + 1.2).done && frozen.equals(director.figure.body.position), "Failure reaction moved the actor or did not finish");
        check(caughtHead.angleTo(director.headBone.quaternion) < 1e-7, "Failure reaction did not settle to its caught pose");
        pursuits.push({ hz, part: contacts[0].part, player: [player.x, player.z], actor: frozen.toArray() });
      }

      fresh();
      resetPlayer(7.2, 0, Math.PI / 2);
      let passive = [];
      for (let i = 0; i < 60 * 5 && director.active; i++) { aim(); player.update(1 / 60, []); passive.push(...update(1 / 60)); }
      check(!passive.some(event => event.id === "crawler-contact"), "An authored crawler path killed a stationary player");
      fresh(); resetPlayer(3.8, 0, -Math.PI / 2); player.keys.add("KeyS"); player.keys.add("ShiftLeft");
      for (let i = 0; i < 60 && director.active; i++) {
        aim(); player.update(1 / 60, []);
        check(!update(1 / 60).some(event => event.id === "crawler-contact"), "Backing away triggered contact");
      }
      fresh();
      const head = director.headBone.getWorldPosition(new T.Vector3());
      const obstruction = new T.Mesh(new T.BoxGeometry(.06, 2.4, 2), new T.MeshBasicMaterial());
      obstruction.position.set(head.x - .08, 1.2, head.z); scene.add(obstruction);
      house.occluders.push(obstruction);
      const collider = { minX: head.x - .11, maxX: head.x - .05, minZ: head.z - 1, maxZ: head.z + 1 };
      resetPlayer(head.x - .4, head.z, -Math.PI / 2); player.keys.add("KeyW"); player.keys.add("ShiftLeft");
      for (let i = 0; i < 12; i++) {
        aim(); player.update(1 / 120, [collider]);
        check(!update(1 / 120).some(event => event.id === "crawler-contact"), "Crawler contact reached through a real wall");
      }
      scene.remove(obstruction); obstruction.geometry.dispose(); obstruction.material.dispose();
      fresh(); aim();
      for (let i = 0; i < 25; i++) update(1 / 60);
      const closeThreat = director.snapshot().threat.amount;
      check(closeThreat > .1, "Directly looking at a visible crawler has no effect");
      player.yaw += Math.PI; player.pitch = 0; player.syncCamera();
      for (let i = 0; i < 25; i++) update(1 / 60);
      check(director.snapshot().threat.amount < closeThreat * .15, "Gaze effect does not decay when looking away");
      update(1 / 60, { enabled: false });
      check(director.snapshot().threat.amount === 0 && !director.figure.body.visible, "Comfort mode retained danger");
      director.reset();
      check(!director.snapshot().threat.contact && director.snapshot().threat.amount === 0, "Restart retained a death/gaze effect");
      return { status: "PASS", rendered: false, contactShapes: director.contactShapes.length, movement, pursuits,
        checks: ["actual rig and swept capsule contact", "sprint speed/diagonal/wall collisions at 20/60/120 Hz", "authored retreat can be caught",
          "stationary and backing-away immunity", "real wall occlusion", "visible gaze and decay", "comfort cancellation", "one-shot/reset", "finite pause-safe contact reaction"] };
    });
    assert.deepEqual(errors, []); assert.deepEqual(failed, []);
    console.log(JSON.stringify({ ...report, errors, failed }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
