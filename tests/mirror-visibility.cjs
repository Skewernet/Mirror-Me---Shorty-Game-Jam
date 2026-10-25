// Skip only a mirror wholly covered by one actual convex opaque wall. Partial
// glass, doorway gaps and changing wall transforms retain the live reflection.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.MIRROR_TEST_URL || 'http://127.0.0.1:8000';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  const errors = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.route('**/__mirror-visibility__', route => route.fulfill({ contentType: 'text/html',
      body: '<link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>' }));
    await page.goto(base + '/__mirror-visibility__');
    const report = await page.evaluate(async () => {
      const T = await import('three');
      const { Reflector } = await import('/vendor/Reflector.js');
      const { singleBounce } = await import('/src/reflection.mjs');
      const { ReflectionVisibility } = await import('/src/reflection-visibility.mjs');
      const check = (condition, message) => { if (!condition) throw Error(message); };
      const scene = new T.Scene(); scene.background = new T.Color(0x28472b);
      const camera = new T.PerspectiveCamera(65, 1, .055, 30);
      camera.position.set(0, 0, 3); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
      const mirror = singleBounce(new Reflector(new T.PlaneGeometry(2, 2), {
        textureWidth: 64, textureHeight: 64, multisample: 0,
      }));
      scene.add(mirror);
      const parent = new T.Group(); scene.add(parent);
      const wall = new T.Mesh(new T.BoxGeometry(3, 3, .1), new T.MeshBasicMaterial({ color: 0x1e3077 }));
      wall.position.z = 1.5; wall.userData.architecture = 'wall'; parent.add(wall);
      const red = new T.Mesh(new T.BoxGeometry(.7, .7, .1), new T.MeshBasicMaterial({ color: 0xff1122 }));
      red.position.set(.65, .2, 4); scene.add(red);
      const visibility = new ReflectionVisibility(mirror, [wall]);
      const original = mirror.onBeforeRender;
      let enabled = false, reflectionPasses = 0;
      mirror.onBeforeRender = function (renderer, world, view, ...args) {
        if (view.userData.reflectionView || (enabled && visibility.isOccluded(view))) return;
        return original.call(this, renderer, world, view, ...args);
      };
      const renderer = new T.WebGLRenderer(); renderer.setSize(64, 64);
      const target = new T.WebGLRenderTarget(64, 64), pixels = new Uint8Array(64 * 64 * 4);
      renderer.setRenderTarget(target);
      const render = renderer.render.bind(renderer);
      renderer.render = (world, view) => {
        if (view === mirror.camera) reflectionPasses++;
        return render(world, view);
      };
      const capture = optimized => {
        enabled = optimized; reflectionPasses = 0;
        renderer.render(scene, camera);
        renderer.readRenderTargetPixels(target, 0, 0, 64, 64, pixels);
        return { passes: reflectionPasses, pixels: pixels.slice() };
      };
      const rows = [];
      const compare = (name, expected) => {
        const source = JSON.stringify([camera.position.toArray(), camera.quaternion.toArray(), camera.projectionMatrix.toArray(), camera.layers.mask]);
        const before = capture(false), after = capture(true);
        check(source === JSON.stringify([camera.position.toArray(), camera.quaternion.toArray(), camera.projectionMatrix.toArray(), camera.layers.mask]),
          name + ': source camera changed');
        check(after.passes === expected, name + ': unexpected secondary world-pass count');
        check(before.passes === 1, name + ': baseline did not draw its reflection');
        check(before.pixels.every((value, i) => value === after.pixels[i]), name + ': visible pixels changed');
        rows.push({ name, before: before.passes, after: after.passes, pixelChanges: 0 });
      };
      compare('fully blocked wall', 0);
      wall.scale.x = .27; wall.position.x = -.1;
      compare('partly visible glass', 1);
      wall.scale.x = .337; wall.position.x = -.025;
      compare('narrow visible edge', 1);
      wall.scale.set(1, 1, 1); wall.position.x = 0;
      parent.visible = false; compare('hidden wall parent', 1); parent.visible = true;
      wall.material.transparent = true; wall.material.opacity = .5;
      compare('transparent wall', 1); wall.material.opacity = 1;
      const alpha = new T.DataTexture(new Uint8Array([255, 255, 255, 0]), 1, 1); alpha.needsUpdate = true;
      wall.material.map = alpha; wall.material.needsUpdate = true;
      compare('opacity-one transparent wall with alpha hole', 1);
      wall.material.transparent = false; wall.material.map = null; wall.material.needsUpdate = true; alpha.dispose();
      wall.material.depthWrite = false; compare('non-depth-writing wall', 1); wall.material.depthWrite = true;
      wall.layers.set(3); compare('wall on an excluded camera layer', 1); wall.layers.set(0);
      wall.position.x = 5; compare('wall moved after cached transform', 1); wall.position.x = 0;
      wall.rotation.y = .23; compare('rotated convex blocker', 0); wall.rotation.y = 0;
      wall.position.z = -1; compare('wall behind the glass', 1);
      wall.position.z = 2.99; wall.scale.z = .1; compare('wall wholly before camera near plane', 1);
      wall.scale.z = 1; wall.position.z = 1.5;
      camera.position.z = 1.5; camera.updateMatrixWorld(true);
      check(!visibility.isOccluded(camera), 'Camera inside a blocker must stay conservative');
      const orthographic = new T.OrthographicCamera(-1, 1, 1, -1, .1, 10);
      orthographic.position.z = 3; orthographic.updateMatrixWorld(true);
      check(!visibility.isOccluded(orthographic), 'Parallel rays cannot use a perspective occlusion cone');
      renderer.setRenderTarget(null); target.dispose(); mirror.dispose(); renderer.dispose();
      return { rows, checks: ['same-wall convex occlusion', 'live partial and narrow-edge views',
        'source camera unaffected', 'hidden/transparent/alpha-hole/moved/rotated walls', 'depth/layer exclusions', 'wall behind mirror and near-plane fallback',
        'inside-wall and orthographic fallback', 'byte-identical visible pixels'] };
    });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ result: 'PASS', ...report, errors }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
