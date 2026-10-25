// The real loading/menu DOM and native Web Audio, without loading house geometry.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.MIRROR_TEST_URL || 'http://127.0.0.1:8000';
const out = process.env.MIRROR_TEST_OUTPUT || '/tmp/mirror-me-intro';
const brandViewports = [{ width: 1920, height: 1080 }, { width: 1280, height: 720 },
  { width: 800, height: 600 }, { width: 390, height: 844 }];
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
    const introStarted = Date.now();
    const snapshot = () => page.evaluate(() => window.__mirrorIntro.snapshot());
    const checkBrandLayout = async stage => {
      for (const viewport of brandViewports) {
        await page.setViewportSize(viewport);
        const layout = await page.evaluate(() => {
          const intro = document.getElementById('intro'), title = document.getElementById('intro-title');
          const logo = document.getElementById('intro-logo'), style = getComputedStyle(title);
          const card = document.querySelector('.intro-card').getBoundingClientRect();
          const logoRect = logo.getBoundingClientRect();
          const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
          ctx.font = style.font; ctx.letterSpacing = style.letterSpacing;
          const ink = ctx.measureText(title.textContent);
          return { stage: intro.dataset.stage, width: intro.clientWidth, scrollWidth: intro.scrollWidth,
            scrollHeight: intro.scrollHeight, height: intro.clientHeight,
            card: { left: card.left, right: card.right, top: card.top, bottom: card.bottom, width: card.width },
            logo: { width: logoRect.width, height: logoRect.height },
            font: style.fontFamily, inkWidth: ink.actualBoundingBoxLeft + ink.actualBoundingBoxRight,
            inkHeight: ink.actualBoundingBoxAscent + ink.actualBoundingBoxDescent,
            titleHeight: title.getBoundingClientRect().height,
            mainFont: getComputedStyle(document.getElementById('title')).fontFamily,
            bodyFont: getComputedStyle(document.body).fontFamily };
        });
        assert.equal(layout.stage, String(stage), 'Layout checks stay on the displayed card');
        assert.ok(layout.scrollWidth <= layout.width + 1 && layout.scrollHeight <= layout.height + 1,
          'Each splash fits desktop and compact viewports without clipping or scrolling');
        assert.ok(layout.card.left >= 0 && layout.card.right <= viewport.width + 1);
        assert.ok(layout.card.top >= 0 && layout.card.bottom <= viewport.height + 1);
        if (stage === 0) {
          assert.ok(Math.abs(layout.logo.width / layout.logo.height - 1448 / 1086) < .001,
            'Original studio logo retains its aspect ratio');
        } else {
          assert.match(layout.font, /Skewer Blade/);
          assert.ok(layout.inkWidth <= layout.card.width && layout.inkHeight <= layout.titleHeight,
            'The supplied display glyphs fit without losing their tall spurs');
          assert.equal(layout.logo.width, 0, 'Studio art is exclusive to the producer splash');
        }
        assert.doesNotMatch(layout.mainFont + layout.bodyFont, /Skewer Blade/,
          'Splash branding leaves the approved menu and readable interface fonts unchanged');
      }
      await page.setViewportSize({ width: 1280, height: 800 });
    };
    assert.equal((await snapshot()).stage, 0);
    assert.equal(await page.locator('#intro-kicker').innerText(), 'PRODUCED BY');
    assert.equal(await page.locator('#intro-title').innerText(), 'SKEWER GAMES');
    await page.waitForFunction(() => document.getElementById('intro').dataset.brandReady === 'true');
    assert.deepEqual(await page.locator('#intro-logo').evaluate(image => [image.naturalWidth, image.naturalHeight]), [1448, 1086]);
    assert.equal(await page.locator('#intro-logo').getAttribute('alt'), '');
    assert.equal(await page.locator('#intro').getAttribute('aria-labelledby'), 'intro-title');
    await checkBrandLayout(0);
    assert.equal((await snapshot()).audio.context, 'uncreated', 'Audio must not start before a gesture');
    assert.equal(await page.locator('#menu').evaluate(element => element.inert), true);
    // Slow scene preparation must delay cards without skipping the jam credit.
    await page.evaluate(() => {
      const until = performance.now() + 2200;
      while (performance.now() < until) { /* Simulated loading work. */ }
    });
    await page.waitForFunction(() => window.__mirrorIntro.snapshot().stage === 1);
    assert.equal(await page.locator('#intro-title').innerText(), 'SHORTY JAM 2026');
    assert.ok(await page.evaluate(async () => (await document.fonts.load('80px "Skewer Blade"', 'SHORTY JAM 2026')).length > 0),
      'Chromium accepts the supplied local display font');
    await checkBrandLayout(1);
    await page.waitForFunction(() => window.__mirrorIntro.snapshot().stage === 2 && window.__mirrorIntro.snapshot().phase === 'hold');
    assert.ok(Date.now() - introStarted >= 14000, 'Branding cards actually fade and hold instead of jumping straight into the menu');
    assert.equal(await page.locator('#intro-title').innerText(), 'MIRROR ME');
    await checkBrandLayout(2);
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
    assert.equal((await snapshot()).accepting, true, 'Consent fades the title before opening the menu');
    await page.waitForFunction(() => !window.__mirrorIntro.snapshot().visible);
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
    // A skip before the previous card has painted must invalidate both RAFs,
    // not let its delayed callbacks fade/advance the content warning later.
    await privatePage.evaluate(async () => {
      const { initIntro } = await import('/src/intro.mjs');
      for (const id of ['intro-sound', 'intro-silent']) document.getElementById(id).disabled = false;
      const state = { enabled: false, context: 'uncreated', volume: .55 };
      const atmosphere = { snapshot: () => ({...state}), setActive() {}, setVolume() {},
        async setEnabled(enabled) { state.enabled = enabled; }, async dispose() {} };
      window.__mirrorIntro = initIntro({ atmosphere, fadeDuration: 40, holdDuration: 40, blankDuration: 10 });
      document.getElementById('intro-skip').click();
    });
    await privatePage.waitForTimeout(350);
    const skipped = await privatePage.evaluate(() => window.__mirrorIntro.snapshot());
    assert.equal(skipped.stage, 2);
    assert.equal(skipped.phase, 'hold');
    assert.equal(skipped.visible, true);
    await privatePage.evaluate(() => window.__mirrorIntro.dispose());
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
    // A missing logo or webfont must leave a readable producer heading and
    // cannot hold game readiness, skipping, or the content warning hostage.
    for (const missingFont of [false, true]) {
      const fallback = await context.newPage();
      const fallbackErrors = [];
      fallback.on('pageerror', error => fallbackErrors.push(error.message));
      const paths = ['assets/art/skewer-games-logo.png'];
      if (missingFont) paths.push('assets/fonts/SkewerBlade-Regular.woff2');
      for (const path of paths)
        await fallback.route('**/' + path, route => route.fulfill({ status: 404, contentType: 'text/plain', body: '' }));
      await fallback.setViewportSize(brandViewports[0]);
      await fallback.emulateMedia({ reducedMotion: 'reduce' });
      await fallback.goto(base + '/');
      await fallback.waitForFunction(() => window.__mirrorIntro && window.introFixtureReady);
      if (!missingFont) assert.ok(await fallback.evaluate(async () =>
        (await document.fonts.load('80px "Skewer Blade"', 'SHORTY JAM 2026')).length > 0));
      assert.equal((await fallback.evaluate(() => __mirrorIntro.snapshot())).timing.fade, 100);
      assert.equal(await fallback.locator('#intro').getAttribute('data-brand-ready'), 'false');
      assert.ok((await fallback.locator('#intro-title').boundingBox()).width > 1, 'Failed image keeps text fallback visible');
      assert.equal(await fallback.locator('#intro-title').innerText(), 'SKEWER GAMES');
      assert.doesNotMatch(await fallback.locator('#intro-title').evaluate(element => getComputedStyle(element).fontFamily),
        /Skewer Blade/, 'Fallback producer heading avoids the wide logo ligature and tall emblem metrics');
      assert.ok(await fallback.locator('#intro').evaluate(element => element.scrollWidth <= element.clientWidth + 1));
      await fallback.evaluate(() => completeIntroFixture());
      await fallback.waitForFunction(() => __mirrorIntro.snapshot().ready);
      await fallback.click('#intro-skip');
      await fallback.waitForFunction(() => __mirrorIntro.snapshot().stage === 2 && __mirrorIntro.snapshot().phase === 'hold');
      assert.equal(await fallback.locator('#intro-title').innerText(), 'MIRROR ME');
      await fallback.click('#intro-silent');
      await fallback.waitForFunction(() => !__mirrorIntro.snapshot().visible);
      assert.equal(await fallback.locator('#start').isEnabled(), true);
      assert.deepEqual(fallbackErrors, []);
      await fallback.close();
    }
    assert.deepEqual(errors, []); assert.deepEqual(failed, []);
    console.log(JSON.stringify({ result: 'PASS', checks: ['producer and jam splashes under loading stalls', 'MIRROR ME content warning',
      'no audio or device before consent', 'skip and keyboard focus', '12 original-logo and display-font layouts', 'branding failure fallback and reduced motion',
      'responsive warning', 'loading and session acknowledgement',
      'explicit sound and silent choices', 'master volume', 'native capture/menu audio handoff', 'hidden-page suspension',
      'storage refusal', 'context disposal', 'skip invalidates unpainted stage callbacks', 'pending resume reconciles newer capture/mute'], errors, failed }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
