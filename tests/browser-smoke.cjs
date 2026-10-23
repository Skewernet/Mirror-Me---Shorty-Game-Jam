const { chromium } = require("playwright");
const assert = require("node:assert/strict");
require("node:fs").mkdirSync(
  process.env.MIRROR_TEST_OUTPUT || "/tmp/mirror-me-expansion-checks",
  { recursive: true },
);
(async () => {
  const b = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  try {
    const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
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
    p.on("requestfailed", (r) => failed.push(r.url()));
    console.log("Normal mode: loading");
    await p.goto(
      (process.env.MIRROR_TEST_URL || "http://127.0.0.1:8000") + "/",
    );
    await p.waitForFunction(
      () => !document.querySelector("#start").disabled,
      {},
      { timeout: 60000 },
    );
    assert.equal(await p.evaluate(() => typeof window.__mirror), "undefined");
    await p.locator("#settings summary").click();
    await p.selectOption("#quality", "480");
    await p.locator("#brightness").fill("1.3");
    await p.locator("#grain").uncheck();
    await p.locator("#settings summary").click();
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
        (process.env.MIRROR_TEST_OUTPUT || "/tmp/mirror-me-expansion-checks") +
        "/normal-flashlight.png",
      timeout: 60000,
    });
    assert.equal(await p.locator("canvas").evaluate((e) => e.height), 480);
    assert.equal(await p.locator("#hud").evaluate((e) => e.hidden), false);
    console.log("Normal mode: journal");
    await p.keyboard.press("Tab");
    await p.waitForFunction(() => !document.querySelector("#pocket").hidden);
    await p.keyboard.press("Tab");
    await playing();
    await p.waitForTimeout(150);
    await p.keyboard.press("Escape");
    await p.waitForFunction(() => !document.querySelector("#menu").hidden);
    console.log("Normal mode: picture and resize");
    await p.locator("#settings summary").click();
    await p.selectOption("#quality", "900");
    await p.setViewportSize({ width: 1280, height: 800 });
    await p.waitForTimeout(500);
    assert.equal(await p.locator("canvas").evaluate((e) => e.height), 800);
    await p.locator("#settings summary").click();
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
          "pointer lock and walking",
          "flashlight render",
          "480/900 quality and resize",
          "brightness/grain controls",
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
