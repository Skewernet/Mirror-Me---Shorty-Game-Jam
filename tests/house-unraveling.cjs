// Actual house/hand assets, chapter and comfort gates, clear mirror route.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.MIRROR_TEST_URL || 'http://127.0.0.1:8000';
const output = process.env.MIRROR_TEST_OUTPUT || '/tmp/mirror-house-unraveling';
fs.mkdirSync(output, {recursive: true});
(async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox', '--enable-unsafe-swiftshader']});
  const errors = [], failed = [];
  try {
    const page = await browser.newPage({viewport:{width:1280,height:720}});
    page.setDefaultTimeout(180000);
    page.on('pageerror', e => errors.push(e.message));
    page.on('requestfailed', r => failed.push(r.url()));
    await page.route('**/__unraveling__', route => route.fulfill({contentType:'text/html',body:
      '<!doctype html><link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script><style>body{margin:0}canvas{display:block}</style>'}));
    await page.goto(base+'/__unraveling__');
    const result = await page.evaluate(async () => {
      const T = await import('/vendor/three.module.js');
      const {buildHouse} = await import('/src/house.mjs');
      const {Story} = await import('/src/story.mjs');
      const {UNRAVELING_HANDS,unravelingFlickerAt} = await import('/src/house-unraveling.mjs');
      const scene = new T.Scene();scene.background = new T.Color(0x101417);
      const house = await buildHouse(scene), art = house.unraveling;
      const originalColliders = house.colliders.map(c=>({...c})), originalCount = house.colliders.length;
      const {preloadCharacterAssets} = await import('/src/figure.mjs');
      await preloadCharacterAssets();
      const bakeStart=performance.now();await art.prepare();const cachedBakeMs=performance.now()-bakeStart;
      const prepared = art.snapshot();
      const state = new Story();state.stage=5;state.power=true;state.clockSolved=true;state.radioSolved=true;state.doors.bedroom=true;state.doors.kitchen=true;state.doors.bathroom=true;
      const player = {x:4.2,z:0,yaw:-Math.PI/2,pitch:0};
      art.update(1,.016,state,player,{encounterSeen:false});
      const beforeCrawler = art.snapshot();
      art.update(2,.016,state,player,{encounterSeen:true});
      player.x=7.9;art.update(7,.016,state,player,{encounterSeen:true});
      const emerged = art.snapshot();
      const visibleBefore = art.group.visible;
      art.update(8,.016,state,player,{enabled:false,encounterSeen:true});
      const disabled = art.snapshot();
      art.update(9,.016,state,player,{enabled:true,flashes:false,encounterSeen:true});
      const lightingOff = art.lightingFactor(.12,state,'bathroom');
      const sample = new T.PointLight();sample.intensity=4;
      art.applyLighting(15.04,state,{bathroom:[sample]});
      const disabledIntensity = sample.intensity;
      const absent=[];
      for(const stage of [0,1,2,3,4,6]) {state.stage=stage;art.update(10+stage,.016,state,player,{encounterSeen:true});absent.push(art.snapshot());}
      state.stage=5;state.inverted=true;art.update(17,.016,state,player,{encounterSeen:true});const inverted=art.snapshot();
      state.inverted=false;art.update(18,.016,state,player,{encounterSeen:true});art.update(23,.016,state,player,{encounterSeen:true});
      const restored = art.snapshot();
      house.animate(12.6,.1,state,player);house.applyHorrorLighting();
      const utilityCut={intensity:house.lightingGroups.utility[0].intensity,bulbs:[]};
      scene.traverse(o=>{if(o.isMesh&&o.userData.lightCircuit==='utility'&&o.material.isMeshBasicMaterial)utilityCut.bulbs.push(o.material.color.getHex());});
      house.animate(13.1,.1,state,player);house.applyHorrorLighting();
      const utilityRestored={intensity:house.lightingGroups.utility[0].intensity,bulbs:[]};
      scene.traverse(o=>{if(o.isMesh&&o.userData.lightCircuit==='utility'&&o.material.isMeshBasicMaterial)utilityRestored.bulbs.push(o.material.color.getHex());});
      const renderer = new T.WebGLRenderer({antialias:false});renderer.setSize(1280,720);renderer.setPixelRatio(1);
      renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.13;
      document.body.append(renderer.domElement);
      const camera = new T.PerspectiveCamera(65,1280/720,.055,65);
      window.renderUnraveling=(name)=>{
        const views={hall:[[3.4,1.66,0],[8,1.6,0]],hands:[[6.7,1.66,0],[8.7,1.85,0]],
          lounge:[[-1.25,1.66,5.1],[-3.5,.75,4.5]],kitchen:[[2.4,1.66,-.85],[3.3,.7,-2.2]],
          entry:[[0,1.66,6.5],[0,1.6,.2]]};
        const [eye,target]=views[name];camera.position.fromArray(eye);camera.lookAt(...target);camera.updateMatrixWorld();
        house.animate(33,.1,state,player);art.update(33,.1,state,player,{encounterSeen:true});renderer.render(scene,camera);
      };
      window.renderUnraveling('hall');
      const collidersUnchanged = originalCount===house.colliders.length && originalColliders.every((c,i)=>
        Object.entries(c).filter(([key])=>key!=='disabled').every(([key,value])=>house.colliders[i][key]===value));
      const generated = {meshes:0,triangles:0};art.group.traverse(o=>{if(o.isMesh){generated.meshes++;generated.triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});
      const flickerSamples = ['bathroom','utility'].map(zone=>Array.from({length:3000},(_,i)=>unravelingFlickerAt(i*.01,zone)));
      art.reset();const reset=art.snapshot();art.update(24,.1,state,player,{encounterSeen:true});art.update(29,.1,state,player,{encounterSeen:true});
      return {cachedBakeMs,prepared,beforeCrawler,emerged,disabled,lightingOff,disabledIntensity,absent,inverted,restored,reset,
        visibleBefore,utilityCut,utilityRestored,collidersUnchanged,generated,handSpecs:UNRAVELING_HANDS.length,
        flicker:flickerSamples.map(samples=>({min:Math.min(...samples),max:Math.max(...samples),off:samples.filter(x=>x===0).length})),
        warmupObjects:art.warmupObjects.length};
    });
    fs.writeFileSync(output+'/result.json',JSON.stringify(result,null,2));
    assert.equal(result.prepared.ready,true);
    assert.equal(result.prepared.visible,false,'Preparing cannot expose late art during play');
    assert.equal(result.beforeCrawler.handsVisible,false,'Hands wait for final crawler');
    assert.equal(result.beforeCrawler.visible,true,'Dishevelment establishes the final loop first');
    assert.equal(result.emerged.handsVisible,true);assert.equal(result.emerged.handCount,8);
    assert.ok(result.emerged.handTriangles>200,'Real source-rig hand geometry was baked');
    for(let i=0;i<result.emerged.handBounds.length;i++){
      const b=result.emerged.handBounds[i];
      assert.ok(b.min[0]>3.3 && b.max[0]<8.8,'Hands leave mirror frame and entrance clear');
      if(i%2===1)assert.ok(b.min[1]>1.9,'Ceiling hands clear player head height');
      else assert.ok(b.min[2]>.24||b.max[2]<-.24,'Wall hands leave the central capsule route clear');
    }
    assert.equal(result.disabled.handsVisible,false);
    assert.equal(result.disabledIntensity,4,'Disabled flashes preserve practical lights');
    for(const absent of [...result.absent,result.inverted,result.reset])assert.equal(absent.visible,false);
    assert.equal(result.utilityCut.intensity,0);assert.ok(result.utilityCut.bulbs.length>0 && result.utilityCut.bulbs.every(v=>v===0),'Utility practical outage extinguishes its visible bulb too');
    assert.ok(result.utilityRestored.intensity>0&&result.utilityRestored.bulbs.every(v=>v!==0),'Utility circuit restores both light and fixture');
    assert.equal(result.collidersUnchanged,true,'No authored movement/collision geometry is changed');
    assert.ok(result.flicker.every(s=>s.min===0&&s.max===1&&s.off>0&&s.off<150),'Faulty room circuits have sparse irregular cuts');
    assert.ok(result.warmupObjects>=result.generated.meshes,'Every late mesh participates in background warmup');
    for(const view of ['hall','hands','lounge','kitchen','entry']){
      await page.evaluate(view=>renderUnraveling(view),view);
      await page.screenshot({path:output+'/'+view+'.png'});
    }
    assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
    fs.writeFileSync(output+'/result.json',JSON.stringify(result,null,2));
    console.log(JSON.stringify({result:'PASS',checks:['actual hand-rig bake','late chapter and crawler gates','capsule/head/mirror clearance',
      'sparse room flicker and comfort switches','no collider changes','all late meshes warmable','reset/inverted isolation'],
      cachedBakeMs:result.cachedBakeMs,generated:result.generated,handTriangles:result.emerged.handTriangles,errors,failed,output}));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
