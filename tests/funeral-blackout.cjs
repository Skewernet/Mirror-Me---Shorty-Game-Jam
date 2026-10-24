// The actual parlor light/material pipeline, with finite simulation-clock
// outages. Small WebGL samples prove that indirect light cannot wash them out.
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
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('requestfailed', r => failed.push(r.url()));
    await page.route('**/__funeral-blackout__', route => route.fulfill({ contentType: 'text/html',
      body: '<link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>' }));
    await page.goto(base + '/__funeral-blackout__');
    const report = await page.evaluate(async () => {
      const T = await import('three');
      const { buildHouse } = await import('/src/house.mjs');
      const { Story } = await import('/src/story.mjs');
      const { preloadCharacterAssets } = await import('/src/figure.mjs');
      const { preloadEvelynAssets } = await import('/src/evelyn.mjs');
      const { BLACKOUT_ENVIRONMENT, FUNERAL_BLACKOUT } = await import('/src/crawler-flicker.mjs');
      const check = (value, message) => { if (!value) throw new Error(message); };
      await Promise.all([preloadCharacterAssets(), preloadEvelynAssets()]);
      const scene = new T.Scene(); scene.background = new T.Color(0x101417);
      const house = await buildHouse(scene), wake = house.wake, state = new Story();
      state.stage = 6; state.power = state.inverted = state.frontOpen = state.wakeEntered = true;
      const player = { x: 0, z: 10.2, yaw: Math.PI, pitch: 0 };
      house.reset(state); wake.begin(10, player); house.animate(10, 0, state, player);
      const baseLights = new Map(wake.lights.map(light => [light, light.intensity]));
      const baseVisible = wake.lights.map(light => light.visible);
      const ambient = house.ambientLight.intensity;
      const ambientSky = house.ambientLight.color.clone(), ambientGround = house.ambientLight.groundColor.clone();
      const env = house.materials.wood.envMapIntensity;
      const emissions = new Map();
      wake.group.traverse(object => {
        for (const material of Array.isArray(object.material) ? object.material : [object.material])
          if (material?.userData.wakeElectricalFixture)
            emissions.set(material, { color: material.color.clone(), emissive: material.emissiveIntensity });
      });
      check(emissions.size >= 5, 'Actual pendant/window/radio fixture registration is incomplete');
      const restored = () => {
        for (const [light, value] of baseLights) check(light.intensity === value, 'Parlor practical failed to restore');
        for (const [material, value] of emissions)
          check(material.color.equals(value.color) && material.emissiveIntensity === value.emissive,
            'Parlor fixture/window emission failed to restore');
        check(house.ambientLight.intensity === ambient && house.materials.wood.envMapIntensity === env,
          'Parlor indirect light failed to restore');
        check(house.ambientLight.color.equals(ambientSky) && house.ambientLight.groundColor.equals(ambientGround),
          'Parlor ambient palette failed to restore');
      };
      const camera = new T.PerspectiveCamera(65, 4 / 3, .055, 40);
      camera.position.set(0, 1.64, 10.2); camera.lookAt(0, 1.2, 15.65); camera.updateMatrixWorld(true);
      const renderer = new T.WebGLRenderer(); renderer.setSize(256, 192);
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.13;
      const target = new T.WebGLRenderTarget(256, 192);
      renderer.setRenderTarget(target);
      await renderer.compileAsync(scene, camera);
      const measure = () => {
        renderer.render(scene, camera);
        const pixels = new Uint8Array(256 * 192 * 4);
        renderer.readRenderTargetPixels(target, 0, 0, 256, 192, pixels);
        let sum = 0;
        for (let index = 0; index < pixels.length; index += 4)
          sum += pixels[index] * .2126 + pixels[index + 1] * .7152 + pixels[index + 2] * .0722;
        return sum / (256 * 192);
      };
      const lit = measure(), programs = renderer.info.programs.length;
      check(wake.beginBlackout(20), 'Parlor blackout did not begin');
      check(!wake.beginBlackout(20), 'Report callback can start a second blackout');
      house.animate(20.2, .2, state, player);
      const dark = measure();
      check(dark < lit * .80 && dark > 1, 'Parlor outage must interrupt practicals while preserving room silhouettes: ' + dark / lit);
      check(renderer.info.programs.length === programs, 'Outage compiled new shader programs');
      check(wake.lights.every((light, index) => light.intensity === 0 && light.visible === baseVisible[index]),
        'Parlor practicals stayed lit or changed shader light counts');
      check(house.ambientLight.intensity === BLACKOUT_ENVIRONMENT.ambientIntensity &&
        house.materials.wood.envMapIntensity === env * BLACKOUT_ENVIRONMENT.environmentMultiplier,
        'Parlor did not keep readable failed-fuse ambient/environment fill');
      for (const [material] of emissions) {
        if (material.isMeshBasicMaterial) check(material.color.getHex() === 0, 'Self-lit pendant stayed visible');
        if (material.emissiveIntensity !== undefined) check(material.emissiveIntensity === 0, 'Window/radio emission stayed bright');
      }
      const events = wake.drainEvents(), paused = JSON.stringify(wake.snapshot().blackout);
      for (let index = 0; index < 12; index++) house.animate(20.2, 0, state, player);
      check(JSON.stringify(wake.snapshot().blackout) === paused && wake.drainEvents().length === 0,
        'Paused parlor replayed clacks or advanced its power failure');
      for (let frame = 13; frame <= Math.ceil((FUNERAL_BLACKOUT.duration + .25) * 60); frame++) {
        house.animate(20 + frame / 60, 1 / 60, state, player);
        events.push(...wake.drainEvents());
      }
      restored();
      const restoredLuminance = measure();
      check(Math.abs(restoredLuminance - lit) < 1, 'Parlor illumination accumulated darkness after restoration');
      check(events.filter(event => event.edge === 'off').length === FUNERAL_BLACKOUT.windows.length &&
        events.filter(event => event.edge === 'on').length === FUNERAL_BLACKOUT.windows.length,
        'Parlor did not emit exactly one mechanical bank for every actual off/on edge');
      check(!wake.snapshot().blackout.active,
        'Electrical sequence fails to restore after its finite accusation prelude');

      wake.reset(); wake.begin(30, player); wake.beginBlackout(30);
      house.animate(30.2, .2, state, player); wake.drainEvents();
      wake.setBlackoutEnabled(false); house.animate(30.2, 0, state, player);
      restored(); check(wake.drainEvents().length === 0, 'Comfort toggle retained relay sounds');
      wake.setBlackoutEnabled(true); house.animate(30 + FUNERAL_BLACKOUT.duration + 1, 0, state, player);
      restored(); check(wake.drainEvents().length === 0, 'Re-enabling later replayed a missed blackout');

      wake.reset(); wake.begin(40, player); wake.beginBlackout(40, { flashes: false });
      for (const age of [.2, .9, 1.7, 2.6]) {
        house.animate(40 + age, .1, state, player); restored();
        check(wake.drainEvents().length === 0, 'Reduced-flashing mode played an electrical scare');
      }
      wake.reset(); wake.begin(50, player); wake.beginBlackout(50);
      house.animate(50.2, .2, state, player);
      wake.beginAttack(50.2, player, { enabled: false });
      house.animate(50.2, 0, state, player); restored();
      check(wake.drainEvents().length === 0, 'Attack began with stale electrical clacks');
      state.reset(); house.reset(state);
      check(wake.snapshot().blackout.startedAt === null && wake.drainEvents().length === 0,
        'Restart retained the previous funeral blackout');
      check(house.materials.wood.envMapIntensity === env, 'Restart retained darkened environment materials');
      renderer.setRenderTarget(null); target.dispose(); renderer.dispose();
      return { status: 'PASS', litLuminance: lit, darkLuminance: dark,
        darkFraction: dark / lit, programs, shaderProgramsAddedByBlackout: 0,
        practicalLights: baseLights.size, emissiveMaterials: emissions.size, relayEvents: events.length,
        checks: ['readable parlor outage', 'stable shader light count', 'shared failed-fuse indirect fill',
          'finite off/on relay edges', 'pause', 'comfort off and no late replay',
          'full restoration before accusation/attack', 'attack cancellation', 'restart'] };
    });
    assert.deepEqual(errors, []); assert.deepEqual(failed, []);
    console.log(JSON.stringify({ ...report, errors, failed }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
