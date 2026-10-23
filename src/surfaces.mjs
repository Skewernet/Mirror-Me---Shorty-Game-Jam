import * as T from 'three';
let seed=1709;
function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
function canvas(size=128){const c=document.createElement('canvas');c.width=c.height=size;return [c,c.getContext('2d')];}
function texture(c){const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.magFilter=T.NearestFilter;t.minFilter=T.NearestMipmapNearestFilter;t.wrapS=t.wrapT=T.RepeatWrapping;return t;}
function patina(ctx,size,amount=2200){for(let i=0;i<amount;i++){const v=random();ctx.fillStyle=v>.5?'rgba(0,0,0,.09)':'rgba(218,198,154,.07)';ctx.fillRect(random()*size,random()*size,1+random()*3,1+random()*2);}}
export function createSurfaces(){
  const maps={};
  {const [c,g]=canvas();g.fillStyle='#687056';g.fillRect(0,0,128,128);for(let x=0;x<128;x+=32){g.fillStyle='#6e775b';g.fillRect(x,0,2,128);for(let y=-32;y<160;y+=48){const yy=y+(x%64?24:0);g.strokeStyle='#424f39';g.lineWidth=1.2;g.beginPath();g.moveTo(x+16,yy);g.bezierCurveTo(x+2,yy+10,x+5,yy+23,x+16,yy+30);g.bezierCurveTo(x+27,yy+23,x+30,yy+10,x+16,yy);g.stroke();g.fillStyle='#a1a075';g.fillRect(x+15,yy+10,2,8);}}patina(g,128);maps.wallpaper=texture(c);}
  {const [c,g]=canvas();g.fillStyle='#363a2e';g.fillRect(0,0,128,128);for(let x=0;x<128;x++){g.fillStyle=`rgba(13,16,9,${.05+random()*.12})`;g.fillRect(x,0,1,128);}g.strokeStyle='#191e18';g.lineWidth=3;g.strokeRect(6,5,116,118);g.strokeStyle='#5b5c3e';g.lineWidth=1;g.strokeRect(10,9,108,110);patina(g,128);maps.panel=texture(c);}
  {const [c,g]=canvas();g.fillStyle='#624b32';g.fillRect(0,0,128,128);for(let row=0;row<8;row++){let y=row*16;g.fillStyle=row%2?'#58442e':'#6c5134';g.fillRect(0,y,128,16);g.fillStyle='#2a281c';g.fillRect(0,y,128,1);g.fillRect((row%3)*43,y,1,16);for(let n=0;n<15;n++){g.fillStyle=`rgba(24,22,13,${random()*.18})`;g.fillRect(random()*128,y+random()*15,10+random()*40,1);}}patina(g,128);maps.floor=texture(c);}
  {const [c,g]=canvas();g.fillStyle='#817e64';g.fillRect(0,0,128,128);patina(g,128,4200);g.strokeStyle='#625f4c';g.beginPath();g.moveTo(18,0);g.lineTo(26,25);g.lineTo(18,34);g.lineTo(32,48);g.stroke();maps.ceiling=texture(c);}
  {const [c,g]=canvas();g.fillStyle='#512b27';g.fillRect(0,0,128,128);for(const x of [5,11,116,122]){g.fillStyle='#aa8e58';g.fillRect(x,0,2,128);}for(let y=0;y<128;y+=32){g.strokeStyle='#8f6945';g.lineWidth=2;g.beginPath();g.moveTo(64,y+3);g.lineTo(92,y+16);g.lineTo(64,y+29);g.lineTo(36,y+16);g.closePath();g.stroke();g.fillStyle='#a08752';g.fillRect(61,y+13,6,6);}patina(g,128);maps.rug=texture(c);}
  function material(name,repeatX=1,repeatY=1,color=0xffffff){const map=maps[name].clone();map.needsUpdate=true;map.repeat.set(repeatX,repeatY);return new T.MeshStandardMaterial({map,color,roughness:1});}
  return {material,maps};
}
export function paintingTexture(){
  const [c,g]=canvas(128);g.fillStyle='#606252';g.fillRect(0,0,128,128);g.fillStyle='#2f3b32';g.beginPath();g.moveTo(0,83);g.lineTo(27,55);g.lineTo(57,80);g.lineTo(90,50);g.lineTo(128,73);g.lineTo(128,128);g.lineTo(0,128);g.fill();
  g.fillStyle='#7c7355';g.fillRect(45,63,44,47);g.fillStyle='#242c27';g.beginPath();g.moveTo(35,65);g.lineTo(67,35);g.lineTo(99,65);g.fill();g.fillStyle='#d4ba7b';g.fillRect(53,72,7,13);g.fillRect(75,72,7,13);g.fillStyle='#202b25';g.fillRect(63,89,10,21);g.strokeStyle='#9b9572';g.lineWidth=8;g.beginPath();g.moveTo(68,109);g.lineTo(54,128);g.stroke();patina(g,128,2800);return texture(c);
}
export function writingTexture(lines,{background='#c6bc94',color='#39382b',size=256,font=20}={}){
  const [c,g]=canvas(size);g.fillStyle=background;g.fillRect(0,0,size,size);g.fillStyle=color;g.font=`${font}px Georgia`;g.textAlign='center';lines.forEach((line,i)=>g.fillText(line,size/2,size*.32+i*font*1.7));patina(g,size,1000);return texture(c);
}
