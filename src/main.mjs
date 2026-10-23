import * as T from 'three';
import {Player} from './player.mjs';
import {buildHouse} from './house.mjs';
import {Mirror} from './mirror.mjs';
import {Story} from './story.mjs';
import {Sound} from './sound.mjs';

const $=id=>document.getElementById(id),scene=new T.Scene();
scene.background=new T.Color(0x101611);scene.fog=new T.FogExp2(0x101611,.028);
const camera=new T.PerspectiveCamera(68,innerWidth/innerHeight,.06,45);
let renderer;
try{renderer=new T.WebGLRenderer({antialias:false,powerPreference:'high-performance'});}
catch(error){$('error').textContent='WebGL could not start. Try a desktop browser with hardware acceleration.';throw error;}
renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.13;
renderer.domElement.setAttribute('aria-label','First-person view of the house');document.body.prepend(renderer.domElement);
const house=buildHouse(scene),player=new Player(camera),mirror=new Mirror(scene,house),story=new Story(),ray=new T.Raycaster();
const sound=new Sound(text=>$('subtitle').textContent=text);
let mode='title',active=false,target=null,elapsed=0,messageUntil=0,lateSpoken=false,pending=[],arrival=false,endingAt=0;
const testMode=new URLSearchParams(location.search).get('test')==='1';

function say(text,duration=4){$('message').textContent=text;messageUntil=elapsed+duration;}
function queueVoice(id,delay=0){pending.push({id,at:elapsed+delay});}
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();const h=Math.min(432,innerHeight);renderer.setSize(Math.round(h*camera.aspect),h,false);}
resize();window.addEventListener('resize',resize);
function updateInventory(){
  $('inventory').textContent=story.hasKey?'BRASS KEY · TAB':story.hasNote?'FOLDED NOTE · TAB':'';
  const cards=[];
  if(story.hasNote)cards.push('<article class="item"><div class="item-symbol">⌑</div><h3>Folded note</h3><p>IF THE HALL RETURNS,<br>WATCH THE GLASS.<br><br>WAIT FOR IT TO MOVE.<br>THEN LOOK AWAY.</p><p>The handwriting looks familiar.</p></article>');
  if(story.hasKey)cards.push('<article class="item"><div class="item-symbol">⚿</div><h3>Brass key</h3><p>A small key, warm as skin. The tag reads “FRONT”.</p><p>'+ (story.doorOpen?'The lock accepted it.':'Try it in the front door. E uses it automatically.') +'</p></article>');
  $('items').innerHTML=cards.join('')||'<article class="item"><h3>Nothing.</h3><p>You came here empty-handed.<br>Or the house made sure of it.</p></article>';
}
function reset(){
  story.reset();player.reset();mirror.reset();sound.reset();elapsed=0;messageUntil=0;lateSpoken=false;pending=[];target=null;arrival=false;endingAt=0;$('veil').classList.remove('closing');
  house.setStage(0);house.doorPivot.rotation.y=0;house.doorCollider.disabled=false;house.drawerSlide.position.x=-.32;house.key.visible=false;house.exitLight.intensity=0;house.note.visible=true;
  $('message').textContent='';$('subtitle').textContent='';$('prompt').textContent='';$('title').innerHTML='MIRROR<span>ME</span>';
  $('description').innerHTML='You know the way home.<br>So does something else.';$('chapter').textContent='A SHORT PSYCHOLOGICAL HORROR EXPERIENCE';
  mode='title';updateInventory();house.animate(0,0,story);
}
function showMenu(){
  active=false;player.clear();sound.pause();$('pocket').hidden=true;$('menu').hidden=false;$('hud').hidden=true;
  if(mode==='ending'){
    $('chapter').textContent='END OF THE FIRST ENCOUNTER';$('title').innerHTML='YOUR<span>TURN</span>';
    $('description').textContent='Somewhere behind you, a reflection leaves the glass. You are still in the house.';
    $('start').textContent='PLAY AGAIN';$('restart').hidden=true;
  }else if(mode!=='title'){
    mode='paused';$('start').textContent='RETURN TO THE HOUSE';$('restart').hidden=false;$('chapter').textContent='THE HOUSE CAN WAIT';
  }
  $('start').focus({preventScroll:true});
}
async function enter(){
  $('error').textContent='';
  if(mode==='ending')reset();
  try{await sound.start();}catch{$('error').textContent='Audio could not start. You can still play with subtitles.';}
  try{await renderer.domElement.requestPointerLock();}
  catch{showMenu();$('error').textContent='Mouse capture was refused. Click RETURN again. Your progress is kept.';}
}
function pocket(){
  if(mode==='pocket'){enter();return;}
  if(!active)return;
  mode='pocket';active=false;player.clear();sound.pause();updateInventory();
  $('pocket').hidden=false;$('hud').hidden=true;document.exitPointerLock();
}
$('start').disabled=false;$('start').textContent='ENTER THE HOUSE';
$('start').addEventListener('click',enter);
$('restart').addEventListener('click',()=>{reset();enter();});
$('sensitivity').oninput=e=>player.sensitivity=Number(e.target.value);
$('bob').onchange=e=>player.bob=e.target.checked;
$('volume').oninput=e=>sound.setVolume(Number(e.target.value));
$('voice').onchange=e=>sound.setVoice(e.target.checked);
document.addEventListener('pointerlockchange',()=>{
  if(document.pointerLockElement===renderer.domElement){
    mode='playing';active=true;$('menu').hidden=true;$('pocket').hidden=true;$('hud').hidden=false;player.clear();
    if(!arrival){arrival=true;queueVoice('arrival',1);say('The front door is locked. Follow the hallway.',5);}
  }else if(mode!=='pocket')showMenu();
});
document.addEventListener('pointerlockerror',()=>{showMenu();$('error').textContent='Mouse capture was refused. Click RETURN again.';});
window.addEventListener('blur',()=>{player.clear();if(document.pointerLockElement)document.exitPointerLock();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){player.clear();if(document.pointerLockElement)document.exitPointerLock();}});
document.addEventListener('mousemove',e=>{if(active)player.look(e.movementX,e.movementY);});
document.addEventListener('keydown',e=>{
  if(e.code==='Tab'){e.preventDefault();if(!e.repeat)pocket();return;}
  if(mode==='pocket'&&e.code==='Escape'){showMenu();return;}
  if(!active)return;
  if(e.code==='Escape'){document.exitPointerLock();return;}
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
  player.keys.add(e.code);
  if(e.code==='KeyE'&&!e.repeat){target=findTarget();if(target)interact(target.id);}
});
document.addEventListener('keyup',e=>player.keys.delete(e.code));
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();active=false;player.clear();sound.pause();if(document.pointerLockElement)document.exitPointerLock();showMenu();$('start').disabled=true;$('error').textContent='The graphics context was lost. Reload the page to restart the house.';});

