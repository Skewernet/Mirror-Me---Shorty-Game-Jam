const { chromium } = require("playwright");
const assert = require("node:assert/strict");
require("node:fs").mkdirSync(
  process.env.MIRROR_TEST_OUTPUT || "/tmp/mirror-me-crescendo-checks",
  { recursive: true },
);
(async () => {
  const b = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  try {
    const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
    p.setDefaultTimeout(60000);
    const playing = () =>
      p.waitForFunction(
        () =>
          !!document.pointerLockElement &&
          !document.querySelector("#hud").hidden &&
          document.querySelector("#pocket").hidden,
        {},
        { polling: 50 },
      );
    const errors = [],
      failed = [];
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    p.on("requestfailed", (r) => failed.push(r.url()));
    await p.addInitScript(() => sessionStorage.setItem('mirror-me.intro.v1', 'acknowledged'));
    console.log("Normal mode: loading");
    await p.goto(
      (process.env.MIRROR_TEST_URL || "http://127.0.0.1:8000") + "/",
    );
    await p.waitForFunction(
      () => !document.querySelector("#start").disabled,
      {},
      { timeout: 120000 },
    );
    assert.equal(await p.evaluate(() => typeof window.__mirror), "undefined");
    const fullscreen = p.locator("#fullscreen");
    const checkFullscreen = async (enabled) => {
      // Native exit resolves before its queued fullscreenchange event; wait
      // for the menu to receive that event before inspecting its state.
      await p.waitForFunction(enabled => {
        const button = document.querySelector("#fullscreen");
        return (document.fullscreenElement === document.documentElement) === enabled &&
          button.getAttribute("aria-pressed") === String(enabled) && !button.disabled;
      },
        enabled,
      );
      assert.equal(await fullscreen.innerText(), enabled ? "EXIT FULLSCREEN" : "FULLSCREEN");
      assert.equal(await fullscreen.getAttribute("aria-pressed"), String(enabled));
      assert.ok(await p.locator("#menu").isVisible());
      assert.equal(await p.evaluate(() => document.pointerLockElement), null,
        "Fullscreen must not acquire gameplay capture on its own");
      await p.waitForFunction(() => {
        const canvas = document.querySelector("canvas");
        const height = Math.min(Number(document.querySelector("#quality").value), innerHeight);
        return canvas.height === height && canvas.width === Math.round(height * innerWidth / innerHeight);
      });
    };
    console.log("Normal mode: fullscreen");
    await checkFullscreen(false);
    await p.evaluate(() => {
      const root = document.documentElement;
      const request = root.requestFullscreen;
      window.restoreFullscreenRequest = () => { root.requestFullscreen = request; };
      root.requestFullscreen = () => Promise.reject(new DOMException("Refused", "NotAllowedError"));
    });
    await fullscreen.click();
    await p.waitForFunction(() => !document.querySelector("#fullscreen").disabled &&
      document.querySelector("#error").textContent.includes("Fullscreen could not start"));
    await checkFullscreen(false);
    await p.evaluate(() => { window.restoreFullscreenRequest(); delete window.restoreFullscreenRequest; });
    await fullscreen.click();
    await checkFullscreen(true);
    assert.equal(await p.locator("#error").innerText(), "");
    await fullscreen.click();
    await checkFullscreen(false);
    // Keep fullscreen through actual play, pause and journal capture cycles.
    await fullscreen.click();
    await checkFullscreen(true);
    await p.click("#credits-open");
    await p.waitForFunction(() => !document.querySelector("#credits").hidden);
    assert.equal(await p.evaluate(() => document.pointerLockElement), null);
    assert.ok((await p.locator("#credit-list").innerText()).length > 100);
    await p.click("#credits-close");
    await p.locator("#settings summary").click();
    assert.deepEqual(
      await p
        .locator("#quality option")
        .evaluateAll((options) => options.map((option) => option.value).sort()),
      ["1080", "1440", "720"],
    );
    await p.selectOption("#quality", "720");
    await p.locator("#auto-quality").uncheck();
    await p.locator("#brightness").fill("1.3");
    await p.locator("#grain").uncheck();
    await p.locator("#sudden-scares").uncheck();
    await p.locator("#flashing-lights").uncheck();
    await p.locator("#settings-close").click();
    console.log("Normal mode: starting");
    await p.click("#start");
    await playing();
    await p.keyboard.down("KeyW");
    await p.waitForTimeout(2000);
    await p.keyboard.up("KeyW");
    await p.keyboard.press("KeyF");
    await p.waitForTimeout(1000);
    await p.screenshot({
      path:
        (process.env.MIRROR_TEST_OUTPUT || "/tmp/mirror-me-crescendo-checks") +
        "/normal-flashlight.png",
      timeout: 60000,
    });
    await p.keyboard.press("Escape");
    await p.waitForFunction(() => !document.querySelector("#menu").hidden);
    assert.equal(await p.locator("canvas").evaluate((e) => e.height), 720);
    if (!await p.evaluate(() => Boolean(document.fullscreenElement))) await fullscreen.click();
    await checkFullscreen(true);
    await p.click("#start");
    await playing();
    console.log("Normal mode: journal");
    await p.keyboard.press("Tab");
    await p.waitForFunction(() => !document.querySelector("#pocket").hidden);
    await p.keyboard.press("Tab");
    await playing();
    await p.waitForTimeout(150);
    await p.keyboard.press("Escape");
    await p.waitForFunction(() => !document.querySelector("#menu").hidden);
    if (!await p.evaluate(() => Boolean(document.fullscreenElement))) await fullscreen.click();
    await checkFullscreen(true);
    // Also cover a browser/native exit, rather than only the toggle's handler.
    await p.evaluate(() => document.exitFullscreen());
    await checkFullscreen(false);
    console.log("Normal mode: picture and resize");
    await p.locator("#settings summary").click();
    await p.selectOption("#quality", "1440");
    await p.locator("#contact-shadows").uncheck();
    await p.locator("#contact-shadows").check();
    await p.locator("#sudden-scares").check();
    await p.locator("#flashing-lights").check();
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.waitForTimeout(500);
    assert.equal(await p.locator("canvas").evaluate((e) => e.height), 900);
    await p.selectOption("#quality", "1080");
    await p.locator("#settings-close").click();
    await p.click("#start");
    await playing();
    await p.keyboard.press("KeyH");
    await p.waitForTimeout(300);
    assert.ok((await p.locator("#hint").innerText()).length > 0);
    await p.waitForTimeout(150);
    await p.keyboard.press("Escape");
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
    console.log(
      JSON.stringify({
        result: "PASS",
        checks: [
          "normal render loop",
          "no test harness",
          "fullscreen enter/exit, native exit, overlay visibility and canvas sizing",
          "fullscreen refusal leaves menu usable and retry clears the error",
          "pointer capture and journal/pause across fullscreen and windowed play",
          "pointer lock and walking",
          "flashlight render",
          "720/1080/1440 quality and resize",
          "brightness/grain/contact-shadow/scare/flicker controls",
          "asset credits and return to menu",
          "journal pause/resume",
          "Escape and hint",
        ],
        errors,
        failed,
      }),
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
