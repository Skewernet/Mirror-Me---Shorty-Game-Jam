// The final return reuses one actor. Verify its lamp/room/visibility gates and
// finite spatial cues independently of the spoken confession's duration.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.MIRROR_TEST_URL || 'http://127.0.0.1:8000';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox'] });
  const errors = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/__escape-check__', route => route.fulfill({ contentType: 'text/html',
      body: '<!doctype html><link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>' }));
    await page.goto(base + '/__escape-check__');
    const result = await page.evaluate(async () => {
      const T = await import('/vendor/three.module.js');
      const { HorrorDirector } = await import('/src/horror.mjs');
      const check = (value, message) => { if (!value) throw new Error(message); };
      const scene = new T.Scene(), camera = new T.PerspectiveCamera(65, 16 / 9, .055, 30);
      const house = { occluders: [] };
      const director = new HorrorDirector(scene, house, { figureFactory: () => ({
        body: new T.Group(), setCreaturePose() {}, resetPose() {}, resetMotion() {},
      }) });
      const body = director.figure.body;
      const story = { stage: 6, inverted: true, truthFound: false, lampOff: false,
        doors: { kitchen: true, utility: true, bathroom: true, lounge: true, bedroom: true } };
      const player = { x: 7.4, z: -2.5 };
      let time = 0;
      const at = (x, z, target) => {
        player.previousX = player.x = x; player.previousZ = player.z = z;
        camera.position.set(x, 1.64, z); camera.lookAt(...target); camera.updateMatrixWorld(true);
      };
      const step = (seconds, options = {}) => {
        for (let i = 0; i < Math.ceil(seconds * 60); i++) {
          time += 1 / 60;
          director.update(time, 1 / 60, story, player, camera, options);
        }
      };
      const kitchen = [2.4, 1.86, -1.55];
      at(3.8, 0, kitchen); step(.3);
      check(!director.active && !director.escapeArmed, 'The confession gates the exit sequence');
      story.truthFound = true; step(.3);
      check(!director.active && !director.escapeArmed, 'A lamp still burning keeps the return quiet');
      story.lampOff = true; at(7.4, -2.5, kitchen); step(.3);
      check(!director.active && !director.escapeArmed, 'Switching the lamp off does not reveal a bedroom crawler');
      at(7.4, 0, kitchen); step(.1);
      check(director.escapeArmed && !director.active, 'The sequence arms only after leaving the bedroom');
      const cases = [
        { id: 'exit-kitchen', room: 'kitchen', x: 3.8, z: 0, look: kitchen },
        { id: 'exit-utility', room: 'utility', x: 0, z: .4, look: [-1.55, 1.86, 1.8] },
        { id: 'inverted-witness', room: 'bathroom', x: 0, z: 1.9, look: [1.55, 1.86, 2.5] },
        { id: 'exit-sitting-room', room: 'lounge', x: 0, z: 3.8, look: [-1.55, 1.86, 5.1] },
      ];
      const measured = [];
      for (const fixture of cases) {
        at(fixture.x, fixture.z, fixture.look);
        story.doors[fixture.room] = false; step(.15, { dialogueBusy: true });
        check(!director.active, fixture.id + ' must respect a closed room');
        story.doors[fixture.room] = true;
        // A real occluder also blocks the cue, even when the story door is open.
        const wall = new T.Mesh(new T.BoxGeometry(20, 4, .03), new T.MeshBasicMaterial());
        wall.position.copy(camera.position).lerp(new T.Vector3(...fixture.look), .35);
        wall.lookAt(camera.position); scene.add(wall); house.occluders.push(wall);
        step(.15, { dialogueBusy: true });
        check(!director.active && !director.completed[fixture.id], fixture.id + ' cannot reveal through a wall');
        wall.visible = false;
        step(.15, { dialogueBusy: true });
        check(director.active?.definition.id === fixture.id, fixture.id + ' should reveal despite a remaining spoken line');
        check(director.figure.body === body, 'All room flashes reuse the existing actor');
        const events = director.drainEvents();
        check(events.some(event => event.id === 'crawler-click' && event.encounter === fixture.id), fixture.id + ' must carry a positional click');
        check(!events.some(event => event.id === 'crawler-contact'), 'A stationary player is never attacked');
        step(1.1, { dialogueBusy: true });
        check(!director.active && !body.visible, fixture.id + ' must finish within one second');
        measured.push(fixture.id);
      }
      check(Object.keys(director.completed).filter(id => director.completed[id]).length === 4, 'Exactly four exit witnesses were consumed');
      for (const fixture of cases) { at(fixture.x, fixture.z, fixture.look); step(.3); }
      check(!director.active, 'Returning through the hall cannot replay completed flashes');
      director.reset(); time = 0; at(3.8, 0, kitchen); step(.3, { enabled: false });
      check(!director.active && director.drainEvents().length === 0, 'Disabling sudden scares suppresses body and cues');
      step(.15, { flashes: false, dialogueBusy: true });
      check(director.active && director.light.lightMultiplier === 1, 'No-flash setting preserves a readable still glimpse');
      story.endingStarted = true; step(.1);
      check(!director.active && !body.visible && director.drainEvents().length === 0, 'Funeral entry cancels the final-house actor');
      director.reset();
      check(!director.escapeArmed && !Object.values(director.completed).some(Boolean), 'Restart resets the complete return sequence');
      return { rooms: measured, checks: ['truth + lamp + bedroom-exit gates', 'closed doors and real occlusion',
        'one pooled actor', 'finite four-room reveals during speech', 'sparse spatial clicks', 'stationary player safe',
        'no replay', 'comfort options', 'funeral cancellation', 'restart'] };
    });
    // Repeat the forward-walking sightlines with the actual house, open door
    // leaves and skinned demon. A head merely inside a room is insufficient:
    // its ray can still hit the jamb before the player reaches the doorway.
    const actualRooms = await page.evaluate(async () => {
      const T = await import('/vendor/three.module.js');
      const { buildHouse } = await import('/src/house.mjs');
      const { preloadCharacterAssets } = await import('/src/figure.mjs');
      const { preloadDemonAssets } = await import('/src/demon.mjs');
      const { HorrorDirector } = await import('/src/horror.mjs');
      const { Story } = await import('/src/story.mjs');
      const check = (value, message) => { if (!value) throw new Error(message); };
      const scene = new T.Scene(), camera = new T.PerspectiveCamera(65, 16 / 9, .055, 30);
      const [house] = await Promise.all([buildHouse(scene), preloadCharacterAssets(), preloadDemonAssets()]);
      const director = new HorrorDirector(scene, house), story = new Story();
      Object.assign(story, { stage: 6, inverted: true, truthFound: true, farewellSaid: true, lampOff: true, power: true });
      story.doors = { kitchen: true, utility: true, bathroom: true, lounge: true, bedroom: true };
      house.reset(story);
      for (const door of Object.values(house.roomDoors)) door.pivot.rotation.y = door.openAngle;
      const cases = [
        { id: 'exit-kitchen', x: 3.7, z: 0, west: true },
        { id: 'exit-utility', x: 0, z: .7 },
        { id: 'inverted-witness', x: 0, z: 1.45 },
        { id: 'exit-sitting-room', x: 0, z: 3.8 },
      ];
      const results = [];
      for (const fixture of cases) {
        director.reset();
        const player = { x: fixture.x, z: fixture.z, previousX: fixture.x, previousZ: fixture.z };
        camera.position.set(player.x, 1.64, player.z);
        camera.lookAt(player.x - (fixture.west ? 3 : 0), 1.64, player.z + (fixture.west ? 0 : 3));
        camera.updateMatrixWorld(true);
        house.animate(1, 1 / 60, story, player);
        for (let frame = 0; frame < 30 && !director.active; frame++)
          director.update(1 + frame / 60, 1 / 60, story, player, camera, { dialogueBusy: true });
        check(director.active?.definition.id === fixture.id, fixture.id + ' must reveal through its actual doorway during forward movement');
        const bounds = new T.Box3().setFromObject(director.figure.body);
        check(bounds.max.y <= 2.321 && bounds.min.y > 1.4, fixture.id + ' must cling below the real ceiling');
        const clear = fixture.west ? bounds.max.z < -.64 : fixture.id === 'inverted-witness' ? bounds.min.x > .64 : bounds.max.x < -.64;
        check(clear, fixture.id + ' must remain outside the required hall walking route');
        results.push({ id: fixture.id, min: bounds.min.toArray(), max: bounds.max.toArray() });
      }
      director.reset();
      const runner = { x: 7.4, z: 0, previousX: 7.4, previousZ: 0 };
      const seen = new Set();
      for (let frame = 0; frame < 600 && runner.z < 7.1; frame++) {
        runner.previousX = runner.x; runner.previousZ = runner.z;
        const west = runner.x > 0;
        if (west) runner.x = Math.max(0, runner.x - 3.25 / 60);
        else runner.z += 3.25 / 60;
        camera.position.set(runner.x, 1.64, runner.z);
        camera.lookAt(runner.x - (west ? 3 : 0), 1.64, runner.z + (west ? 0 : 3));
        camera.updateMatrixWorld(true);
        director.update(3 + frame / 60, 1 / 60, story, runner, camera, { dialogueBusy: true });
        if (director.active) seen.add(director.active.definition.id);
        check(!director.drainEvents().some(event => event.id === 'crawler-contact'), 'The required sprint route cannot cause contact failure');
      }
      check(cases.every(fixture => seen.has(fixture.id)), 'Forward sprinting must still expose all four room witnesses; saw ' + [...seen]);
      return results;
    });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ result: 'PASS', ...result, actualRooms, errors }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
