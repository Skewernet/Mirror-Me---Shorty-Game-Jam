// Real browser acquisition/release/resume, with supported-API shims for fallback
// branches. No game renderer or invented movement packet is needed here.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const p = await browser.newPage({ viewport: { width: 800, height: 600 } });
    const errors = [];
    p.on("pageerror", error => errors.push(error.message));
    await p.route("**/src/pointer-lock.mjs", route => route.fulfill({
      contentType: "text/javascript",
      body: fs.readFileSync(path.join(__dirname, "../src/pointer-lock.mjs"), "utf8"),
    }));
    await p.route("**/__pointer-lock__", route => route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><link rel="icon" href="data:,"><canvas id="game" width="500" height="300"></canvas><button id="start">Capture</button>
        <script type="module">
        import { requestGamePointerLock, pointerLockRequestPending } from '/src/pointer-lock.mjs';
        const game=document.querySelector('#game');
        window.fixture={result:null,failures:[],events:[],nativeErrors:0,attempts:[]};
        const state=window.fixture;
        const native=game.requestPointerLock.bind(game);
        window.mode='native';
        game.requestPointerLock=(options)=>{
          state.attempts.push(options||null);
          if(window.mode==='unsupported' && options?.unadjustedMovement){
            document.dispatchEvent(new Event('pointerlockerror'));
            return Promise.reject(new DOMException('Raw input unsupported','NotSupportedError'));
          }
          if(window.mode==='denied'){
            document.dispatchEvent(new Event('pointerlockerror'));
            return Promise.reject(new DOMException('Capture denied','NotAllowedError'));
          }
          if(window.mode==='legacy'){
            const promise=native();
            promise?.catch(()=>{});
            return;
          }
          return native(options);
        };
        // Acquisition failures belong to the helper promise. Native error
        // events can arrive after an earlier fallback already succeeded.
        document.addEventListener('pointerlockerror',()=>state.nativeErrors++);
        document.addEventListener('mousemove',event=>{
          if(document.pointerLockElement===game)state.events.push([event.movementX,event.movementY,event.isTrusted]);
        });
        document.querySelector('#start').onclick=()=>{
          state.result=null;
          requestGamePointerLock(game).then(result=>state.result=result,error=>state.failures.push(error.name));
        };
        window.ready=true;
        </script>`,
    }));
    await p.goto("http://127.0.0.1:8000/__pointer-lock__");
    await p.waitForFunction(() => window.ready);
    const capture = async () => {
      await p.click("#start");
      await p.waitForFunction(() => document.pointerLockElement && window.fixture.result);
      return p.evaluate(() => window.fixture.result);
    };
    const release = async () => {
      await p.evaluate(() => document.exitPointerLock());
      await p.waitForFunction(() => !document.pointerLockElement);
    };
    const native = await capture();
    assert.equal(native.alreadyLocked, false);
    await p.mouse.move(100, 100);
    await p.mouse.move(160, 115, { steps: 3 });
    const motion = await p.evaluate(() => window.fixture.events);
    assert.ok(motion.some(event => event[2] && Math.hypot(event[0], event[1]) > 0), "Native locked mouse movement was not delivered");
    await release();
    await capture();
    await release();
    await p.evaluate(() => { window.mode = "unsupported"; window.fixture.attempts = []; });
    const fallback = await capture();
    assert.equal(fallback.unadjustedRequested, false);
    assert.deepEqual(await p.evaluate(() => window.fixture.attempts), [{ unadjustedMovement: true }, null]);
    await p.evaluate(() => document.dispatchEvent(new Event("pointerlockerror")));
    assert.equal(await p.evaluate(() => !!document.pointerLockElement), true, "Late native error interrupted valid capture");
    assert.deepEqual(await p.evaluate(() => window.fixture.failures), []);
    await release();
    await p.evaluate(() => { window.mode = "legacy"; });
    const legacy = await capture();
    assert.equal(legacy.promiseAPI, false);
    await release();
    await p.evaluate(() => { window.mode = "denied"; window.fixture.attempts = []; });
    await p.click("#start");
    await p.waitForFunction(() => window.fixture.failures.length === 1);
    assert.deepEqual(await p.evaluate(() => window.fixture.failures), ["NotAllowedError"]);
    assert.equal(await p.evaluate(() => window.fixture.attempts.length), 1);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ status: "PASS", browser: browser.version(), nativeRequest: native, checks: ["native locked motion", "release and reacquire", "unsupported raw fallback", "late fallback error ignored", "legacy void completion", "permission rejection never retried"], errors }));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
