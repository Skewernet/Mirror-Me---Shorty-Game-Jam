const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const url = (process.env.MIRROR_TEST_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  const errors = [];
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(120000);
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/__house-shadows__', route => route.fulfill({ contentType: 'text/html',
      body: '<link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>' }));
    await page.goto(url + '/__house-shadows__');
    const result = await page.evaluate(async () => {
      const T = await import('three');
      const { buildHouse } = await import('/src/house.mjs');
      const { Story } = await import('/src/story.mjs');
      const check = (value, text) => { if (!value) throw new Error(text); };
      const house = await buildHouse(new T.Scene());
      const lights = house.architecture.shadowLights;
      const clear = () => lights.forEach(light => { light.shadow.needsUpdate = false; });
      const player = { x: 0, z: 0 };
      const cases = [];
      for (const id of [...Object.keys(house.roomDoors), 'back', 'front']) {
        const state = new Story(); state.power = true;
        house.reset(state); clear();
        if (id === 'back') state.doorOpen = true;
        else if (id === 'front') state.frontOpen = true;
        else state.doors[id] = true;
        const requests = [0, 0];
        for (let frame = 1; frame <= 240; frame++) {
          house.animate(frame / 120, 1 / 120, state, player);
          for (let light = 0; light < lights.length; light++)
            if (lights[light].shadow.needsUpdate) requests[light]++;
          clear(); // Renderer consumes a dirty shadow after each actual frame.
        }
        check(requests.every(count => count <= 61), 'Door updates exceed the 30 Hz shadow budget: ' + id);
        cases.push({ id, shadowUpdates: requests });
      }
      check(cases.some(item => item.shadowUpdates.some(Boolean)), 'Moving doors never invalidate any visible light cone');
      check(cases.some(item => item.shadowUpdates.filter(Boolean).length === 1), 'Local doors still refresh both unrelated light cones');
      const state = new Story(); state.power = true; house.reset(state); clear();
      const movingActor = [0, 0];
      for (let frame = 1; frame <= 120; frame++) {
        house.animate(frame / 120, 1 / 120, state, player);
        house.invalidateShadows(frame / 120);
        for (let light = 0; light < lights.length; light++) if (lights[light].shadow.needsUpdate) movingActor[light]++;
        clear();
      }
      check(movingActor.every(count => count >= 29 && count <= 31), 'Creature shadow refresh is not bounded to 30 Hz');
      house.reset(state);
      check(lights.every(light => light.shadow.needsUpdate), 'Reset must refresh the initial shadow image');
      return { status: 'PASS', simulationHz: 120, doorSeconds: 2, cases, movingActor,
        checks: ['actual house door cones', '30 Hz refresh ceiling', 'local shadow invalidation', 'actor scheduler', 'reset'] };
    });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ ...result, errors }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
