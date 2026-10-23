// Complete collision-respecting route through the L-shaped house and rear portal.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const url = process.env.MIRROR_TEST_URL || "http://127.0.0.1:8000";
const out = process.env.MIRROR_TEST_OUTPUT || "/tmp/mirror-me-threshold-checks";
fs.mkdirSync(out, { recursive: true });
(async () => {
  const { TARGETS, ROOMS, SPAWN, MIRROR, EXIT } = await import(
    "../src/layout.mjs"
  );
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  let currentPage;
  try {
    const p = (currentPage = await browser.newPage({
      viewport: { width: 1280, height: 800 },
    }));
    const errors = [],
      failed = [],
      assets = [];
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    p.on("requestfailed", (r) => failed.push(r.url()));
    p.on("response", (r) => {
      if (r.ok()) assets.push(r.url());
    });
    await p.goto(url + "/?test=1");
    await p.waitForFunction(() => !!window.__mirror, {}, { timeout: 120000 });
    const snap = () => p.evaluate(() => window.__mirror.snapshot());
    const advance = (s) => p.evaluate((s) => window.__mirror.advance(s), s);
    const face = (yaw, pitch = 0) =>
      p.evaluate((v) => window.__mirror.face(...v), [yaw, pitch]);
    const playing = () =>
      p.waitForFunction(
        () =>
          !!document.pointerLockElement &&
          !document.querySelector("#hud").hidden,
      );
    async function photo(name) {
      await p.evaluate(() => window.__mirror.render());
      await p.screenshot({ path: out + "/" + name + ".png", timeout: 60000 });
    }
    async function aim(x, y, z) {
      const s = await snap(),
        dx = x - s.pose.x,
        dz = z - s.pose.z;
      await face(
        Math.atan2(-dx, -dz),
        Math.atan2(y - 1.64, Math.hypot(dx, dz)),
      );
      await advance(0.035);
    }
    async function walk(x, z) {
      for (let i = 0; i < 160; i++) {
        const s = await snap(),
          dx = x - s.pose.x,
          dz = z - s.pose.z,
          d = Math.hypot(dx, dz);
        if (d < 0.055) {
          await p.keyboard.up("KeyW");
          await advance(0.13);
          return;
        }
        assert.equal(
          s.portal,
          null,
          "Walk target must not cross a portal accidentally",
        );
        await face(Math.atan2(-dx, -dz));
        await p.keyboard.down("KeyW");
        await advance(Math.min(0.32, d / 2.1));
      }
      throw Error(
        "Cannot walk to " +
          [x, z] +
          " from " +
          JSON.stringify((await snap()).pose),
      );
    }
    async function useAt(id, x, y, z) {
      await aim(x, y, z);
      const s = await snap();
      assert.equal(
        s.target,
        id,
        "Target " + id + " at " + [x, y, z] + " from " + JSON.stringify(s.pose),
      );
      await p.keyboard.press("KeyE");
      await advance(0.1);
    }
    async function use(id) {
      const t = TARGETS[id];
      assert.ok(t, "Known target " + id);
      await useAt(id, t.x, t.y, t.z);
    }
    async function openRoom(id) {
      if ((await snap()).story.doors[id]) return;
      const r = ROOMS.find((r) => r.id === id);
      await useAt("room-" + id, r.doorX, 1.15, r.doorZ);
      await advance(1.3);
      assert.equal((await snap()).story.doors[id], true);
    }
    async function hallCorner() {
      const { x, z } = (await snap()).pose;
      if (x > 0.4 && Math.abs(z) < 0.5) await walk(x, 0);
      await walk(0, 0);
    }
    async function rearDoor() {
      await hallCorner();
      await walk(EXIT.x, 0);
    }
    async function enterLounge() {
      await walk(0, 5.1);
      await openRoom("lounge");
      await walk(-1.2, 5.1);
    }
    async function leaveLounge() {
      await walk(-1.2, 5.1);
      await walk(0, 5.1);
    }
    async function phone() {
      await walk(-1.45, 5.85);
      await use("telephone");
    }
    async function enterKitchen() {
      await hallCorner();
      await walk(2.4, 0);
      await openRoom("kitchen");
      await walk(2.4, -1.25);
    }
    async function leaveKitchen() {
      await walk(2.1, -2.15);
      await walk(2.4, -1.25);
      await walk(2.4, 0);
    }
    async function kitchenRadio() {
      await walk(2.1, -2.15);
      await use("radio");
    }
    async function enterBathroom() {
      await walk(0, 2.5);
      await openRoom("bathroom");
      await walk(1.3, 2.5);
      await walk(2, 2.15);
    }
    async function leaveBathroom() {
      await walk(1.3, 2.5);
      await walk(0, 2.5);
    }
    async function enterBedroom() {
      await hallCorner();
      await walk(7.4, 0);
      await openRoom("bedroom");
      await walk(7.4, -1.3);
    }
    async function leaveBedroom() {
      await walk(7.4, -1.3);
      await walk(7.4, 0);
    }
    async function crossRear(expectedStage, pauseDuring = false) {
      await rearDoor();
      if (!(await snap()).story.doorOpen) await use("door");
      await advance(1.4);
      const before = await snap();
      assert.equal(before.story.doorOpen, true);
      await face(Math.PI);
      await p.keyboard.down("KeyW");
      let transition;
      for (let i = 0; i < 60; i++) {
        await advance(0.08);
        transition = await snap();
        if (transition.portal) break;
      }
      await p.keyboard.up("KeyW");
      assert.ok(
        transition.portal,
        "Crossing the actual rear porch starts a threshold transition",
      );
      assert.ok(
        transition.pose.z > 1.6,
        "Portal begins beyond the open door, not in the hall",
      );
      if (pauseDuring) {
        await p.keyboard.press("Escape");
        await p.waitForFunction(() => !document.querySelector("#menu").hidden);
        const paused = await snap();
        await advance(3);
        assert.equal((await snap()).time, paused.time);
        assert.deepEqual((await snap()).pose, paused.pose);
        await p.click("#start");
        await playing();
      }
      await advance(1.1);
      const after = await snap();
      assert.equal(after.story.stage, expectedStage);
      assert.equal(after.story.laps, before.story.laps + 1);
      assert.equal(after.story.doorOpen, false);
      assert.equal(after.portal, null);
      assert.ok(
        Math.hypot(after.pose.x - SPAWN.x, after.pose.z - SPAWN.z) < 0.08,
        "Rear door returns to the front entrance",
      );
      assert.ok(
        Math.abs(
          Math.atan2(
            Math.sin(after.pose.yaw - SPAWN.yaw),
            Math.cos(after.pose.yaw - SPAWN.yaw),
          ),
        ) < 0.02,
        "Facing the rear exit maps to facing into the front hall",
      );
      assert.ok(
        after.speed < 0.01,
        "Transition clears movement so the player cannot drift",
      );
      return after;
    }

    console.log(
      "BEGIN: one L, a closed rear door and an incomplete impossible exit",
    );
    await photo("title");
    await p.click("#start");
    await playing();
    const initial = await snap();
    assert.equal(initial.character, "Mara Vale");
    await use("front-door");
    assert.equal((await snap()).story.doorOpen, false);
    await rearDoor();
    await face(Math.PI);
    await p.keyboard.down("KeyW");
    await advance(1);
    await p.keyboard.up("KeyW");
    assert.ok((await snap()).pose.z < 0.52, "Closed rear leaf blocks movement");
    assert.equal((await snap()).story.laps, 0);
    await crossRear(0, true);
    assert.equal((await snap()).story.power, false);
    await photo("returned-front-door");

    console.log(
      "PASS: incomplete back-door exit returns to the entrance and pauses safely",
    );
    await enterLounge();
    await phone();
    assert.equal((await snap()).story.heardArrival, true);
    await walk(-1.55, 5.5);
    await use("letter");
    assert.equal((await snap()).story.hasLetter, true);
    await photo("sitting-room");
    await leaveLounge();
    await hallCorner();
    await walk(4.7, -0.12);
    await use("note");
    assert.equal((await snap()).story.hasNote, true);
    await walk(7.3, 0);
    await aim(MIRROR.x, MIRROR.y, MIRROR.z);
    await advance(1.5);
    assert.ok((await snap()).story.firstSeen >= 1.3);
    await photo("faithful-mirror");
    await enterKitchen();
    await walk(2.1, -3.25);
    await use("fuse");
    assert.equal((await snap()).story.hasFuse, true);
    await photo("kitchen");
    await leaveKitchen();
    await hallCorner();
    await walk(0, 1.8);
    await openRoom("utility");
    await walk(-1.3, 1.8);
    await walk(-2.3, 1.85);
    await use("panel");
    assert.equal((await snap()).story.power, true);
    await walk(-1.3, 1.8);
    await walk(0, 1.8);
    await rearDoor();
    assert.equal(
      (await snap()).story.stage,
      0,
      "Walking the complete L does not count as a loop",
    );
    const pass1 = await crossRear(1);
    assert.equal(pass1.story.hasLetter, true);
    assert.equal(pass1.story.power, true);
    console.log(
      "PASS 1: power, ordinary reflection and actual rear-to-front discontinuity",
    );

    await hallCorner();
    await walk(7.3, 0);
    await aim(MIRROR.x, MIRROR.y, MIRROR.z);
    await advance(0.8);
    await p.keyboard.down("KeyD");
    await advance(0.23);
    await p.keyboard.up("KeyD");
    const lag = await snap();
    assert.ok(
      Math.hypot(lag.pose.x - lag.body.x, lag.pose.z - lag.body.z) > 0.1,
      "Reflection is measurably late",
    );
    await advance(1.6);
    await face(Math.PI / 2);
    await advance(0.12);
    assert.equal((await snap()).story.frozen, true);
    await walk(6.7, 0);
    const held = await snap();
    await aim(MIRROR.x, MIRROR.y, MIRROR.z);
    await advance(1.4);
    assert.equal((await snap()).story.encounter, true);
    assert.ok(
      Math.hypot(
        (await snap()).body.x - held.body.x,
        (await snap()).body.z - held.body.z,
      ) < 0.01,
      "Held occupant stays at the glass",
    );
    await photo("held-reflection");
    await walk(4.7, -0.12);
    await use("drawer");
    await advance(0.7);
    await use("drawer");
    assert.equal((await snap()).story.hasKey, true);
    await enterBedroom();
    await walk(8.7, -1.65);
    await walk(8.7, -2.55);
    await use("diary");
    assert.equal((await snap()).story.hasDiary, true);
    await photo("bedroom");
    await walk(8.7, -1.65);
    await leaveBedroom();
    await crossRear(2);
    console.log("PASS 2: delayed/held reflection, bedroom key and diary");

    await enterBathroom();
    await use("bath-clue");
    assert.equal((await snap()).story.hasTimeClue, true);
    await photo("bathroom-clue");
    await leaveBathroom();
    await hallCorner();
    await walk(5.05, -0.15);
    await use("clock");
    assert.equal((await snap()).mode, "clock");
    const stopped = (await snap()).time;
    await advance(3);
    assert.equal((await snap()).time, stopped);
    await p.locator("#clock-hour").fill("3");
    await p.locator("#clock-minute").fill("17");
    await p.locator("#clock-form button[type=submit]").click();
    await playing();
    await advance(0.2);
    assert.equal((await snap()).story.clockSolved, true);
    await hallCorner();
    await enterLounge();
    await phone();
    assert.equal((await snap()).story.heardCall, true);
    await leaveLounge();
    await face(0);
    const callDeadline = Date.now() + 60000;
    let heardCallVoice = false;
    while (!(await snap()).scares.hallAppearance && Date.now() < callDeadline) {
      heardCallVoice ||= (await snap()).dialogue.id === "call";
      await p.waitForTimeout(500);
      await advance(0.15);
    }
    assert.equal(
      heardCallVoice,
      true,
      "The second telephone performance actually plays",
    );
    assert.equal(
      (await snap()).scares.hallAppearance,
      true,
      "The entry-hall appearance waits for the actual queued telephone dialogue",
    );
    assert.equal((await snap()).scares.visible, true);
    assert.equal(
      await p.locator("#subtitle").innerText(),
      "",
      "The sudden encounter does not interrupt a spoken line",
    );
    await photo("hall-appearance");
    await advance(0.7);
    assert.equal(
      (await snap()).scares.visible,
      false,
      "The transient figure clears after its authored duration",
    );
    await crossRear(3);
    assert.equal((await snap()).body.visible, false);
    console.log("PASS 3: reflected time and the separate telephone call");

    await enterKitchen();
    await kitchenRadio();
    assert.equal(
      (await snap()).story.echoIndex,
      0,
      "Wrong first sound recovers",
    );
    await leaveKitchen();
    await enterBedroom();
    await walk(6, -1.65);
    await walk(6, -3.2);
    await use("musicbox");
    assert.equal((await snap()).story.echoIndex, 1);
    await photo("inverted-bedroom");
    await walk(6, -1.65);
    await leaveBedroom();
    await hallCorner();
    await enterBathroom();
    await use("tap");
    assert.equal((await snap()).story.echoIndex, 2);
    await leaveBathroom();
    await enterLounge();
    await phone();
    assert.equal(
      (await snap()).story.echoIndex,
      2,
      "The dead phone cannot reset two quiet sounds",
    );
    await leaveLounge();
    await enterKitchen();
    await kitchenRadio();
    assert.equal((await snap()).story.echoIndex, 3);
    await photo("separate-kitchen-radio");
    await p.keyboard.press("Tab");
    await p.waitForFunction(() => !document.querySelector("#pocket").hidden);
    assert.ok((await p.locator("#items").innerText()).includes("3 / 3"));
    await photo("journal");
    await p.keyboard.press("Tab");
    await playing();
    await leaveKitchen();
    await crossRear(4);
    await p.waitForTimeout(800);
    const quiet = (await snap()).roomSound;
    assert.ok(
      quiet.radio < 0.005 && quiet.water < 0.005,
      "Solved sounds stay quiet after another impossible exit",
    );
    console.log(
      "PASS 4: independent sound sources, reverse order and persistent silence",
    );

    await hallCorner();
    await walk(7.3, 0);
    await aim(MIRROR.x, MIRROR.y, MIRROR.z);
    await advance(0.5);
    assert.equal((await snap()).story.finalFaced, true);
    await photo("final-reflection");
    await p.keyboard.press("Escape");
    await p.waitForFunction(() => !document.querySelector("#menu").hidden);
    const paused = await snap();
    await p.keyboard.press("KeyE");
    await p.keyboard.down("KeyW");
    await advance(3);
    await p.keyboard.up("KeyW");
    assert.equal((await snap()).time, paused.time);
    assert.deepEqual((await snap()).pose, paused.pose);
    assert.equal((await snap()).audio, "suspended");
    await p.click("#start");
    await playing();
    await walk(3.0, -0.12);
    assert.equal((await snap()).story.exitReleased, true);
    await rearDoor();
    if (!(await snap()).story.doorOpen) await use("door");
    await advance(1.4);
    await face(Math.PI);
    await p.keyboard.down("KeyW");
    for (let i = 0; i < 60; i++) {
      await advance(0.08);
      if ((await snap()).portal) break;
    }
    await p.keyboard.up("KeyW");
    const playTime = (await snap()).time;
    await advance(11);
    assert.equal((await snap()).mode, "ending");
    assert.equal((await snap()).story.ended, true);
    assert.deepEqual(
      (await snap()).story.visited.slice().sort(),
      ROOMS.map((r) => r.id).sort(),
    );
    await photo("ending");
    const scares = (await snap()).scares;
    assert.equal(
      scares.mirrorSnap,
      true,
      "The mirror encounter fires its authored sudden scare",
    );
    assert.equal(scares.hallAppearance, true);
    assert.equal(await p.locator("#ending-credits").isVisible(), true);
    await p.click("#credits-open");
    await p.waitForFunction(() => !document.querySelector("#credits").hidden);
    assert.equal(await p.evaluate(() => document.pointerLockElement), null);
    assert.ok(
      (await p.locator("#credit-list").innerText()).length > 100,
      "The ending exposes substantive asset and contributor credits",
    );
    await p.click("#credits-close");
    assert.equal((await snap()).mode, "ending");
    console.log(
      "PASS 5: refusal and rear-door mirror-trap ending, game seconds",
      playTime.toFixed(1),
    );

    await p.click("#start");
    await playing();
    const reset = await snap();
    assert.equal(reset.story.stage, 0);
    assert.equal(reset.story.laps, 0);
    assert.equal(reset.story.power, false);
    assert.equal(reset.story.hasKey, false);
    assert.equal(reset.story.hasLetter, false);
    assert.equal(reset.story.echoIndex, 0);
    assert.equal(reset.story.exitReleased, false);
    assert.equal(reset.story.doors.lounge, false);
    assert.equal(reset.pose.x, SPAWN.x);
    assert.equal(reset.pose.z, SPAWN.z);
    assert.equal(reset.portal, null);
    assert.equal(reset.scares.mirrorSnap, false);
    assert.equal(reset.scares.hallAppearance, false);
    assert.deepEqual(reset.dressing, initial.dressing);
    await p.keyboard.press("KeyF");
    await advance(0.1);
    assert.equal((await snap()).flashlight, true);
    assert.ok(
      assets.some((name) =>
        /\/assets\/character\/.*\.(glb|gltf)(\?|$)/.test(name),
      ),
      "A real character asset was loaded by the game",
    );
    const voices = await p.evaluate(async () => {
      const { VOICES } = await import("./src/story.mjs");
      const lines = await (await fetch("assets/voice/lines.json")).json();
      const credit = await (await fetch("assets/voice/README.md")).text();
      if (!/kokoro/i.test(credit))
        throw Error("Voice engine provenance is not upgraded");
      const c = new AudioContext(),
        result = {};
      try {
        for (const id of Object.keys(VOICES)) {
          if (lines[id].text !== VOICES[id].text)
            throw Error("Stale synthesis text " + id);
          const r = await fetch("assets/voice/" + id + ".ogg");
          if (!r.ok) throw Error("Missing voice " + id);
          const b = await c.decodeAudioData(await r.arrayBuffer());
          if (!b.getChannelData(0).some((v) => Math.abs(v) > 0.01))
            throw Error("Silent voice " + id);
          result[id] = b.duration;
        }
      } finally {
        await c.close();
      }
      return result;
    });
    assert.equal(Object.keys(voices).length, 17);
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
    console.log(
      JSON.stringify(
        {
          result: "PASS",
          stages: 5,
          rooms: 5,
          loops: 5,
          gameSeconds: playTime,
          voices: Object.keys(voices).length,
          scares,
          screenshots: out,
          checks: [
            "closed rear-door collision",
            "incomplete threshold loop",
            "portal pause and orientation",
            "one L-shaped route",
            "five room doors and props",
            "power and faithful/delayed/held reflection",
            "actual GLB protagonist",
            "separate telephone/radio",
            "hospital letter and diary",
            "clock UI",
            "reverse sound order recovery",
            "persistent final silence",
            "authored mirror and hallway scares",
            "rear-door ending and credits",
            "full reset",
            "Kokoro voice decoding",
          ],
        },
        null,
        2,
      ),
    );
  } catch (error) {
    if (currentPage && !currentPage.isClosed()) {
      console.error(
        "Last game state:",
        await currentPage
          .evaluate(() => window.__mirror?.snapshot())
          .catch(() => null),
      );
    }
    throw error;
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
