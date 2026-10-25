// Render the game's own Mara assets into small, transparent title-mirror plates.
// This is an offline art build, not a second runtime renderer or a retouched image.
// Run a source HTTP server, then MIRROR_TEST_URL=http://127.0.0.1:8050 node tools/render_menu_portraits.cjs.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const base = (process.env.MIRROR_TEST_URL || 'http://127.0.0.1:8050').replace(/\/$/, '');
const out = process.env.MIRROR_PORTRAIT_OUTPUT || path.join(root, 'assets/art');
const proof = process.env.MIRROR_PORTRAIT_PROOF || '/tmp/mirror-menu-portraits';
fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(proof, { recursive: true });
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  const errors = [], failed = [];
  try {
    const page = await browser.newPage({ viewport: { width: 768, height: 1152 } });
    page.setDefaultTimeout(180000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('requestfailed', request => failed.push(request.url()));
    await page.route('**/__menu-portrait-render__', route => route.fulfill({ contentType: 'text/html',
      body: '<!doctype html><style>body{margin:0;background:#0c0d0d}canvas{display:block;width:768px;height:1152px}</style><link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>' }));
    await page.goto(base + '/__menu-portrait-render__');
    const rendered = await page.evaluate(async () => {
      const T = await import('three');
      const { preloadCharacterAssets, createFigure } = await import('/src/figure.mjs');
      const { RGBELoader } = await import('/vendor/RGBELoader.js');
      await preloadCharacterAssets();
      const scene = new T.Scene();
      const renderer = new T.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1); renderer.setSize(768, 1152);
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.09;
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
      document.body.append(renderer.domElement);
      const hdr = await new RGBELoader().loadAsync('/assets/materials/photographic/interior-reflections.hdr');
      hdr.mapping = T.EquirectangularReflectionMapping;
      const pmrem = new T.PMREMGenerator(renderer), environment = pmrem.fromEquirectangular(hdr);
      scene.environment = environment.texture;
      scene.add(new T.HemisphereLight(0xa3b0b5, 0x19100c, .28));
      const key = new T.SpotLight(0xffe7d2, 6, 4, .65, .72, 2);
      key.position.set(-.48, 1.94, -.88); key.target.position.set(0,1.55,0);
      key.castShadow = true; key.shadow.mapSize.set(1024,1024); key.shadow.normalBias=.002;
      scene.add(key,key.target);
      const fill = new T.PointLight(0x889da6, .54, 3, 2); fill.position.set(.48,1.61,-.55); scene.add(fill);
      const rim = new T.PointLight(0xb8c8d1, 1.8, 3, 2); rim.position.set(.35,1.85,.38); scene.add(rim);
      const camera = new T.PerspectiveCamera(32, 2/3, .045, 10);
      camera.position.set(0,1.62,-1.2); camera.lookAt(0,1.56,0); camera.updateMatrixWorld(true);
      const normal = createFigure(null,0), distorted = createFigure(null,0);
      scene.add(normal.body,distorted.body);
      for (const figure of [normal,distorted]) {
        figure.resetPose(); figure.animate(1.2,0,true,{distance:0,delta:1/60});
        figure.body.position.set(0,0,0); figure.body.rotation.set(0,0,0);
      }
      distorted.setHorror(1,0,{still:true});
      scene.updateMatrixWorld(true);
      const eyes = normal.body.getObjectByName('Mara_Eyes');
      eyes.computeBoundingBox();
      const eye = eyes.localToWorld(eyes.boundingBox.getCenter(new T.Vector3()));
      eye.project(camera);
      const result = { width:768,height:1152, eyeAnchor:[(eye.x+1)/2,(1-eye.y)/2], plates:[] };
      for (const [name,actor] of [['normal',normal],['distorted',distorted]]) {
        normal.body.visible=actor===normal; distorted.body.visible=actor===distorted;
        scene.updateMatrixWorld(true); await renderer.compileAsync(scene,camera);
        renderer.render(scene,camera);
        // Export directly from the render canvas. No photograph is edited or
        // composited: transparency, PBR materials and anatomy are the render.
        const encoded=renderer.domElement.toDataURL('image/webp',.87);
        if (!encoded.startsWith('data:image/webp;base64,')) throw Error('WebP export is unavailable.');
        const png=renderer.domElement.toDataURL('image/png');
        result.plates.push({name,encoded,png,programs:renderer.info.programs.length});
      }
      // A separate room plate puts the real house behind the same bust camera.
      // The UI can dim it independently, and missing glass can expose backing
      // without requiring a live scene or doubling the portrait textures.
      const { buildHouse } = await import('/src/house.mjs');
      const { Story } = await import('/src/story.mjs');
      const room = new T.Scene(); room.background = new T.Color(0x070a09);
      room.fog = new T.FogExp2(0x070a09,.08);
      const house = await buildHouse(room), state = new Story();
      state.power=true;house.reset(state);
      room.traverse(object=>{if(object.isReflector)object.visible=false;});
      camera.position.set(8.6,1.62,0);camera.lookAt(7.4,1.56,0);camera.updateMatrixWorld(true);
      renderer.toneMappingExposure=.58;
      room.updateMatrixWorld(true);await renderer.compileAsync(room,camera);renderer.render(room,camera);
      result.plates.push({name:'room',encoded:renderer.domElement.toDataURL('image/webp',.83),
        png:renderer.domElement.toDataURL('image/png'),programs:renderer.info.programs.length});
      result.camera={portraitPosition:[0,1.62,-1.2],portraitTarget:[0,1.56,0],fov:32,
        roomPosition:[8.6,1.62,0],roomTarget:[7.4,1.56,0],roomExposure:.58};
      renderer.dispose(); environment.dispose(); pmrem.dispose(); hdr.dispose();
      return result;
    });
    if(errors.length||failed.length)throw Error(JSON.stringify({errors,failed}));
    const metadata={
      title:'MIRROR ME — original title-mirror render plates',
      description:'Two transparent WebP portraits of the game\'s existing Mara model and actual mirror distortion, plus a matching dim actual-house underlay. The same camera and original staged lighting are rendered offline; no image generation, film likeness, retouching, extra human model or new external artwork is used.',
      generator:'tools/render_menu_portraits.cjs',width:rendered.width,height:rendered.height,eyeAnchor:rendered.eyeAnchor,camera:rendered.camera,
      sources:['assets/character/mara.glb','assets/character/inside-mouth-mask.jpg','assets/materials/photographic/interior-reflections.hdr',
        'assets/materials/photographic/wood-color.jpg','assets/materials/original/tactile-house-albedos.png',
        'src/figure.mjs','src/figure-motion.mjs','src/house.mjs','src/surfaces.mjs'],
      inputs:{},outputs:[],errors,failed,
    };
    for(const source of metadata.sources)metadata.inputs[source]=hash(fs.readFileSync(path.join(root,source)));
    for(const plate of rendered.plates){
      const bytes=Buffer.from(plate.encoded.split(',')[1],'base64'),file='menu-mara-'+plate.name+'.webp';
      fs.writeFileSync(path.join(out,file),bytes);
      fs.writeFileSync(path.join(proof,'menu-mara-'+plate.name+'.png'),Buffer.from(plate.png.split(',')[1],'base64'));
      metadata.outputs.push({file,bytes:bytes.length,sha256:hash(bytes)});
    }
    fs.writeFileSync(path.join(out,'menu-mara-sources.json'),JSON.stringify(metadata,null,2)+'\n');
    console.log(JSON.stringify({result:'PASS',width:metadata.width,height:metadata.height,eyeAnchor:metadata.eyeAnchor,outputs:metadata.outputs,errors,failed}));
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
