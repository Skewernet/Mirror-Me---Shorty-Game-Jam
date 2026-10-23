import * as T from 'three';
import {Player} from './player.mjs';
import {buildHouse} from './house.mjs';
const $=id=>document.getElementById(id),scene=new T.Scene();scene.background=new T.Color(0x101611);scene.fog=new T.FogExp2(0x101611,.035);
const camera=new T.PerspectiveCamera(68,innerWidth/innerHeight,.06,45);
let renderer;try{renderer=new T.WebGLRenderer({antialias:false,powerPreference:'high-performance'});}catch(error){$('error').textContent='WebGL could not start. Try a desktop browser with hardware acceleration.';throw error;}
renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;document.body.prepend(renderer.domElement);
const house=buildHouse(scene),player=new Player(camera),ray=new T.Raycaster();
let mode='title',active=false,target=null,elapsed=0,messageUntil=0,pass=1,crossing=false;
function say(text,duration=4){$('message').textContent=text;messageUntil=elapsed+duration;}
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();const h=Math.min(480,innerHeight);renderer.setSize(Math.round(h*camera.aspect),h,false);}resize();window.addEventListener('resize',resize);
function reset(){player.reset();pass=1;crossing=false;elapsed=0;target=null;$('message').textContent='';$('inventory').textContent='';}
function showMenu(){active=false;player.clear();$('menu').hidden=false;$('hud').hidden=true;if(mode==='playing'){$('start').textContent='RETURN TO THE HOUSE';$('restart').hidden=false;$('chapter').textContent='PAUSED';}}
async function enter(){$('error').textContent='';try{await renderer.domElement.requestPointerLock();}catch{$('error').textContent='Mouse capture was refused. Click ENTER again to resume.';}}
$('start').disabled=false;$('start').textContent='ENTER THE HOUSE';$('start').addEventListener('click',enter);$('restart').addEventListener('click',()=>{reset();enter();});
document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement===renderer.domElement){const first=mode==='title';mode='playing';active=true;$('menu').hidden=true;$('hud').hidden=false;if(first)say('The front door is locked. There must be another way.');}else showMenu();});
window.addEventListener('blur',()=>{player.clear();if(document.pointerLockElement)document.exitPointerLock();});document.addEventListener('visibilitychange',()=>{if(document.hidden){player.clear();document.exitPointerLock?.();}});
document.addEventListener('mousemove',e=>{if(active)player.look(e.movementX,e.movementY);});
document.addEventListener('keydown',e=>{if(!active)return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();player.keys.add(e.code);if(e.code==='KeyE'&&!e.repeat&&target)say(target.id==='door'?'Locked. From this side.':'An empty drawer.');});document.addEventListener('keyup',e=>player.keys.delete(e.code));
$('sensitivity').oninput=e=>player.sensitivity=Number(e.target.value);$('bob').onchange=e=>player.bob=e.target.checked;
function findTarget(){ray.setFromCamera(new T.Vector2(0,0),camera);const hit=ray.intersectObjects(house.interactables.map(i=>i.mesh),false)[0],found=hit&&house.interactables.find(i=>i.mesh===hit.object&&hit.distance<=i.range);if(!found)return null;const direction=ray.ray.direction;for(let d=.1;d<hit.distance-.15;d+=.1){const x=player.x+direction.x*d,z=player.z+direction.z*d;if(house.colliders.some(c=>!c.disabled&&x>c.minX&&x<c.maxX&&z>c.minZ&&z<c.maxZ))return null;}return found;}
let previous=performance.now();function tick(now){requestAnimationFrame(tick);const dt=Math.min((now-previous)/1000,.05);previous=now;if(active){elapsed+=dt;player.update(dt,house.colliders);if(player.x>2.2&&player.z<0)crossing=true;if(crossing&&player.x>2.2&&player.z>3.7){pass++;crossing=false;say('This place again.');}target=findTarget();$('prompt').textContent=target?'[ E ] '+target.label:'';$('cross').classList.toggle('active',!!target);if(elapsed>messageUntil)$('message').textContent='';}renderer.render(scene,camera);}requestAnimationFrame(tick);
