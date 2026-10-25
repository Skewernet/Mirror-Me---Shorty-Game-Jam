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
    page.on('console', m=>{if(m.type()==='error')errors.push(m.text());});
    page.on('requestfailed', r => failed.push(r.url()));
    await page.route('**/__unraveling__', route => route.fulfill({contentType:'text/html',body:
      '<!doctype html><link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script><style>body{margin:0}canvas{display:block}</style>'}));
    await page.goto(base+'/__unraveling__');
    const result = await page.evaluate(async () => {
      const T = await import('/vendor/three.module.js');
      const {buildHouse} = await import('/src/house.mjs');
      const {Story} = await import('/src/story.mjs');
      const {Mirror} = await import('/src/mirror.mjs');
      const {prepareRenderPrograms,prepareRenderTextures,warmProgramView,createProgramView}=await import('/src/performance.mjs');
      const {UNRAVELING_HANDS,unravelingFlickerAt} = await import('/src/house-unraveling.mjs');
      const scene = new T.Scene();scene.background = new T.Color(0x101417);scene.fog=new T.FogExp2(0x101417,.025);
      const house = await buildHouse(scene), art = house.unraveling;
      const originalColliders = house.colliders.map(c=>({...c})), originalCount = house.colliders.length;
      const {preloadCharacterAssets} = await import('/src/figure.mjs');
      await preloadCharacterAssets();
      const bakeStart=performance.now();await art.prepare();const cachedBakeMs=performance.now()-bakeStart;
      const prepared = art.snapshot();
      const state = new Story();state.stage=5;state.mirrorReady=true;state.power=true;state.clockSolved=true;state.radioSolved=true;state.doors.bedroom=true;state.doors.kitchen=true;state.doors.bathroom=true;
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
      renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
      document.body.append(renderer.domElement);
      const camera = new T.PerspectiveCamera(65,1280/720,.055,65);
      const mirror=new Mirror(scene,house);mirror.setQuality(720);
      player.pose=()=>({x:player.x,z:player.z,yaw:-Math.PI/2,pitch:0,speed:0,vx:0,vz:0,distance:0});
      let visualTime=64;
      const instanced=art.hands.children.find(o=>o.isInstancedMesh);
      // Future-room lights change the generated shader even when their
      // intensity iszero. Warm this instanced material in the actualstage5
      // house light configuration before its first primary/mirror reveal.
      player.x=7.15;player.z=0;camera.position.set(7.15,1.66,0);camera.lookAt(9.08,1.5,0);camera.updateMatrixWorld();
      art.update(30,.016,state,player,{encounterSeen:true});house.animate(30,.016,state,player);mirror.update(30,player,state,true);
      art.hands.visible=false;
      const programTarget=new T.WebGLRenderTarget(160,90,{type:T.HalfFloatType});renderer.setRenderTarget(programTarget);
      renderer.render(scene,camera);
      const normalPreparation=await prepareRenderPrograms(renderer,scene,camera,{target:programTarget,
        include:[instanced],exclude:[house.revelation.group,house.wake.group],onlyMeshes:[instanced]});
      const revelationView=createProgramView(scene,{include:[instanced,house.revelation.group],exclude:[house.wake.group],onlyMeshes:[instanced]});
      await prepareRenderTextures(renderer,normalPreparation.view);
      await warmProgramView(renderer,normalPreparation.view,camera,{target:programTarget});
      const beforeReveal=renderer.info.programs.length;
      art.hands.visible=true;renderer.render(scene,camera);
      const normalArmWarmup={meshes:normalPreparation.meshes,lights:normalPreparation.lights,revelationLights:revelationView.lights,
        instanceCount:normalPreparation.view.children.find(o=>o.isInstancedMesh)?.count,
        programsBeforeReveal:beforeReveal,programsAfterReveal:renderer.info.programs.length,
        customArmPrograms:renderer.info.programs.filter(p=>String(p.cacheKey).includes('unraveling-complete-arm-v1')).length};
      renderer.setRenderTarget(null);programTarget.dispose();

      window.renderArmMotion=(time,x=7.15)=>{
        player.x=x;player.z=0;camera.position.set(x,1.66,0);camera.lookAt(9.08,1.5,0);camera.updateMatrixWorld();
        art.update(time,.016,state,player,{encounterSeen:true});house.animate(time,.016,state,player);mirror.update(time,player,state,true);
        const attributes=()=>JSON.stringify([Array.from(instanced.instanceMatrix.array),...['armUpper','armLower','armHand','armMotion'].map(n=>Array.from(instanced.geometry.getAttribute(n).array))]);
        const before=attributes();renderer.render(scene,camera);
        return {sameData:before===attributes(),snapshot:art.snapshot(),draws:renderer.info.render.calls,triangles:renderer.info.render.triangles};
      };
      window.renderUnraveling=(name)=>{
        const views={hall:[[3.4,1.66,0],[8,1.6,0]],hands:[[6.7,1.66,0],[8.7,1.85,0]],
          lounge:[[-1.25,1.66,5.1],[-3.5,.75,4.5]],kitchen:[[2.4,1.66,-.85],[3.3,.7,-2.2]],
          entry:[[0,1.66,6.5],[0,1.6,.2]]};
        const [eye,target]=views[name];camera.position.fromArray(eye);camera.lookAt(...target);camera.updateMatrixWorld();
        visualTime+=.3;player.x=eye[0];player.z=eye[2];
        house.animate(visualTime,.1,state,player);art.update(visualTime,.1,state,player,{encounterSeen:true});mirror.update(visualTime,player,state,true);renderer.render(scene,camera);
      };
      const collidersUnchanged = originalCount===house.colliders.length && originalColliders.every((c,i)=>
        Object.entries(c).filter(([key])=>key!=='disabled').every(([key,value])=>house.colliders[i][key]===value));
      const generated = {meshes:0,triangles:0};art.group.traverse(o=>{if(o.isMesh){generated.meshes++;generated.triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);}});
      const motion=[];player.x=7.5;player.z=0;
      for(const t of [40,41,42,43,44,45]){art.update(t,.016,state,player,{encounterSeen:true});motion.push(art.snapshot().arms);}
      player.x=3.7;art.update(46,.016,state,player,{encounterSeen:true});const shallow=art.snapshot().arms;
      player.x=8.6;art.update(46.001,.001,state,player,{encounterSeen:true});const deep=art.snapshot().arms;
      const actualSurfaceIntersections=[];
      const geometry=instanced.geometry,pattr=geometry.getAttribute('position'),blendAttr=geometry.getAttribute('armBlend'),deltaAttr=geometry.getAttribute('armGripDelta');
      const eRest=new T.Vector3().fromArray(deep.restElbow),wRest=new T.Vector3().fromArray(deep.restWrist);
      const qa=new T.Quaternion(),qb=new T.Quaternion(),qc=new T.Quaternion(),worldMatrix=new T.Matrix4();
      const p=new T.Vector3(),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),e=new T.Vector3(),w=new T.Vector3(),delta=new T.Vector3();
      for(let arm=0;arm<UNRAVELING_HANDS.length;arm++){
        const spec=UNRAVELING_HANDS[arm],normal=new T.Vector3(...spec.normal),origin=new T.Vector3(...spec.at),bounds=new T.Box3();
        qa.fromArray(geometry.getAttribute('armUpper').array,arm*4);qb.fromArray(geometry.getAttribute('armLower').array,arm*4);qc.fromArray(geometry.getAttribute('armHand').array,arm*4);
        e.copy(eRest).applyQuaternion(qa);w.copy(wRest).sub(eRest).applyQuaternion(qb).add(e);
        worldMatrix.fromArray(instanced.instanceMatrix.array,arm*16);const grasp=geometry.getAttribute('armMotion').getX(arm);
        let minimum=Infinity,maximum=-Infinity;
        for(let vertex=0;vertex<pattr.count;vertex++){
          p.fromBufferAttribute(pattr,vertex);delta.fromBufferAttribute(deltaAttr,vertex);
          a.copy(p).applyQuaternion(qa).multiplyScalar(blendAttr.getX(vertex));
          b.copy(p).sub(eRest).applyQuaternion(qb).add(e).multiplyScalar(blendAttr.getY(vertex));
          c.copy(p).sub(wRest).addScaledVector(delta,grasp).applyQuaternion(qc).add(w).multiplyScalar(blendAttr.getZ(vertex));
          p.copy(a).add(b).add(c).applyMatrix4(worldMatrix);bounds.expandByPoint(p);
          const depth=delta.copy(p).sub(origin).dot(normal);minimum=Math.min(minimum,depth);maximum=Math.max(maximum,depth);
        }
        actualSurfaceIntersections.push({minimum,maximum,min:bounds.min.toArray(),max:bounds.max.toArray(),zone:spec.zone});
      }

      const sampledClearance=[];
      for(const x of [3.7,5.2,6.8,8.5])for(let j=0;j<12;j++){
        player.x=x;art.update(47+(x===3.7?0:x===5.2?12:x===6.8?24:36)*.16+j*.16,.016,state,player,{encounterSeen:true});
        sampledClearance.push(...art.snapshot().arms.armBounds.map(b=>({min:b.min,max:b.max,zone:b.zone})));
      }
      player.x=7.7;const cpuStart=performance.now();
      for(let i=0;i<1000;i++)art.update(55+i/1000,.001,state,player,{encounterSeen:true});
      const updateMeanMs=(performance.now()-cpuStart)/1000;
      const flickerSamples = ['bathroom','utility'].map(zone=>Array.from({length:3000},(_,i)=>unravelingFlickerAt(i*.01,zone)));
      art.reset();const reset=art.snapshot();art.update(57,.1,state,player,{encounterSeen:true});art.update(62,.1,state,player,{encounterSeen:true});
      window.renderUnraveling('hall');
      return {cachedBakeMs,prepared,beforeCrawler,emerged,disabled,lightingOff,disabledIntensity,absent,inverted,restored,reset,
        visibleBefore,normalArmWarmup,utilityCut,utilityRestored,motion,shallow,deep,actualSurfaceIntersections,sampledClearance,updateMeanMs,collidersUnchanged,generated,handSpecs:UNRAVELING_HANDS.length,
        flicker:flickerSamples.map(samples=>({min:Math.min(...samples),max:Math.max(...samples),off:samples.filter(x=>x===0).length})),
        warmupObjects:art.warmupObjects.length};
    });
    fs.writeFileSync(output+'/result.json',JSON.stringify(result,null,2));
    assert.equal(result.normalArmWarmup.meshes,1,'Normal-light preparation draws only the late arm mesh');
    assert.equal(result.normalArmWarmup.instanceCount,24,'Detached preparation retains all24instances');
    assert.equal(result.normalArmWarmup.revelationLights,result.normalArmWarmup.lights+1,'The revelation adds a shader-relevant pointlight');
    assert.equal(result.normalArmWarmup.programsAfterReveal,result.normalArmWarmup.programsBeforeReveal,'First ordinary-house primary/mirror arm reveal compiles zero new programs');
    assert.ok(result.normalArmWarmup.customArmPrograms>0,'Custom arm shader was actually prepared');
    assert.equal(result.prepared.ready,true);
    assert.equal(result.prepared.visible,false,'Preparing cannot expose late art during play');
    assert.equal(result.beforeCrawler.handsVisible,false,'Hands wait for final crawler');
    assert.equal(result.beforeCrawler.visible,true,'Dishevelment establishes the final loop first');
    assert.equal(result.emerged.handsVisible,true);assert.equal(result.emerged.handCount,24);assert.equal(result.emerged.armDraws,1);
    assert.ok(result.emerged.handTriangles>200,'Real source-rig hand geometry was baked');
    for(const b of result.emerged.handBounds){
      assert.ok(b.min[0]>2.7 && b.max[0]<8.95,'Arms leave mirror frame and hall entrance clear');
      if(b.zone==='ceiling')assert.ok(b.min[1]>1.88,'Ceiling arms clear player head height');
      else assert.ok(b.min[2]>.18||b.max[2]<-.18,'Wall arms leave the central capsule route clear');
      const distance=(a,c)=>Math.hypot(...a.map((x,i)=>x-c[i]));
      assert.ok(Math.abs(distance(b.shoulder,b.elbow)-result.emerged.arms.upperLength)<1e-6,'Shoulder to elbow length stays anatomical');
      assert.ok(Math.abs(distance(b.elbow,b.wrist)-result.emerged.arms.lowerLength)<1e-6,'Elbow to wrist length stays anatomical');
    }
    const delta=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
    assert.ok(result.motion.every(s=>s.armBounds.length===24),'All motion samples contain24fullyemergedarms');
    const moved=result.motion[0].armBounds.filter((b,i)=>result.motion.slice(1).some(s=>delta(b.elbow,s.armBounds[i].elbow)>.003));
    const grasped=result.motion[0].armBounds.filter((b,i)=>result.motion.slice(1).some(s=>Math.abs(b.grasp-s.armBounds[i].grasp)>.1));
    assert.equal(moved.length,24,'Every full arm bends continuously');assert.equal(grasped.length,24,'Every hand opens and grasps independently');
    const meanDepth=(s,zone)=>{const a=s.armBounds.filter(b=>b.zone===zone);return a.reduce((sum,b)=>sum+(zone==='wall'?.637-Math.abs(b.wrist[2]):2.32-b.wrist[1]),0)/a.length;};
    assert.ok(meanDepth(result.deep,'wall')-meanDepth(result.shallow,'wall')>.14,'Wall wrists extend visibly farther over the final approach');
    assert.ok(meanDepth(result.deep,'ceiling')-meanDepth(result.shallow,'ceiling')>.12,'Ceiling arms descend farther near the mirror');
    assert.equal(result.sampledClearance.length,48*24,'Every animated clearance sample contains24fullyemergedarms');
    for(const b of result.sampledClearance){
      assert.ok(b.min[0]>2.7&&b.max[0]<8.95,'Animated arms keep the glass plane clear');
      if(b.zone==='ceiling')assert.ok(b.min[1]>1.88,'Moving ceiling arms keep head clearance');
      else assert.ok(b.min[2]>.18||b.max[2]<-.18,'Moving wall arms keep capsule clearance');
    }
    assert.ok(result.actualSurfaceIntersections.every(a=>a.minimum<-.01&&a.maximum>.08),'Every complete arm crosses its actual wall/ceiling surface without a floating shoulder end');
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
    for(const [i,t] of [70,71.4,73].entries()){
      const view=await page.evaluate(t=>renderArmMotion(t),t);assert.equal(view.sameData,true,'Mirror pass preserves the exact primary-view instance pose');
      await page.screenshot({path:output+'/mirror-motion-'+i+'.png'});
    }
    assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
    fs.writeFileSync(output+'/result.json',JSON.stringify(result,null,2));
    console.log(JSON.stringify({result:'PASS',checks:['actual full-arm skin/sleeve extraction','late chapter and crawler gates','capsule/head/mirror clearance',
      '24articulated instances in one draw; sparse room flicker and comfort switches','no collider changes','all late meshes warmable','reset/inverted isolation'],
      normalArmWarmup:result.normalArmWarmup,cachedBakeMs:result.cachedBakeMs,updateMeanMs:result.updateMeanMs,generated:result.generated,handTriangles:result.emerged.handTriangles,errors,failed,output}));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
