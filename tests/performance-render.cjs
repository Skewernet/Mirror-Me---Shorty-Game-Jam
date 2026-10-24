const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const url = (process.env.MIRROR_TEST_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  const errors = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.route('**/__performance-render__', route => route.fulfill({ contentType: 'text/html',
      body: '<link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>' }));
    await page.goto(url + '/__performance-render__');
    const report = await page.evaluate(async () => {
      const T = await import('three');
      const { warmRenderResources, prepareRenderPrograms, prepareRenderTextures, warmProgramView } = await import('/src/performance.mjs');
      const check = (value, text) => { if (!value) throw new Error(text); };
      const scene = new T.Scene();
      const camera = new T.PerspectiveCamera(65, 1, .055, 20);
      camera.position.set(0, 1.6, 3); camera.lookAt(0, 1, 0);
      const light = new T.SpotLight(0xffffff, 15, 9, .6, .7, 1.7);
      light.position.set(.4, 2, 2); light.target.position.set(0, .4, 0);
      scene.add(light, light.target, new T.HemisphereLight(0xffffff, 0x222222, .3));
      const pixel = new T.DataTexture(new Uint8Array([130, 95, 65, 255]), 1, 1);
      pixel.needsUpdate = true;
      const material = new T.MeshStandardMaterial({ map: pixel, roughness: .7 });
      const floor = new T.Mesh(new T.BoxGeometry(4, .1, 4), material);
      floor.receiveShadow = true; scene.add(floor);
      const object = new T.Mesh(new T.BoxGeometry(.5, 1, .5), material);
      object.position.y = .5; object.castShadow = object.receiveShadow = true; scene.add(object);
      const renderer = new T.WebGLRenderer(); renderer.setSize(128, 128);
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
      renderer.render(scene, camera);
      const baseline = renderer.info.programs.length;
      // Reproduce the old F handler's shader-key change with a real render.
      light.castShadow = true; light.shadow.mapSize.set(64, 64);
      renderer.render(scene, camera);
      const switched = renderer.info.programs.length;
      check(switched > baseline, 'The old castShadow toggle did not reproduce new shader variants');
      const target = new T.WebGLRenderTarget(128, 128);
      renderer.setRenderTarget(target); renderer.setViewport(3, 4, 120, 118);
      renderer.setScissor(4, 5, 118, 116); renderer.setScissorTest(true);
      const beforeRender = JSON.stringify(renderer.info.render);
      const viewport = renderer.getViewport(new T.Vector4()).toArray();
      const scissor = renderer.getScissor(new T.Vector4()).toArray();
      const hidden = new T.Mesh(new T.BoxGeometry(.2, .2, .2), material);
      hidden.position.set(100, 100, 100); hidden.visible = false;
      hidden.frustumCulled = true; scene.add(hidden);
      light.shadow.autoUpdate = false; light.shadow.needsUpdate = true;
      const prepared = warmRenderResources(renderer, scene, camera, { target, objects: [hidden] });
      check(!hidden.visible && hidden.frustumCulled, 'Warmup leaked explicit-body visibility/culling');
      check(renderer.getRenderTarget() === target && renderer.getScissorTest(), 'Warmup leaked target/scissor state');
      check(JSON.stringify(renderer.getViewport(new T.Vector4()).toArray()) === JSON.stringify(viewport), 'Warmup leaked viewport');
      check(JSON.stringify(renderer.getScissor(new T.Vector4()).toArray()) === JSON.stringify(scissor), 'Warmup leaked scissor');
      check(JSON.stringify(renderer.info.render) === beforeRender, 'Warmup leaked frame counters');
      check(prepared.textures >= 1 && prepared.geometries >= 3 && light.shadow.map, 'Warmup failed to allocate geometry/texture/shadow resources');
      renderer.setRenderTarget(null); renderer.setViewport(0, 0, 128, 128); renderer.setScissorTest(false);
      const stablePrograms = renderer.info.programs.length, shadowMap = light.shadow.map;
      // The renderer normally resets after the shadow pass. Include those
      // draw calls here so off-state work is measured rather than inferred.
      renderer.info.autoReset = false;
      const toggles = [];
      for (const intensity of [0, 19, 0, 19, 0]) {
        renderer.info.reset();
        light.intensity = intensity;
        light.shadow.autoUpdate = intensity > 0;
        renderer.render(scene, camera);
        check(renderer.info.programs.length === stablePrograms, 'An intensity-only F toggle created shader variants');
        check(light.shadow.map === shadowMap, 'An F toggle reallocated its shadow target');
        toggles.push({ intensity, calls: renderer.info.render.calls });
      }
      check(toggles[0].calls < toggles[1].calls, 'The switched-off flashlight still renders dynamic shadow geometry');
      const render = renderer.render.bind(renderer);
      renderer.render = () => { throw new Error('intentional warmup failure'); };
      let threw = false;
      try { warmRenderResources(renderer, scene, camera, { target, objects: [hidden] }); } catch { threw = true; }
      check(threw && !hidden.visible && hidden.frustumCulled && renderer.getRenderTarget() === null, 'Warmup failure leaked state');
      renderer.render = render;
      const future = new T.Group(); future.visible = false;
      const futureLight = new T.PointLight(0xffbbaa, 4, 8);
      futureLight.position.set(0, 2, 1);
      futureLight.castShadow = true; futureLight.shadow.mapSize.set(32, 32);
      const futureMaterial = material.clone(); futureMaterial.alphaTest = .15;
      const futureMesh = new T.Mesh(new T.SphereGeometry(.25, 12, 8), futureMaterial);
      futureMesh.castShadow = true;
      futureMesh.position.set(.8, .5, 0);
      future.add(futureLight, futureMesh); scene.add(future);
      const sourceChildren = scene.children.slice(), beforeFuturePrograms = renderer.info.programs.length;
      const pending = prepareRenderPrograms(renderer, scene, camera, { target, include: [future] });
      check(renderer.getRenderTarget() === null && !future.visible && future.parent === scene,
        'Pending future compilation changed the live scene or render target');
      renderer.render(scene, camera); // A real live frame while compilation waits.
      const futurePrepared = await pending;
      const futureTextures = await prepareRenderTextures(renderer, futurePrepared.view);
      let signalGate, releaseGate;
      const reachedGate = new Promise(resolve => { signalGate = resolve; });
      const resumedGate = new Promise(resolve => { releaseGate = resolve; });
      const warmingFuture = warmProgramView(renderer, futurePrepared.view, camera, { target,
        beforeSubmit: () => { signalGate(); return resumedGate; } });
      await reachedGate;
      renderer.render(scene, camera); // Resumed play can postpone the tiny submission.
      check(!future.visible && renderer.getRenderTarget() === null,
        'Waiting for a safe submission changed the live scene');
      const beforeWarmFrame = renderer.info.render.frame;
      releaseGate();
      const futureWarmed = await warmingFuture;
      check(renderer.info.render.frame > beforeWarmFrame,
        'Isolated warmup rewound the frame used by skeleton upload caches');
      check(renderer.getRenderTarget() === null && !future.visible && !futureLight.shadow.map,
        'Tiny isolated warmup leaked the live target, visibility or shadow allocation');
      check(scene.children.every((child, i) => child === sourceChildren[i]) && !future.visible,
        'Compile descriptors reparented or revealed gameplay nodes');
      const preparedFuturePrograms = renderer.info.programs.length;
      future.visible = true;
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      check(renderer.info.programs.length === preparedFuturePrograms,
        'First future-room reveal compiled an unprepared shader variant');
      future.visible = false;
      renderer.setRenderTarget(null);
      target.dispose(); light.shadow.map.dispose(); renderer.dispose();
      return { status: 'PASS', oldShaderPrograms: baseline, afterOldFToggle: switched,
        stablePrograms, prepared, toggles,
        future: { before: beforeFuturePrograms, prepared: preparedFuturePrograms,
          meshes: futurePrepared.meshes, lights: futurePrepared.lights, textures: futureTextures, warmed: futureWarmed },
        checks: ['old F shader-variant reproduction', 'stable shadow/light key',
          'no toggle-time shadow target allocation', 'off-state shadow work skipped', 'GPU resource warmup',
          'render state/error restoration', 'isolated future compile during live rendering',
          'safe submission gate after async linking', 'tiny isolated shadow/buffer warmup',
          'zero-program first future reveal'] };
    });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ ...report, errors }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
