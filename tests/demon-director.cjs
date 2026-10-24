// Camera/occlusion and encounter lifecycle regression checks with a lightweight
// figure double. No renderer, gameplay timers or puzzle state are bypassed.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const url = (process.env.MIRROR_TEST_URL || "http://127.0.0.1:8000").replace(
  /\/$/,
  "",
);
const out = process.env.MIRROR_TEST_OUTPUT || "/tmp/mirror-me-demon-checks";
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const report = { result: "FAIL", rendered: false, errors: [], failed: [] };
  try {
    const page = await browser.newPage();
    page.on("pageerror", (error) => report.errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") report.errors.push(message.text());
    });
    page.on("requestfailed", (request) => report.failed.push(request.url()));
    await page.route("**/__demon-director__", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: '<!doctype html><link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>',
      }),
    );
    await page.goto(url + "/__demon-director__");
    Object.assign(
      report,
      await page.evaluate(async () => {
        const T = await import("/vendor/three.module.js");
        const { HorrorDirector } = await import("/src/horror.mjs");
        const check = (condition, message) => {
          if (!condition) throw new Error(message);
        };
        const scene = new T.Scene(),
          camera = new T.PerspectiveCamera(65, 1.6, 0.05, 30);
        const house = { occluders: [] };
        const stub = () => ({
          body: new T.Group(),
          setCreaturePose() {},
          resetPose() {},
          resetMotion() {},
        });
        const director = new HorrorDirector(scene, house, {
          figureFactory: stub,
        });
        const story = {
          stage: 3,
          doors: { bedroom: true },
          hasDiary: true,
          hasTimeClue: true,
          echoIndex: 0,
        };
        const player = { x: 2, z: 0, yaw: -Math.PI / 2 };
        camera.position.set(2, 1.64, 0);
        const id = "far-hall-crawler";
        let time = 0;
        const face = (x, y, z) => {
          camera.lookAt(x, y, z);
          camera.updateMatrixWorld(true);
        };
        const step = (seconds, options = {}) => {
          let result;
          for (let index = 0; index < Math.ceil(seconds * 60); index++) {
            time += 1 / 60;
            result = director.update(
              time,
              1 / 60,
              story,
              player,
              camera,
              options,
            );
          }
          return result;
        };
        const fresh = () => {
          director.reset();
          time = 0;
          story.stage = 3;
          story.endingStarted = false;
          story.wakeEntered = false;
          story.ended = false;
          player.x = 2;
          player.z = 0;
          camera.position.set(2, 1.64, 0);
        };
        const started = (options = {}) => {
          for (let index = 0; index < 180; index++) {
            step(1 / 60, options);
            if (director.snapshot().active === id) return director.snapshot();
          }
          throw new Error("Readable, eligible encounter never started");
        };
        const checks = [];

        face(-4, 1.6, 0);
        step(3);
        check(
          !director.snapshot().active && !director.snapshot().completed[id],
          "Looking away consumed or revealed the crawler",
        );
        const offscreenEvents = director.drainEvents();
        check(
          offscreenEvents.filter((event) => event.id === "demon-inhale")
            .length <= 1,
          "Offscreen anticipation repeated instead of remaining sparse",
        );
        checks.push(
          "offscreen gaze preserves the unseen encounter and bounds anticipatory cues",
        );

        fresh();
        face(5.75, 8, 0);
        step(3);
        check(
          !director.snapshot().active && !director.snapshot().completed[id],
          "Pitched-away view consumed the floor crawler",
        );
        checks.push("actual vertical camera frustum is respected");

        fresh();
        face(5.75, 0.44, 0);
        const wall = new T.Mesh(
          new T.BoxGeometry(0.12, 2.2, 1.3),
          new T.MeshBasicMaterial(),
        );
        wall.position.set(4, 1.1, 0);
        scene.add(wall);
        house.occluders.push(wall);
        step(3);
        check(
          !director.snapshot().active && !director.snapshot().completed[id],
          "A real wall failed to occlude the encounter",
        );
        check(
          director.drainEvents().length === 0,
          "Anticipation played through an occluding wall",
        );
        wall.visible = false;
        checks.push("real visible wall blocks both reveal and anticipation");

        fresh();
        face(5.75, 0.44, 0);
        step(3, { dialogueBusy: true });
        check(
          !director.snapshot().active && !director.snapshot().completed[id],
          "Creature reveal overlapped essential dialogue",
        );
        check(
          director.drainEvents().length === 0,
          "Creature cue overlapped essential dialogue",
        );
        checks.push("dialogue defers the entire encounter onset");

        fresh();
        story.stage = 2;
        story.doors.bathroom = true;
        player.x = 2;
        player.z = 2.2;
        camera.position.set(2, 1.64, 2.2);
        face(3.1, 1.86, 2.2);
        step(0.15);
        check(
          director.snapshot().active === "bathroom-ceiling",
          "Silent ceiling encounter did not reveal on a clear view",
        );
        check(
          !director.snapshot().anticipated["bathroom-ceiling"],
          "Silent ceiling encounter adopted the crawler's anticipatory signature",
        );
        check(
          director.drainEvents().length === 0,
          "Silent ceiling encounter played an onset cue",
        );
        checks.push("silent ceiling onset varies the encounter signature");

        const circuits = [];
        for (const encounter of [
          { id: "bathroom-ceiling", stage: 2, x: 2, z: 2.2, at: [3.1, 1.86, 2.2], source: "bathroom" },
          { id: "far-hall-crawler", stage: 3, x: 2, z: 0, at: [5.75, .44, 0], source: "far-hall" },
          { id: "sitting-room-return", stage: 4, x: 0, z: 1, at: [0, .44, 4.3], source: "entry" },
          { id: "last-ceiling", stage: 5, x: 4.2, z: 0, at: [7.3, 1.86, 0], source: "far-hall" },
        ]) {
          fresh();
          story.stage = encounter.stage;
          story.echoIndex = 1;
          story.silenceComplete = false;
          story.doors = { bedroom: true, bathroom: true, lounge: true };
          player.x = encounter.x; player.z = encounter.z;
          camera.position.set(player.x, 1.64, player.z);
          face(...encounter.at);
          for (let index = 0; index < 180 && !director.active; index++) step(1 / 60);
          check(director.snapshot().active === encounter.id, encounter.id + " did not reveal");
          check(director.snapshot().lightMultiplier === 1, encounter.id + " hid the initial readable body");
          let previous = 1, offs = 0, firstOff = null;
          const began = director.active.started;
          for (let index = 0; index < 600 && director.active; index++) {
            const body = director.figure.body;
            face(body.position.x, body.position.y + (director.active.mode === "ceiling" ? -.38 : .44), body.position.z);
            const environment = step(1 / 60);
            check(environment.lightMultiplier === 0 || environment.lightMultiplier === 1,
              encounter.id + " used a smooth dim instead of a circuit interruption");
            if (environment.lightMultiplier === 0) {
              check(environment.lightSource === encounter.source, encounter.id + " affected the wrong circuit");
              if (previous === 1) { offs++; firstOff ??= time - began; }
            }
            previous = environment.lightMultiplier;
          }
          check(offs >= 3 && offs <= 4, encounter.id + " did not deliver its finite irregular interruptions");
          check(firstOff >= .30, encounter.id + " darkened before its readable first glimpse");
          check(director.snapshot().lightMultiplier === 1 && !director.snapshot().lightSource,
            encounter.id + " left a circuit dark after withdrawal");
          const relays = director.drainEvents().filter(event => event.id === "light-relay");
          check(relays.length === offs, encounter.id + " repeated or missed its circuit relay");
          circuits.push({ id: encounter.id, interruptions: offs, firstOff });
        }
        checks.push("all four crawling/ceiling sightings interrupt their own circuit irregularly after a readable reveal and restore it");

        fresh();
        face(5.75, .44, 0);
        started();
        while (director.snapshot().lightMultiplier !== 0) step(1 / 60);
        check(step(1 / 60, { flashes: false }).lightMultiplier === 1,
          "Switching flicker off did not immediately restore a dark circuit");
        check(step(1 / 60, { dialogueBusy: true }).lightMultiplier === 1,
          "Essential dialogue did not suppress a current interruption");
        const pausedTime = time;
        const paused = director.update(time, 0, story, player, camera);
        const resumed = director.update(time, 0, story, player, camera);
        check(paused.lightMultiplier === resumed.lightMultiplier && time === pausedTime,
          "Paused simulation advanced the electrical sequence");
        director.reset();
        check(director.snapshot().lightMultiplier === 1 && !director.snapshot().lightSource,
          "Restart retained a dark circuit");
        checks.push("comfort toggle, dialogue priority, paused time and reset cannot retain or replay dark intervals");

        fresh();
        face(5.75, 0.44, 0);
        const start = started();
        check(
          start.phase === "still",
          "The first readable reveal did not begin with stillness",
        );
        const origin = director.figure.body.position.clone();
        step(0.1);
        check(
          director.figure.body.position.distanceTo(origin) < 1e-6,
          "The creature moved before its still read completed",
        );
        const phases = new Set([start.phase]);
        let minLight = 1,
          maxLight = 0;
        for (let index = 0; index < 480; index++) {
          const environment = step(1 / 60);
          const snapshot = director.snapshot();
          if (snapshot.phase) phases.add(snapshot.phase);
          minLight = Math.min(minLight, environment.lightMultiplier);
          maxLight = Math.max(maxLight, environment.lightMultiplier);
        }
        const events = director.drainEvents();
        check(
          phases.has("orient") && phases.has("withdraw"),
          "The encounter skipped its orientation or committed withdrawal phase",
        );
        check(
          !director.snapshot().active &&
            !director.snapshot().visible &&
            director.snapshot().completed[id],
          "Finite encounter did not finish and hide its body",
        );
        for (const cue of ["demon-inhale", "demon-reveal", "demon-withdraw"]) {
          check(
            events.filter((event) => event.id === cue).length <= 1,
            cue + " fired repeatedly during one encounter",
          );
        }
        check(
          minLight === 0 && maxLight === 1,
          "The crawler circuit never switched fully off and back on",
        );
        step(20);
        check(
          !director.snapshot().active && director.drainEvents().length === 0,
          "Completed encounter or its cue repeated",
        );
        checks.push(
          "stillness, orientation and finite withdrawal complete once without repeated cues",
        );

        fresh();
        face(5.75, 0.44, 0);
        step(0.05);
        step(0.1, { enabled: false });
        check(
          !director.snapshot().active &&
            !director.snapshot().visible &&
            !director.snapshot().completed[id],
          "Disabling a pending scare consumed or exposed it",
        );
        check(
          director.drainEvents().length === 0,
          "Disabled scare leaked queued anticipation audio",
        );
        check(
          !Object.values(director.snapshot().anticipated).some(Boolean),
          "Disabling a pending scare retained anticipatory state",
        );
        started({ flashes: false });
        for (let index = 0; index < 480; index++)
          check(
            step(1 / 60, { flashes: false }).lightMultiplier === 1,
            "Reduced flashing preference changed the room lights",
          );
        checks.push(
          "disabled anticipation can be retried and reduced flashes leave the encounter visible without dimming",
        );

        for (const terminatingFlag of [
          "endingStarted",
          "wakeEntered",
          "ended",
        ]) {
          fresh();
          face(5.75, 0.44, 0);
          started();
          director.drainEvents();
          story[terminatingFlag] = true;
          step(0.1);
          check(
            !director.snapshot().active && !director.snapshot().visible,
            terminatingFlag + " retained an active creature",
          );
          check(
            director.drainEvents().length === 0,
            terminatingFlag + " leaked creature audio",
          );
        }
        fresh();
        face(5.75, 0.44, 0);
        started();
        director.drainEvents();
        step(0.1, { enabled: false });
        check(
          !director.snapshot().active &&
            !director.snapshot().visible &&
            director.drainEvents().length === 0,
          "Disabling an active encounter did not clear it",
        );
        director.reset();
        const reset = director.snapshot();
        check(
          !reset.active &&
            !reset.visible &&
            !reset.phase &&
            !Object.values(reset.completed).some(Boolean),
          "Reset retained a completed or visible encounter",
        );
        check(
          !Object.values(reset.anticipated).some(Boolean) &&
            director.drainEvents().length === 0,
          "Reset retained anticipation or stale cue events",
        );
        checks.push(
          "disable, ending and restart hide the body and discard pending creature cues",
        );
        const shadowInvalidations = [];
        house.invalidateShadows = time => shadowInvalidations.push(time);
        fresh();
        face(5.75, .44, 0);
        started();
        step(.15);
        story.endingStarted = true;
        step(1 / 60);
        check(shadowInvalidations.length > 2 && shadowInvalidations[0] === 0 &&
          shadowInvalidations.every(Number.isFinite) && shadowInvalidations.at(-1) === time,
          "Creature shadows did not delegate reset, motion and finish to the house simulation-time scheduler");
        delete house.invalidateShadows;
        house.architecture = { shadowLights: [{ shadow: { needsUpdate: false } }] };
        director.updateShadows(time);
        check(house.architecture.shadowLights[0].shadow.needsUpdate,
          "Custom houses without a shadow scheduler lost their fallback invalidation");
        checks.push("creature shadow invalidation shares the house scheduler and retains custom-house fallback");
        return {
          checks,
          phases: [...phases],
          circuits,
          minLight,
          maxLight,
          cueCounts: Object.fromEntries(
            [...new Set(events.map((event) => event.id))].map((id) => [
              id,
              events.filter((event) => event.id === id).length,
            ]),
          ),
        };
      }),
    );
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.failed, []);
    report.result = "PASS";
  } catch (error) {
    report.failure = error.stack || String(error);
    throw error;
  } finally {
    fs.writeFileSync(
      out + "/demon-director.json",
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(JSON.stringify(report, null, 2));
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
