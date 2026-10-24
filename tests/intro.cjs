// The real loading/menu DOM and native Web Audio, without loading house geometry.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.MIRROR_TEST_URL || 'http://127.0.0.1:8000';
const out = process.env.MIRROR_TEST_OUTPUT || '/tmp/mirror-me-intro';
fs.mkdirSync(out, { recursive: true });

const fixture = `
  import {initSettings} from '/src/settings.mjs';
  const canvas=document.createElement('canvas');
  canvas.width=800; canvas.height=600; document.body.prepend(canvas);
  window.introSettings=initSettings();
  document.querySelector('#start').onclick=()=>canvas.requestPointerLock();
  document.addEventListener('pointerlockchange',()=>{
    document.querySelector('#menu').hidden=!!document.pointerLockElement;
  });
  window.completeIntroFixture=()=>{
    document.querySelector('#start').disabled=false;
    document.querySelector('#start').textContent='ENTER THE HOUSE';
    document.querySelector('#loading-status').textContent='';
  };
  window.introFixtureReady=true;
`;

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox'] });
  const errors = [], failed = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.route('**/src/main.mjs', route => route.fulfill({ contentType: 'text/javascript', body: fixture }));
    const page = await context.newPage();
    const observe = p => {
      p.on('pageerror', error => errors.push(error.message));
      p.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      p.on('requestfailed', request => failed.push(request.url()));
    };
    observe(page);
    await page.goto(base + '/');
    await page.waitForFunction(() => window.__mirrorIntro && window.introFixtureReady);
    const snapshot = () => page.evaluate(() => window.__mirrorIntro.snapshot());
    assert.equal((await snapshot()).stage, 0);
    assert.equal(await page.locator('#intro-kicker').innerText(), 'PRODUCED BY');
    assert.equal(await page.locator('#intro-title').innerText(), 'SKEWER GAMES');
    assert.equal((await snapshot()).audio.context, 'uncreated', 'Audio must not start before a gesture');
    assert.equal(await page.locator('#menu').evaluate(element => element.inert), true);
    // Slow scene preparation must delay cards without skipping the jam credit.
    await page.evaluate(() => {
      const until = performance.now() + 2200;
      while (performance.now() < until) { /* Simulated loading work. */ }
    });
    await page.waitForFunction(() => window.__mirrorIntro.snapshot().stage === 1);
    assert.equal(await page.locator('#intro-title').innerText(), 'SHORTY JAM 2026');
    await page.waitForFunction(() => window.__mirrorIntro.snapshot().stage === 2);
    assert.equal(await page.locator('#intro-title').innerText(), 'MIRROR ME');
    const warning = await page.locator('#intro-warning').innerText();
    for (const term of ['flashing lights', 'gore', 'blood', 'violence']) assert.ok(warning.includes(term));
    assert.equal(await page.locator('#intro-sound').evaluate(element => document.activeElement === element), true);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.locator('#intro-silent').evaluate(element => document.activeElement === element), true);
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('#intro-sound').evaluate(element => document.activeElement === element), true);
    for (const viewport of [{ width: 1280, height: 800 }, { width: 800, height: 600 }, { width: 600, height: 650 }]) {
      await page.setViewportSize(viewport);
      const layout = await page.locator('#intro').evaluate(element => ({ width: element.clientWidth,
        scrollWidth: element.scrollWidth, viewport: innerWidth }));
      assert.ok(layout.scrollWidth <= layout.width + 1 && layout.width === layout.viewport);
      assert.ok(await page.locator('#intro-sound').isVisible());
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({ path: out + '/warning.png' });
    await page.evaluate(() => completeIntroFixture());
    await page.waitForFunction(() => window.__mirrorIntro.snapshot().ready);
    assert.match(await page.locator('#intro-load-status').innerText(), /ready when you are/);
    await page.click('#intro-silent');
    assert.equal(await page.locator('#intro').isVisible(), false);
    assert.equal(await page.locator('#menu').evaluate(element => element.inert), false);
    assert.equal(await page.evaluate(() => sessionStorage.getItem('mirror-me.intro.v1')), 'acknowledged');
    assert.equal((await snapshot()).audio.context, 'uncreated');
    await page.click('#menu-sound');
    await page.waitForFunction(() => window.__mirrorIntro.snapshot().audio.context === 'running' &&
      window.__mirrorIntro.snapshot().audio.enabled);
    assert.equal(await page.locator('#menu-sound').getAttribute('aria-pressed'), 'true');
    await page.locator('#settings summary').click();
    await page.locator('#volume').fill('0');
    await page.waitForFunction(() => window.__mirrorIntro.snapshot().audio.context === 'suspended');
    assert.equal((await snapshot()).audio.volume, 0);
    await page.locator('#volume').fill('0.35');
    await page.waitForFunction(() => window.__mirrorIntro.snapshot().audio.context === 'running');
    assert.equal((await snapshot()).audio.volume, .35);
    await page.click('#settings-close');
    await page.click('#start');
    await page.waitForFunction(() => !!document.pointerLockElement &&
      window.__mirrorIntro.snapshot().audio.context === 'suspended');
    await page.evaluate(() => document.exitPointerLock());
    await page.waitForFunction(() => !document.pointerLockElement &&
      window.__mirrorIntro.snapshot().audio.context === 'running');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForFunction(() => window.__mirrorIntro.snapshot().audio.context === 'suspended');
    await page.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForFunction(() => window.__mirrorIntro.snapshot().audio.context === 'running');
    await page.click('#menu-sound');
    await page.waitForFunction(() => !window.__mirrorIntro.snapshot().audio.enabled &&
      window.__mirrorIntro.snapshot().audio.context === 'suspended');
    await page.reload();
    await page.waitForFunction(() => window.__mirrorIntro && window.introFixtureReady);
    assert.equal((await snapshot()).visible, false, 'Acknowledged warning must not re-block the tab');
    assert.equal((await snapshot()).audio.context, 'uncreated', 'Reload cannot autoplay menu sound');
    const privatePage = await context.newPage(); observe(privatePage);
    await privatePage.addInitScript(() => {
      for (const name of ['localStorage', 'sessionStorage']) Object.defineProperty(window, name, {
        configurable: true, get() { throw new DOMException('Storage unavailable', 'SecurityError'); },
      });
    });
    await privatePage.goto(base + '/');
    await privatePage.waitForFunction(() => window.__mirrorIntro);
    await privatePage.click('#intro-skip');
    await privatePage.click('#intro-sound');
    await privatePage.waitForFunction(() => !window.__mirrorIntro.snapshot().visible &&
      window.__mirrorIntro.snapshot().audio.context === 'running');
    await privatePage.evaluate(() => window.__mirrorIntro.dispose());
    assert.equal(await privatePage.evaluate(() => window.__mirrorIntro.snapshot().audio.context), 'closed');
    assert.equal(await privatePage.locator('#menu').evaluate(element => element.inert), false);
    await page.evaluate(async () => {
      const {MenuAtmosphere} = await import('/src/menu-audio.mjs');
      for (const action of ['capture', 'mute']) {
        let finishResume, suspensions = 0;
        const audio = new MenuAtmosphere();
        const context = {
          state: 'suspended', currentTime: 0,
          resume() { return new Promise(resolve => { finishResume = resolve; }); },
          suspend() { this.state = 'suspended'; suspensions++; return Promise.resolve(); },
          close() { this.state = 'closed'; return Promise.resolve(); },
        };
        audio.context = context;
        audio.master = {gain: {cancelScheduledValues() {}, setTargetAtTime() {}}};
        audio.enabled = true;
        const pending = audio.apply();
        if (action === 'capture') audio.setActive(false);
        else await audio.setEnabled(false);
        context.state = 'running'; finishResume();
        await pending;
        await new Promise(resolve => setTimeout(resolve, 400));
        if (context.state !== 'suspended' || suspensions !== 1)
          throw new Error('Pending menu resume escaped a newer ' + action + ' request');
        await audio.dispose();
      }
    });
    assert.deepEqual(errors, []); assert.deepEqual(failed, []);
    console.log(JSON.stringify({ result: 'PASS', checks: ['producer and jam splashes under loading stalls', 'MIRROR ME content warning',
      'no audio or device before consent', 'skip and keyboard focus', 'responsive warning', 'loading and session acknowledgement',
      'explicit sound and silent choices', 'master volume', 'native capture/menu audio handoff', 'hidden-page suspension',
      'storage refusal', 'context disposal', 'pending resume reconciles newer capture/mute'], errors, failed }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
