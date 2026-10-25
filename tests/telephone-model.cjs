// Actual room/model checks: connected lifted cord, stable interaction and reset.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.MIRROR_TEST_URL || 'http://127.0.0.1:8000';
const out = process.env.MIRROR_TEST_OUTPUT || '/tmp/mirror-telephone-model';
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [], failed = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('requestfailed', request => failed.push(request.url()));
    await page.route('**/__phone-model__', route => route.fulfill({ contentType: 'text/html',
      body: '<!doctype html><style>body{margin:0}</style><link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>' }));
    await page.goto(base + '/__phone-model__');
    const report = await page.evaluate(async () => {
      const T = await import('three');
      const { buildHouse } = await import('/src/house.mjs');
      const { Story } = await import('/src/story.mjs');
      const check = (value, why) => { if (!value) throw new Error(why); };
      const scene = new T.Scene();
      const house = await buildHouse(scene), state = new Story();
      state.power = true; house.reset(state);
      const phone = house.props.rotaryPhone;
      check(phone, 'Actual furnishings do not use the rotary telephone');
      check(house.interactables.find(item => item.id === 'telephone')?.mesh === phone.target,
        'Telephone interaction lost its stable case target');
      const meshes = [], geometries = new Set();
      phone.root.traverse(object => {
        if (!object.isMesh) return;
        check(object.geometry && object.geometry.attributes.position, 'Telephone has an invalid merged mesh');
        check([...object.geometry.attributes.position.array].every(Number.isFinite), 'Telephone geometry is not finite');
        meshes.push(object); geometries.add(object.geometry);
      });
      check(meshes.length <= 12, 'Telephone adds excessive individual draw meshes');
      check(phone.snapshot().numberCount === 10, 'Rotary dial lost its ten number/finger positions');
      const aim = new T.Vector3(-1.45, .94, 6.71), eye = new T.Vector3(-1.45, 1.4, 6.0);
      const firstHit = new T.Raycaster(eye, aim.clone().sub(eye).normalize(), 0, 2.3)
        .intersectObjects(house.occluders, false)[0];
      let owner = firstHit?.object;
      while (owner && owner.userData.interactionId !== 'telephone') owner = owner.parent;
      check(owner, 'Normal player aim cannot target the phone through its dial/handset');
      const cord = phone.root.getObjectByName('Continuous coiled receiver cord');
      const positions = cord.geometry.attributes.position;
      const endpoint = (ring, radial = 5) => {
        const p = new T.Vector3();
        for (let i = 0; i < radial; i++) p.add(new T.Vector3().fromBufferAttribute(positions, ring * (radial + 1) + i));
        return p.divideScalar(radial);
      };
      const lower = endpoint(256).clone();
      let maxCordError = 0, lastLift = 0;
      const storedGeometry = [...geometries];
      for (let i = 0; i < 180; i++) {
        phone.update(true, 1 / 60);
        const frame = phone.snapshot();
        check(frame.lift >= lastLift && frame.lift - lastLift < .18, 'Receiver snaps instead of lifting smoothly');
        lastLift = frame.lift;
        maxCordError = Math.max(maxCordError, endpoint(0).distanceTo(new T.Vector3(...frame.cordStart)));
        check(endpoint(256).distanceTo(lower) < 1e-7, 'Lifting pulled the cord out of the case');
      }
      check(phone.snapshot().lift === 1 && phone.receiver.position.y > .26, 'Call fails to lift the receiver');
      check(maxCordError < 1e-6, 'Receiver separates from its coiled cord');
      for (let i = 0; i < 180; i++) phone.update(false, 1 / 60);
      check(phone.snapshot().lift === 0 && phone.receiver.position.length() === 0, 'Receiver does not settle back on its cradle');
      phone.update(true, .05); phone.reset();
      check(phone.snapshot().lift === 0 && phone.receiver.rotation.x === 0 && phone.receiver.rotation.z === 0,
        'Restart leaves the handset off its cradle');
      check(storedGeometry.every(geometry => geometries.has(geometry)), 'Lifting changed model geometry identity');
      const renderer = new T.WebGLRenderer({ antialias: true });
      renderer.setSize(1280, 900); renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.13;
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
      document.body.append(renderer.domElement);
      const camera = new T.PerspectiveCamera(50, 1280 / 900, .03, 25);
      window.renderPhone = (lifted, detail) => {
        state.phoneLiftUntil = lifted ? 100 : 0;
        for (let i = 0; i < 180; i++) house.animate(1 + i / 60, 1 / 60, state, {x: -1.45, z: 5.9});
        camera.position.set(detail ? -1.20 : -1.45, detail ? 1.23 : 1.57, detail ? 6.20 : 5.85);
        camera.lookAt(-1.45, detail ? .965 : .97, 6.75); camera.updateMatrixWorld(true);
        renderer.render(scene, camera);
      };
      return { result: 'PASS', meshes: meshes.length,
        triangles: meshes.reduce((sum, mesh) => sum + (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3, 0), maxCordError,
        checks: ['actual-room model and stable target', 'finite batched geometry', 'ten-position dial',
          'smooth lift and return', 'both cord ends connected', 'restart resets receiver'] };
    });
    for (const [name, lifted, detail] of [['resting-room', false, false], ['resting-detail', false, true], ['lifted-detail', true, true]]) {
      await page.evaluate(([lifted, detail]) => window.renderPhone(lifted, detail), [lifted, detail]);
      await page.screenshot({ path: `${out}/${name}.png` });
    }
    assert.deepEqual(errors, []); assert.deepEqual(failed, []);
    console.log(JSON.stringify({ ...report, errors, failed, output: out }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
