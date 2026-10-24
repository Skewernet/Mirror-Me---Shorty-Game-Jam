// Complete route uses actual collision-respecting movement, never pose teleports.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const url = process.env.MIRROR_TEST_URL || "http://127.0.0.1:8000";
const out = process.env.MIRROR_TEST_OUTPUT || "/tmp/mirror-me-crescendo-checks";
fs.mkdirSync(out, { recursive: true });
(async () => {
  const { TARGETS, ROOMS, SPAWN, MIRROR, EXIT, PORTAL } = await import(
    "../src/layout.mjs"
  );
  const { VOICES } = await import("../src/story.mjs");
  const { RADIUS } = await import("../src/physics.mjs");
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
    const snap = async () => {
      const state = await p.evaluate(() => window.__mirror.snapshot());
      for (const id of [state.dialogue.id, ...state.dialogue.queued].filter(
        Boolean,
      ))
        assert.ok(
          Object.hasOwn(VOICES, id),
          "Queued voice has a registered script and take: " + id,
        );
      return state;
    };
    const advance = (s) => p.evaluate((s) => window.__mirror.advance(s), s);
    const face = (yaw, pitch = 0) =>
      p.evaluate((v) => window.__mirror.face(...v), [yaw, pitch]);
    const playing = () =>
      p.waitForFunction(
        () =>
          !!document.pointerLockElement &&
          !document.querySelector("#hud").hidden,
      );
    const close = (a, b, tolerance = 1e-8) =>
      assert.ok(Math.abs(a - b) < tolerance, `${a} ≈ ${b}`);
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
      const portals = (await snap()).portalCount;
      for (let i = 0; i < 160; i++) {
        const s = await snap(),
          dx = x - s.pose.x,
          dz = z - s.pose.z,
          d = Math.hypot(dx, dz);
        assert.equal(
          s.portalCount,
          portals,
          "An ordinary room route must not cross a spatial threshold",
        );
        if (d < 0.055) {
          await p.keyboard.up("KeyW");
          await advance(0.13);
          return;
        }
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
        "Target " + id + " from " + JSON.stringify(s.pose),
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
    async function enterUtility() {
      await walk(0, 1.8);
      await openRoom("utility");
      await walk(-1.3, 1.8);
    }
    async function leaveUtility() {
      await walk(-1.3, 1.8);
      await walk(0, 1.8);
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
    async function frozenModal(mode) {
      const before = await snap();
      assert.equal(before.mode, mode);
      assert.equal(before.active, false);
      assert.deepEqual(before.input.keys, []);
      await p.keyboard.down("KeyW");
      await p.keyboard.press("KeyE");
      await p.keyboard.press("KeyF");
      await advance(2);
      await p.keyboard.up("KeyW");
      const after = await snap();
      assert.equal(after.time, before.time);
      assert.deepEqual(after.pose, before.pose);
      assert.deepEqual(after.story, before.story);
      assert.deepEqual(after.ending, before.ending);
      assert.equal(after.flashlight, before.flashlight);
      assert.deepEqual(after.input.keys, []);
      assert.equal(after.audio, "suspended");
    }
    async function waitDialogue(onLine = () => {}) {
      const deadline = Date.now() + 90000;
      while (Date.now() < deadline) {
        const s = await snap();
        onLine(s.dialogue.id);
        if (!s.dialogue.busy && !s.dialogue.queued.length) return;
        await p.waitForTimeout(500);
        await advance(0.2);
      }
      throw Error(
        "Dialogue did not finish: " + JSON.stringify((await snap()).dialogue),
      );
    }
    async function waitEndingFlag(flag) {
      const deadline = Date.now() + 90000;
      while (Date.now() < deadline) {
        const state = await snap();
        if (state.ending?.[flag]) return state;
        assert.equal(
          state.mode,
          "playing",
          "The final report and response complete before ending credits",
        );
        await p.waitForTimeout(350);
        await advance(0.15);
      }
      throw Error(
        "Ending phase did not complete: " +
          flag +
          " " +
          JSON.stringify((await snap()).ending),
      );
    }
    async function encounter(id, x, y, z) {
      await aim(x, y, z);
      const deadline = Date.now() + 90000;
      while (Date.now() < deadline) {
        const s = await snap();
        if (s.scares.active === id) return s;
        assert.equal(
          s.scares.completed[id],
          false,
          "The intended encounter was not consumed unseen",
        );
        await p.waitForTimeout(500);
        await advance(0.15);
      }
      throw Error(
        "Encounter unavailable: " +
          id +
          " " +
          JSON.stringify((await snap()).scares),
      );
    }
    function checkTransform(last, kind) {
      assert.equal(last.kind, kind);
      const { from, to } = last;
      close(to.pitch, from.pitch);
      close(to.distance, from.distance);
      close(to.speed, from.speed);
      close(to.vx, -from.vx);
      close(to.vz, -from.vz);
      close(Math.sin(to.yaw), -Math.sin(from.yaw));
      close(Math.cos(to.yaw), -Math.cos(from.yaw));
      if (kind === "rear") {
        close(to.x, PORTAL.returnX - (from.x - EXIT.x));
        close(to.z, PORTAL.returnZ - (from.z - PORTAL.thresholdZ));
        assert.ok(from.z > PORTAL.thresholdZ);
      } else {
        close(to.x, MIRROR.x - (2 * RADIUS + 0.04) - (from.x - (MIRROR.x - RADIUS)));
        close(to.z, MIRROR.z - (from.z - MIRROR.z));
        assert.ok(from.x >= MIRROR.x - RADIUS);
        assert.ok(from.x < MIRROR.x, "crossing happens before the camera clips through the glass");
      }
    }
    async function crossRear(stage, offset = 0) {
      await rearDoor();
      if (offset) await walk(EXIT.x + offset, 0);
      const before = await snap();
      assert.equal(
        before.story.doorOpen,
        true,
        "The completed puzzle opens the latch without another E interaction",
      );
      await advance(1.4);
      await face(Math.PI, 0.17);
      if (stage === 1) await photo("open-rear-portal");
      await p.keyboard.down("KeyW");
      let after;
      for (let i = 0; i < 100; i++) {
        await advance(1 / 60);
        after = await snap();
        assert.equal(
          after.portal,
          null,
          "A rear crossing never inserts a fade or frozen transition state",
        );
        if (after.portalCount > before.portalCount) break;
      }
      assert.equal(after.portalCount, before.portalCount + 1);
      assert.equal(after.story.stage, stage);
      assert.equal(after.story.laps, before.story.laps + 1);
      assert.equal(after.story.doorOpen, false);
      close(after.time, after.lastPortal.time);
      assert.equal(
        await p
          .locator("#transition")
          .evaluate((e) => getComputedStyle(e).opacity),
        "0",
        "The crossing never covers the scene with a fade",
      );
      checkTransform(after.lastPortal, "rear");
      assert.ok(after.input.keys.includes("KeyW"));
      assert.ok(
        after.speed > 1.6,
        "Momentum survives the exact crossing frame",
      );
      const z = after.pose.z;
      await advance(0.12);
      assert.ok(
        (await snap()).pose.z < z - 0.15,
        "Held forward input continues into the front hall",
      );
      await p.keyboard.up("KeyW");
      await advance(0.15);
      return snap();
    }
    async function offer(target, item, testPause = false) {
      await use(target);
      assert.equal((await snap()).mode, "offering");
      if (testPause) await frozenModal("offering");
      await p.locator(`#offering-choices button[data-item="${item}"]`).click();
      await playing();
      await advance(0.15);
    }

    console.log(
      "BEGIN: seven chapters, locked unfinished exit and continuous spatial returns",
    );
    await photo("title");
    await p.locator("#settings summary").click();
    await p.locator("#flashing-lights").uncheck();
    await p.locator("#settings summary").click();
    await p.click("#start");
    await playing();
    const initial = await snap();
    assert.equal(initial.character, "Mara Vale");
    assert.equal(initial.story.truthFound, false);
    assert.equal(initial.revelation.visible, false);
    assert.equal(initial.revelation.truthAcknowledged, false);
    assert.equal(initial.revelation.newColliders, 0);
    assert.equal(initial.scares.flashes, false);
    await use("front-door");
    assert.equal((await snap()).story.frontOpen, false);
    await rearDoor();
    await use("door");
    assert.equal((await snap()).story.doorOpen, false);
    await face(Math.PI);
    await p.keyboard.down("KeyW");
    await advance(1);
    await p.keyboard.up("KeyW");
    await advance(0.15);
    assert.ok(
      (await snap()).pose.z < 0.52,
      "The unfinished chapter's rear leaf physically blocks leaving",
    );
    assert.equal((await snap()).portalCount, 0);
    assert.equal((await snap()).story.laps, 0);
    await p.keyboard.press("Escape");
    await p.waitForFunction(() => !document.querySelector("#menu").hidden);
    await frozenModal("paused");
    await p.click("#start");
    await playing();

    await hallCorner();
    await enterLounge();
    await phone();
    await walk(-1.55, 5.5);
    await use("letter");
    await photo("sitting-room");
    await leaveLounge();
    await hallCorner();
    await walk(4.7, -0.12);
    await use("note");
    await walk(7.3, 0);
    await aim(MIRROR.x, MIRROR.y, MIRROR.z);
    await advance(1.5);
    assert.ok((await snap()).story.firstSeen >= 1.3);
    await photo("faithful-mirror");
    await enterKitchen();
    await walk(2.1, -3.25);
    await use("fuse");
    await photo("kitchen");
    await leaveKitchen();
    await hallCorner();
    await enterUtility();
    await walk(-2.3, 1.85);
    await use("panel");
    assert.equal((await snap()).story.power, true);
    assert.equal((await snap()).story.doorOpen, true);
    await leaveUtility();
    const first = await crossRear(1, 0.1);
    assert.equal(first.story.hasLetter, true);
    assert.equal(first.story.power, true);
    await photo("seamless-front-return");
    console.log(
      "PASS 1: chapter gate and seamless rear half-turn with held movement",
    );

    await hallCorner();
    await walk(0, 1.5);
    await use("photo");
    assert.equal((await snap()).story.photoStraightened, true);
    await advance(1.6);
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
      "The reflection visibly lags real movement",
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
    await photo("bedroom-diary");
    await p.keyboard.press("Tab");
    await p.waitForFunction(() => !document.querySelector("#pocket").hidden);
    await frozenModal("pocket");
    assert.ok((await p.locator("#items").innerText()).includes("93.7"));
    await p.keyboard.press("Tab");
    await playing();
    await walk(8.7, -1.65);
    await leaveBedroom();
    await crossRear(2);
    console.log(
      "PASS 2: delayed/held reflection, key, diary and paused readable journal",
    );

    await enterBathroom();
    await use("bath-clue");
    assert.equal((await snap()).story.hasTimeClue, true);
    await walk(1.2, 2.3);
    const ceiling = await encounter("bathroom-ceiling", 2.6, 1.55, 2.2);
    assert.equal(ceiling.scares.mode, "ceiling");
    await advance(0.3);
    assert.equal(
      (await snap()).scares.lightMultiplier,
      1,
      "Disabling flicker leaves the visible creature encounter intact",
    );
    await photo("ceiling-encounter");
    await advance(5);
    assert.equal((await snap()).scares.visible, false);
    await leaveBathroom();
    await hallCorner();
    await walk(5.05, -0.15);
    await use("clock");
    await frozenModal("clock");
    await p.locator("#clock-hour").fill("3");
    await p.locator("#clock-minute").fill("17");
    await p.locator("#clock-form button[type=submit]").click();
    await playing();
    await advance(0.2);
    assert.equal((await snap()).story.clockSolved, true);
    await enterKitchen();
    await kitchenRadio();
    await frozenModal("radio");
    await p.keyboard.press("Escape");
    await p.waitForFunction(() => !document.querySelector("#menu").hidden);
    assert.equal(await p.locator("#radio-inspect").isVisible(), false);
    await p.click("#start");
    await playing();
    await kitchenRadio();
    await p.locator("#radio-frequency").fill("93.8");
    await p.locator("#radio-form button[type=submit]").click();
    await playing();
    await advance(0.2);
    assert.equal((await snap()).story.radioTuned, false);
    await kitchenRadio();
    await p.locator("#radio-frequency").fill("93.7");
    await p.locator("#radio-form button[type=submit]").click();
    await playing();
    await advance(0.2);
    assert.equal((await snap()).story.radioTuned, true);
    assert.equal((await snap()).story.heardCall, false);
    await photo("tuned-kitchen-radio");
    await leaveKitchen();
    await hallCorner();
    await enterLounge();
    await phone();
    assert.equal((await snap()).story.heardCall, true);
    await leaveLounge();
    let heardCallVoice = false;
    await waitDialogue((id) => {
      heardCallVoice ||= id === "call";
    });
    assert.equal(
      heardCallVoice,
      true,
      "The second telephone performance actually plays",
    );
    assert.equal(await p.locator("#subtitle").innerText(), "");
    await p.keyboard.press("Escape");
    await p.waitForFunction(() => !document.querySelector("#menu").hidden);
    await p.locator("#settings summary").click();
    await p.locator("#flashing-lights").check();
    await p.locator("#settings summary").click();
    await p.click("#start");
    await playing();
    await crossRear(3);
    console.log(
      "PASS 3: ceiling creature, comfort switch, reflected clock, tuning UI and separate telephone call",
    );

    await hallCorner();
    await walk(2, 0);
    const crawler = await encounter("far-hall-crawler", 5.75, 0.44, 0);
    assert.equal(crawler.scares.mode, "crawl");
    await advance(0.3);
    await photo("floor-crawler");
    await advance(5);
    assert.equal((await snap()).scares.visible, false);
    await hallCorner();
    await enterLounge();
    await walk(-1.55, 5.5);
    await use("keepsake-ribbon");
    assert.equal((await snap()).story.keepsakes.ribbon, true);
    await leaveLounge();
    await enterUtility();
    await walk(-2.3, 1.85);
    await walk(-2.05, 2.1);
    await use("keepsake-ring");
    assert.equal((await snap()).story.keepsakes.ring, true);
    await walk(-2.3, 1.85);
    await leaveUtility();
    await enterKitchen();
    await walk(3.25, -2);
    await walk(3.65, -2.17);
    await use("keepsake-watch");
    assert.equal((await snap()).story.keepsakes.watch, true);
    await photo("found-keepsakes");
    await walk(3.25, -2);
    await walk(2.4, -1.25);
    await walk(2.1, -2.7);
    await use("radio-altar");
    await frozenModal("offering");
    await p.click("#offering-back");
    await playing();
    assert.equal((await snap()).story.ritualIndex, 0);
    assert.deepEqual((await snap()).story.keepsakes, {
      watch: true,
      ring: true,
      ribbon: true,
    });
    await offer("radio-altar", "ring");
    assert.equal((await snap()).story.ritualIndex, 0);
    assert.equal((await snap()).story.keepsakes.ring, true);
    assert.equal((await snap()).story.keepsakes.watch, true);
    await offer("radio-altar", "watch");
    assert.equal((await snap()).story.ritualIndex, 1);
    assert.equal((await snap()).story.keepsakes.watch, false);
    await leaveKitchen();
    await hallCorner();
    await enterBathroom();
    await offer("bath-dish", "ring");
    assert.equal((await snap()).story.ritualIndex, 2);
    await leaveBathroom();
    await enterBedroom();
    await walk(6, -1.65);
    await walk(6, -3.2);
    await offer("musicbox-base", "ribbon");
    assert.equal((await snap()).story.ritualIndex, 3);
    assert.deepEqual((await snap()).story.placedKeepsakes, [
      "watch",
      "ring",
      "ribbon",
    ]);
    await photo("returned-keepsakes");
    await walk(6, -1.65);
    await leaveBedroom();
    await crossRear(4);
    console.log(
      "PASS 4: floor crawler, three physical pickups and ordered offerings with wrong-choice recovery",
    );

    await enterKitchen();
    await kitchenRadio();
    assert.equal((await snap()).story.echoIndex, 0);
    await leaveKitchen();
    await enterBedroom();
    await walk(6, -1.65);
    await walk(6, -3.2);
    await use("musicbox");
    assert.equal((await snap()).story.echoIndex, 1);
    await photo("closed-music-box");
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
      "The telephone cannot reset two quiet ritual sounds",
    );
    await leaveLounge();
    await enterKitchen();
    await kitchenRadio();
    assert.equal((await snap()).story.echoIndex, 3);
    await p.keyboard.press("Tab");
    await p.waitForFunction(() => !document.querySelector("#pocket").hidden);
    assert.ok((await p.locator("#items").innerText()).includes("3 / 3"));
    await photo("journal");
    await p.keyboard.press("Tab");
    await playing();
    await leaveKitchen();
    await crossRear(5);
    assert.equal((await snap()).story.backdoorGone, true);
    assert.equal((await snap()).story.mirrorReady, true);
    assert.equal((await snap()).body.visible, false);
    assert.equal((await snap()).revelation.visible, false);
    await p.waitForTimeout(800);
    const quiet = (await snap()).roomSound;
    assert.ok(quiet.radio < 0.005 && quiet.water < 0.005);
    console.log("PASS 5: reverse silence and the vanished back door");

    await rearDoor();
    await aim(TARGETS.door.x, TARGETS.door.y, TARGETS.door.z);
    assert.notEqual((await snap()).target, "door");
    const portalCount = (await snap()).portalCount;
    await face(Math.PI);
    await p.keyboard.down("KeyW");
    await advance(1);
    await p.keyboard.up("KeyW");
    await advance(0.15);
    assert.ok(
      (await snap()).pose.z < 0.52,
      "The missing rear doorway is replaced by a solid wall",
    );
    assert.equal((await snap()).portalCount, portalCount);
    await walk(7.4, 0);
    await aim(MIRROR.x, MIRROR.y, MIRROR.z);
    await use("mirror");
    assert.equal(
      (await snap()).story.stage,
      5,
      "E cannot substitute for physically entering the empty glass",
    );
    await photo("empty-mirror");
    await face(-Math.PI / 2, 0.07);
    await p.keyboard.down("KeyW");
    let inverted;
    for (let i = 0; i < 120; i++) {
      await advance(1 / 60);
      inverted = await snap();
      if (inverted.portalCount > portalCount) break;
    }
    assert.equal(inverted.story.stage, 6);
    assert.equal(inverted.story.inverted, true);
    assert.equal(inverted.revelation.visible, true);
    assert.equal(inverted.revelation.coveredBody, true);
    assert.equal(inverted.revelation.truthAcknowledged, false);
    assert.equal(
      inverted.story.truthFound,
      false,
      "Crossing into the real house does not acknowledge the bedside evidence",
    );
    assert.equal(inverted.portalCount, portalCount + 1);
    checkTransform(inverted.lastPortal, "mirror");
    assert.ok(inverted.input.keys.includes("KeyW"));
    assert.ok(inverted.speed > 1.6);
    const mx = inverted.pose.x;
    await advance(0.12);
    assert.ok((await snap()).pose.x < mx - 0.15);
    await p.keyboard.up("KeyW");
    await advance(0.15);
    await photo("inverted-house");
    await aim(MIRROR.x, MIRROR.y, MIRROR.z);
    assert.equal(
      (await snap()).body.visible,
      true,
      "The real house restores Mara's reflection instead of hiding her from the evidence",
    );
    await photo("truthful-mirror");
    console.log(
      "PASS 6: passable empty mirror, continuous movement and inverted house",
    );

    await enterBedroom();
    await walk(8.7, -1.65);
    await walk(8.7, -2.55);
    await use("bedside-lamp");
    assert.equal((await snap()).story.lampOff, false);
    assert.equal((await snap()).story.frontReleased, false);
    await walk(8.7, -1.65);
    await walk(7.4, -1.7);
    await use("bed-farewell");
    assert.equal((await snap()).story.farewellSaid, true);
    assert.equal((await snap()).story.truthFound, true);
    assert.equal((await snap()).revelation.truthAcknowledged, true);
    assert.equal((await snap()).story.frontReleased, false);
    await photo("bedside-truth");
    await walk(8.7, -1.65);
    await walk(8.7, -2.55);
    await use("bedside-lamp");
    assert.equal((await snap()).story.lampOff, true);
    assert.equal((await snap()).story.frontReleased, true);
    await photo("farewell-bedroom");
    await walk(8.7, -1.65);
    await leaveBedroom();
    await hallCorner();
    await walk(0, 6.6);
    await use("front-door");
    assert.equal((await snap()).story.frontOpen, true);
    assert.equal(
      (await snap()).story.endingStarted,
      false,
      "Opening the door alone does not start the reception",
    );
    await advance(1.7);
    await face(Math.PI);
    await p.keyboard.down("KeyW");
    let wake;
    for (let i = 0; i < 130; i++) {
      await advance(1 / 60);
      wake = await snap();
      if (wake.story.wakeEntered) break;
    }
    await p.keyboard.up("KeyW");
    assert.equal(wake.story.wakeEntered, true);
    assert.equal(wake.story.truthFound, true);
    assert.equal(wake.story.endingStarted, true);
    assert.ok(wake.funeralRoom.roomArea > 70);
    assert.ok(wake.funeralRoom.emptyChairs >= 2);
    assert.equal(wake.funeralRoom.casket.cleanMother, true);
    assert.equal(wake.mode, "playing");
    await advance(0.3);
    await photo("wake-arrival");
    await p.keyboard.down("KeyW");
    await advance(0.5);
    await p.keyboard.up("KeyW");
    assert.ok(
      (await snap()).pose.z > wake.pose.z + 0.2,
      "The reception retains player movement",
    );
    await p.mouse.move(640, 400);
    const yaw = (await snap()).pose.yaw;
    await p.mouse.move(700, 400);
    assert.notEqual(
      (await snap()).pose.yaw,
      yaw,
      "The reception retains mouse look",
    );
    await face(Math.PI);
    await p.keyboard.press("Escape");
    await p.waitForFunction(() => !document.querySelector("#menu").hidden);
    await frozenModal("paused");
    await p.click("#start");
    await playing();
    await advance(2);
    await waitEndingFlag("newsStarted");
    assert.equal((await snap()).dialogue.id, "news");
    await p.waitForFunction(
      () => {
        const voice = window.__mirror.snapshot().dialogue;
        return voice.id === "news" && voice.offset > 0.6;
      },
      {},
      { timeout: 15000 },
    );
    const newsPlaying = await snap();
    assert.equal(newsPlaying.dialogue.id, "news");
    assert.ok(
      newsPlaying.dialogue.offset > 0.5,
      "The funeral report advances on the audio clock",
    );
    close(newsPlaying.dialogue.position.x, 1.04);
    close(newsPlaying.dialogue.position.y, 1.04);
    close(newsPlaying.dialogue.position.z, 11.92);
    assert.ok(
      newsPlaying.roomSound.radio < 0.005,
      "The kitchen weather loop stays silent during the funeral report",
    );
    await p.keyboard.press("Escape");
    await p.waitForFunction(() => !document.querySelector("#menu").hidden);
    await frozenModal("paused");
    await p.click("#start");
    await playing();
    await p.waitForTimeout(250);
    await advance(0.05);
    const newsResumed = await snap();
    assert.equal(newsResumed.dialogue.id, "news");
    assert.ok(
      newsResumed.dialogue.offset >= newsPlaying.dialogue.offset - 0.15,
      "Pausing the report preserves its offset instead of repeating its opening",
    );
    const reportCaption = await p.locator("#subtitle").innerText();
    const captionPrefix = VOICES.news.speaker + " — “";
    assert.ok(reportCaption.startsWith(captionPrefix));
    assert.ok(
      VOICES.news.text.includes(reportCaption.slice(captionPrefix.length, -1)),
      "The resumed report retains its current readable subtitle segment",
    );
    await advance(50);
    assert.equal(
      (await snap()).mode,
      "playing",
      "Fast simulated time cannot cut off the real funeral report",
    );
    assert.equal((await snap()).ending.newsFinished, false);
    assert.equal(
      await p.locator("#veil").evaluate((e) => e.classList.contains("closing")),
      false,
      "The room stays visible until the final report and response finish",
    );
    await aim(1.04, 1.04, 11.92);
    await photo("wake-news-radio");
    await face(Math.PI);
    await photo("wake-mourners");
    await waitEndingFlag("newsFinished");
    assert.equal((await snap()).mode, "playing");
    assert.equal((await snap()).ending.lastLineFinished, false);
    await advance(2);
    assert.equal((await snap()).dialogue.id, null);
    await advance(1);
    assert.equal((await snap()).dialogue.id, "ending");
    await waitEndingFlag("lastLineFinished");
    const finalPause = await snap();
    assert.equal(finalPause.mode, "playing");
    assert.equal(finalPause.ending.attack.phase, "turn");
    assert.equal(finalPause.ending.attack.enabled, true);
    assert.equal(finalPause.ending.attack.characterAsset, "assets/character/evelyn.glb");
    assert.ok(finalPause.ending.attack.wounds.removedFaces > 0);
    async function attackTo(seconds) {
      const state = await snap();
      const age = state.time - state.ending.attack.startedAt;
      assert.ok(age <= seconds + 1e-7, "Attack target must be ahead of the current simulation time");
      if (seconds > age) await advance(seconds - age);
    }
    const beforeTurn = finalPause.pose.yaw;
    await attackTo(.18);
    assert.notEqual((await snap()).pose.yaw, beforeTurn, "Mum's final line is followed by the forced turn");
    await p.keyboard.press("Escape");
    await p.waitForFunction(() => !document.querySelector("#menu").hidden);
    const pausedAttack = (await snap()).ending.attack;
    await advance(10);
    assert.deepEqual((await snap()).ending.attack, pausedAttack, "Pause preserves the entire attack sequence");
    await p.click("#start");
    await playing();
    await attackTo(.29);
    assert.equal((await snap()).ending.attack.phase, "lunge");
    assert.equal((await snap()).ending.attack.visible, true);
    await photo("evelyn-lunge");
    assert.equal((await snap()).ending.goodnightStarted, true);
    await attackTo(.50);
    assert.equal((await snap()).mode, "playing");
    assert.ok((await snap()).ending.attack.fade > 0);
    await attackTo(.70);
    if (!(await snap()).ending.goodnightFinished) {
      assert.equal((await snap()).mode, "playing", "Blackout must not cut Mum's Goodnight short");
      assert.equal((await snap()).dialogue.id, "goodnight");
    }
    await waitEndingFlag("goodnightFinished");
    await advance(.05);
    assert.equal((await snap()).mode, "ending");
    assert.equal((await snap()).story.ended, true);
    assert.deepEqual(
      (await snap()).story.visited.slice().sort(),
      ROOMS.map((r) => r.id).sort(),
    );
    await photo("ending");
    const completed = await snap(),
      scares = completed.scares,
      playTime = completed.time;
    assert.equal(scares.mirrorSnap, true);
    assert.equal(scares.completed["bathroom-ceiling"], true);
    assert.equal(scares.completed["far-hall-crawler"], true);
    assert.equal(completed.portalCount, 6);
    assert.equal(await p.locator("#ending-credits").isVisible(), true);
    await p.click("#credits-open");
    await p.waitForFunction(() => !document.querySelector("#credits").hidden);
    await frozenModal("credits");
    assert.ok((await p.locator("#credit-list").innerText()).length > 100);
    await p.keyboard.press("Escape");
    await p.waitForFunction(() => !document.querySelector("#menu").hidden);
    assert.equal((await snap()).mode, "ending");
    console.log(
      "PASS 7: bedside acknowledgment, lamp, playable wake and complete spatial news with pause recovery",
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
    assert.deepEqual(reset.story.keepsakes, {
      watch: false,
      ring: false,
      ribbon: false,
    });
    assert.deepEqual(reset.story.placedKeepsakes, []);
    assert.equal(reset.story.inverted, false);
    assert.equal(reset.story.truthFound, false);
    assert.equal(reset.revelation.visible, false);
    assert.equal(reset.revelation.truthAcknowledged, false);
    assert.equal(reset.revelation.coveredBody, false);
    assert.equal(reset.revelation.newColliders, 0);
    assert.equal(reset.story.wakeEntered, false);
    assert.equal(reset.story.backdoorGone, false);
    assert.equal(reset.story.doors.lounge, false);
    assert.equal(reset.pose.x, SPAWN.x);
    assert.equal(reset.pose.z, SPAWN.z);
    assert.equal(reset.portalCount, 0);
    assert.equal(reset.lastPortal, null);
    assert.equal(reset.scares.mirrorSnap, false);
    assert.ok(Object.values(reset.scares.completed).every((v) => v === false));
    assert.deepEqual(reset.dressing, initial.dressing);
    await p.keyboard.press("KeyF");
    await advance(0.1);
    assert.equal((await snap()).flashlight, true);
    assert.ok(assets.some((u) => /\/assets\/character\/.*\.glb(\?|$)/.test(u)));
    const voices = await p.evaluate(async () => {
      const { VOICES } = await import("./src/story.mjs"),
        lines = await (await fetch("assets/voice/lines.json")).json();
      const c = new AudioContext(),
        result = {};
      try {
        for (const [id, line] of Object.entries(VOICES)) {
          if (lines[id]?.text !== line.text)
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
    assert.equal(Object.keys(voices).length, Object.keys(VOICES).length);
    assert.equal(Object.keys(voices).length, 30);
    assert.ok(voices.news > 10, "The funeral news is a complete voiced report");
    assert.ok(voices.sob > 0, "Mara's broken confession has audible content");
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
    console.log(
      JSON.stringify(
        {
          result: "PASS",
          chapters: 7,
          rooms: 5,
          rearReturns: 5,
          mirrorCrossings: 1,
          gameSeconds: playTime,
          intentionalEndingClockStressSeconds: 50,
          voices: Object.keys(voices).length,
          scares,
          screenshots: out,
          checks: [
            "locked incomplete exit",
            "automatic one-shot latch",
            "instant rear/mirror transforms and held movement",
            "five furnished rooms",
            "faithful/delayed/held/empty reflection",
            "readable script journal",
            "clock and tuning UI pause",
            "separate telephone/radio",
            "ceiling and floor creatures",
            "flicker comfort control",
            "keepsake UI and wrong-choice recovery",
            "reverse silence",
            "vanished rear wall",
            "inverted house",
            "bedside truth acknowledgment and lamp order",
            "front threshold and playable wake",
            "one-shot funeral report with spatial origin and preserved pause offset",
            "credits wait for the complete report, response and final pause",
            "ending credits and full reset",
            "all Kokoro voices decode",
          ],
        },
        null,
        2,
      ),
    );
  } catch (error) {
    if (currentPage && !currentPage.isClosed())
      console.error(
        "Last game state:",
        await currentPage
          .evaluate(() => window.__mirror?.snapshot())
          .catch(() => null),
      );
    throw error;
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
