// Layout/appearance fixture using the shipped DOM, settings and font assets.
// Game progression is verified separately by the integrated playthrough.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.MIRROR_TEST_URL || 'http://127.0.0.1:8000';
const output = process.env.MIRROR_TEST_OUTPUT || '/tmp/mirror-horror-ui';
fs.mkdirSync(output, { recursive: true });
const fixture = `
  import {initSettings} from '/src/settings.mjs';
  import {renderHorrorText,decorateHorrorText} from '/src/ui-text.mjs';
  window.fixtureSettings=initSettings();
  const ids=['menu','hud','pocket','inspect','radio-inspect','offering','credits','death-screen'];
  const byId=id=>document.getElementById(id);
  byId('start').disabled=false; byId('start').textContent='ENTER THE HOUSE';
  byId('fullscreen').disabled=false; byId('loading-status').textContent='';
  byId('items').innerHTML='<article class="item"><span class="item-symbol">◷</span><h3>Mum’s watch</h3><p>The second hand stopped in the bath. The room still holds the sound of rain.</p></article><article class="item"><span class="item-symbol">◐</span><h3>The diary</h3><p>She always wound the music box before the bath.<br>The radio would not stop talking.</p></article><article class="item"><span class="item-symbol">⌁</span><h3>Blue ribbon</h3><p>Once, Mum tied it around your wrist so she would not lose you in a crowd.</p></article>';
  byId('credit-list').innerHTML=Array.from({length:8},(_,index)=>'<article><h3>Asset '+(index+1)+'</h3><p>Original creator · Free asset license</p><a href="#license">Source</a> · <a href="#license">License</a><p>Adapted for MIRROR ME. The complete original attribution remains available here.</p></article>').join('');
  byId('ending-credit-names').innerHTML='<span class="ending-credit">Mara — Open-source character artists · <a href="#source">Source & license</a></span><span class="ending-credit">Fonts — Hubert & Fischer, NaN; Brian J. Bonislawsky · <a href="#source">Source & license</a></span>';
  window.showUiFixture=name=>{
    for(const id of ids)byId(id).hidden=true;
    byId('settings').open=false;
    byId('ending-credits').hidden=true;
    byId('start').textContent='ENTER THE HOUSE';byId('restart').hidden=true;
    byId('chapter').textContent='THE HOUSE THAT LEARNS';
    byId('description').innerHTML='Someone left the house awake.<br>Someone else is learning your way home.';
    if(name==='loading'){
      byId('menu').hidden=false;byId('start').disabled=true;
      byId('start').textContent='LOADING THE HOUSE…';byId('loading-status').textContent='Preparing the mirror…';
    }else{
      byId('start').disabled=false;byId('loading-status').textContent='';
      if(['menu','pause','settings','ending'].includes(name))byId('menu').hidden=false;
      else byId(name).hidden=false;
    }
    if(name==='pause'){
      byId('start').textContent='RETURN TO THE HOUSE';byId('restart').hidden=false;
      byId('chapter').textContent='THE HOUSE CAN WAIT';
    }
    if(name==='settings'){byId('settings').open=true;byId('settings-panel').scrollTop=0;}
    if(name==='ending'){
      byId('start').textContent='PLAY AGAIN';byId('chapter').textContent='THE CALL WAS YOURS';
      byId('description').textContent='No one else was in the room.';byId('ending-credits').hidden=false;
    }
    if(name==='hud'){
      byId('location').textContent='THE HALL';byId('inventory').textContent='TAB · 3 MEMORIES';
      renderHorrorText(byId('subtitle'),'MARA — “Mum kept the water running. Even after she died.”');
      renderHorrorText(byId('prompt'),'[ E ] LOOK INTO THE GLASS');byId('prompt').className='mirror-prompt';
      renderHorrorText(byId('hint'),'Something on the other side is holding its breath.');
    }
    decorateHorrorText(byId('items'));decorateHorrorText(byId('offering'));decorateHorrorText(byId('death-screen'));
  };
  window.uiFixtureReady=true;
`;

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  const errors = [], failures = [], layouts = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('requestfailed', request => failures.push(request.url()));
    await page.addInitScript(() => sessionStorage.setItem('mirror-me.intro.v1', 'acknowledged'));
    await page.route('**/src/main.mjs', route => route.fulfill({ contentType: 'text/javascript', body: fixture }));
    await page.goto(base + '/');
    await page.waitForFunction(() => window.uiFixtureReady && window.__mirrorIntro);
    const fonts = await page.evaluate(async () => {
      await Promise.all([document.fonts.load('60px "Mirror Dirt"'),document.fonts.load('17px "Mirror Type"')]);
      return document.fonts.check('60px "Mirror Dirt"') && document.fonts.check('17px "Mirror Type"');
    });
    assert.equal(fonts, true, 'Bundled horror fonts load locally');
    for (const viewport of [{width:1920,height:1080},{width:1280,height:720},{width:960,height:600},{width:800,height:600}]) {
      await page.setViewportSize(viewport);
      for (const view of ['menu','loading','pause','settings','hud','pocket','inspect','radio-inspect','offering','credits','death-screen','ending']) {
        await page.evaluate(view=>window.showUiFixture(view),view);
        await page.waitForTimeout(50);
        const metrics = await page.evaluate(view => {
          const id=['menu','loading','pause','settings','ending'].includes(view)?'menu':view;
          const element=document.getElementById(id), rect=element.getBoundingClientRect();
          const bounds=node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
          return {view,id,width:innerWidth,height:innerHeight,scrollOverflow:element.scrollWidth-element.clientWidth,
            bodyOverflow:document.documentElement.scrollWidth-innerWidth,
            screen:bounds(element),
            hud:view==='hud'?{rail:bounds(document.getElementById('hud-controls')),subtitle:bounds(document.getElementById('subtitle')),
              prompt:bounds(document.getElementById('prompt')),hint:bounds(document.getElementById('hint')),
              pointer:getComputedStyle(document.getElementById('hud-controls')).pointerEvents}:null,
            menu:['menu','loading','pause','ending'].includes(view)?{body:bounds(document.querySelector('.menu-body')),
              start:bounds(document.getElementById('start')),links:bounds(document.querySelector('.menu-links')),
              controls:bounds(document.querySelector('.quick-controls'))}:null,
            ending:view==='ending'?bounds(document.getElementById('ending-credits')):null,
            returnControl:view==='pocket'?bounds(document.querySelector('.pocket-help')):
              view==='credits'?bounds(document.getElementById('credits-close')):
              view==='settings'?bounds(document.getElementById('settings-close')):null};
        },view);
        await page.screenshot({path:output+`/${viewport.width}x${viewport.height}-${view}.png`});
        assert.ok(metrics.scrollOverflow<=1 && metrics.bodyOverflow<=1,`${view} must not overflow horizontally at ${viewport.width}`);
        assert.ok(metrics.screen.x>=0 && metrics.screen.y>=0 && metrics.screen.right<=viewport.width+1 && metrics.screen.bottom<=viewport.height+1);
        if(metrics.hud){
          const {rail,subtitle,prompt,hint}=metrics.hud;
          assert.equal(metrics.hud.pointer,'none','Control reminder never intercepts game input');
          assert.ok(subtitle.bottom<prompt.y,`Subtitles must clear mirror prompt at ${viewport.width}`);
          assert.ok(prompt.bottom<hint.y,`Mirror prompt must clear hints at ${viewport.width}`);
          assert.ok(hint.bottom<rail.y,`Hints must clear control keys at ${viewport.width}`);
          assert.ok(rail.x>=0 && rail.right<=viewport.width && rail.bottom<=viewport.height);
        }
        if(metrics.menu){
          assert.ok(metrics.menu.start.y>=metrics.menu.body.y && metrics.menu.start.bottom<=metrics.menu.body.bottom+1,`Play visible at ${viewport.width} ${view}`);
          assert.ok(metrics.menu.links.bottom<=metrics.menu.body.bottom+1,`Menu links visible without scrolling at ${viewport.width} ${view}`);
        }
        if(metrics.ending)assert.ok(metrics.ending.bottom<=metrics.menu.body.bottom+1,`Ending credits fit without a middle scrollbar at ${viewport.width}`);
        if(metrics.returnControl)assert.ok(metrics.returnControl.x>=0 && metrics.returnControl.y>=0 && metrics.returnControl.right<=viewport.width && metrics.returnControl.bottom<=viewport.height,`Return control stays visible on ${view} at ${viewport.width}`);
        layouts.push({viewport,view,scrollOverflow:metrics.scrollOverflow});
      }
    }
    assert.deepEqual(errors, []);assert.deepEqual(failures, []);
    console.log(JSON.stringify({result:'PASS',checks:['bundled horror fonts','four desktop/embed viewport sizes','12 screens per viewport',
      'no horizontal overflow','visible menu actions','subtitles/prompts/hints/controls do not overlap','HUD ignores pointer input'],screens:layouts.length,errors,failures,output}));
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
