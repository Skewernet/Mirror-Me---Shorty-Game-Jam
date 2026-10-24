import * as T from "three";
import { mergeGeometries } from "../vendor/BufferGeometryUtils.js";
import { BLOOD_RECIPES, createBloodAtlas, bloodMaterial, bloodPatchGeometry } from "./blood-writing.mjs";
import { clippedBloodGeometry, bloodZone as zone } from "./blood-layout.mjs";

export const KITCHEN_FREQUENCY = "93.7";

// Bounds stop at real cornice, door/window openings and panel steps. The east
// wall is the obsessive focal point; the radio's first legible number keeps a
// small pocket of breathing room amid competing attempts around it.
const wallSurfaces = {
  west: { surfaceAxis: "x", x: .903, yaw: Math.PI / 2, clipZones: [
    zone(-4.57,-.79,.82,1.58), zone(-4.57,-.79,1.95,2.235),
    zone(-4.57,-2.88,1.58,1.95), zone(-1.67,-.79,1.58,1.95),
  ] },
  east: { surfaceAxis: "x", x: 4.497, yaw: -Math.PI / 2, clipZones: [zone(-4.57,-.79,.82,2.235)] },
  "east-low": { surfaceAxis: "x", x: 4.493, yaw: -Math.PI / 2, clipZones: [zone(-4.57,-.79,.115,.747)] },
  "north-left": { surfaceAxis: "z", z: -4.597, yaw: 0, clipZones: [zone(.94,1.97,.96,2.235)] },
  "north-right": { surfaceAxis: "z", z: -4.597, yaw: 0, clipZones: [zone(3.33,4.46,.96,2.235)] },
  "north-top": { surfaceAxis: "z", z: -4.597, yaw: 0, clipZones: [zone(1.97,3.33,2.105,2.235)] },
  "entry-left": { surfaceAxis: "z", z: -.763, yaw: Math.PI, clipZones: [zone(.92,1.87,.82,2.235)] },
  "entry-right": { surfaceAxis: "z", z: -.763, yaw: Math.PI, clipZones: [zone(2.93,4.48,.82,2.235)] },
  "entry-low": { surfaceAxis: "z", z: -.767, yaw: Math.PI, clipZones: [zone(.92,1.87,.115,.747),zone(2.93,4.48,.115,.747)] },
};
function wall(surface, u, y, w, h, tile, tilt = 0) {
  const spec = wallSurfaces[surface];
  return { ...spec, ...(spec.surfaceAxis === "x" ? {z:u} : {x:u}), y,w,h,tile,tilt,
    wall: surface.startsWith("north") ? "north" : surface.startsWith("entry") ? "entry" : surface.startsWith("east") ? "east" : "west",
    cluster: surface };
}
export const KITCHEN_FREQUENCY_MARKS = Object.freeze([
  { wall: "west", x: .903, y: 1.68, z: -2.24, w: 1.34, h: .59, yaw: Math.PI / 2, tile: 0, primary: true },
  wall("west",-3.75,1.64,1.25,1.02,5,-.09),
  wall("west",-3.41,1.20,.69,.53,1,.07),
  wall("west",-3.92,1.88,1.47,.77,14,.11),
  wall("west",-4.25,1.19,.55,.56,2,-.12),
  wall("west",-3.24,2.02,1.87,.54,15,-.035),
  wall("west",-2.14,2.11,1.30,.47,2,.07),
  wall("west",-1.14,1.89,.84,.86,8,-.11),
  wall("west",-1.08,1.25,.69,.61,7,.09),
  wall("west",-1.47,2.08,.76,.36,4,-.06),
  wall("west",-2.68,1.14,1.24,.48,14,-.08),
  wall("west",-2.90,.91,.78,.36,1,.11),
  wall("west",-1.29,.99,.60,.41,0,-.04),
  wall("west",-4.02,2.16,.58,.40,1,.10),
  wall("east",-3.05,1.51,2.84,1.45,6,-.06),
  wall("east",-3.38,1.67,1.41,1.07,1,.10),
  wall("east",-3.83,1.17,.82,.59,14,-.12),
  wall("east",-2.91,2.02,1.74,.67,15,.07),
  wall("east",-2.48,1.20,1.01,.75,8,-.08),
  wall("east",-4.20,1.93,.76,.70,7,.04),
  wall("east",-3.54,2.15,.79,.42,1,-.07),
  wall("east",-2.21,1.73,.59,.47,2,.115),
  wall("east",-1.40,1.95,.91,.61,4,-.04),
  wall("east",-1.09,1.34,.73,.88,5,.09),
  wall("east",-1.71,1.03,1.28,.54,1,-.06),
  wall("east",-4.12,.91,.66,.43,8,.11),
  wall("east",-2.96,.88,.54,.41,7,-.035),
  wall("east",-4.36,1.40,.47,.76,2,.065),
  wall("east-low",-2.78,.48,1.44,.69,14,-.12),
  wall("east-low",-3.32,.27,.63,.54,1,.09),
  wall("east-low",-1.32,.52,.91,.52,7,.045),
  wall("east-low",-2.42,.19,.54,.41,8,-.07),
  wall("north-left",1.76,1.55,.65,1.12,4,.10),
  wall("north-left",1.64,1.13,.53,.52,1,-.08),
  wall("north-left",1.95,2.02,.63,.48,2,.05),
  wall("north-right",3.56,1.57,.75,1.08,15,-.085),
  wall("north-right",3.59,1.30,.50,.54,8,.11),
  wall("north-right",3.95,2.09,.79,.42,1,-.04),
  wall("north-top",2.47,2.15,1.73,.36,14,.025),
  wall("entry-left",1.23,1.73,1.01,.91,1,-.11),
  wall("entry-left",1.55,1.16,.73,.65,15,.08),
  wall("entry-left",1.37,2.14,.61,.49,2,-.06),
  wall("entry-right",3.31,1.55,1.29,1.17,5,.075),
  wall("entry-right",3.55,1.96,1.18,.63,14,-.09),
  wall("entry-right",3.99,1.15,.71,.66,8,.035),
  wall("entry-right",3.04,1.03,.61,.49,7,-.12),
  wall("entry-low",1.45,.48,1.16,.57,1,.08),
  wall("entry-low",3.14,.28,.91,.58,14,-.07),
].map(mark => Object.freeze(mark)));

