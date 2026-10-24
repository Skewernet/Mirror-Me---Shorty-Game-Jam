import * as T from "three";
import { BLOOD_RECIPES, createBloodAtlas, bloodMaterial } from "./blood-writing.mjs";
import { mergeBloodPatches, bloodZone as zone } from "./blood-layout.mjs";

// The writing gathers in anxious, uneven pockets. Doorways remain empty and
// lower attempts sit on the separate, slightly proud wainscot plane. Every
// phrase implies water, waiting or passing time without giving the solution.
const hallSurfaces = {
  west: {x:-.637,yaw:Math.PI/2,surfaceAxis:"x",clipZones:[zone(2.34,4.52,.82,2.235)]},
  east: {x:.637,yaw:-Math.PI/2,surfaceAxis:"x",clipZones:[zone(3.10,5.80,.82,2.235)]},
  "west-low": {x:-.633,yaw:Math.PI/2,surfaceAxis:"x",clipZones:[zone(2.34,4.52,.12,.747)]},
  "east-low": {x:.633,yaw:-Math.PI/2,surfaceAxis:"x",clipZones:[zone(3.10,5.80,.12,.747)]},
  north: {z:-.637,yaw:0,surfaceAxis:"z",clipZones:[zone(2.97,6.82,.82,2.235),zone(7.96,9.17,.82,2.235)]},
  south: {z:.637,yaw:Math.PI,surfaceAxis:"z",clipZones:[zone(.78,6.78,.82,2.235),zone(8.04,9.17,.82,2.235)]},
  "south-low": {z:.633,yaw:Math.PI,surfaceAxis:"z",clipZones:[zone(.78,6.78,.12,.747)]},
};
function mark(surface,u,y,w,h,tile,tilt=0){
  const spec=hallSurfaces[surface];
  return {...spec,...(spec.surfaceAxis==="x"?{z:u}:{x:u}),y,w,h,tile,tilt,cluster:surface};
}
export const HALL_BLOOD_MARKS = Object.freeze([
  mark("west",3.47,1.55,1.71,1.13,13,-.07),
  mark("west",3.07,1.08,.91,.61,10,.105),
  mark("west",3.92,1.92,.83,.73,12,.06),
  mark("west",3.66,1.25,.77,.70,13,-.12),
  mark("west",2.55,1.79,.71,.60,11,.08),
  mark("west",4.22,1.02,.63,.51,9,-.04),
  mark("east",4.93,1.44,1.73,.99,10,.075),
  mark("east",5.39,1.91,.88,.77,13,-.095),
  mark("east",4.64,1.03,.76,.57,12,.10),
  mark("east",3.34,1.15,.68,.64,11,-.07),
  mark("west-low",3.02,.43,1.23,.72,13,.10),
  mark("east-low",5.19,.27,.79,.64,10,-.055),
  mark("north",3.99,1.40,2.13,1.13,9,-.055),
  mark("north",3.31,1.95,.71,.65,12,.11),
  mark("north",4.73,1.08,.89,.63,10,.045),
  mark("south",4.55,1.20,1.86,.87,11,-.085),
  mark("south",4.09,1.54,.79,.69,13,.09),
  mark("south",5.91,.97,.59,.43,12,-.055),
  mark("south-low",4.81,.45,1.30,.73,11,.07),
  mark("north",8.48,1.52,.91,.92,12,.085),
  mark("north",8.82,1.03,.56,.56,13,-.09),
].map(value=>Object.freeze(value)));

export function createHallBlood(parent){
  const root=new T.Group();root.name="The hallway's half-remembered evening";parent.add(root);
  const atlas=createBloodAtlas(),material=bloodMaterial(atlas);
  const mesh=new T.Mesh(mergeBloodPatches(HALL_BLOOD_MARKS),material);
  mesh.name="Hall blood — interrupted water, waiting and turning hands";
  mesh.castShadow=false;mesh.receiveShadow=true;mesh.userData.hallBlood=true;
  root.add(mesh);root.visible=false;
  return {root,mesh,atlas,markings:HALL_BLOOD_MARKS,
    animate(state){root.visible=state.stage>=2;},reset(){root.visible=false;},
    snapshot:()=>({visible:root.visible,count:HALL_BLOOD_MARKS.length,phrases:HALL_BLOOD_MARKS.map(value=>BLOOD_RECIPES[value.tile].text)}),
  };
}
