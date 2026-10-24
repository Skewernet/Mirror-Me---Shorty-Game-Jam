// Real Chromium input packets exercise the frame bound; dispatchEvent alone
// cannot reproduce browser coalescing and pointer-lock lifecycle behavior.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const url = (process.env.MIRROR_TEST_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/__native-mouse__", route => route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><link rel="icon" href="data:,"><style>body{margin:0}canvas{width:100vw;height:100vh;background:#222}button{position:absolute;left:420px;top:320px}</style><canvas id="view"></canvas><button>Capture</button><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script><script type="module">
        import * as T from 'three';
        import {Player} from '/src/player.mjs';
        import {LookInput,MAX_LOOK_FRAME_ANGLE} from '/src/look-input.mjs';
        const canvas=document.querySelector('canvas'),button=document.querySelector('button');
        const player=new Player(new T.PerspectiveCamera()),reader=new LookInput();
        window.fixture={player,reader,packets:[],frames:[],maximum:MAX_LOOK_FRAME_ANGLE};
        button.onclick=()=>canvas.requestPointerLock();
        document.addEventListener('pointerlockchange',event=>{reader.reset(event.timeStamp);button.hidden=!!document.pointerLockElement});
        document.addEventListener('mousemove',event=>{
          if(document.pointerLockElement!==canvas)return;
          reader.enqueue(event,performance.now());
          fixture.packets.push({x:event.movementX,y:event.movementY,time:event.timeStamp,trusted:event.isTrusted});
        });
        let previous=performance.now();
        function tick(now){
          const dt=Math.min((now-previous)/1000,.05);previous=now;
          const before=player.yaw,motion=reader.consume(dt,player.sensitivity);
          if(motion)player.look(motion.x,motion.y);
          player.syncCamera();fixture.frames.push({turn:player.yaw-before,time:now});
          requestAnimationFrame(tick);
        }requestAnimationFrame(tick);
        fixture.ready=true;
      </script>`,
    }));
    await page.goto(url + "/__native-mouse__");
    await page.waitForFunction(() => window.fixture?.ready);
    await page.click("button");
    await page.waitForFunction(() => !!document.pointerLockElement);
    await page.mouse.move(500, 350);
    await page.waitForTimeout(40);
    await page.evaluate(() => { fixture.packets = []; fixture.frames = []; });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 1500, y: 350, pointerType: "mouse" });
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 2500, y: 350, pointerType: "mouse" });
    await page.waitForTimeout(60);
    const burst = await page.evaluate(() => ({ packets: fixture.packets, frames: fixture.frames, maximum: fixture.maximum }));
    assert.ok(burst.packets.length > 0 && burst.packets.every(packet => packet.trusted));
    assert.equal(burst.packets.reduce((sum, packet) => sum + packet.x, 0), 2000);
    assert.ok(Math.max(...burst.frames.map(frame => Math.abs(frame.turn))) <= burst.maximum + 1e-8,
      "Native coherent packets must not bypass the total frame bound");
    await page.waitForTimeout(60);
    const noBacklog = await page.evaluate(() => fixture.frames.at(-1).turn);
    assert.equal(noBacklog, 0, "Excess native input must not replay after the burst");
    await page.setViewportSize({ width: 1280, height: 800 });
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 2501, y: 351, pointerType: "mouse" });
    await page.waitForTimeout(40);
    const resize = await page.evaluate(() => ({ frame: fixture.frames.at(-1), packets: fixture.packets, maximum: fixture.maximum }));
    assert.ok(resize.packets.at(-1).trusted);
    assert.ok(Math.abs(resize.frame.turn) <= resize.maximum + 1e-8);
    await page.evaluate(() => document.exitPointerLock());
    await page.waitForFunction(() => !document.pointerLockElement);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ status: "PASS", trustedPackets: burst.packets.length, nativeCounts: 2000, maxFrameTurnDegrees: Math.max(...burst.frames.map(frame => Math.abs(frame.turn))) * 180 / Math.PI, checks: ["native Chromium pointer lock", "trusted coherent packet burst bounded", "discarded backlog stays discarded", "viewport resize"], errors }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
