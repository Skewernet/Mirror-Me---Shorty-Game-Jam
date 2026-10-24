const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = (process.env.MIRROR_TEST_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const out = process.env.MIRROR_TEST_OUTPUT || '/tmp/mirror-blood-ramblings';
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  const errors = [], failed = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 850 } });
    page.setDefaultTimeout(180000);
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('requestfailed', r => failed.push(r.url()));
    await page.route('**/__kitchen-frequency__', route => route.fulfill({ contentType: 'text/html',
      body: '<!doctype html><style>body{margin:0}</style><link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>' }));
    await page.goto(base + '/__kitchen-frequency__');
    const result = await page.evaluate(async () => {
      const T = await import('three');
      const { buildHouse } = await import('/src/house.mjs');
      const { Story } = await import('/src/story.mjs');
      const { BLOOD_RECIPES, bloodPatchGeometry } = await import('/src/blood-writing.mjs');
      const { clippedBloodGeometry } = await import('/src/blood-layout.mjs');
      const check = (condition, text) => { if (!condition) throw Error(text); };
      const start = performance.now();
      const scene = new T.Scene(), house = await buildHouse(scene), state = new Story();
      const clue = house.props.kitchenFrequency, hall = house.props.hallBlood;
      const player = { x: 2.1, z: -2.15, yaw: Math.PI / 2, pitch: 0, speed: 0 };
      const visible = object => { for (let p = object; p; p = p.parent) if (!p.visible) return false; return true; };
      state.power = true;
      check(clue.patches.length >= 85 && clue.markings.length === 13, 'Kitchen coverage is missing or not batched');
      check(clue.textures.length === 1 && hall.atlas.texture === clue.textures[0], 'Room art does not share one atlas');
      const texture = clue.textures[0], uuid = texture.uuid;
      check(texture.image.width === 2048 && texture.image.height === 2048, 'Unexpected texture budget');
      check(clue.atlas.stats.every(recipe => recipe.drips >= 6), 'A phrase lacks paint-connected gravity drips');
      const surfaces = new Set(clue.patches.map(patch => patch.surface || patch.wall));
      for (const expected of ['west','east','north','entry','cabinet','worktop','cupboard','fridge-door','fridge-freezer','fridge-side'])
        check(surfaces.has(expected), 'Missing blood surface: ' + expected);
      for (const [stage, clockSolved, kitchenVisible, hallVisible] of [
        [0,false,false,false],[1,true,false,false],[2,false,false,true],[2,true,true,true],
        [3,true,true,true],[4,true,true,true],[5,true,true,true],[6,true,true,true],
      ]) {
        state.stage = stage; state.clockSolved = clockSolved;
        house.animate(2 + stage, 1 / 60, state, player);
        check(clue.surfaceRoots.every(root => root.visible === kitchenVisible), 'Kitchen reveal/persistence mismatch at' + stage);
        check(hall.root.visible === hallVisible, 'Hall clue timing mismatch at' + stage);
      }
      const phrases = hall.snapshot().phrases.join(' ');
      check(!/03[:.]17|bathroom|clock|go to|set the|use the/i.test(phrases), 'Hall writing gives a direct puzzle instruction/answer');
      check(/water|bath/.test(phrases) && /hands|turning/.test(phrases), 'Hall writing lacks indirect water/time associations');
      state.stage = 2; state.clockSolved = true;
      house.animate(10, 1 / 60, state, player); scene.updateMatrixWorld(true);
      const occluders = house.occluders.filter(visible);
      const contacts = [], surfaceAxes={x:[2,1,0],y:[0,2,1],z:[0,1,2]};
      const canvasPixels=texture.image.getContext('2d').getImageData(0,0,2048,2048).data;
      const painted=uv=>canvasPixels[(Math.min(2047,Math.max(0,Math.floor((1-uv.y)*2048)))*2048+
        Math.min(2047,Math.max(0,Math.floor(uv.x*2048))))*4+3]>110;
      let checkedVertices=0,paintedContacts=0,paintedPatches=0;
      for(const patch of [...clue.patches,...hall.markings.map(mark=>({...mark,parent:hall.root,surface:'hall-wall'}))]){
        const geometry=clippedBloodGeometry(patch);
        const shape=geometry.index?geometry.toNonIndexed():geometry;
        const p=shape.attributes.position,uv=shape.attributes.uv;
        const normal=new T.Vector3(0,0,1).applyEuler(new T.Euler(patch.pitch||0,patch.yaw||0,0));
        const worldNormal=normal.clone().transformDirection(patch.parent.matrixWorld);
        const [uAxis,vAxis,normalAxis]=surfaceAxes[patch.surfaceAxis||'z'];
        for(let i=0;i<p.count;i++){
          const point=[p.getX(i),p.getY(i),p.getZ(i)];
          if(patch.clipZones)check(patch.clipZones.some(zone=>point[uAxis]>=zone.u0-2e-6&&point[uAxis]<=zone.u1+2e-6&&
            point[vAxis]>=zone.v0-2e-6&&point[vAxis]<=zone.v1+2e-6&&
            (zone.plane===undefined||Math.abs(point[normalAxis]-zone.plane)<2e-6)),
            'A tilted corner crossed its physical surface/aperture bounds: '+(patch.surface||patch.wall));
          const worldPoint=new T.Vector3(...point).applyMatrix4(patch.parent.matrixWorld);
          const within=(value,min,max)=>value>min+1e-5&&value<max-1e-5;
          if(patch.wall==='entry'&&worldPoint.y<2.08)check(!within(worldPoint.x,1.90,2.90),'Paint bridges the kitchen doorway');
          if(patch.wall==='north')check(!(within(worldPoint.x,1.97,3.33)&&within(worldPoint.y,1.02,2.105)),
            'Paint crossed the kitchen window/frame opening');
          if(patch.surface==='hall-wall'&&worldPoint.y<2.08){
            if(Math.abs(worldPoint.x+.637)<.008)check(!within(worldPoint.z,1.33,2.27)&&!within(worldPoint.z,4.60,5.60),'Hall paint bridges a west doorway');
            if(Math.abs(worldPoint.x-.637)<.008)check(!within(worldPoint.z,2.02,2.98),'Hall paint bridges the bathroom doorway');
            if(Math.abs(worldPoint.z+.637)<.008)check(!within(worldPoint.x,1.90,2.90)&&!within(worldPoint.x,6.91,7.89),'Hall paint bridges a north doorway');
            if(Math.abs(worldPoint.z-.637)<.008)check(!within(worldPoint.x,6.88,7.92),'Hall paint bridges the rear doorway');
          }
          checkedVertices++;
        }
        let patchContacts=0;
        for(let i=0;i<p.count;i+=3){
          const a=new T.Vector3().fromBufferAttribute(p,i),b=new T.Vector3().fromBufferAttribute(p,i+1),c=new T.Vector3().fromBufferAttribute(p,i+2);
          const ua=new T.Vector2().fromBufferAttribute(uv,i),ub=new T.Vector2().fromBufferAttribute(uv,i+1),uc=new T.Vector2().fromBufferAttribute(uv,i+2);
          // Corners, edge midpoints and a triangular interior grid cover actual
          // retained ink, including the far ends of large rotated attempts.
          for(const [wb,wc] of [[0,0],[1,0],[0,1],[.5,0],[0,.5],[.5,.5],[.2,.2],[.2,.6],[.6,.2]]){
            const wa=1-wb-wc;
            const sampleUV=ua.clone().multiplyScalar(wa).addScaledVector(ub,wb).addScaledVector(uc,wc);
            if(!painted(sampleUV))continue;
            const local=a.clone().multiplyScalar(wa).addScaledVector(b,wb).addScaledVector(c,wc);
            if(patch.wall==='west'&&!patch.primary)check(!(local.z>-2.88+1e-5&&local.z<-1.67-1e-5&&local.y>1.58+1e-5&&local.y<1.95-1e-5),
              'Overwriting obscures the primary station/decimal pocket');
            const position=local.applyMatrix4(patch.parent.matrixWorld);
            const ray=new T.Raycaster(position.clone().addScaledVector(worldNormal,.001),worldNormal.clone().negate(),0,.012);
            const hit=ray.intersectObjects(occluders,false)[0];
            check(hit&&hit.distance>=.0015&&hit.distance<=.008,
              'Retained painted edge floats off its physical surface: '+(patch.surface||patch.wall)+' at '+position.toArray()+' d='+hit?.distance);
            contacts.push({surface:patch.surface||patch.wall,gap:hit.distance-.001});
            paintedContacts++;patchContacts++;
          }
        }
        if(patchContacts)paintedPatches++;
        shape.dispose();if(shape!==geometry)geometry.dispose();
      }
      check(paintedPatches>=65&&paintedContacts>=220,'Dense geometry contains too little retained actual paint');
      const flows=new Map();
      for(const patch of clue.patches.filter(patch=>patch.flow&&patch.flow!=='overprint')){
        const geometry=bloodPatchGeometry(patch),points=geometry.attributes.position;
        const anchor=new T.Vector3().fromBufferAttribute(points,0).applyMatrix4(patch.parent.matrixWorld);
        geometry.dispose();
        const entries=flows.get(patch.flow)||[];entries.push(anchor);flows.set(patch.flow,entries);
      }
      const continuations=[...flows.values()].filter(entries=>entries.length>=2);
      check(continuations.length>=4,'Writing no longer continues across adjacent cabinet doors');
      for(const entries of continuations)check(entries.every(point=>point.distanceTo(entries[0])<1e-5),'A cabinet seam restarts or shifts the shared phrase');
      check(clue.surfaceRoots.slice(1).every(group => group.parent !== house.props.roomGroups.kitchen),
        'Appliance/cabinet art is detached from its prop');
      const targets = house.interactables.filter(item => item.id === 'station-clue');
      check(targets.length === 1 && targets[0].mesh === clue.primary && targets[0].range === 2.4, 'Primary clue target changed');
      const camera = new T.PerspectiveCamera(65, 1200/850, .055, 65);
      camera.position.set(player.x,1.64,player.z);camera.lookAt(clue.primary.getWorldPosition(new T.Vector3()));camera.updateMatrixWorld(true);
      const ray = new T.Raycaster();ray.setFromCamera(new T.Vector2(),camera);
      const first = ray.intersectObjects([clue.primary,...occluders],false)[0];
      check(first?.object === clue.primary && first.distance < 2.4, 'Primary station clue cannot be inspected');
      const pixels = texture.image.getContext('2d').getImageData(0,0,2048,2048).data;
      let darkestRed = 255, highAlpha = 0, lowerPaint = 0;
      for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
        const i = (y * 2048 + x) * 4;
        if (pixels[i+3] > 200) { darkestRed = Math.min(darkestRed,pixels[i]);highAlpha++;if(y>350)lowerPaint++; }
      }
      check(highAlpha > 10000 && darkestRed < 90 && lowerPaint > 30, `Primary mark is too faint or lacks its bleeding tail: ${JSON.stringify({highAlpha,darkestRed,lowerPaint})}`);
      check(pixels[3] === 0, 'Art has an opaque panel background');
      const renderer = new T.WebGLRenderer({ antialias: true });renderer.setSize(1200,850);
      renderer.outputColorSpace = T.SRGBColorSpace;renderer.toneMapping = T.ACESFilmicToneMapping;renderer.toneMappingExposure = 1.13;
      document.body.append(renderer.domElement);await renderer.compileAsync(scene,camera);
      window.drawBlood = view => {
        if(view==='primary'){camera.position.set(2.1,1.64,-2.15);camera.lookAt(.903,1.68,-2.24);}
        else if(view==='room'){camera.position.set(2.4,1.64,-1.05);camera.lookAt(2.7,1.25,-3.15);}
        else if(view==='fridge'){camera.position.set(2.85,1.54,-2.22);camera.lookAt(3.7,1.0,-1.37);}
        else if(view==='hall'){camera.position.set(0,1.64,6.6);camera.lookAt(-.64,1.4,3.5);}
        else if(view==='east'){camera.position.set(2.22,1.64,-2.28);camera.lookAt(4.49,1.35,-2.95);}
        else if(view==='cabinet'){camera.position.set(2.25,1.05,-2.17);camera.lookAt(2.9,.42,-3.96);}
        else if(view==='hall-water'){camera.position.set(-.09,1.64,4.1);camera.lookAt(.64,1.4,5.0);}
        camera.updateMatrixWorld(true);renderer.render(scene,camera);
      };
      window.bloodFixture={house,state,clue,hall,camera,renderer,scene};
      window.drawBlood('primary');
      house.reset(new Story());
      check(clue.surfaceRoots.every(group=>!group.visible)&&!hall.root.visible,'Reset leaves a blood marking behind');
      check(clue.textures[0].uuid===uuid,'Visibility regenerated the texture atlas');
      state.stage=6;state.clockSolved=true;state.inverted=true;house.animate(15,1/60,state,player);
      check(clue.root.visible&&clue.surfaceRoots.every(group=>visible(group)),'Truth chapter erased kitchen markings');
      state.stage=2;state.inverted=false;house.animate(16,1/60,state,player);
      return {status:'PASS',patches:clue.patches.length,drawMeshes:clue.markings.length,hallPatches:hall.markings.length,
        atlas:2048,recipeCount:BLOOD_RECIPES.length,surfaces:[...surfaces],contactSamples:paintedContacts,paintedPatches,checkedVertices,
        gapRange:[Math.min(...contacts.map(contact=>contact.gap)),Math.max(...contacts.map(contact=>contact.gap))],
        cabinetContinuations:continuations.length,primaryDistance:first.distance,
        atlasPaint:{highAlpha,lowerPaint,darkestRed},buildMilliseconds:performance.now()-start,
        checks:['hand-traced blood alphabet and connected drips','all kitchen surfaces','one shared atlas and batched geometry',
          'opaque painted edge contacts and whole-geometry extent bounds','cross-cabinet UV continuity','primary clue inspection','late-game persistence','indirect hallway hints','reset and texture reuse']};
    });
    for(const view of ['primary','room','fridge','hall','east','cabinet','hall-water']){
      await page.evaluate(view=>window.drawBlood(view),view);
      await page.screenshot({path:`${out}/${view}.png`,timeout:60000});
    }
    assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
    fs.writeFileSync(out+'/report.json',JSON.stringify({...result,errors,failed},null,2));
    console.log(JSON.stringify({...result,errors,failed}));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
