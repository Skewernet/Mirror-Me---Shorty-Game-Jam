// A character pose must leave bone world matrices current before rendering:
// contact tests and attached props read them in the same simulation update.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.MIRROR_TEST_URL || 'http://127.0.0.1:8000';

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox'] });
  const errors = [], failed = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('requestfailed', request => failed.push(request.url()));
    await page.route('**/__character_matrices__', route => route.fulfill({ contentType: 'text/html',
      body: '<link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>' }));
    await page.goto(base + '/__character_matrices__');
    const report = await page.evaluate(async () => {
      const T = await import('three');
      const { preloadCharacterAssets, createFigure } = await import('/src/figure.mjs');
      const { createFirstPerson } = await import('/src/first-person.mjs');
      await preloadCharacterAssets();
      let poses = 0, matrices = 0, maxError = 0;
      const coherent = (figure, label) => {
        const bones = [...figure.anatomy.joints.values()].map(({ bone }) =>
          [bone, bone.matrixWorld.elements.slice()]);
        figure.body.updateMatrixWorld(true);
        for (const [bone, previous] of bones) for (let i = 0; i < 16; i++) {
          const error = Math.abs(previous[i] - bone.matrixWorld.elements[i]);
          maxError = Math.max(maxError, error);
          if (!Number.isFinite(error) || error > 1e-10)
            throw new Error(label + ': stale world matrix at ' + bone.name + ', component ' + i + ', error ' + error);
        }
        poses++; matrices += bones.length;
      };
      const figure = createFigure(null, 0);
      for (let frame = 0; frame < 120; frame++) {
        const time = frame / 60;
        figure.body.position.set(time * .2, 0, -time * .5);
        figure.body.rotation.y = Math.sin(time);
        figure.animate(time, frame < 30 ? 0 : 1.85, frame > 100,
          { distance: time * 1.1, delta: 1 / 60, yaw: figure.body.rotation.y, vx: .2, vz: -.5 });
        figure.setHorror(Math.floor(frame / 24) * .24, time, { held: frame > 100 });
        figure.head.rotation.set(Math.sin(time) * .2, Math.cos(time) * .3, frame % 3 ? .1 : 0);
        figure.arms[0].rotation.x = frame % 4 ? 0 : -.6;
        coherent(figure, 'normal/held/control');
      }
      for (const mode of ['crawl', 'ceiling', 'twisted', 'crawl']) for (let frame = 0; frame < 40; frame++) {
        figure.setCreaturePose(frame / 60, frame / 40, { mode, intensity: .9, distance: frame * .012 });
        coherent(figure, mode);
      }
      // Palette reuse must retain repaint semantics after an external actor
      // material override; merely remembering the last horror level is unsafe.
      figure.resetPose(); figure.setHorror(.42, 0);
      const skin = figure.body.getObjectByName('Mara_Skin').material;
      const expected = skin.color.clone(); skin.color.set(0);
      figure.setHorror(.42, 0);
      const difference = Math.abs(skin.color.r - expected.r) + Math.abs(skin.color.g - expected.g) +
        Math.abs(skin.color.b - expected.b);
      if (difference > 1e-12)
        throw new Error('Material repaint was lost after an external actor override');
      const scene = new T.Scene(), camera = new T.PerspectiveCamera(65, 1.3, .055, 30);
      camera.layers.enable(2);
      const firstPerson = createFirstPerson(scene, camera);
      const player = { x: 0, z: 0, yaw: 0, pitch: 0, speed: 0, distance: 0, vx: 0, vz: 0 };
      firstPerson.prepare(player);
      for (let frame = 0; frame < 180; frame++) {
        const time = frame / 60;
        player.yaw = Math.sin(time) * .8; player.pitch = Math.sin(time * 1.7) * 1.25;
        player.speed = frame > 30 ? 1.85 : 0; player.z -= player.speed / 60;
        player.distance += player.speed / 60; player.vz = -player.speed;
        camera.position.set(0, 1.64, player.z); camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
        camera.updateMatrixWorld(true);
        if (frame % 50 === 8) firstPerson.interact(new T.Vector3(.23, 1.25, player.z - .4));
        firstPerson.update(1 / 60, player, { flashlightOn: frame % 80 < 40, time,
          clearance: frame % 60 < 30 ? .38 : Infinity });
        coherent(firstPerson.figure, 'first-person/props');
      }
      return { result: 'PASS', poses, matrices, maxError,
        checks: ['bone matrices current before render', 'normal/held aim controls',
          'crawl/ceiling/twisted contact poses', 'material repaint after overrides',
          'first-person gait/pitch/wall/draw/stow/item reach'] };
    });
    assert.deepEqual(errors, []); assert.deepEqual(failed, []);
    console.log(JSON.stringify({ ...report, errors, failed }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
