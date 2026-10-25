// Controlled CPU comparison in the actual game. Optional saved pre-change
// figure.mjs / first-person.mjs sources are supplied with --reference DIR.
// The profiler's exports exist only in this intercepted local browser response.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const value = name => args[args.indexOf(name) + 1];
const reference = args.includes('--reference') ? path.resolve(value('--reference')) : null;
const output = args.includes('--output') ? path.resolve(value('--output')) : '/tmp/mirror-character-cpu.json';
const base = process.env.MIRROR_TEST_URL || 'http://127.0.0.1:8000';
// Both variants use the same frozen modules even if another developer is
// working in the shared checkout while this multi-context comparison runs.
const source = new Map(fs.readdirSync(path.join(root, 'src')).filter(name => name.endsWith('.mjs'))
  .map(name => [name, fs.readFileSync(path.join(root, 'src', name), 'utf8')]));
const hashes = Object.fromEntries([...source].map(([name, text]) => [name,
  crypto.createHash('sha256').update(text).digest('hex')]));

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--enable-precise-memory-info'] });
  const results = [];
  try {
    for (const variant of reference ? ['reference', 'current'] : ['current']) {
      const variantHashes = { ...hashes };
      const context = await browser.newContext({ viewport: { width: 1000, height: 760 } });
      await context.addInitScript(() => {
        sessionStorage.setItem('mirror-me.intro.v1', 'acknowledged');
        localStorage.setItem('mirror-me.settings.v1', JSON.stringify({ version: 1,
          values: { quality: '720', 'auto-quality': false, volume: 0 } }));
      });
      await context.route('**/src/*.mjs', route => {
        const name = new URL(route.request().url()).pathname.split('/').at(-1);
        const body = source.get(name);
        return body === undefined ? route.continue() : route.fulfill({ contentType: 'text/javascript', body });
      });
      if (variant === 'reference') for (const name of ['figure.mjs', 'first-person.mjs']) {
        const body = fs.readFileSync(path.join(reference, name), 'utf8');
        variantHashes[name] = crypto.createHash('sha256').update(body).digest('hex');
        await context.route('**/src/' + name, route => route.fulfill({ contentType: 'text/javascript', body }));
      }
      await context.route('**/src/main.mjs', route => route.fulfill({ contentType: 'text/javascript',
        body: source.get('main.mjs') +
          '\nwindow.__characterProfile = { firstPerson, mirror, house, horror, player, renderer, camera, scene, update };\n' }));
      const page = await context.newPage();
      page.setDefaultTimeout(180000);
      const errors = [], failed = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      page.on('requestfailed', request => failed.push(request.url()));
      console.log('Character CPU profiler: loading ' + variant);
      await page.goto(base + '/?test=1');
      await page.waitForFunction(() => window.__characterProfile && window.__mirror?.snapshot().rendering.preparation.wake);
      await page.click('#start');
      await page.waitForFunction(() => document.pointerLockElement && __mirror.snapshot().active);
      const report = await page.evaluate(async () => {
        const { MIRROR } = await import('/src/layout.mjs');
        const T = await import('three');
        const p = window.__characterProfile;
        __mirror.pose(MIRROR.x - 1.2, 0, -Math.PI / 2, 0);
        const quantiles = samples => {
          samples.sort((a, b) => a - b);
          return { median: samples[Math.floor(samples.length * .5)], p95: samples[Math.floor(samples.length * .95)],
            max: samples.at(-1), samples: samples.length };
        };
        // Five updates per sample avoid treating the timer's 0.1 ms precision
        // as actual per-frame quantization. No rendering occurs in this phase.
        for (let i = 0; i < 120; i++) p.update(1 / 60);
        const samples = [];
        for (let sample = 0; sample < 100; sample++) {
          const began = performance.now();
          for (let frame = 0; frame < 5; frame++) p.update(1 / 60);
          samples.push((performance.now() - began) / 5);
        }
        const boundaries = {};
        const wrap = (owner, name, label) => {
          const original = owner[name], record = boundaries[label] = { calls: 0, ms: 0 };
          owner[name] = function(a, b, c, d, e, f) {
            const began = performance.now();
            const result = original.call(this, a, b, c, d, e, f);
            record.calls++; record.ms += performance.now() - began;
            return result;
          };
          return () => { owner[name] = original; };
        };
        const undo = [
          wrap(p.firstPerson, 'update', 'firstPerson'), wrap(p.firstPerson.figure, 'animate', 'firstPersonGait'),
          wrap(p.mirror, 'update', 'mirror'), wrap(p.mirror.figure, 'animate', 'mirrorGait'),
          wrap(p.mirror.figure, 'setHorror', 'mirrorHorror'), wrap(p.house, 'animate', 'house'),
          wrap(p.horror, 'update', 'director'),
        ];
        for (let i = 0; i < 120; i++) p.update(1 / 60);
        for (const restore of undo) restore();
        let matrixNodes = 0;
        const matrix = T.Object3D.prototype.updateMatrixWorld;
        T.Object3D.prototype.updateMatrixWorld = function(force) { matrixNodes++; return matrix.call(this, force); };
        for (let i = 0; i < 60; i++) p.update(1 / 60);
        T.Object3D.prototype.updateMatrixWorld = matrix;
        const render = [];
        for (let i = 0; i < 12; i++) {
          const began = performance.now(); __mirror.render(); render.push(performance.now() - began);
        }
        return { cpuUpdateMs: quantiles(samples), componentMs: boundaries, matrixNodeUpdatesPerFrame: matrixNodes / 60,
          renderSubmissionMs: quantiles(render), rendering: __mirror.snapshot().rendering,
          note: 'CPU update and render submission in cloud Chromium/SwiftShader, not target-GPU FPS or completed GPU frame time.' };
      });
      results.push({ variant, sourceHashes: variantHashes, ...report, errors, failed });
      console.log(JSON.stringify({ variant, cpu: report.cpuUpdateMs, matrices: report.matrixNodeUpdatesPerFrame,
        errors, failed }));
      await context.close();
    }
    fs.writeFileSync(output, JSON.stringify(results, null, 2) + '\n');
    console.log('CPU evidence: ' + output);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
