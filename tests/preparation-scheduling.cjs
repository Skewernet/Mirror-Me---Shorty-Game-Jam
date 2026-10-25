// Run the actual main scheduling functions with controlled async boundaries.
// The renderer integration suite covers real WebGL; this check makes entering
// or resuming across a preparation await deterministic, without wall-clock sleeps.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/main.mjs'), 'utf8');
function section(start, end) {
  const first = source.indexOf(start), last = source.indexOf(end, first);
  assert.ok(first >= 0 && last > first, 'Preparation source boundaries remain identifiable');
  return source.slice(first, last);
}
const scheduler = section('const nextPreparationTask =', '\ntry {\n  firstPerson.prepare(player);');
const future = section('async function prepareFutureRooms()', '\n// This promise is deliberately independent');
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
const turn = () => new Promise(resolve => setImmediate(resolve));

(async () => {
  const { prepareRenderTextures } = await import(pathToFileURL(path.join(root, 'src/performance.mjs')));
  const timers = [], events = [], preparation = {}, warmupStats = [];
  const armFinished = deferred(), linked = deferred(), warmLinked = deferred(), warmFinished = deferred();
  const lateMesh = { name: 'prepared arms' };
  let api, programCalls = 0, warmCalls = 0;
  const record = kind => events.push({ kind, active: api.isActive() });
  const textures = Array.from({ length: 10 }, () => ({ isTexture: true, version: 1 }));
  const view = { traverse(visit) { for (const map of textures) visit({ material: { map } }); } };
  const house = {
    unraveling: {
      warmupObjects: [],
      async prepare({ yieldTask }) {
        for (let chunk = 0; chunk < 3; chunk++) {
          await yieldTask();
          record('arm chunk');
        }
        await armFinished.promise;
        this.warmupObjects.push(lateMesh);
      },
    },
    revelation: { group: {} }, wake: { group: {}, attackBody: {} },
  };
  const deps = {
    house, preparation, warmupStats, performance,
    renderer: { initTexture() { record('upload'); } },
    scene: {}, camera: {}, picture: { target: {} }, essentialObjects: [],
    setTimeout(callback, delay) { timers.push({ callback, delay }); },
    prepareRenderTextures,
    async prepareRenderPrograms(renderer, scene, camera, { include, onlyMeshes }) {
      record('compile');
      if (!programCalls) {
        assert.ok(include.includes(lateMesh), 'Late objects are prepared before first appearance');
        assert.deepEqual(onlyMeshes, [lateMesh], 'Normal-light preparation draws only late meshes');
      } else assert.ok(!include.includes(lateMesh), 'Hidden arms do not need future-room shader variants');
      if (++programCalls === 1) await linked.promise;
      return { view, meshes: 1, lights: 1, materials: 1 };
    },
    async warmProgramView(renderer, scene, camera, { beforeSubmit }) {
      await beforeSubmit?.();
      record('shadow preparation');
      const first = ++warmCalls === 1;
      if (first) await warmLinked.promise;
      await beforeSubmit?.();
      record('submit');
      if (first) await warmFinished.promise;
      return { programs: 1 };
    },
  };
  // Only test bindings replace browser/GPU dependencies. Scheduling, active
  // checks and the extraction callback execute verbatim from main.mjs.
  api = new Function('deps', `
    let active = false;
    const { house, preparation, warmupStats, performance, renderer, scene,
      camera, picture, essentialObjects, setTimeout, prepareRenderTextures,
      prepareRenderPrograms, warmProgramView } = deps;
    ${scheduler}
    ${future}
    return { run: prepareFutureRooms, setActive(value) { active = value; },
      isActive() { return active; } };
  `)(deps);
  async function flush() {
    const ready = timers.splice(0);
    assert.ok(ready.length, 'The intended asynchronous boundary is pending');
    for (const { callback } of ready) callback();
    await turn();
  }
  const count = kind => events.filter(event => event.kind === kind).length;

  api.setActive(true);
  const done = api.run();
  await turn();
  assert.equal(events.length, 0, 'Future preparation waits while playing');
  api.setActive(false); await flush();

  api.setActive(true); await flush();
  assert.equal(count('arm chunk'), 0, 'Resuming during an extraction yield cannot start a chunk');
  api.setActive(false); await flush();
  await flush(); await flush();
  assert.equal(count('arm chunk'), 3);

  api.setActive(true); armFinished.resolve(); await turn();
  assert.equal(programCalls, 0, 'Finishing extraction during play cannot start shader compilation');
  api.setActive(false); await flush();
  assert.equal(programCalls, 1);

  api.setActive(true); linked.resolve(); await turn();
  assert.equal(count('upload'), 0, 'Async linking cannot start texture uploads after play resumes');
  api.setActive(false); await flush();
  assert.equal(count('upload'), 8);
  api.setActive(true); await flush();
  assert.equal(count('upload'), 8, 'A yielded upload batch stays stopped after play resumes');
  api.setActive(false); await flush(); await flush();
  assert.equal(count('upload'), 10);
  assert.equal(count('shadow preparation'), 1);

  api.setActive(true); warmLinked.resolve(); await turn();
  assert.equal(count('submit'), 0, 'Async shadow linking cannot submit a warm draw during play');
  api.setActive(false); await flush();
  assert.equal(count('submit'), 1);
  api.setActive(true); warmFinished.resolve(); await turn();
  assert.equal(programCalls, 1, 'The next room cannot start when resources complete during play');
  api.setActive(false); await flush();
  await done;
  assert.equal(programCalls, 3);
  assert.equal(preparation.unraveling, true);
  assert.equal(preparation.revelation, true);
  assert.equal(preparation.wake, true);
  assert.deepEqual(warmupStats.map(phase => phase.phase), ['unraveling', 'revelation', 'wake']);
  assert.ok(events.every(event => !event.active), 'All heavy preparation work belongs to an inactive screen');
  console.log(JSON.stringify({ result: 'PASS', checks: ['actual main scheduling source',
    'extraction yield and completion gates', 'async shader-link handoff', 'first and subsequent upload batches',
    'warm draw and next-room handoffs', 'paused preparation resumes without replay'], events: events.length }));
})().catch(error => { console.error(error); process.exitCode = 1; });
