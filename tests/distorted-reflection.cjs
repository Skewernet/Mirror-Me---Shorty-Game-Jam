// The final glass keeps human bone lengths; its private facial strain cannot
// leak into healthy Mara or the director's separately authored creature poses.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.MIRROR_TEST_URL || 'http://127.0.0.1:8000';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox'] });
  const errors = [], failed = [];
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(120000);
    page.on('pageerror', e => errors.push(e.message));
    page.on('requestfailed', request => failed.push(request.url()));
    await page.route('**/__distorted-reflection__', route => route.fulfill({ contentType: 'text/html',
      body: '<link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>' }));
    await page.goto(base + '/__distorted-reflection__');
    const report = await page.evaluate(async () => {
      const { preloadCharacterAssets, createFigure } = await import('/src/figure.mjs');
      await preloadCharacterAssets();
      const check = (condition, message) => { if (!condition) throw Error(message); };
      const normal = createFigure(null, 0), reflection = createFigure(null, 1), creature = createFigure(null, 0);
      const fingerprint = figure => {
        const joints = [...figure.anatomy.joints.values()].map(({ bone }) => [
          bone.position.toArray(), bone.quaternion.toArray(), bone.scale.toArray()]);
        const materials = [];
        figure.body.traverse(mesh => {
          if (mesh.isMesh) materials.push([mesh.name, mesh.material.color.toArray(), mesh.material.roughness,
            mesh.material.map?.uuid, mesh.morphTargetInfluences?.slice()]);
        });
        return JSON.stringify({ joints, materials });
      };
      normal.resetPose(); const healthy = fingerprint(normal);
      const skin = reflection.body.getObjectByName('Mara_Skin');
      const strain = skin.geometry.morphAttributes.position[skin.morphTargetDictionary.Mara_Mirror_Strain];
      const source = skin.geometry.attributes.position;
      let maxStrain = 0;
      for (let vertex = 0; vertex < strain.count; vertex++) {
        const x = strain.getX(vertex), y = strain.getY(vertex), z = strain.getZ(vertex);
        check(Number.isFinite(x + y + z), 'Facial strain contains a non-finite vertex');
        maxStrain = Math.max(maxStrain, Math.hypot(x, y, z));
        if (source.getY(vertex) < 1.47) check(x === 0 && y === 0 && z === 0, 'Face morph moves torso or limbs');
      }
      check(maxStrain > .004 && maxStrain < .018, 'Strain stays a bounded anatomical adjustment');
      let samples = 0;
      for (let frame = 0; frame < 240; frame++) {
        const time = frame * .137;
        reflection.setCreaturePose(time, .5, { mode: 'twisted', intensity: .9, reflection: true });
        for (const [name, joint] of reflection.anatomy.joints) {
          if (!/^(lowerarm_|hand_|index_|middle_|ring_|pinky_|thumb_)/.test(name)) continue;
          check(joint.bone.position.distanceTo(joint.position) < 1e-12, 'Mirror lengthens ' + name);
          check(joint.bone.scale.distanceTo(joint.scale) < 1e-12, 'Mirror scales ' + name);
          samples++;
        }
        const jaw = skin.morphTargetInfluences[skin.morphTargetDictionary.Mara_Jaw_Open];
        check(jaw >= 0 && jaw < .2, 'Final mirror returns to an exaggerated oval jaw');
      }
      reflection.resetPose(); reflection.setHorror(1, 0, { still: true });
      const held = fingerprint(reflection);
      reflection.setHorror(1, 10000, { still: true });
      check(fingerprint(reflection) === held, 'Held face follows idle animation time');
      creature.setCreaturePose(2, .5, { mode: 'twisted', intensity: .9 });
      const creatureSkin = creature.body.getObjectByName('Mara_Skin');
      check(creatureSkin.morphTargetInfluences[creatureSkin.morphTargetDictionary.Mara_Mirror_Strain] === 0,
        'Director creature acquired the private mirror face');
      const forearm = creature.anatomy.joint('lowerarm_l');
      check(forearm.bone.position.length() > forearm.position.length() * 1.2,
        'The existing creature deformation was overwritten by the mirror pose');
      check(fingerprint(normal) === healthy, 'Private mirror art changes healthy Mara');
      reflection.resetPose();
      check(fingerprint(reflection) === healthy, 'Reset retains facial strain or material changes');
      return { samples, maxStrain };
    });
    assert.deepEqual(errors, []); assert.deepEqual(failed, []);
    console.log(JSON.stringify({ result: 'PASS', ...report, checks: ['bounded skin-only facial strain',
      'human arm and finger lengths across 240 final-reflection frames', 'still face has no time drift',
      'private materials and normal reset', 'original creature deformation retained'], errors, failed }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
