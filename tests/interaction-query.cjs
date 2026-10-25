// Compare the production query with its former whole-scene implementation on
// the real house, animated props, door leaves and prepared character branches.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.MIRROR_TEST_URL || 'http://127.0.0.1:8000';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox'] });
  const errors = [], failed = [];
  try {
    const page = await browser.newPage(); page.setDefaultTimeout(180000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('requestfailed', request => failed.push(request.url()));
    await page.route('**/__interaction-check__', route => route.fulfill({ contentType: 'text/html',
      body: '<!doctype html><link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>' }));
    await page.goto(base + '/__interaction-check__');
    const result = await page.evaluate(async () => {
      const T = await import('/vendor/three.module.js');
      const { buildHouse } = await import('/src/house.mjs');
      const { preloadCharacterAssets } = await import('/src/figure.mjs');
      const { preloadDemonAssets } = await import('/src/demon.mjs');
      const { preloadEvelynAssets } = await import('/src/evelyn.mjs');
      const { createFirstPerson } = await import('/src/first-person.mjs');
      const { HorrorDirector } = await import('/src/horror.mjs');
      const { Mirror } = await import('/src/mirror.mjs');
      const { Story } = await import('/src/story.mjs');
      const { createInteractionQuery } = await import('/src/interaction-query.mjs');
      const check = (condition, message) => { if (!condition) throw new Error(message); };
      const scene = new T.Scene(), camera = new T.PerspectiveCamera(65, 16 / 9, .055, 65);
      const [house] = await Promise.all([buildHouse(scene), preloadCharacterAssets(), preloadDemonAssets(), preloadEvelynAssets()]);
      await house.wake.prepare(); await house.revelation.prepare();
      new Mirror(scene, house); createFirstPerson(scene, camera); new HorrorDirector(scene, house);
      const query = createInteractionQuery(house.interactables, house.occluders);
      const ray = new T.Raycaster(); ray.far = Math.max(...house.interactables.map(item => item.range));
      const origin = new T.Vector3(), aim = new T.Vector3();
      const visible = object => { for (let p = object; p; p = p.parent) if (!p.visible) return false; return true; };
      const oldQuery = story => {
        scene.updateMatrixWorld(true);
        const items = house.interactables.filter(item => (item.id !== 'note' || !story.hasNote) &&
          (item.id !== 'fuse' || (!story.hasFuse && !story.power)) && visible(item.mesh));
        const hit = ray.intersectObjects([...new Set([...items.map(item => item.mesh), ...house.occluders.filter(visible)])], false)[0] || null;
        if (!hit) return { hit, target: null };
        for (let object = hit.object; object; object = object.parent) if (object.userData.interactionId)
          return { hit, target: items.find(item => item.id === object.userData.interactionId && hit.distance <= item.range) || null };
        return { hit, target: items.find(item => item.mesh === hit.object && hit.distance <= item.range) || null };
      };
      const rays = [
        [[0, 1.64, 6.7], [0, 1.64, 0]], [[0, 1.64, 6.7], [0, 1.4, 7.5]],
        [[0, 1.64, 5.1], [-1.45, .89, 6.75]], [[-2, 1.64, 5.1], [-1.45, .89, 6.75]],
        [[2.4, 1.64, -1.3], [1.22, 1.1, -2.15]], [[1.8, 1.64, 2.5], [2.15, 1.7, 1.015]],
        [[7.4, 1.64, -1.6], [7.4, .76, -2.55]], [[8.1, 1.64, -3.2], [8.64, 1.05, -3.65]],
        [[4.9, 1.64, 0], [5.05, 1.83, .55]], [[8.1, 1.64, 0], [9.08, 1.35, 0]],
        [[-1.4, 1.64, 1.8], [-3.26, 1.48, 1.85]], [[7.4, 1.64, 0], [7.4, 1.3, .64]],
      ];
      const setRay = pair => ray.set(origin.fromArray(pair[0]), aim.fromArray(pair[1]).sub(origin).normalize());
      const compare = (actual, expected, label) => {
        check(actual.target === expected.target, label + ' target differs');
        check(actual.hit?.object === expected.hit?.object, label + ' occluding mesh differs');
        check(Math.abs((actual.hit?.distance ?? 0) - (expected.hit?.distance ?? 0)) < 1e-8, label + ' flashlight clearance differs');
        if (actual.hit) check(actual.hit.point.distanceTo(expected.hit.point) < 1e-8, label + ' interaction point differs');
      };
      let comparisons = 0, usableHits = 0;
      const story = new Story();
      const profiles = [];
      for (const stage of [0, 1, 2, 3, 4, 5, 6]) {
        for (const opened of [false, true]) for (const claimed of [false, true]) {
          Object.assign(story, { stage, inverted: stage === 6, power: claimed, hasFuse: claimed, hasNote: claimed,
            hasKey: true, hasDiary: true, hasTimeClue: true, clockSolved: stage > 2,
            farewellSaid: stage === 6, truthFound: stage === 6, lampOff: stage === 6, phoneLiftUntil: 100 });
          story.doors = { kitchen: opened, utility: opened, bathroom: opened, lounge: opened, bedroom: opened };
          house.reset(story);
          for (const door of Object.values(house.roomDoors)) door.pivot.rotation.y = opened ? door.openAngle : 0;
          house.animate(8 + stage, 1 / 60, story, { x: 0, z: 6.7 });
          for (const pair of rays) {
            setRay(pair);
            // New query goes first, before the baseline can update any dirty
            // door/receiver/frame matrices on its behalf.
            const actual = query.query(ray, story), expected = oldQuery(story);
            compare(actual, expected, `stage${stage}/${opened}/${claimed}`);
            comparisons++; if (actual.target) usableHits++;
          }
        }
        if (stage !== 0 && stage !== 6) continue;
        for (let i = 0; i < 20; i++) { setRay(rays[i % rays.length]); oldQuery(story); query.query(ray, story); }
        const oldMatrix = T.Object3D.prototype.updateMatrixWorld, newMatrix = T.Object3D.prototype.updateWorldMatrix;
        let oldCount = 0, newCount = 0;
        T.Object3D.prototype.updateMatrixWorld = function (force) { oldCount++; return oldMatrix.call(this, force); };
        T.Object3D.prototype.updateWorldMatrix = function (parents, children) { newCount++; return newMatrix.call(this, parents, children); };
        const batches = [];
        for (let batch = 0; batch < 6; batch++) {
          let before = performance.now();
          for (let i = 0; i < 60; i++) { setRay(rays[i % rays.length]); oldQuery(story); }
          const baselineMs = (performance.now() - before) / 60;
          before = performance.now();
          for (let i = 0; i < 60; i++) { setRay(rays[i % rays.length]); query.query(ray, story); }
          batches.push({ baselineMs, queryMs: (performance.now() - before) / 60 });
        }
        T.Object3D.prototype.updateMatrixWorld = oldMatrix; T.Object3D.prototype.updateWorldMatrix = newMatrix;
        profiles.push({ stage, recursiveMatrixVisits: oldCount / 360, selectedMatrixVisits: newCount / 360,
          candidates: query.stats.candidates, topologyNodes: query.stats.nodes, batches });
        check(newCount < oldCount, 'The selected query must avoid recursive character/decor traversal');
      }
      check(usableHits > 20, 'The comparison must exercise real usable targets, not only empty rays');
      check(query.stats.topologyBuilds === 1, 'Ordinary animation must reuse the fixed topology');
      return { comparisons, usableHits, profiles, interactables: house.interactables.length, occluders: house.occluders.length };
    });
    assert.deepEqual(errors, []); assert.deepEqual(failed, []);
    console.log(JSON.stringify({ result: 'PASS', ...result, errors, failed }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