function findTarget(){
  scene.updateMatrixWorld(true);ray.setFromCamera(new T.Vector2(0,0),camera);
  const interactions=house.interactables.filter(i=>i.id!=='note'||!story.hasNote);
  const objects=[...new Set([...interactions.map(i=>i.mesh),...house.occluders])];
  const hits=ray.intersectObjects(objects,false).filter(h=>h.object.visible);
  const hit=hits[0];if(!hit)return null;
  return interactions.find(i=>i.mesh===hit.object&&hit.distance<=i.range)||null;
}
function interact(id){
  const event=story.interact(id);if(!event)return;
  sound.effect(event);
  switch(event){
    case 'note':house.note.visible=false;say('“If the hall returns, watch the glass. Wait for it to move. Then look away.”',7);break;
    case 'mirror-first':say('You. Exactly where you should be.');break;
    case 'mirror-late':say('Wait. Watch it. Then look away.',5);break;
    case 'mirror-held':say('There is something in the drawer now.',4);break;
    case 'drawer-open':say(story.keyAvailable&&!story.hasKey?'Something catches the light. [ E ] TAKE KEY':'Only dust.',3);break;
    case 'key':say('A brass key. The tag reads “FRONT”.',4);queueVoice('key',.3);break;
    case 'locked':say('Locked. The key must be somewhere in the house.');break;
    case 'unlocked':say('The door opens. That should feel better.',4);queueVoice('unlocked',1.1);break;
  }
  updateInventory();
}
function finish(){
  if(story.ended)return;
  story.ended=true;endingAt=0;$('veil').classList.remove('closing');mode='ending';active=false;player.clear();pending=[];sound.stopVoice();document.exitPointerLock();showMenu();
}
function update(dt){
  if(!active)return;
  elapsed+=dt;
  if(endingAt){if(elapsed>=endingAt)finish();return;}
  player.update(dt,house.colliders);
  const looking=mirror.looking(player,camera),near=player.x<1.6&&Math.hypot(player.x+1.595,player.z+.45)<4;
  for(const event of story.observe(dt,looking,near)){
    if(event==='held'){sound.stopVoice();pending=[];}
    if(event==='returned'){sound.effect('key');say('You moved. It didn’t.',3);queueVoice('returned',2.4);}
  }
  const transition=story.traverse(player.x,player.z);
  if(transition){house.setStage(story.stage);
    if(transition==='second-pass'){queueVoice('repeat',2.1);sound.effect('knock');}
    if(transition==='third-pass')say('The house is holding its breath.',4);
    if(transition==='missed-mirror')say('A mirror hangs in the hallway. You passed it.',5);
    if(transition==='return-mirror')say('Wait at the glass. Then turn away.',5);
  }
  if(story.stage===1&&story.secondSeen>.6&&!lateSpoken){lateSpoken=true;queueVoice('late',.2);}
  mirror.update(elapsed,player,story,looking);house.animate(elapsed,dt,story);
  sound.step(player.distance,player.speed);sound.update(story.frozen);
  for(const line of pending.filter(q=>q.at<=elapsed))sound.voice(line.id);
  pending=pending.filter(q=>q.at>elapsed);
  target=findTarget();
  let label=target?.label||'';
  if(target?.id==='drawer'&&story.drawerOpen)label=story.keyAvailable&&!story.hasKey?'TAKE BRASS KEY':'CLOSE DRAWER';
  if(target?.id==='door')label=story.doorOpen?'THE WAY OUT':story.hasKey?'UNLOCK WITH BRASS KEY':'TRY FRONT DOOR';
  $('prompt').textContent=label?'[ E ] '+label:'';$('cross').classList.toggle('active',!!target);
  $('hint').textContent=story.doorOpen?'Go through the front door.':story.hasKey?'The front door. Where you began.':story.encounter?'The drawer beside the mirror.':story.stage===1?'Watch your reflection. Then look away.':'Explore the house · E inspect · TAB pocket';
  if(elapsed>messageUntil)$('message').textContent='';
  if(story.doorOpen&&player.z>9.35){endingAt=elapsed+6;pending=[];player.clear();sound.voice('ending');say('The door closes on the wrong side.',5);$('veil').classList.add('closing');}
}
let previous=performance.now();
function tick(now){requestAnimationFrame(tick);const dt=Math.min((now-previous)/1000,.05);previous=now;if(!testMode)update(dt);renderer.render(scene,camera);}
requestAnimationFrame(tick);

// Explicit opt-in harness for deterministic browser checks; absent during normal play.
if(testMode){
  const snapshot=()=>({mode,active,time:elapsed,pose:player.pose(),speed:player.speed,story:{...story},target:target?.id||null,body:{x:mirror.body.position.x,z:mirror.body.position.z,yaw:mirror.body.rotation.y},audio:sound.context?.state,voiceBuffers:[...sound.buffers.keys()],doorAngle:house.doorPivot.rotation.y});
  window.__mirror={snapshot,advance(seconds){for(let t=0;t<seconds;t+=1/60)update(Math.min(1/60,seconds-t));return snapshot();},pose(x,z,yaw=0,pitch=0){player.x=x;player.z=z;player.yaw=yaw;player.pitch=pitch;player.clear();player.syncCamera();return snapshot();},face(yaw,pitch=0){player.yaw=yaw;player.pitch=pitch;player.syncCamera();},reset,colliders:house.colliders};
}
updateInventory();
