// Isolate the real menu DOM/settings module from expensive house rendering.
// The ordinary-mode gameplay smoke verifies the integrated controls separately.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const url = process.env.MIRROR_TEST_URL || "http://127.0.0.1:8000";
const out = process.env.MIRROR_TEST_OUTPUT || "/tmp/mirror-me-settings";
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox"] });
  const errors = [], failed = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    page.on("requestfailed", request => failed.push(request.url()));
    await page.addInitScript(() => {
      if (sessionStorage.getItem("menu-fixture-seeded")) return;
      sessionStorage.setItem("menu-fixture-seeded", "true");
      localStorage.setItem("mirror-me.settings.v1", JSON.stringify({ version: 1, values: {
        quality: "999", volume: "NaN", sensitivity: null, brightness: 99, voice: "false", unexpected: "ignored",
      } }));
    });
    await page.route("**/src/main.mjs", route => route.fulfill({ contentType: "text/javascript", body: `
      import {initSettings, SETTINGS_DEFAULTS} from '/src/settings.mjs';
      const applied={};
      for(const id of Object.keys(SETTINGS_DEFAULTS)){
        const input=document.getElementById(id);
        input[input.type==='range'?'oninput':'onchange']=()=>applied[id]=input.type==='checkbox'?input.checked:input.value;
      }
      document.getElementById('start').disabled=false;
      document.getElementById('start').textContent='ENTER THE HOUSE';
      document.getElementById('fullscreen').disabled=false;
      document.getElementById('loading-status').textContent='';
      window.menuFixture={settings:initSettings(),defaults:SETTINGS_DEFAULTS,applied};
    ` }));
    await page.goto(url + "/");
    await page.waitForFunction(() => window.menuFixture);
    assert.deepEqual(await page.evaluate(() => menuFixture.settings.snapshot()), await page.evaluate(() => menuFixture.defaults));
    assert.equal(await page.locator("#brightness-value").textContent(), "113%");
    assert.equal(await page.locator("#sensitivity-value").textContent(), "1.0×");
    await page.screenshot({ path: out + "/menu.png" });
    await page.locator("#settings summary").click();
    await page.waitForFunction(() => document.querySelector("#menu").dataset.settingsOpen === "true");
    await page.locator("#volume").fill("0.35");
    await page.locator("#brightness").fill("1.25");
    await page.locator("#sensitivity").fill("1.4");
    await page.locator("#quality").selectOption("720");
    for (const id of ["voice", "subtitles", "post-processing", "auto-quality", "flashing-lights"])
      await page.locator("#" + id).uncheck();
    assert.equal(await page.locator("#volume-value").innerText(), "35%");
    assert.equal(await page.locator("#brightness-value").innerText(), "125%");
    assert.equal(await page.locator("#sensitivity-value").innerText(), "1.4×");
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("mirror-me.settings.v1")));
    assert.equal(saved.version, 1);
    assert.equal(saved.values.subtitles, false);
    assert.equal(saved.values.quality, "720");
    assert.equal(Object.hasOwn(saved.values, "unexpected"), false);
    await page.reload();
    await page.waitForFunction(() => window.menuFixture);
    const restored = await page.evaluate(() => ({ values: menuFixture.settings.snapshot(), applied: menuFixture.applied }));
    assert.deepEqual(restored.values, saved.values);
    assert.equal(restored.applied.volume, "0.35");
    assert.equal(restored.applied.subtitles, false);
    assert.equal(restored.applied["auto-quality"], false);
    await page.locator("#settings summary").click();
    await page.locator("#settings-reset").click();
    assert.deepEqual(await page.evaluate(() => menuFixture.settings.snapshot()), await page.evaluate(() => menuFixture.defaults));
    assert.match(await page.locator("#settings-status").innerText(), /Default settings restored/);
    await page.locator("#settings-panel").evaluate(element => element.scrollTop = 0);
    await page.screenshot({ path: out + "/settings.png" });
    for (const viewport of [{ width: 1280, height: 800 }, { width: 800, height: 600 }, { width: 600, height: 650 }]) {
      await page.setViewportSize(viewport);
      const bounds = await page.locator("#settings-panel").evaluate(element => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: innerWidth, height: innerHeight, overflow: element.scrollWidth - element.clientWidth };
      });
      assert.ok(bounds.left >= 0 && bounds.top >= 0 && bounds.right <= bounds.width && bounds.bottom <= bounds.height);
      assert.ok(bounds.overflow <= 1, "Settings content overflows horizontally");
    }
    await page.locator("#settings-close").click();
    assert.equal(await page.locator("#settings").evaluate(element => element.open), false);
    assert.equal(await page.locator("#settings summary").evaluate(element => document.activeElement === element), true);
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector("#settings").open);
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#settings").evaluate(element => element.open), false);
    await page.evaluate(async () => {
      menuFixture.settings.dispose();
      const {initSettings}=await import('/src/settings.mjs');
      menuFixture.settings=initSettings({storage:{getItem(){throw new Error('Blocked')},setItem(){throw new Error('Blocked')}}});
    });
    await page.locator("#settings summary").click();
    await page.locator("#volume").fill("0.4");
    assert.match(await page.locator("#settings-status").innerText(), /this session/);
    assert.equal(await page.evaluate(() => menuFixture.settings.snapshot().volume), .4);
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
    console.log(JSON.stringify({ status: "PASS", checks: ["invalid preferences use defaults", "range readouts and applied events", "versioned persistence and reload", "restore defaults", "Done/Escape keyboard focus", "three responsive settings layouts", "blocked storage keeps controls usable"], errors, failed }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
