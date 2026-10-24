// Exercise the actual pointer-lock binding and render-frame integration. A
// browser/driver burst must not bypass safety merely by using several packets.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const url = (process.env.MIRROR_TEST_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const gain = .0018;
const frame = 1 / 60;
const frameBudget = 18 * Math.PI / 180;
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} ≈ ${b}`);

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
    page.setDefaultTimeout(180000);
    const errors = [], failed = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    page.on("requestfailed", request => failed.push(request.url()));
    await page.addInitScript(() => sessionStorage.setItem('mirror-me.intro.v1', 'acknowledged'));
    await page.goto(url + "/?test=1");
    await page.waitForFunction(() => !!window.__mirror);
    const playing = async () => {
      await page.click("#start");
      await page.waitForFunction(() => !!document.pointerLockElement && window.__mirror.snapshot().active);
    };
    await playing();
    await page.evaluate(() => {
      window.sendLook = (x, y = 0) => {
        const event = new MouseEvent("mousemove", { bubbles: true });
        Object.defineProperties(event, { movementX: { value: x }, movementY: { value: y } });
        document.dispatchEvent(event);
      };
      window.nativeLookPackets = [];
      document.addEventListener("mousemove", event => {
        if (event.isTrusted && document.pointerLockElement)
          window.nativeLookPackets.push({ x: event.movementX, y: event.movementY, time: event.timeStamp, trusted: event.isTrusted });
      });
    });
    const result = await page.evaluate(({ frame, gain, frameBudget }) => {
      const snapshot = () => window.__mirror.snapshot().pose;
      const tick = () => { window.__mirror.advance(frame); return snapshot(); };
      const check = (condition, message) => { if (!condition) throw new Error(message); };
      const near = (a, b, message) => check(Math.abs(a - b) < 1e-8, message + `: ${a} != ${b}`);
      const normalStart = snapshot();
      window.sendLook(12, -7);
      near(snapshot().yaw, normalStart.yaw, "Input must be applied on the next simulation frame");
      const normal = tick();
      near(normal.yaw, normalStart.yaw - 12 * gain, "Normal horizontal motion changed");
      near(normal.pitch, normalStart.pitch + 7 * gain, "Normal vertical motion changed");
      const cases = [
        { name: "one half-turn packet", packets: [1745] },
        { name: "moderate burst is bounded rather than lost", packets: [250, 250], mustMove: true },
        { name: "corroborating large packets", packets: [1000, 1000] },
        { name: "below-old-threshold packet burst", packets: [850, 850] },
        { name: "many individually small packets", packets: Array(30).fill(70) },
      ];
      for (const entry of cases) {
        const before = snapshot();
        for (const count of entry.packets) window.sendLook(count);
        const after = tick();
        const angle = Math.abs(after.yaw - before.yaw);
        check(angle <= frameBudget + 1e-8, entry.name + " caused a sudden turn: " + angle);
        if (entry.mustMove) check(angle > 0, "Moderate fast input must still rotate the camera");
        const idle = tick();
        near(idle.yaw, after.yaw, entry.name + " replayed discarded backlog on the next frame");
      }
      const sweepStart = snapshot();
      for (let i = 0; i < 35; i++) { window.sendLook(50); tick(); }
      near(snapshot().yaw, sweepStart.yaw - 1750 * gain, "A deliberate fast half turn lost normal movement");
      window.sendLook(100000); // Must be discarded across capture epochs.
      return { pending: snapshot(), normalPackets: 35, boundedBurstCases: cases.length };
    }, { frame, gain, frameBudget });
    await page.evaluate(() => document.exitPointerLock());
    await page.waitForFunction(() => !document.pointerLockElement && !window.__mirror.snapshot().active);
    const unlocked = await page.evaluate(() => { window.sendLook(150, 150); return window.__mirror.snapshot().pose; });
    close(unlocked.yaw, result.pending.yaw);
    close(unlocked.pitch, result.pending.pitch);
    await playing();
    const resumed = await page.evaluate(frame => {
      const before = window.__mirror.snapshot().pose;
      window.sendLook(3);
      window.__mirror.advance(frame);
      return { before, after: window.__mirror.snapshot().pose };
    }, frame);
    close(resumed.after.yaw, resumed.before.yaw - 3 * gain);

    // Genuine browser input, unlike dispatchEvent: verify small trusted deltas
    // pass through capture and a viewport resize without producing a flip.
    await page.mouse.move(500, 350);
    await page.evaluate(frame => { window.__mirror.advance(frame); window.nativeLookPackets = []; }, frame);
    const beforeNative = await page.evaluate(() => window.__mirror.snapshot().pose);
    await page.mouse.move(510, 353);
    const native = await page.evaluate(frame => {
      window.__mirror.advance(frame);
      return { pose: window.__mirror.snapshot().pose, packets: window.nativeLookPackets };
    }, frame);
    assert.ok(native.packets.length > 0 && native.packets.every(packet => packet.trusted));
    close(native.pose.yaw, beforeNative.yaw - native.packets.reduce((sum, packet) => sum + packet.x, 0) * gain);
    close(native.pose.pitch, beforeNative.pitch - native.packets.reduce((sum, packet) => sum + packet.y, 0) * gain);
    await page.setViewportSize({ width: 1280, height: 800 });
    const beforeResizeMotion = await page.evaluate(() => window.__mirror.snapshot().pose);
    await page.mouse.move(511, 354);
    const resizeMotion = await page.evaluate(frame => { window.__mirror.advance(frame); return window.__mirror.snapshot().pose; }, frame);
    assert.ok(Math.abs(resizeMotion.yaw - beforeResizeMotion.yaw) <= frameBudget + 1e-8);
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
    console.log(JSON.stringify({ status: "PASS", checks: ["actual canvas capture", "frame-applied normal diagonal input", "single and multi-packet burst bounds", "no stale backlog replay", "deliberate fast half turn", "capture loss/reacquisition", "trusted browser mouse events", "viewport resize"], boundedBurstCases: result.boundedBurstCases, trustedPackets: native.packets.length, errors, failed }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
