// Exercise the application's actual pointer-lock event binding. No screenshots
// or image payloads are needed to detect a sudden 180-degree look discontinuity.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const url = (process.env.MIRROR_TEST_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
    page.setDefaultTimeout(120000);
    const errors = [], failed = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    page.on("requestfailed", request => failed.push(request.url()));
    await page.goto(url + "/?test=1");
    await page.waitForFunction(() => !!window.__mirror, {}, { timeout: 180000 });
    assert.equal(await page.locator("#start").count(), 1, "Game document has no start control: " + page.url());
    const playing = async () => {
      await page.click("#start");
      await page.waitForFunction(() => !!document.pointerLockElement && window.__mirror.snapshot().active);
    };
    await playing();
    await page.evaluate(() => {
      window.sendLook = (x, y = 0) => {
        const event = new MouseEvent("mousemove", { bubbles: true });
        Object.defineProperties(event, {
          movementX: { value: x }, movementY: { value: y },
        });
        document.dispatchEvent(event);
        return window.__mirror.snapshot().pose;
      };
    });
    const first = await page.evaluate(() => {
      const initial = window.__mirror.snapshot().pose;
      const spike = window.sendLook(1745);
      const resumed = window.sendLook(5, -2);
      let fast;
      for (let i = 0; i < 25; i++) fast = window.sendLook(70);
      const dpi = [window.sendLook(1000), window.sendLook(1000), window.sendLook(1000)].at(-1);
      // Leave a fresh discontinuity pending, then lose and regain the lock.
      const pending = window.sendLook(100000);
      return { initial, spike, resumed, fast, dpi, pending };
    });
    const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);
    close(first.spike.yaw, first.initial.yaw);
    close(first.resumed.yaw, first.initial.yaw - 5 * .0018);
    close(first.resumed.pitch, first.initial.pitch + 2 * .0018);
    close(first.fast.yaw, first.resumed.yaw - 1750 * .0018);
    close(first.dpi.yaw, first.fast.yaw - 3000 * .0018);
    close(first.pending.yaw, first.dpi.yaw);
    await page.evaluate(() => document.exitPointerLock());
    await page.waitForFunction(() => !document.pointerLockElement && !window.__mirror.snapshot().active);
    const unlocked = await page.evaluate(() => window.sendLook(150, 150));
    close(unlocked.yaw, first.pending.yaw);
    close(unlocked.pitch, first.pending.pitch);
    await playing();
    const reset = await page.evaluate(() => {
      const before = window.__mirror.snapshot().pose;
      const small = window.sendLook(3);
      const a = window.sendLook(1745), b = window.sendLook(-1745), c = window.sendLook(4);
      return { before, small, a, b, c };
    });
    close(reset.small.yaw, reset.before.yaw - 3 * .0018);
    close(reset.a.yaw, reset.small.yaw);
    close(reset.b.yaw, reset.small.yaw);
    close(reset.c.yaw, reset.small.yaw - 4 * .0018);
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
    console.log(JSON.stringify({ status: "PASS", checks: ["live canvas pointer lock", "isolated half-turn packet rejected", "normal diagonal input preserved", "fast deliberate turn preserved", "high-DPI stream preserves every count", "unlocked mouse ignored", "lock reacquisition clears pending input", "reciprocal recenter pair rejected"], errors, failed }));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
