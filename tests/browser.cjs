// Full collision-respecting playthrough of the expanded house.
const{chromium}=require('playwright');const assert=require('node:assert/strict');const fs=require('node:fs');
const url=process.env.MIRROR_TEST_URL||'http://127.0.0.1:8000',out=process.env.MIRROR_TEST_OUTPUT||'/tmp/mirror-me-expansion-checks';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[],failed=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});p.on('requestfailed',r=>failed.push(r.url()));
  await p.goto(url+'/?test=1');await p.waitForFunction(()=>!!window.__mirror,{},{timeout:60000});await p.screenshot({path:out+'/title.png'});await p.click('#start');await p.waitForFunction(()=>!!document.pointerLockElement);
  const snap=()=>p.evaluate(()=>window.__mirror.snapshot());const advance=s=>p.evaluate(s=>window.__mirror.advance(s),s);
  const face=(y,pitch=0)=>p.evaluate(v=>window.__mirror.face(...v),[y,pitch]);
  async function aim(x,y,z){const s=await snap(),dx=x-s.pose.x,dz=z-s.pose.z;await face(Math.atan2(-dx,-dz),Math.atan2(y-1.64,Math.hypot(dx,dz)));await advance(.03);}
  async function walk(x,z){
   for(let i=0;i<130;i++){const s=await snap(),dx=x-s.pose.x,dz=z-s.pose.z,d=Math.hypot(dx,dz);if(d<.07){await p.keyboard.up('KeyW');await advance(.13);return;}await face(Math.atan2(-dx,-dz));await p.keyboard.down('KeyW');await advance(Math.min(.42,d/1.85));}
   throw Error('Cannot walk to '+x+','+z+' from '+JSON.stringify((await snap()).pose));
  }
  async function use(id,x,y,z){await aim(x,y,z);const state=await snap();assert.equal(state.target,id,'Target at '+[x,y,z]+' from '+JSON.stringify(state.pose));await p.keyboard.press('KeyE');await advance(.08);}
  async function open(id,x,z){await aim(x,1.2,z);assert.equal((await snap()).target,'room-'+id);await p.keyboard.press('KeyE');await advance(1);assert.equal((await snap()).story.doors[id],true);}
  async function toMain(){await walk(3.5,7);await walk(0,7);}
  async function lap(){await walk(0,-8);await walk(3.5,-8);await walk(3.5,7);await walk(0,7);}
  async function photo(name){await p.evaluate(()=>window.__mirror.render());await p.screenshot({path:out+'/'+name+'.png',timeout:60000});}
  console.log('BEGIN: rooms and first pass');
  await use('door',0,1.1,8.4);assert.equal((await snap()).story.doorOpen,false);
  await walk(0,4);await open('lounge',-1.75,4);await walk(-3.4,4);await walk(-3.1,5.15);await use('radio',-3,.86,6.75);assert.equal((await snap()).story.heardArrival,true);await photo('sitting-room');
  await walk(-3.4,4);await walk(0,4);await walk(0,1);await use('note',1.09,.903,.65);assert.equal((await snap()).story.hasNote,true);
  await walk(0,-.5);await aim(-1.595,1.52,-.5);await advance(1.5);assert.ok((await snap()).story.firstSeen>=1.3);await photo('faithful-mirror');
  await walk(0,-8);await walk(3.5,-8);await walk(3.5,-.2);await open('kitchen',5.25,-.2);await walk(8.7,-.2);await walk(9.65,-2.2);await use('fuse',10.84,1.005,-2.2);assert.equal((await snap()).story.hasFuse,true);await photo('kitchen');
  await walk(8.7,-.2);await walk(3.5,-.2);await walk(3.5,-7.2);await open('utility',5.25,-7.2);await walk(9.65,-7.2);await use('panel',11.6,1.52,-6.9);assert.equal((await snap()).story.power,true);
  await walk(3.5,-7.2);await toMain();assert.equal((await snap()).story.stage,1);
  console.log('PASS 1: power restored, normal reflection witnessed');
  await walk(0,-.5);await aim(-1.595,1.52,-.5);await advance(.8);await p.keyboard.down('KeyD');await advance(.23);await p.keyboard.up('KeyD');const lag=await snap();assert.ok(Math.hypot(lag.pose.x-lag.body.x,lag.pose.z-lag.body.z)>.1);await advance(1.6);
  await face(Math.PI);await advance(.12);assert.equal((await snap()).story.frozen,true);await walk(0,1.3);const held=await snap();await aim(-1.595,1.52,-.5);await advance(1.4);assert.equal((await snap()).story.encounter,true);assert.equal((await snap()).body.z,held.body.z);await photo('held-mirror');
  await walk(0,.9);await use('drawer',1,.62,.9);await advance(.6);await use('drawer',.95,.63,.9);assert.equal((await snap()).story.hasKey,true);
  // The old shortcut must stay closed even with the encounter key.
  await walk(0,6.7);await use('door',0,1.1,8.4);assert.equal((await snap()).story.doorOpen,false);
  await walk(3.5,6.1);await open('bedroom',5.25,6.1);await walk(7.15,6.35);await use('diary',7.84,.77,7.2);assert.equal((await snap()).story.hasDiary,true);await photo('bedroom');await walk(3.5,6.1);await toMain();await lap();assert.equal((await snap()).story.stage,2);
  console.log('PASS 2: mirror encounter, bedroom and diary');
  await walk(0,-5.5);await open('bathroom',-1.75,-5.5);await walk(-3.5,-5.5);await walk(-3.5,-7.55);await use('bath-clue',-3.5,1.92,-9.31);assert.equal((await snap()).story.hasTimeClue,true);await photo('bathroom-clue');
  await walk(-3.5,-5.5);await walk(0,-5.5);await walk(0,-7.9);await use('clock',.3,1.96,-9.24);assert.equal((await snap()).mode,'clock');const clockPause=(await snap()).time;await advance(3);assert.equal((await snap()).time,clockPause);
  await p.locator('#clock-hour').fill('3');await p.locator('#clock-minute').fill('17');await p.locator('#clock-form button[type=submit]').click();await p.waitForFunction(()=>!!document.pointerLockElement);await advance(.2);assert.equal((await snap()).story.clockSolved,true);
  await walk(0,4);await walk(-3.4,4);await walk(-3.1,5.15);await use('radio',-3,.86,6.75);assert.equal((await snap()).story.heardCall,true);await walk(-3.4,4);await walk(0,4);await lap();assert.equal((await snap()).story.stage,3);assert.equal((await snap()).body.visible,false);
  console.log('PASS 3: reverse-time puzzle and second call');
  // One wrong answer must recover; then the player must traverse all three rooms.
  await walk(0,4);await walk(-3.4,4);await walk(-3.1,5.15);await use('radio',-3,.86,6.75);assert.equal((await snap()).story.echoIndex,0);await walk(-3.4,4);await walk(0,4);await walk(0,7);await walk(3.5,6.1);await walk(7,6.1);await walk(7,4.7);await walk(9.75,4.7);await use('musicbox',10.65,.8,4.3);assert.equal((await snap()).story.echoIndex,1);await photo('inverted-bedroom');
  await walk(7,4.7);await walk(7,6.1);await walk(3.5,6.1);await toMain();await walk(0,-5.5);await walk(-3.5,-5.5);await walk(-3.5,-7.55);await use('tap',-3.5,1.11,-8.96);assert.equal((await snap()).story.echoIndex,2);
  await walk(-3.5,-5.5);await walk(0,-5.5);await walk(0,4);await walk(-3.4,4);await walk(-3.1,5.15);await use('radio',-3,.86,6.75);assert.equal((await snap()).story.echoIndex,3);
  await p.keyboard.press('Tab');await p.waitForFunction(()=>!document.querySelector('#pocket').hidden);assert.ok((await p.locator('#items').innerText()).includes('3 / 3'));await photo('journal');await p.keyboard.press('Tab');await p.waitForFunction(()=>!!document.pointerLockElement);
  await walk(-3.4,4);await walk(0,4);await lap();assert.equal((await snap()).story.stage,4);
  console.log('PASS 4: reversed sound sequence');
  await walk(0,-.5);await aim(-1.595,1.52,-.5);await advance(.5);assert.equal((await snap()).story.finalFaced,true);
  await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.querySelector('#menu').hidden);const paused=await snap();await p.keyboard.press('KeyE');await p.keyboard.down('KeyW');await advance(4);await p.keyboard.up('KeyW');const still=await snap();assert.equal(still.time,paused.time);assert.deepEqual(still.pose,paused.pose);assert.equal(still.audio,'suspended');await p.click('#start');await p.waitForFunction(()=>!!document.pointerLockElement);
  await walk(0,5);assert.equal((await snap()).story.exitReleased,true);await walk(0,6.7);await use('door',0,1.1,8.4);await advance(1.3);assert.equal((await snap()).story.doorOpen,true);await walk(0,10.3);const playTime=(await snap()).time;await advance(9.2);assert.equal((await snap()).mode,'ending');assert.equal((await snap()).story.ended,true);await photo('ending');
  console.log('PASS 5: disobedience and replacement ending, game seconds',playTime.toFixed(1));
  await p.click('#start');await p.waitForFunction(()=>!!document.pointerLockElement);const reset=await snap();assert.equal(reset.story.stage,0);assert.equal(reset.story.power,false);assert.equal(reset.story.hasKey,false);assert.equal(reset.story.echoIndex,0);assert.equal(reset.story.exitReleased,false);assert.equal(reset.story.doors.lounge,false);assert.equal(reset.pose.z,6.7);
  await p.keyboard.press('KeyF');await advance(.1);assert.equal((await snap()).flashlight,true);
  // All voices must decode non-silently, independent of narrative pacing in this fast test.
  const voices=await p.evaluate(async()=>{const lines=await(await fetch('assets/voice/lines.json')).json(),c=new AudioContext(),result={};try{for(const id of Object.keys(lines)){const r=await fetch('assets/voice/'+id+'.ogg');if(!r.ok)throw Error('Missing voice '+id);const b=await c.decodeAudioData(await r.arrayBuffer());if(!b.getChannelData(0).some(v=>Math.abs(v)>.01))throw Error('Silent voice '+id);result[id]=b.duration;}}finally{await c.close();}return result;});
  assert.equal(Object.keys(voices).length,15);assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  console.log(JSON.stringify({result:'PASS',stages:5,rooms:5,gameSeconds:playTime,voices:Object.keys(voices).length,screenshots:out,checks:['actual navigation and five room doors','fuse installation','normal/delayed/held reflection','bedroom key cannot bypass ending','diary and backward clock UI','phone and inversion','wrong-order recovery','reverse sound sequence','inventory','pause/audio','disobedience finale','full reset','flashlight','voice decoding']},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
