// Real menu DOM and image decoding, without loading a second 3D scene.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.MIRROR_TEST_URL || 'http://127.0.0.1:8000';
const out = process.env.MIRROR_TEST_OUTPUT || '/tmp/mirror-menu-reflection';
fs.mkdirSync(out, { recursive: true });
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="48"><rect width="32" height="48" fill="#25372d"/><ellipse cx="16" cy="18" rx="9" ry="13" fill="#d3b69b"/></svg>';

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  const errors = [], checks = [];
  try {
    const setup = async ({ saved, storageFailure = false, readFailure = false, failImage = false, late = false } = {}) => {
      const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(saved => {
        sessionStorage.setItem('mirror-me.intro.v1', 'acknowledged');
        if (saved) localStorage.setItem('mirror-me.settings.v1', JSON.stringify({ version: 1, values: saved }));
      }, saved);
      await page.route('**/src/main.mjs', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
      await page.route('**/assets/art/menu-mara-*.webp', route =>
        failImage && route.request().url().includes('-distorted.') ? route.abort('failed') :
          route.fulfill({ contentType: 'image/svg+xml', body: svg }));
      await page.goto(base + '/');
      await page.evaluate(async options => {
        const module = await import('/src/menu-mirror.mjs');
        module.menuMirror?.dispose();
        const menu = document.getElementById('menu');
        menu.dataset.settingsReady = options.late ? 'true' : 'false';
        document.getElementById('settings').open = false;
        document.getElementById('start').disabled = false;
        document.getElementById('start').textContent = 'ENTER THE HOUSE';
        document.getElementById('loading-status').textContent = '';
        if (options.late) {
          document.getElementById('flashing-lights').checked = true;
          document.getElementById('sudden-scares').checked = true;
        }
        let time = 0, nextId = 0;
        const tasks = new Map();
        const clock = {
          now: () => time,
          setTimeout(callback, delay) { const id = ++nextId; tasks.set(id, { at: time + delay, callback }); return id; },
          clearTimeout(id) { tasks.delete(id); },
        };
        window.stepMirror = milliseconds => {
          time += milliseconds;
          let guard = 0;
          while ([...tasks.values()].some(task => task.at <= time)) {
            if (++guard > 20) throw Error('Timer backlog was replayed');
            const [id, task] = [...tasks].find(([, task]) => task.at <= time);
            tasks.delete(id); task.callback();
          }
        };
        window.mirrorTasks = () => tasks.size;
        window.initTestMirror = module.initMenuMirror;
        const stored = JSON.stringify({ version: 1, values: options.saved || {} });
        window.failedMirrorStorage = {
          getItem() { if (options.readFailure) throw new Error('Storage refused'); return stored; },
          setItem() { throw new Error('Storage full'); },
        };
        window.testMirror = module.initMenuMirror({ clock,
          ...(options.storageFailure ? { storage: window.failedMirrorStorage } : {}) });
        window.dispatchEvent(new Event('focus'));
      }, { saved, storageFailure, readFailure, late });
      await page.waitForFunction(() => window.testMirror.snapshot().assets !== 'pending');
      return page;
    };
    const snap = page => page.evaluate(() => window.testMirror.snapshot());
    const active = page => page.waitForFunction(() => window.testMirror.snapshot().active);
    const stopped = page => page.waitForFunction(() => !window.testMirror.snapshot().active &&
      !window.testMirror.snapshot().timerPending && window.testMirror.snapshot().state === 'normal');

    const page = await setup({ late: true });
    await active(page);
    assert.equal(await page.evaluate(() => mirrorTasks()), 1);
    await page.evaluate(() => stepMirror(4400));
    assert.equal((await snap(page)).state, 'distorted');
    // CSS resolves a reveal even if JavaScript is occupied with graphics work.
    await page.waitForTimeout(220);
    assert.equal(await page.locator('.menu-reflection-distorted').evaluate(element => Number(getComputedStyle(element).opacity)), 0);
    assert.equal(await page.locator('.menu-reflection-normal').evaluate(element => Number(getComputedStyle(element).opacity)), 1);
    await page.evaluate(() => stepMirror(10000));
    assert.equal((await snap(page)).state, 'normal', 'A late task replayed past glimpses');
    assert.equal(await page.evaluate(() => mirrorTasks()), 1);
    checks.push('one leased timer; sparse current-time reveals; finite CSS recovery and no replay');

    const suspend = async (stop, resume) => {
      await page.evaluate(stop); await stopped(page);
      await page.evaluate(() => stepMirror(60000));
      assert.equal((await snap(page)).state, 'normal');
      await page.evaluate(resume); await active(page);
      assert.equal((await snap(page)).elapsed, 0);
      assert.equal((await snap(page)).state, 'normal');
    };
    await suspend(() => { document.getElementById('menu').hidden = true; }, () => { document.getElementById('menu').hidden = false; });
    await suspend(() => { document.getElementById('menu').inert = true; }, () => { document.getElementById('menu').inert = false; });
    await suspend(() => { document.getElementById('intro').hidden = false; }, () => { document.getElementById('intro').hidden = true; });
    await suspend(() => { document.getElementById('settings').open = true; }, () => { document.getElementById('settings').open = false; });
    await suspend(() => window.dispatchEvent(new Event('blur')), () => window.dispatchEvent(new Event('focus')));
    await suspend(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); },
      () => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    await suspend(() => { Object.defineProperty(document, 'pointerLockElement', { configurable: true, value: document.body }); document.dispatchEvent(new Event('pointerlockchange')); },
      () => { delete document.pointerLockElement; document.dispatchEvent(new Event('pointerlockchange')); });
    await page.setViewportSize({ width: 700, height: 600 }); await stopped(page);
    await page.setViewportSize({ width: 960, height: 600 }); await active(page);
    await suspend(() => { document.getElementById('ending-credits').hidden = false; }, () => { document.getElementById('ending-credits').hidden = true; });
    await page.setViewportSize({ width: 1920, height: 1080 }); await active(page);
    await page.emulateMedia({ reducedMotion: 'reduce' }); await stopped(page);
    await page.emulateMedia({ reducedMotion: 'no-preference' }); await active(page);
    checks.push('intro/menu/playing/settings/layout/focus/visibility/reduced-motion suspension with fresh calm re-entry');

    // A glimpse must repaint the mirror alone, never blink the surrounding UI.
    await page.evaluate(async () => { await document.fonts.ready; });
    const normal = await page.screenshot({ path: out + '/normal.png' });
    await page.evaluate(() => { stepMirror(4400); document.getElementById('menu-mirror').style.setProperty('--mirror-glimpse-ms', '2000ms'); });
    await page.waitForTimeout(30);
    const distorted = await page.screenshot({ path: out + '/glimpse.png' });
    const regions = await page.evaluate(async ({ normal, distorted }) => {
      const pixels = async encoded => {
        const image = new Image(); image.src = 'data:image/png;base64,' + encoded; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const context = canvas.getContext('2d'); context.drawImage(image, 0, 0); return context.getImageData(0, 0, canvas.width, canvas.height);
      };
      const before = await pixels(normal), after = await pixels(distorted), results = [];
      for (const selector of ['#title', '#start', '.wordmark', '.quick-controls', '.content-note']) {
        const element = document.querySelector(selector), bounds = element.getBoundingClientRect();
        const x0 = Math.max(0, Math.ceil(bounds.x)), y0 = Math.max(0, Math.ceil(bounds.y));
        let brightBefore = 0, brightAfter = 0, differences = 0;
        for (let y = y0; y < Math.min(before.height, Math.floor(bounds.bottom)); y++)
          for (let x = x0; x < Math.min(before.width, Math.floor(bounds.right)); x++) {
            const index = (y * before.width + x) * 4;
            if (before.data[index] > 115 && before.data[index + 1] > 95 && before.data[index + 2] > 85) brightBefore++;
            if (after.data[index] > 115 && after.data[index + 1] > 95 && after.data[index + 2] > 85) brightAfter++;
            if ([0, 1, 2].some(channel => before.data[index + channel] !== after.data[index + channel])) differences++;
          }
        results.push({ selector, brightBefore, brightAfter, differences, visible: getComputedStyle(element).visibility });
      }
      return results;
    }, { normal: normal.toString('base64'), distorted: distorted.toString('base64') });
    for (const region of regions) {
      assert.ok(region.brightBefore > 40 && region.brightAfter >= region.brightBefore * .97, JSON.stringify(region));
      assert.equal(region.differences, 0, 'A reflection glimpse repainted surrounding menu pixels: ' + region.selector);
    }
    checks.push('actual-controller glimpse leaves title/buttons/header/footer pixels unchanged');
    await page.close();

    const saved = { 'flashing-lights': false, 'sudden-scares': false, quality: '1440', volume: .35 };
    const savedPage = await setup({ saved });
    await stopped(savedPage);
    assert.equal((await snap(savedPage)).reason, 'comfort');
    assert.equal(await savedPage.locator('#flashing-lights').isChecked(), false);
    assert.equal(await savedPage.locator('#sudden-scares').isChecked(), false);
    await savedPage.evaluate(() => stepMirror(45000));
    assert.equal(await savedPage.evaluate(() => mirrorTasks()), 0);
    await savedPage.close();
    const latePage = await setup({ saved, late: true }); await active(latePage); await latePage.close();
    checks.push('saved comfort applies during asset loading; late initialization preserves current session controls');

    for (const options of [{ storageFailure: false }, { storageFailure: true }, { storageFailure: true, readFailure: true }]) {
      const early = await setup({ saved: { quality: '1440', volume: .35 }, ...options });
      await active(early);
      await early.locator('#settings summary').click();
      await early.locator('#flashing-lights').uncheck();
      await stopped(early);
      assert.ok((await snap(early)).pendingChoices > 0);
      if (!options.storageFailure) {
        const stored = await early.evaluate(() => JSON.parse(localStorage.getItem('mirror-me.settings.v1')).values);
        assert.equal(stored['flashing-lights'], false); assert.equal(stored.quality, '1440'); assert.equal(stored.volume, .35);
      }
      const restored = await early.evaluate(async failure => {
        const { initSettings } = await import('/src/settings.mjs');
        const observed = [];
        document.getElementById('flashing-lights').onchange = event => observed.push(event.currentTarget.checked);
        window.delayedSettings = initSettings(failure ? { storage: window.failedMirrorStorage } : {});
        document.getElementById('menu').dataset.settingsReady = 'true';
        return { checked: document.getElementById('flashing-lights').checked, observed };
      }, options.storageFailure);
      assert.equal(restored.checked, false); assert.deepEqual(restored.observed, [false]);
      await early.evaluate(() => window.delayedSettings.reset());
      assert.equal(await early.locator('#flashing-lights').isChecked(), true, 'Initial handoff prevented a later explicit defaults restore');
      await early.locator('#settings-close').click(); await active(early);
      await early.close();
    }
    checks.push('trusted early comfort edits survive delayed main restore and read/write storage refusal; later defaults still work');

    const failed = await setup({ failImage: true, late: true });
    assert.equal((await snap(failed)).assets, 'fallback'); await stopped(failed);
    assert.equal(await failed.locator('#start').isEnabled(), true);
    await failed.close();
    const disposed = await setup({ late: true });
    const lateDecode = await disposed.evaluate(async () => {
      window.testMirror.dispose();
      const image = document.querySelector('.menu-reflection-distorted');
      let finish;
      image.decode = () => new Promise(resolve => { finish = resolve; });
      const controller = initTestMirror();
      await Promise.resolve(); await Promise.resolve();
      controller.dispose();
      const before = document.getElementById('menu-mirror').outerHTML;
      finish(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
      window.dispatchEvent(new Event('focus'));
      return { same: before === document.getElementById('menu-mirror').outerHTML, snapshot: controller.snapshot() };
    });
    assert.equal(lateDecode.same, true); assert.equal(lateDecode.snapshot.timerPending, false);
    await disposed.close();
    checks.push('portrait failure leaves a static usable menu; disposed pending decode cannot reactivate or mutate');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ result: 'PASS', checks, pixelRegions: regions, errors, output: out }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
