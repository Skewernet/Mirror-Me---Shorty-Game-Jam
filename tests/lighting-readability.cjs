// Render the actual failed-fuse arrival and electrical encounter from the same
// views. Matching a relative multiplier alone cannot prove rooms stay readable.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = (process.env.MIRROR_TEST_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  const errors = [], failed = [];
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(120000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('requestfailed', request => failed.push(request.url()));
    await page.route('**/__lighting-readability__', route => route.fulfill({ contentType: 'text/html',
      body: '<link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>' }));
    await page.goto(base + '/__lighting-readability__');
    const report = await page.evaluate(async () => {
      const T = await import('three');
      const { buildHouse } = await import('/src/house.mjs');
      const { Story } = await import('/src/story.mjs');
      const { BLACKOUT_ENVIRONMENT } = await import('/src/crawler-flicker.mjs');
      const check = (value, message) => { if (!value) throw new Error(message); };
      const scene = new T.Scene(); scene.background = new T.Color(0x101417);
      const state = new Story(), house = await buildHouse(scene);
      house.reset(state);
      const renderer = new T.WebGLRenderer(); renderer.setSize(256, 192);
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.13;
      const target = new T.WebGLRenderTarget(256, 192);
      const camera = new T.PerspectiveCamera(65, 4 / 3, .055, 40);
      const views = [
        ['arrival hall', [0, 1.64, 5.6], [0, 1.5, -.9]],
        ['long hall', [1.55, 1.64, 0], [6.45, 1.5, 0]],
        ['bathroom', [2.7, 1.64, 3.5], [2.0, 1.45, 1.3]],
      ];
      const measure = () => {
        renderer.setRenderTarget(target); renderer.render(scene, camera);
        const pixels = new Uint8Array(256 * 192 * 4);
        renderer.readRenderTargetPixels(target, 0, 0, 256, 192, pixels);
        let sum = 0, readable = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          const value = pixels[index] * .2126 + pixels[index + 1] * .7152 + pixels[index + 2] * .0722;
          sum += value; if (value >= 3) readable++;
        }
        return { luminance: sum / (256 * 192), readableFraction: readable / (256 * 192) };
      };
      const results = [];
      for (const [name, position, aim] of views) {
        camera.position.set(...position); camera.lookAt(...aim); camera.updateMatrixWorld(true);
        state.reset(); house.reset(state); house.animate(0, 0, state);
        const arrival = measure();
        state.power = true; house.animate(0, 0, state);
        house.applyHorrorLighting({ lightSource: 'all', lightMultiplier: 0, ...BLACKOUT_ENVIRONMENT });
        const outage = measure();
        const ratio = outage.luminance / arrival.luminance;
        check(arrival.luminance > 1 && arrival.readableFraction > .3, name + ' arrival fixture is not a readable comparison');
        check(ratio >= .90 && ratio <= 1.10, name + ' outage no longer matches failed-fuse arrival: ' + ratio);
        check(outage.readableFraction >= arrival.readableFraction - .03,
          name + ' loses readable room detail during an outage');
        results.push({ name, arrival, outage, ratio });
      }
      state.stage = 6; state.inverted = true; state.power = true;
      house.animate(1, 0, state);
      const invertedSky = house.ambientLight.color.clone(), invertedGround = house.ambientLight.groundColor.clone();
      house.applyHorrorLighting({ lightSource: 'all', lightMultiplier: 0, ...BLACKOUT_ENVIRONMENT });
      check(house.ambientLight.intensity === .025 && house.ambientLight.color.getHex() === BLACKOUT_ENVIRONMENT.skyColor,
        'Inversion changed the surviving arrival ambient level');
      check(house.lights.filter(light => light.userData.powerCircuit === 'window').every(light =>
        light.intensity === light.userData.base * .12), 'Inversion changed the surviving original window fill');
      house.applyHorrorLighting();
      check(house.ambientLight.intensity === .45 && house.ambientLight.color.equals(invertedSky) &&
        house.ambientLight.groundColor.equals(invertedGround), 'Inverted palette did not fully restore');
      renderer.setRenderTarget(null); target.dispose(); renderer.dispose();
      return { status: 'PASS', renderedViews: results, invertedFillAndRestoration: true };
    });
    assert.deepEqual(errors, []); assert.deepEqual(failed, []);
    console.log(JSON.stringify({ ...report, errors, failed }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