function addBatch(parent, definitions, material, name) {
  const kept = [], parts = [];
  for (const mark of definitions) {
    const geometry = clippedBloodGeometry(mark);
    if (!geometry.attributes.position.count) { geometry.dispose(); continue; }
    parts.push(geometry.index ? geometry.toNonIndexed() : geometry);
    if (geometry.index) geometry.dispose();
    kept.push(mark);
  }
  if (!parts.length) return {mesh:null,kept};
  const geometry = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  const mesh = new T.Mesh(geometry, material);
  mesh.name = name;mesh.castShadow = false;mesh.receiveShadow = true;
  mesh.userData.kitchenBlood = true;mesh.userData.stationClue = KITCHEN_FREQUENCY;
  parent.add(mesh);return {mesh,kept};
}
function cabinetZones(width) {
  const edge = width/2;
  return [
    zone(-edge+.034,edge-.034,.114,.786,.286),
    ...[-1,1].map(side=>zone(side*(edge-.065)-.013,side*(edge-.065)+.013,.135,.765,.3075)),
    zone(-edge+.070,edge-.070,.153,.177,.3075),
    zone(-edge+.070,edge-.070,.723,.747,.3075),
  ];
}
export function createKitchenFrequency(parent, builders, { fridge, cabinets = [], cupboards = [] } = {}) {
  const root = new T.Group();root.name = "The kitchen's blood-written ramblings";parent.add(root);
  const atlas = createBloodAtlas(), material = bloodMaterial(atlas);
  const roots = [root], markings = [], patches = [];
  const add = (group, definitions, name) => {
    const {mesh,kept} = addBatch(group,definitions,material,name);
    for (const mark of kept) patches.push({...mark,parent:group,text:BLOOD_RECIPES[mark.tile || 0].text});
    if (mesh) markings.push(mesh);return mesh;
  };
  const primaryMark = KITCHEN_FREQUENCY_MARKS[0];
  const primary = new T.Mesh(bloodPatchGeometry({...primaryMark,x:0,y:0,z:0,yaw:0}),material);
  primary.name = "93.7 — the radio-side blood-written clue";
  primary.position.set(primaryMark.x,primaryMark.y,primaryMark.z);primary.rotation.y=primaryMark.yaw;
  primary.castShadow=false;primary.receiveShadow=true;primary.userData.kitchenBlood=true;
  primary.userData.stationClue=KITCHEN_FREQUENCY;primary.userData.primary=true;
  root.add(primary);markings.push(primary);patches.push({...primaryMark,parent:root,text:KITCHEN_FREQUENCY});
  builders.target("station-clue",primary,"READ THE BLOOD-WRITTEN STATION",2.4);
  add(root,KITCHEN_FREQUENCY_MARKS.slice(1),"Kitchen walls — crowded, interrupted attempts");
  const external=(surface,name)=>{const group=new T.Group();group.name=name;surface.add(group);roots.push(group);return group;};

  // Whole attempts run across neighboring doors. Their UVs continue at the
  // seams and over the raised frame faces; they are not eight centered labels.
  const westAttempts = [
    {z:-3.17,y:.46,w:2.10,h:.73,tile:15,tilt:-.055,flow:"west-radio"},
    {z:-2.18,y:.26,w:1.01,h:.56,tile:1,tilt:.10,flow:"west-number"},
    {z:-3.91,y:.61,w:.82,h:.67,tile:7,tilt:.035,flow:"west-stop"},
    {z:-3.59,y:.29,w:.68,h:.53,tile:8,tilt:-.09,flow:"west-restart"},
  ];
  const northAttempts = [
    {x:2.95,y:.48,w:2.50,h:.79,tile:6,tilt:-.055,flow:"north-listen"},
    {x:3.46,y:.62,w:1.22,h:.57,tile:1,tilt:.10,flow:"north-number"},
    {x:2.15,y:.28,w:1.07,h:.53,tile:14,tilt:.075,flow:"north-rain"},
    {x:3.79,y:.22,w:.81,h:.52,tile:8,tilt:-.09,flow:"north-restart"},
  ];
  cabinets.forEach((cabinet,index)=>{
    const group=external(cabinet,`Blood across base cabinet ${index+1}`);
    const width=cabinet.userData.cabinetWidth || .72, clipZones=cabinetZones(width);
    const definitions=(index<4?westAttempts:northAttempts).map(attempt=>({
      ...attempt,x:index<4?cabinet.position.z-attempt.z:attempt.x-cabinet.position.x,
      y:attempt.y,z:.286,surfaceAxis:"z",clipZones,surface:"cabinet",
    }));
    // A cramped restart collides with the large cabinet-wide thought, rather
    // than giving every door an equally weighted number in its own frame.
    if(index===1||index===5)definitions.push({x:index===1?-.11:.13,y:.48,z:.286,w:.43,h:.56,tile:1,tilt:-.12,
      surfaceAxis:"z",clipZones,surface:"cabinet",flow:"overprint"});
    if([0,1,4,5,7].includes(index)) {
      const topBounds=[zone(-width/2+.015,width/2-.015,-.269,.269,.947)];
      definitions.push({x:index===0?.09:-.08,y:.947,z:index%2?-.14:.10,w:width*.92,h:.60,pitch:-Math.PI/2,
        tile:index===4?5:index===1?14:1,tilt:index%2?.09:-.07,surfaceAxis:"y",clipZones:topBounds,surface:"worktop"});
      if(index===0||index===7)definitions.push({x:-.12,y:.947,z:-.11,w:.37,h:.32,pitch:-Math.PI/2,tile:7,tilt:.12,
        surfaceAxis:"y",clipZones:topBounds,surface:"worktop"});
    }
    add(group,definitions,`Cabinet/worktop — broken continuations ${index+1}`);
  });
  cupboards.forEach((cupboard,index)=>{
    const group=external(cupboard,`Blood on wall cupboard ${index+1}`);
    const clipZones=[zone(-.283,.283,-.263,.263,.175)];
    const attempts=index ? [
      {x:.07,y:.06,w:.78,h:.71,tile:1,tilt:-.09},{x:-.16,y:-.11,w:.55,h:.55,tile:14,tilt:.12},
      {x:.12,y:.20,w:.75,h:.46,tile:2,tilt:.035},{x:.20,y:-.22,w:.37,h:.41,tile:8,tilt:-.065},
    ]:[{x:-.06,y:.10,w:.83,h:.72,tile:3,tilt:.08},{x:.15,y:-.20,w:.57,h:.45,tile:1,tilt:-.105}];
    add(group,attempts.map(mark=>({...mark,z:.175,surfaceAxis:"z",clipZones,surface:"cupboard"})),`Wall cupboard — interrupted scrawl ${index+1}`);
  });
  if(fridge){
    const group=external(fridge,"Blood on the refrigerator");
    const doorZones=[zone(-.300,.300,.572,1.617,.350),zone(-.078,.158,1.043,1.317,.358)];
    const freezerZones=[zone(-.300,.300,.095,.495,.350)];
    const definitions=[
      {x:.08,y:1.25,w:.89,h:.99,tile:1,tilt:-.105},
      {x:-.15,y:.77,w:.75,h:.80,tile:5,tilt:.06},
      {x:.18,y:1.60,w:.59,h:.54,tile:2,tilt:.09},
      {x:.14,y:.94,w:.67,h:.63,tile:8,tilt:-.07},
      {x:-.22,y:1.11,w:.37,h:.61,tile:7,tilt:.12},
    ].map(mark=>({...mark,z:.350,surfaceAxis:"z",clipZones:doorZones,surface:"fridge-door"}));
    definitions.push(...[
      {x:.08,y:.33,w:.83,h:.53,tile:8,tilt:.105},{x:-.15,y:.14,w:.60,h:.56,tile:14,tilt:-.08},
    ].map(mark=>({...mark,z:.350,surfaceAxis:"z",clipZones:freezerZones,surface:"fridge-freezer"})));
    definitions.push(...[
      {z:-.06,y:1.15,w:.83,h:1.14,tile:15,tilt:-.055},{z:.15,y:.64,w:.63,h:.84,tile:1,tilt:.11},
      {z:-.17,y:1.61,w:.49,h:.46,tile:14,tilt:-.09},
    ].map(mark=>({...mark,x:.347,yaw:Math.PI/2,surfaceAxis:"x",clipZones:[zone(-.263,.263,.06,1.65,.347)],surface:"fridge-side"})));
    add(group,definitions,"Refrigerator — overwritten numbers and interrupted pleas");
  }
  const setVisible=value=>{for(const group of roots)group.visible=Boolean(value);};setVisible(false);
  return {root,surfaceRoots:roots,primary,markings,patches,materials:[material],textures:[atlas.texture],atlas,setVisible,
    animate(state){setVisible(state.stage>=2&&Boolean(state.clockSolved));},reset(){setVisible(false);},
    snapshot:()=>({visible:root.visible,text:KITCHEN_FREQUENCY,count:patches.length,drawMeshes:markings.length,surfaceGroups:roots.length,
      phrases:[...new Set(patches.map(patch=>patch.text))],primary:new T.Vector3().setFromMatrixPosition(primary.matrixWorld).toArray()}),
  };
}
