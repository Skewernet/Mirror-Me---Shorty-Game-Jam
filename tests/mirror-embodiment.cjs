// Actual Mara rigs: pose fidelity, delayed playback, held torch and private
// material reactions through the real planar-reflection renderer.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.MIRROR_TEST_URL || 'http://127.0.0.1:8012';
const out = process.env.MIRROR_TEST_OUTPUT || '/tmp/mirror-embodiment';
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  const errors = [], failed = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
    page.setDefaultTimeout(120000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('requestfailed', request => failed.push(request.url()));
    await page.route('**/__mirror-embodiment__', route => route.fulfill({ contentType: 'text/html',
      body: '<link rel="icon" href="data:,"><style>body{margin:0}</style><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>' }));
    await page.goto(base + '/__mirror-embodiment__');
    const report = await page.evaluate(async () => {
      const T = await import('three');
      const { builders } = await import('/src/builders.mjs');
      const { preloadCharacterAssets, createFigure } = await import('/src/figure.mjs');
      const { createFirstPerson } = await import('/src/first-person.mjs');
      const { Mirror } = await import('/src/mirror.mjs');
      const { MIRROR } = await import('/src/layout.mjs');
      await preloadCharacterAssets();
      const check = (condition, message) => { if (!condition) throw new Error(message); };
      const near = (a, b, epsilon, message) => check(Math.abs(a - b) < epsilon, `${message}: ${a} != ${b}`);
      const scene = new T.Scene(); scene.background = new T.Color(0x17201a);
      const house = builders(scene);
      house.wood = new T.MeshStandardMaterial({ color: 0x514335, roughness: .8 });
      house.brass = new T.MeshStandardMaterial({ color: 0x6e6750, roughness: .4, metalness: .55 });
      const floor = new T.Mesh(new T.PlaneGeometry(14, 8), house.wood);
      floor.rotation.x = -Math.PI / 2; floor.position.x = 5; scene.add(floor);
      scene.add(new T.HemisphereLight(0xe4e8e0, 0x44402e, 1.9));
      const key = new T.DirectionalLight(0xffdec2, 2.0); key.position.set(6, 3, -2); scene.add(key);
      const camera = new T.PerspectiveCamera(65, 1000 / 760, .055, 40);
      camera.layers.enable(2); camera.rotation.order = 'YXZ';
      const clean = createFigure(null, 0);
      const originalGeometry = clean.body.getObjectByName('Mara_Skin').geometry;
      const originalKey = clean.body.getObjectByName('Mara_Skin').material.customProgramCacheKey();
      const mirror = new Mirror(scene, house), fp = createFirstPerson(scene, camera);
      const player = { x: MIRROR.x - 1.2, z: 0, yaw: -Math.PI / 2, pitch: 0,
        distance: 0, speed: 0, vx: 0, vz: 0,
        pose() { return { x: this.x, z: this.z, yaw: this.yaw, pitch: this.pitch,
          distance: this.distance, speed: this.speed, vx: this.vx, vz: this.vz }; } };
      const story = { stage: 0, frozen: false, inverted: false, mirrorReady: false, hasKey: false };
      let previous = 0;
      const step = (time, flashlightOn, looking = true) => {
        camera.position.set(player.x, 1.64, player.z);
        camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ'); camera.updateMatrixWorld(true);
        fp.update(Math.max(0, time - previous), player, { flashlightOn, active: true, time });
        previous = time;
        const capture = fp.capturePose();
        mirror.update(time, player, story, looking, capture);
        return { capture, right: fp.rig.point('hand_r').clone(), left: fp.rig.point('hand_l').clone() };
      };
      let faithfulError = 0;
      for (let frame = 0; frame <= 40; frame++) {
        const time = frame / 60;
        player.pitch = Math.sin(time * 4) * .5;
        if (frame === 15) fp.interact(new T.Vector3(player.x + .4, 1.27, -.21));
        const actual = step(time, time >= .1);
        faithfulError = Math.max(faithfulError,
          actual.right.distanceTo(mirror.figure.anatomy.point('hand_r')),
          actual.left.distanceTo(mirror.figure.anatomy.point('hand_l')));
        near(mirror.snapshot().draw, actual.capture.draw, 1e-7, 'Faithful draw/stow differs');
      }
      check(faithfulError < 1e-5, 'Mirror hand pose does not match actual held/reaching hands');
      mirror.reset(); fp.reset(); previous = 0; story.stage = 1;
      const samples = [];
      for (let frame = 0; frame <= 95; frame++) {
        const time = frame * .02;
        player.yaw = -Math.PI / 2 + Math.sin(time * 1.3) * .17;
        player.pitch = Math.sin(time * 2.7) * .42;
        samples.push(step(time, time >= .1 && time < 1.3));
      }
      const delayed = mirror.snapshot();
      near(delayed.sourceTime, 1.22, 1e-6, 'Delayed torch is not 680ms behind');
      check(delayed.flashlightVisible && !fp.flashlight.visible,
        'Delayed mirror copies the current stowed torch instead of its earlier pose');
      const delayedHandError = samples[61].right.distanceTo(mirror.figure.anatomy.point('hand_r'));
      check(delayedHandError < 1e-5, 'Delayed hand and delayed body use different frame histories');
      const lastShown = mirror.snapshot().sourceTime;
      story.frozen = true;
      step(1.92, false, false);
      const held = mirror.snapshot(), heldHand = mirror.figure.anatomy.point('hand_r');
      let heldGlassClearance = Infinity;
      mirror.flashlight.root.traverse(mesh => {
        if (!mesh.isMesh) return;
        for (let index = 0; index < mesh.geometry.attributes.position.count; index++) {
          const point = mesh.localToWorld(new T.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, index));
          const distance = (point.x - MIRROR.x) * mirror.normal.x + (point.z - MIRROR.z) * mirror.normal.z;
          heldGlassClearance = Math.min(heldGlassClearance, distance);
        }
      });
      check(heldGlassClearance > .05, 'Frozen physical torch crosses the mirror/glass clipping plane');
      near(held.sourceTime, lastShown, 1e-7, 'Freeze captures current player instead of the shown delayed pose');
      const heldTransforms = mirror.embodiment.transforms.slice();
      for (let frame = 1; frame <= 50; frame++) {
        player.x = MIRROR.x - 1.5 - frame * .004;
        player.z = Math.sin(frame * .1) * .3;
        player.yaw += .008; player.pitch = Math.cos(frame * .14) * .7;
        if (frame === 5) fp.interact(new T.Vector3(player.x + .3, 1.2, player.z));
        step(1.92 + frame / 60, frame % 30 < 15, false);
      }
      check(mirror.figure.anatomy.point('hand_r').distanceTo(heldHand) < 1e-5,
        'Held arm follows the player after freeze');
      check(mirror.embodiment.transforms.every((value, index) => value === heldTransforms[index]),
        'Held pose aliases mutable current-player data');
      near(mirror.snapshot().sourceTime, held.sourceTime, 1e-7, 'Held torch history keeps advancing');
      check(mirror.flashlight.root.visible, 'Held flashlight disappears when current player stows');
      story.hasKey = true;
      check(mirror.react(3.0, 2), 'Post-key reaction could not start');
      step(3.052, false, true);
      const twitch = Math.abs(mirror.head.rotation.z);
      check(twitch > .13, 'Post-key reflection has no visible bounded twitch');
      check(!mirror.react(3.1, 3), 'Repeated interaction restarts a twitch every frame');
      step(5, false, true);
      check(!mirror.snapshot().reaction && mirror.snapshot().eyeBleed > .3,
        'Finite reaction does not settle into eye bleeding');
      check(!mirror.react(6, 3, { enabled: false }), 'Sudden-scare preference does not suppress twitch');
      check(clean.body.getObjectByName('Mara_Skin').geometry === originalGeometry &&
        clean.body.getObjectByName('Mara_Skin').material.customProgramCacheKey() === originalKey &&
        !fp.body.getObjectByName('Mara_Skin').material.customProgramCacheKey().includes('mirror-eye'),
        'Mirror blood shader leaked to real Mara or template');
      // Render actual planar optics with the frozen full figure and torch.
      player.x = MIRROR.x - 1.2; player.z = 0; player.yaw = -Math.PI / 2; player.pitch = 0;
      step(5.02, false, true); fp.body.visible = false;
      const renderer = new T.WebGLRenderer({ preserveDrawingBuffer: true, antialias: true });
      renderer.setSize(1000, 760); renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      document.body.append(renderer.domElement);
      await renderer.compileAsync(scene, camera);
      const read = () => {
        const pixels = new Uint8Array(1000 * 760 * 4);
        renderer.render(scene, camera);
        const gl = renderer.getContext(); gl.readPixels(0, 0, 1000, 760, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        check(gl.getError() === gl.NO_ERROR, 'Reflection render produced a GL error');
        return pixels;
      };
      const blood = mirror.eyeBleed.value;
      mirror.eyeBleed.value = 0; const plain = read();
      mirror.eyeBleed.value = blood; const bleeding = read();
      let changed = 0;
      for (let pixel = 0; pixel < plain.length; pixel += 4)
        if (Math.abs(plain[pixel] - bleeding[pixel]) + Math.abs(plain[pixel + 1] - bleeding[pixel + 1]) +
          Math.abs(plain[pixel + 2] - bleeding[pixel + 2]) > 3) changed++;
      check(changed > 10, 'Eye bleeding changes no visible pixels in the actual mirror');
      check(!mirror.surface.camera.layers.isEnabled(2) && mirror.flashlight.root.layers.isEnabled(1),
        'Direct-view body or reflected torch has the wrong reflection layer');
      window.fixture = { renderer, scene, camera, mirror, fp };
      const final = mirror.snapshot();
      mirror.reset();
      check(mirror.snapshot().eyeBleed === 0 && !mirror.snapshot().reaction &&
        !mirror.snapshot().held && !mirror.flashlight.root.visible, 'Reset retains a reaction/torch/bleeding state');
      return { status: 'PASS', faithfulHandError: faithfulError, delayedHandError,
        frozenSourceTime: held.sourceTime, heldGlassClearance, eyeBleedChangedPixels: changed, final,
        checks: ['real faithful torch and reaching-hand pose', '680ms articulated delay', 'freeze captures shown pose',
          'held pose never follows current input', 'finite post-key twitch', 'owned eye bleeding shader',
          'comfort suppression', 'actual planar reflection render', 'reset and character isolation'] };
    });
    // Preserve the rendered reaction, not a reset re-render.
    await page.screenshot({ path: out + '/held-reflection.png' });
    assert.deepEqual(errors, []); assert.deepEqual(failed, []);
    console.log(JSON.stringify({ ...report, errors, failed }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
