const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.MIRROR_TEST_URL||'http://127.0.0.1:8050';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try {
  const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/src/main.mjs',r=>r.fulfill({contentType:'text/javascript',body:''}));
  await p.addInitScript(()=>sessionStorage.setItem('mirror-me.intro.v1','acknowledged'));
  await p.goto(base);
  await p.evaluate(async()=>{
   const {createEndCredits,populateEndCredits}=await import('/src/end-credits.mjs');
   const data=await(await fetch('/assets/credits.json')).json();
   window.done=0; window.roll=createEndCredits(document.querySelector('#credits-roll'),()=>window.done++);
   populateEndCredits(document.querySelector('.credits-roll-track'),data);window.roll.start();
  });
  assert.equal(await p.locator('[data-asset-credit]').count(),15);
  for(const role of ['Creative Director','Script Writer','Head of Development'])assert.ok((await p.locator('#credits-roll').textContent()).includes(role));
  assert.equal(await p.locator('#credits-roll').getAttribute('open'),'');
  await p.locator('[data-roll-pause]').click();
  assert.equal(await p.evaluate(()=>document.querySelector('.credits-roll-track').getAnimations()[0].playState),'paused');
  await p.locator('[data-roll-pause]').click();
  assert.equal(await p.evaluate(()=>document.querySelector('.credits-roll-track').getAnimations()[0].playState),'running');
  await p.evaluate(()=>{const a=document.querySelector('.credits-roll-track').getAnimations()[0];a.currentTime=a.effect.getTiming().duration*.4;});
  await p.setViewportSize({width:390,height:844});
  const ratio=await p.evaluate(()=>{const a=document.querySelector('.credits-roll-track').getAnimations()[0];return a.currentTime/a.effect.getTiming().duration;});
  assert.ok(ratio>.39&&ratio<.42,'Resize preserves progress');
  assert.ok(await p.locator('[data-roll-skip]').evaluate(e=>{const b=e.getBoundingClientRect();return b.top>=0&&b.bottom<=innerHeight&&b.left>=0&&b.right<=innerWidth;}));
  await p.evaluate(()=>document.querySelector('.credits-roll-track').getAnimations()[0].finish());
  await p.waitForFunction(()=>window.done===1);
  assert.equal(await p.locator('#credits-roll').isVisible(),false);
  await p.evaluate(()=>window.roll.start());await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>window.done),2);
  await p.emulateMedia({reducedMotion:'reduce'});await p.evaluate(()=>window.roll.start());
  assert.equal(await p.locator('[data-roll-pause]').isVisible(),false);
  assert.equal(await p.evaluate(()=>document.querySelector('.credits-roll-track').getAnimations().length),0);
  await p.locator('.credits-roll-viewport').evaluate(e=>e.scrollTop=e.scrollHeight);
  assert.ok(await p.locator('.credits-roll-track footer').evaluate(e=>{const b=e.getBoundingClientRect();return b.bottom>0&&b.top<innerHeight;}));
  await p.locator('[data-roll-skip]').click();assert.equal(await p.evaluate(()=>window.done),3);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({result:'PASS',assets:15,checks:['named roles','pause/resume','resize','automatic completion','Escape/skip','reduced-motion manual scroll'],errors}));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
