import * as T from 'three';
import {Player} from './player.mjs';
import {buildHouse} from './house.mjs';
import {Mirror} from './mirror.mjs';
import {Story,VOICES} from './story.mjs';
import {Sound} from './sound.mjs';
import {MIRROR,ROOMS,roomAt} from './layout.mjs';
const $=id=>document.getElementById(id),scene=new T.Scene();scene.background=new T.Color(0x101417);scene.fog=new T.FogExp2(0x101417,.025);
const camera=new T.PerspectiveCamera(67,innerWidth/innerHeight,.055,65);
let renderer;
try{renderer=new T.WebGLRenderer({antialias:false,powerPreference:'high-performance'});}catch(error){$('error').textContent='WebGL could not start. Try a desktop browser with hardware acceleration.';throw error;}
renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.13;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
renderer.domElement.setAttribute('aria-label','First-person view of the house');document.body.prepend(renderer.domElement);
let house;
try{house=await buildHouse(scene);}catch(error){$('error').textContent='A house asset could not load. Reload the page; if it persists, inspect the asset request.';throw error;}
const player=new Player(camera),mirror=new Mirror(scene,house),story=new Story(),ray=new T.Raycaster(),sound=new Sound(text=>$('subtitle').textContent=text);
let mode='title',active=false,target=null,elapsed=0,messageUntil=0,pending=[],arrival=false,endingAt=0,endingStart=0,endingSpoken=false,lateSpoken=false,commandSpoken=false,flashlightOn=false,hintUntil=0,apparitionStarted=false,apparitionSeen=0,apparitionDone=false,quality=720;
const testMode=new URLSearchParams(location.search).get('test')==='1';
const flashlight=new T.SpotLight(0xe2dfc5,0,13,Math.PI*.14,.7,1.8);flashlight.castShadow=false;flashlight.shadow.mapSize.set(768,768);flashlight.shadow.bias=-.0004;flashlight.shadow.normalBias=.025;scene.add(flashlight,flashlight.target);
function say(text,duration=4){$('message').textContent=text;messageUntil=elapsed+duration;}
function queueVoice(id,delay=0){if(VOICES[id]&&!pending.some(q=>q.id===id))pending.push({id,at:elapsed+delay});}
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();const h=Math.min(quality,innerHeight);renderer.setSize(Math.round(h*camera.aspect),h,false);}resize();window.addEventListener('resize',resize);
function setText(element,text){$(element).textContent=text;}
function updateInventory(){
 const count=Number(story.hasNote)+Number(story.hasFuse)+Number(story.hasKey)+Number(story.hasDiary)+Number(story.hasTimeClue);
 $('inventory').textContent=count?'TAB · '+count+' MEMORIES':'';
 const cards=[];
 const item=(title,text,symbol='⌑')=>cards.push(`<article class="item"><div class="item-symbol">${symbol}</div><h3>${title}</h3><p>${text}</p></article>`);
 if(story.hasNote)item('The folded note','IF THE HALL RETURNS, WATCH THE GLASS.<br><br>WHEN IT LEADS, YOU LEAVE.<br><br>I know this handwriting.');
 if(story.hasFuse)item('Ceramic fuse','A spare from the kitchen. The utility room has a fuse box.','▥');
 if(story.power)item('The lights are on','The fuse is installed. The house is awake.','◉');
 if(story.hasKey)item('Bedroom key','A small brass key from the hall drawer. Its tag reads BEDROOM.','⚿');
 if(story.hasDiary)item('A page from the diary','“Every night: the radio first. Then running water. Then the lullaby.<br><br>I wrote the hour on the bathroom glass. I cannot read it from this side.<br><br>What came first must be last.”');
 if(story.hasTimeClue)item('Writing in the steam','71:30<br><br>A reflection of a time. Read it from the other end.','◷');
 if(story.stage===3)item('The sounds','Radio → water → lullaby.<br><br>Silence them in reverse order.<br>Quiet: '+story.echoIndex+' / 3.','◌');
 if(story.stage===4)item('The last instruction','It wants me to come closer.<br><br>The folded note says: when it leads, you leave.','↶');
 $('items').innerHTML=cards.join('')||'<article class="item"><h3>Nothing yet.</h3><p>The telephone is speaking in the sitting room. Start there.</p></article>';
}
function reset(){
 story.reset();player.reset();mirror.reset();sound.reset();elapsed=messageUntil=endingAt=endingStart=0;pending=[];target=null;arrival=lateSpoken=commandSpoken=endingSpoken=apparitionStarted=apparitionDone=false;apparitionSeen=0;hintUntil=0;flashlightOn=false;flashlight.intensity=0;house.reset(story);$('veil').classList.remove('closing');$('message').textContent=$('subtitle').textContent=$('prompt').textContent='';$('title').innerHTML='MIRROR<span>ME</span>';$('description').innerHTML='Someone left the house awake.<br>Someone else is learning your way home.';$('chapter').textContent='THE HOUSE THAT LEARNS';mode='title';updateInventory();
}
function showMenu(){
 active=false;player.clear();sound.pause();$('pocket').hidden=$('inspect').hidden=true;$('menu').hidden=false;$('hud').hidden=true;
 if(mode==='ending'){$('chapter').textContent='YOU KNOW WHICH SIDE YOU ARE ON NOW';$('title').innerHTML='THE OTHER<span>SIDE</span>';$('description').textContent='You watched someone leave in your body. In the glass, the house is finally quiet.';$('start').textContent='PLAY AGAIN';$('restart').hidden=true;}
 else if(mode!=='title'){mode='paused';$('start').textContent='RETURN TO THE HOUSE';$('restart').hidden=false;$('chapter').textContent='THE HOUSE CAN WAIT';}
 $('start').focus({preventScroll:true});
}
async function enter(){
 $('error').textContent='';if(mode==='ending')reset();
 try{await sound.start();}catch{$('error').textContent='Audio could not start. You can still play with subtitles.';}
 try{await renderer.domElement.requestPointerLock();}catch{showMenu();$('error').textContent='Mouse capture was refused. Click RETURN again. Progress is kept.';}
}
function pocket(){if(mode==='pocket'){enter();return;}if(!active)return;mode='pocket';active=false;player.clear();sound.pause();updateInventory();$('pocket').hidden=false;$('hud').hidden=true;document.exitPointerLock();}
function clock(){mode='clock';active=false;player.clear();sound.pause();$('inspect').hidden=false;$('hud').hidden=true;$('clock-hour').value=story.clockHour||12;$('clock-minute').value=String(story.clockMinute).padStart(2,'0');document.exitPointerLock();$('clock-hour').focus();}
$('clock-form').addEventListener('submit',e=>{e.preventDefault();const event=story.setClock($('clock-hour').value,$('clock-minute').value);$('inspect').hidden=true;enter().then(()=>respond(event));});
$('clock-back').onclick=()=>{$('inspect').hidden=true;enter();};
$('start').disabled=false;$('start').textContent='ENTER THE HOUSE';$('start').onclick=enter;$('restart').onclick=()=>{reset();enter();};
$('sensitivity').oninput=e=>player.sensitivity=Number(e.target.value);$('bob').onchange=e=>player.bob=e.target.checked;$('volume').oninput=e=>sound.setVolume(Number(e.target.value));$('voice').onchange=e=>sound.setVoice(e.target.checked);
$('quality').onchange=e=>{quality=Number(e.target.value);renderer.shadowMap.enabled=quality>=720;flashlight.castShadow=flashlightOn&&quality>=720;resize();};$('brightness').oninput=e=>renderer.toneMappingExposure=Number(e.target.value);$('grain').onchange=e=>$('veil').classList.toggle('clean',!e.target.checked);
document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement===renderer.domElement){mode='playing';active=true;$('menu').hidden=$('pocket').hidden=$('inspect').hidden=true;$('hud').hidden=false;player.clear();if(!arrival){arrival=true;queueVoice('arrival',.8);say('A voice is speaking somewhere in the house.',4);}}else if(!['pocket','clock'].includes(mode))showMenu();});
document.addEventListener('pointerlockerror',()=>{showMenu();$('error').textContent='Mouse capture was refused. Click RETURN again.';});
window.addEventListener('blur',()=>{player.clear();if(document.pointerLockElement)document.exitPointerLock();});document.addEventListener('visibilitychange',()=>{if(document.hidden){player.clear();if(document.pointerLockElement)document.exitPointerLock();}});
document.addEventListener('mousemove',e=>{if(active&&!endingAt)player.look(e.movementX,e.movementY);});
document.addEventListener('keydown',e=>{
 if(e.code==='Tab'&&(active||mode==='pocket')){e.preventDefault();if(!e.repeat&&!endingAt)pocket();return;}
 if(['pocket','clock'].includes(mode)&&e.code==='Escape'){showMenu();return;}
 if(!active)return;if(e.code==='Escape'){document.exitPointerLock();return;}if(endingAt)return;
 if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();player.keys.add(e.code);
 if(e.code==='KeyF'&&!e.repeat){flashlightOn=!flashlightOn;flashlight.castShadow=flashlightOn&&quality>=720;sound.effect('switch');}
 if(e.code==='KeyH'&&!e.repeat){hintUntil=elapsed+8;say(story.hint(),5);}
 if(e.code==='KeyE'&&!e.repeat){target=findTarget();if(target)interact(target.id);}
});document.addEventListener('keyup',e=>player.keys.delete(e.code));
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();active=false;player.clear();sound.pause();if(document.pointerLockElement)document.exitPointerLock();showMenu();$('start').disabled=true;$('error').textContent='The graphics context was lost. Reload to restart the house.';});
function visibleInTree(object){for(let p=object;p;p=p.parent)if(!p.visible)return false;return true;}
function findTarget(){
 scene.updateMatrixWorld(true);ray.setFromCamera(new T.Vector2(0,0),camera);
 const items=house.interactables.filter(i=>(i.id!=='note'||!story.hasNote)&&(i.id!=='fuse'||(!story.hasFuse&&!story.power))&&visibleInTree(i.mesh));
 const hit=ray.intersectObjects([...new Set([...items.map(i=>i.mesh),...house.occluders.filter(visibleInTree)])],false)[0];if(!hit)return null;
 for(let object=hit.object;object;object=object.parent){const id=object.userData.interactionId;if(id)return items.find(i=>i.id===id&&hit.distance<=i.range)||null;}
 return items.find(i=>i.mesh===hit.object&&hit.distance<=i.range)||null;
}
function interact(id){
 if(id.startsWith('room-')){const d=house.roomDoors[id.slice(5)];if(story.doors[id.slice(5)]&&Math.abs(player.x-d.x)<.45&&Math.abs(player.z-d.z)<d.width*.65){say('Take a step away from the doorway first.',2);return;}}
 const event=story.interact(id);if(event)respond(event);updateInventory();
}
function respond(event){
 sound.effect(event);
 const lines={
  note:'“If the hall returns, watch the glass. When it leads, you leave.”',
  'arrival-recording':'The recording mentions a spare fuse by the kitchen sink.',
  'radio-static':'A voice caught beneath the static.', 'radio-time':'The line is dead. The hands of the clock are not.',
  fuse:'A spare ceramic fuse. The utility room is at the far end of the return passage.',
  'panel-empty':'One fuse is missing. Someone left its outline in the dust.', 'panel-on':'Power is restored. Every switch is on.',
  power:'The lights come on. Something else wakes up.',
  'mirror-first':'The room behind you. Your face. Everything in its place.', 'mirror-late':'You move. It remembers how, a moment later.',
  'mirror-held':'The drawer beside the glass. Something is inside it now.', 'mirror-command':'When it leads, you leave.',
  'drawer-open':story.keyAvailable&&!story.hasKey?'Something small catches the light. [ E ] TAKE KEY':'Only dust. A shape where a key used to lie.',
  key:'A small brass key. The tag reads BEDROOM.',
  'bedroom-locked':'Locked. The key is small; it must be nearby.',
  diary:'“Radio. Water. A lullaby. What came first must be last. I wrote the hour on the bathroom glass.”',
  'diary-repeat':'The diary remembers: radio, water, lullaby. Last sound first.',
  'bath-clouded':'The glass is cold and dry. There is nothing to wipe away yet.',
  'time-clue':'71:30. A time, written backward in the steam.',
  'clock-set':'You leave the hands where you put them. The house waits.', 'clock-solved':'A latch clicks inside the clock. A telephone starts ringing.',
  call:'Last sound first. The diary remembers the order.',
  musicbox:'A few notes turn in the little wooden box.',tap:'Water runs into an empty basin.',
  photo:'A family. The room is familiar.', 'photo-changed':'The same room. Three places left empty.',
  'echo-silenced':'One sound stops. The others seem farther away.', 'house-quiet':'Nothing. For the first time, nothing.',
  'wrong-order':'That was not the last sound. The house begins again.', 'already-quiet':'It is already quiet.',
  locked:'The front door will not move.', 'door-wait':'The glass is giving you an instruction. Remember the folded note.',
  unlocked:'The latch gives way. Someone has opened it from the other side.',
  released:'You turn away. Behind you, a latch releases.'
 };
 if(event==='note')house.note.visible=false;
 if(event==='clock'){clock();return;}
 if(lines[event])say(lines[event],['diary','note','time-clue'].includes(event)?7:4);
 const voiced={'arrival-recording':'recording',power:'power',key:'key',diary:'diary','time-clue':'time',call:'call','mirror-command':'command',unlocked:'unlocked',released:'released'};
 if(voiced[event])queueVoice(voiced[event],.35);
 if(event==='room-open'||event==='room-close')sound.effect('door-wood');
 if(event==='power')hintUntil=elapsed+5;
}
function finish(){if(story.ended)return;story.ended=true;endingAt=0;mode='ending';active=false;player.clear();pending=[];sound.stopVoice();$('veil').classList.remove('closing');document.exitPointerLock();showMenu();}
function beginEnding(){endingStart=elapsed;endingAt=elapsed+9;pending=[];player.clear();house.endingGlass.visible=true;say('Someone leaves. You don’t.',6);sound.effect('glass');}
function updateFlashlight(dt){
 const direction=new T.Vector3();camera.getWorldDirection(direction);flashlight.position.copy(camera.position).add(new T.Vector3(.07,-.14,0).applyQuaternion(camera.quaternion));flashlight.target.position.copy(camera.position).addScaledVector(direction,10);flashlight.intensity=T.MathUtils.damp(flashlight.intensity,flashlightOn?19:0,12,dt);
}
function apparition(dt){
 if(story.stage!==2){mirror.replacement.body.visible=false;return;}if(apparitionDone)return;
 const inRoom=roomAt(player.x,player.z)==='bedroom',position=new T.Vector3(6.25,1.5,7.27),direction=new T.Vector3();camera.getWorldDirection(direction);const looking=direction.dot(position.sub(camera.position).normalize())>.87;
 if(inRoom&&!apparitionStarted&&!looking){apparitionStarted=true;mirror.replacement.body.visible=true;mirror.replacement.body.position.set(6.25,0,7.28);mirror.replacement.body.rotation.y=0;}
 if(apparitionStarted&&looking)apparitionSeen+=dt;
 if(apparitionSeen>.65&&!looking){apparitionDone=true;mirror.replacement.body.visible=false;sound.effect('behind');}
}
function update(dt){
 if(!active)return;elapsed+=dt;
 if(endingAt){
  const t=elapsed-endingStart;const angle=Math.atan2(Math.sin(-player.yaw),Math.cos(-player.yaw));player.yaw+=angle*(1-Math.exp(-dt*2.2));player.pitch=T.MathUtils.damp(player.pitch,0,3,dt);player.syncCamera();mirror.finale(t);house.animate(elapsed,dt,story,player);sound.update({stage:4,frozen:true},player);if(t>2.6&&!endingSpoken){endingSpoken=true;sound.voice('ending');}if(t>4)$('veil').classList.add('closing');updateFlashlight(dt);if(elapsed>=endingAt)finish();return;
 }
 player.update(dt,house.colliders);const room=roomAt(player.x,player.z),visit=story.visit(room);if(visit&&story.stage===0&&room==='bathroom')sound.effect('drip');
 const looking=mirror.looking(player,camera),distance=Math.hypot(player.x-MIRROR.x,player.z-MIRROR.z),near=player.x>-1.64&&player.x<1.65&&distance<4;
 for(const event of story.observe(dt,looking,near,distance,player.speed>.15)){
  if(event==='held'){sound.stopVoice();pending=[];}
  if(event==='returned'){sound.effect('key');say('You left. It stayed.',4);queueVoice('returned',2.8);}
  if(event==='released')respond(event);
 }
 const transition=story.traverse(player.x,player.z);
 if(transition&&transition!=='incomplete-pass'){
  house.setStage(story.stage);hintUntil=elapsed+4;
  if(story.stage===1){say('Something has changed. It happened while you were away.',4);queueVoice('repeat',2);sound.effect('knock');}
  if(story.stage===2){say('There is writing on the bathroom glass now.',4);sound.effect('drip');}
  if(story.stage===3){queueVoice('inverted',1.2);say('The other side of the same house.',4);}
  if(story.stage===4){say('There is only one instruction left to disobey.',5);}
  updateInventory();
 }else if(transition==='incomplete-pass'){say(story.hint(),5);hintUntil=elapsed+7;}
 if(story.stage===1&&story.secondSeen>.8&&!lateSpoken){lateSpoken=true;queueVoice('late',.3);}
 if(story.stage===4&&looking&&!commandSpoken){commandSpoken=true;queueVoice('command',.7);}
 mirror.update(elapsed,player,story,looking);house.animate(elapsed,dt,story,player);apparition(dt);updateFlashlight(dt);
 sound.step(player.distance,player.speed,room!=='bathroom'&&room!=='kitchen'&&room!=='utility');sound.update(story,player);
 const ready=pending.findIndex(q=>q.at<=elapsed);if(ready>=0&&!sound.busy){const[line]=pending.splice(ready,1);sound.voice(line.id);}
 target=findTarget();let label=target?.label||'';
 if(target?.id==='drawer'&&story.drawerOpen)label=story.keyAvailable&&!story.hasKey?'TAKE BEDROOM KEY':'CLOSE DRAWER';
 if(target?.id.startsWith('room-')){const id=target.id.slice(5);label=(story.doors[id]?'CLOSE ':'OPEN ')+(ROOMS.find(r=>r.id===id)?.name||id);}
 if(target?.id==='panel')label=story.power?'INSPECT RESTORED POWER':story.hasFuse?'INSTALL CERAMIC FUSE':'INSPECT FUSE BOX';
 if(target?.id==='radio'&&story.stage===3)label='SILENCE RADIO';if(target?.id==='tap'&&story.stage===3)label='TURN OFF TAP';if(target?.id==='musicbox'&&story.stage===3)label='CLOSE MUSIC BOX';
 if(target?.id==='door')label=story.doorOpen?'THE WAY OUT':story.exitReleased?'OPEN FRONT DOOR':'TRY FRONT DOOR';
 $('prompt').textContent=label?'[ E ] '+label:'';$('cross').classList.toggle('active',!!target);
 $('location').textContent=ROOMS.find(r=>r.id===room)?.name||(story.stage>=3?'THE OTHER HALL':'THE HALL');
 $('hint').textContent=elapsed<hintUntil?story.hint():elapsed<12?'F · LIGHT     TAB · REMEMBER     H · A THOUGHT':'';
 if(elapsed>messageUntil)$('message').textContent='';if(story.doorOpen&&player.z>10.25)beginEnding();
}
let previous=performance.now(),firstFrame=true;function tick(now){requestAnimationFrame(tick);const dt=Math.min((now-previous)/1000,.05);previous=now;if(!testMode){update(dt);renderer.render(scene,camera);}else if(firstFrame){renderer.render(scene,camera);firstFrame=false;}}requestAnimationFrame(tick);
if(testMode){
 const snapshot=()=>({mode,active,time:elapsed,pose:player.pose(),speed:player.speed,story:JSON.parse(JSON.stringify(story)),target:target?.id||null,body:{x:mirror.body.position.x,z:mirror.body.position.z,yaw:mirror.body.rotation.y,headYaw:mirror.head.rotation.y,visible:mirror.body.visible},audio:sound.context?.state,doorAngle:house.doorPivot.rotation.y,flashlight:flashlightOn,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles});
 window.__mirror={snapshot,render(){renderer.render(scene,camera);},advance(seconds){for(let t=0;t<seconds;t+=1/60)update(Math.min(1/60,seconds-t));return snapshot();},pose(x,z,yaw=0,pitch=0){player.x=x;player.z=z;player.yaw=yaw;player.pitch=pitch;player.clear();player.syncCamera();return snapshot();},face(yaw,pitch=0){player.yaw=yaw;player.pitch=pitch;player.syncCamera();},reset,colliders:house.colliders,targets:house.interactables.map(i=>({id:i.id,position:i.mesh.getWorldPosition(new T.Vector3()).toArray()}))};
}
house.reset(story);updateInventory();
