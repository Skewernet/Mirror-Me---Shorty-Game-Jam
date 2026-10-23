// Uses the environment's Playwright installation and system Chromium.
// Start python -m http.server 8000 --bind 127.0.0.1 in the repository first.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const url=process.env.MIRROR_TEST_URL||'http://127.0.0.1:8000';
const out=process.env.MIRROR_TEST_OUTPUT||'/tmp/mirror-me-checks';
fs.mkdirSync(out,{recursive:true});
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[],requests=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    page.on('requestfailed',r=>requests.push(r.url()));
    await page.goto(url+'/?test=1');await page.waitForFunction(()=>!!window.__mirror);
    await page.screenshot({path:out+'/title.png'});
    await page.click('#start');await page.waitForFunction(()=>!!document.pointerLockElement);
    const snapshot=()=>page.evaluate(()=>window.__mirror.snapshot());
    const advance=s=>page.evaluate(s=>window.__mirror.advance(s),s);
    const face=(yaw,pitch=0)=>page.evaluate(([y,p])=>window.__mirror.face(y,p),[yaw,pitch]);
    const pose=(x,z,yaw=0,pitch=0)=>page.evaluate(v=>window.__mirror.pose(...v),[x,z,yaw,pitch]);
    async function aim(x,y,z){const s=await snapshot(),dx=x-s.pose.x,dz=z-s.pose.z;await face(Math.atan2(-dx,-dz),Math.atan2(y-1.64,Math.hypot(dx,dz)));await advance(.02);}
    async function walkTo(x,z){
      for(let i=0;i<120;i++){
        const s=await snapshot(),dx=x-s.pose.x,dz=z-s.pose.z,d=Math.hypot(dx,dz);
        if(d<.065){await page.keyboard.up('KeyW');await advance(.12);return;}
        await face(Math.atan2(-dx,-dz));await page.keyboard.down('KeyW');await advance(Math.min(.22,d/2.05));
      }
      throw Error('Could not walk to '+x+','+z+': '+JSON.stringify((await snapshot()).pose));
    }
    async function pressE(){await page.keyboard.press('KeyE');await advance(.05);}
    async function lap(){await walkTo(0,-6);await walkTo(3.5,-6);await walkTo(3.5,4.9);await walkTo(0,5);}
    // Interactions before the encounter must not grant a key or open the door.
    await aim(0,1.3,7.5);await advance(.1);await pressE();assert.equal((await snapshot()).story.doorOpen,false);
    await walkTo(0,1.65);await aim(1.08,1,.78);assert.equal((await snapshot()).target,'note');await pressE();assert.equal((await snapshot()).story.hasNote,true);
    await aim(1.1,.65,1.05);assert.equal((await snapshot()).target,'drawer');await pressE();assert.equal((await snapshot()).story.drawerOpen,true);await pressE();assert.equal((await snapshot()).story.hasKey,false);
    // A complete collision-respecting route, rather than teleporting story state.
    await walkTo(0,-.45);await aim(-1.595,1.55,-.45);await advance(1.4);
    assert.ok((await snapshot()).story.firstSeen>=1);await page.screenshot({path:out+'/faithful-mirror.png'});
    await lap();assert.equal((await snapshot()).story.stage,1);
    await walkTo(0,-.45);await aim(-1.595,1.55,-.45);await advance(1.8);
    assert.equal((await snapshot()).story.armed,true);
    await face(Math.PI);await advance(.12);assert.equal((await snapshot()).story.frozen,true);
    await walkTo(0,1.45);const held=await snapshot();assert.ok(held.pose.z-held.body.z>1.4);
    await aim(-1.595,1.55,-.45);await advance(1.2);assert.equal((await snapshot()).story.encounter,true);
    const returned=await snapshot();assert.equal(returned.body.x,held.body.x);assert.equal(returned.body.z,held.body.z);
    await page.screenshot({path:out+'/held-mirror.png'});
    // Pause must stop progression, interactions, position, and audio.
    await page.evaluate(()=>document.exitPointerLock());await page.waitForFunction(()=>!document.querySelector('#menu').hidden);
    const paused=await snapshot();await page.keyboard.press('KeyE');await page.keyboard.down('KeyW');await advance(3);await page.keyboard.up('KeyW');
    const afterPause=await snapshot();assert.equal(afterPause.time,paused.time);assert.deepEqual(afterPause.pose,paused.pose);assert.equal(afterPause.audio,'suspended');
    await page.click('#start');await page.waitForFunction(()=>!!document.pointerLockElement);
    // Returning for the key after opening the drawer early cannot softlock.
    await walkTo(0,1.1);await aim(1.1,.65,1.05);assert.equal((await snapshot()).target,'drawer');
    if(!(await snapshot()).story.drawerOpen)await pressE();await pressE();assert.equal((await snapshot()).story.hasKey,true);
    await page.keyboard.press('Tab');await page.waitForFunction(()=>!document.querySelector('#pocket').hidden);assert.ok((await page.locator('#items').innerText()).includes('Brass key'));
    await page.screenshot({path:out+'/inventory.png'});await page.keyboard.press('Tab');await page.waitForFunction(()=>!!document.pointerLockElement);
    // Walls and furniture block actual player movement, including a large dt harness run.
    await pose(0,1.05,-Math.PI/2);await page.keyboard.down('KeyW');await advance(3);await page.keyboard.up('KeyW');assert.ok((await snapshot()).pose.x<.4);
    await pose(0,-3,Math.PI/2);await page.keyboard.down('KeyW');await advance(3);await page.keyboard.up('KeyW');assert.ok((await snapshot()).pose.x>-1.44);
    await pose(3.5,1,Math.PI/2);await page.keyboard.down('KeyW');await advance(3);await page.keyboard.up('KeyW');assert.ok((await snapshot()).pose.x>2.05);
    // Targeting the console from the other side of the partition must fail.
    await pose(3.5,1.05,Math.PI/2,-.3);await advance(.1);assert.equal((await snapshot()).target,null);
    // Finish through the real unlocked doorway, then restart every state.
    await pose(0,5.1,Math.PI);await aim(0,1.3,7.5);assert.equal((await snapshot()).target,'door');await pressE();assert.equal((await snapshot()).story.doorOpen,true);await advance(2);
    assert.ok((await snapshot()).doorAngle<-.95);await walkTo(0,9.4);await advance(6.1);
    assert.equal((await snapshot()).mode,'ending');assert.equal((await snapshot()).story.ended,true);
    await page.screenshot({path:out+'/ending.png'});await page.click('#start');await page.waitForFunction(()=>!!document.pointerLockElement);const reset=await snapshot();
    assert.equal(reset.story.hasKey,false);assert.equal(reset.story.hasNote,false);assert.equal(reset.story.frozen,false);assert.equal(reset.story.stage,0);assert.equal(reset.story.doorOpen,false);assert.equal(reset.doorAngle,0);assert.equal(reset.pose.z,5.2);
    // All shipped performances must fetch and decode, not just exist on disk.
    const durations=await page.evaluate(async()=>{const c=new AudioContext(),result={};try{for(const id of ['arrival','repeat','late','returned','key','unlocked','ending']){const r=await fetch('assets/voice/'+id+'.ogg');if(!r.ok)throw Error('Missing '+id);const b=await c.decodeAudioData(await r.arrayBuffer());result[id]=b.duration;if(!b.getChannelData(0).some(v=>Math.abs(v)>.01))throw Error('Silent '+id);}}finally{await c.close();}return result;});
    assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
    console.log(JSON.stringify({result:'PASS',checks:['real route through both corners','first reflection before progression','look-away and return encounter','early drawer recovery','inventory','paused input and audio','wall/prop collisions','line of sight','unlocked exit','ending and complete restart','seven non-silent decoded voices'],voiceDurations:durations,screenshots:out},null,2));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
