import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// Production uses the browser import map; CPU geometry checks resolve that
// same vendored Three without a canvas, browser or an installed npm package.
const vendor = new URL("../vendor/three.module.js", import.meta.url).href;
const hooks = registerHooks({ resolve(specifier, context, next) {
  return specifier === "three" ? {url:vendor,shortCircuit:true} : next(specifier,context);
} });
const T = await import(vendor);
const { clippedBloodGeometry, mergeBloodPatches, bloodZone } = await import("../src/blood-layout.mjs");
const { KITCHEN_FREQUENCY_MARKS } = await import("../src/kitchen-frequency.mjs");
const { HALL_BLOOD_MARKS } = await import("../src/hall-blood.mjs");
hooks.deregister();
const axes = {x:[2,1,0],y:[0,2,1],z:[0,1,2]};

function inspect(mark) {
  const before = JSON.stringify(mark), geometry = clippedBloodGeometry(mark);
  assert.equal(JSON.stringify(mark),before,"Clipping mutated the authored surface bounds");
  const {position:p,normal:n,uv} = geometry.attributes;
  const matrix = new T.Matrix4().compose(new T.Vector3(mark.x,mark.y,mark.z),
    new T.Quaternion().setFromEuler(new T.Euler(mark.pitch||0,mark.yaw||0,mark.tilt||0)),new T.Vector3(1,1,1));
  const inverse = matrix.clone().invert(), expectedNormal = new T.Vector3(0,0,1).transformDirection(matrix);
  const [uAxis,vAxis,normalAxis] = axes[mark.surfaceAxis||"z"];
  assert.equal(p.count%3,0);
  for(let i=0;i<p.count;i++) {
    const point = new T.Vector3().fromBufferAttribute(p,i), local = point.clone().applyMatrix4(inverse), position=point.toArray();
    const expectedUV = [((mark.tile%4)+local.x/mark.w+.5)/4,
      (3-Math.floor(mark.tile/4)+local.y/mark.h+.5)/4];
    assert.ok([...position,uv.getX(i),uv.getY(i),n.getX(i),n.getY(i),n.getZ(i)].every(Number.isFinite));
    assert.ok(Math.abs(uv.getX(i)-expectedUV[0])<2e-6&&Math.abs(uv.getY(i)-expectedUV[1])<2e-6,
      "Clipping shifted the shared phrase's interpolated atlas UV");
    assert.ok(new T.Vector3().fromBufferAttribute(n,i).distanceTo(expectedNormal)<2e-6,
      "A clipped fragment lost its normalized surface normal");
    assert.ok(mark.clipZones.some(zone=>position[uAxis]>=zone.u0-1e-6&&position[uAxis]<=zone.u1+1e-6&&
      position[vAxis]>=zone.v0-1e-6&&position[vAxis]<=zone.v1+1e-6&&
      (zone.plane===undefined||Math.abs(position[normalAxis]-zone.plane)<1e-6)),
      "A corner overhangs its flat physical panel/window/door bounds");
  }
  for(let i=0;i<p.count;i+=3) {
    const a = new T.Vector3().fromBufferAttribute(p,i), b = new T.Vector3().fromBufferAttribute(p,i+1),
      c = new T.Vector3().fromBufferAttribute(p,i+2), cross=b.sub(a).cross(c.sub(a));
    assert.ok(cross.length()>1e-9,"Clipping retained a zero-area triangle");
    assert.ok(cross.dot(expectedNormal)>0,"Clipping reversed a triangle's front-face winding");
  }
  geometry.dispose();
}

test("rotated blood fragments retain continuous UVs, normals and bounded winding on every surface axis",()=>{
  let seed=20261024;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(const axis of ["x","y","z"])for(let i=0;i<400;i++) {
    const x=random()*4-2,y=random()*4-2,z=random()*4-2;
    const mark={x,y,z,w:.1+random()*3,h:.1+random()*2,tile:i%16,tilt:(random()-.5)*1.5,surfaceAxis:axis};
    if(axis==="x")mark.yaw=i%2?Math.PI/2:-Math.PI/2;
    if(axis==="y")mark.pitch=-Math.PI/2;
    if(axis==="z")mark.yaw=i%2?Math.PI:0;
    const [u,v,n]=axes[axis],center=[x,y,z];
    mark.clipZones=[bloodZone(center[u]-.1-random(),center[u]+.1+random(),
      center[v]-.1-random(),center[v]+.1+random(),center[n]+.002)];
    inspect(mark);
  }
  for(const mark of [...KITCHEN_FREQUENCY_MARKS,...HALL_BLOOD_MARKS].filter(mark=>mark.clipZones?.length))inspect(mark);
});

test("empty attempts disappear and indexed/unindexed pieces batch with consistent attributes and disposal",()=>{
  const originalDispose=T.BufferGeometry.prototype.dispose,disposals=new Map();
  T.BufferGeometry.prototype.dispose=function(){disposals.set(this.uuid,(disposals.get(this.uuid)||0)+1);originalDispose.call(this);};
  try {
    const none={x:0,y:0,z:0,w:1,h:1,tile:0,surfaceAxis:"z",clipZones:[bloodZone(3,4,3,4)]};
    assert.equal(mergeBloodPatches([none]),null);
    const simple={x:0,y:0,z:0,w:1,h:1,tile:0};
    const merged=mergeBloodPatches([simple,{...simple,x:2},{...simple,x:4,clipZones:[bloodZone(3.8,4.2,-.2,.2)]}]);
    assert.ok(merged&&!merged.index);
    assert.equal(merged.attributes.position.count,merged.attributes.uv.count);
    assert.ok(merged.attributes.position.count>12);
    merged.dispose();
    assert.ok([...disposals.values()].every(count=>count===1),"A source/intermediate/batched geometry was disposed twice");
  } finally { T.BufferGeometry.prototype.dispose=originalDispose; }
});
