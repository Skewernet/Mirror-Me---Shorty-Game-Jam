// Integrate the prepared flashlight/body with the actual menu, input and HUD.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.MIRROR_TEST_URL || 'http://127.0.0.1:8000';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  const errors = [], failed = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
    page.setDefaultTimeout(180000);
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('requestfailed', r => failed.push(r.url()));
    await page.addInitScript(() => localStorage.setItem('mirror-me.settings.v1', JSON.stringify({
      version: 1, values: { quality: '720', 'auto-quality': false },
    })));
    console.log('Polish: loading prepared game');
    await page.goto(base + '/?test=1');
    await page.waitForFunction(() => !!window.__mirror);
    const snap = () => page.evaluate(() => window.__mirror.snapshot());
    const advance = seconds => page.evaluate(seconds => window.__mirror.advance(seconds), seconds);
    const render = () => page.evaluate(() => window.__mirror.render());
    const start = async () => {
      await page.click('#start');
      await page.waitForFunction(() => document.pointerLockElement && window.__mirror.snapshot().active);
    };
    const pause = async () => {
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.pointerLockElement && !document.querySelector('#menu').hidden);
    };
    assert.equal((await snap()).rendering.warmup.length, 3);
    assert.equal((await snap()).settings.quality, '720');
    assert.equal((await snap()).rendering.adaptive.enabled, false);
    await start();
    await advance(.1);
    await render();
    const baseline = (await snap()).rendering.programs;
    console.log('Polish: first flashlight and stow');
    await page.keyboard.press('KeyF');
    await advance(.5);
    await render();
    const lit = await snap();
    assert.equal(lit.flashlight, true);
    assert.equal(lit.firstPerson.layer, 2);
    assert.ok(lit.firstPerson.flashlightVisible && lit.firstPerson.draw > .99);
    assert.ok(lit.firstPerson.beamPosition.every(Number.isFinite));
    assert.ok(Math.abs(Math.hypot(...lit.firstPerson.beamDirection) - 1) < 1e-6);
    assert.equal(lit.rendering.programs, baseline, 'First F press compiled new shader programs');
    assert.equal(lit.rendering.flashlightShadow, true);
    await page.keyboard.press('KeyF');
    await advance(.5);
    await render();
    const stowed = await snap();
    assert.equal(stowed.firstPerson.flashlightVisible, false);
    assert.equal(stowed.firstPerson.draw, 0);
    assert.equal(stowed.rendering.programs, baseline, 'Stowing changed shader variants');
    assert.equal(stowed.rendering.flashlightShadow, true);
    console.log('Polish: body and settings');
    await page.evaluate(() => window.__mirror.face(0, -1.2));
    await advance(.05);
    await render();
    assert.equal((await snap()).firstPerson.visible, true);
    await pause();
    await page.locator('#settings summary').click();
    await page.locator('#subtitles').uncheck();
    await page.locator('#post-processing').uncheck();
    assert.equal((await snap()).settings.subtitles, false);
    assert.equal((await snap()).rendering.postProcessing, false);
    assert.equal(await page.locator('#subtitle').textContent(), '');
    await page.locator('#subtitles').check();
    await page.locator('#post-processing').check();
    await page.locator('#settings-close').click();
    // A fresh arrival guarantees a live caption while verifying preference
    // changes, without inventing a voice API in the production controller.
    await page.click('#restart');
    await page.waitForFunction(() => !!document.pointerLockElement && window.__mirror.snapshot().active);
    console.log('Polish: live captions after restart');
    await advance(1);
    await page.waitForFunction(() => window.__mirror.snapshot().dialogue.busy &&
      document.querySelector('#subtitle').textContent.length > 0);
    assert.equal(await page.locator('#message').isVisible(), false,
      'A dialogue caption is displayed together with a redundant narrative toast');
    await pause();
    await page.locator('#settings summary').click();
    await page.locator('#subtitles').uncheck();
    assert.equal(await page.locator('#subtitle').textContent(), '');
    await page.locator('#subtitles').check();
    await page.locator('#settings-close').click();
    await start();
    await advance(.02);
    assert.equal((await snap()).active, true);
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
    console.log(JSON.stringify({ result: 'PASS', programs: baseline,
      firstPersonTriangles: lit.firstPerson.triangles,
      checks: ['prepared actual game', 'first F compiles zero programs', 'draw/stow and physical beam',
        'look-down body', 'settings application', 'single caption channel', 'subtitle switch', 'pause/resume'],
      errors, failed }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
