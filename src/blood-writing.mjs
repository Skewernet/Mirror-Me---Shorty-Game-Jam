import * as T from "three";

// An original traced alphabet, not a system font. Unequal strokes, missed
// joins and repeated finger pulls are kept in the artwork at every resolution.
const glyphs = {
  A: [[[.05,1],[.43,.03],[.91,.98]],[[.22,.61],[.73,.56]]],
  B: [[[.12,1],[.08,.02]],[[.09,.05],[.55,.02],[.78,.16],[.71,.39],[.15,.49],[.65,.47],[.86,.68],[.76,.91],[.12,.99]]],
  C: [[[.85,.14],[.62,.03],[.25,.12],[.09,.44],[.12,.78],[.39,.98],[.78,.86]]],
  D: [[[.11,.99],[.07,.02],[.43,.04],[.79,.21],[.88,.58],[.7,.86],[.13,1]]],
  E: [[[.86,.05],[.12,.03],[.08,.99],[.85,.92]],[[.13,.49],[.7,.45]]],
  F: [[[.11,1],[.13,.04],[.9,.02]],[[.15,.49],[.73,.44]]],
  G: [[[.86,.14],[.57,.03],[.2,.18],[.09,.55],[.22,.88],[.58,.99],[.89,.79],[.84,.53],[.56,.57]]],
  H: [[[.1,.03],[.13,1]],[[.86,.02],[.81,.99]],[[.14,.54],[.83,.48]]],
  I: [[[.13,.05],[.78,.02]],[[.47,.05],[.43,.98]],[[.12,.99],[.78,.94]]],
  J: [[[.17,.08],[.86,.03]],[[.73,.04],[.74,.75],[.57,.97],[.24,.92],[.1,.73]]],
  K: [[[.13,.03],[.08,1]],[[.87,.04],[.16,.57],[.85,.98]]],
  L: [[[.12,.01],[.08,.97],[.88,.95]]],
  M: [[[.07,1],[.09,.03],[.47,.58],[.82,.02],[.91,1]]],
  N: [[[.12,1],[.09,.04],[.86,.98],[.82,.01]]],
  O: [[[.5,.03],[.22,.07],[.07,.4],[.14,.83],[.47,.99],[.79,.9],[.92,.52],[.78,.15],[.5,.03]]],
  P: [[[.12,1],[.09,.04],[.56,.02],[.86,.19],[.76,.46],[.15,.51]]],
  Q: [[[.5,.04],[.18,.15],[.08,.6],[.29,.94],[.62,.98],[.88,.71],[.88,.29],[.66,.06],[.5,.04]],[[.57,.69],[.97,1.08]]],
  R: [[[.12,1],[.09,.04],[.57,.02],[.84,.2],[.73,.47],[.16,.5]],[[.47,.5],[.91,1]]],
  S: [[[.85,.11],[.58,.01],[.21,.12],[.11,.34],[.33,.5],[.74,.61],[.85,.82],[.61,1],[.14,.87]]],
  T: [[[.02,.05],[.94,.02]],[[.48,.06],[.42,1]]],
  U: [[[.1,.03],[.08,.7],[.26,.97],[.58,1],[.83,.77],[.89,.02]]],
  V: [[[.06,.03],[.45,1],[.91,.02]]],
  W: [[[.05,.02],[.22,1],[.49,.43],[.74,.99],[.91,.01]]],
  X: [[[.08,.02],[.89,.99]],[[.87,.03],[.09,1]]],
  Y: [[[.04,.03],[.47,.52],[.91,.02]],[[.47,.52],[.43,1]]],
  Z: [[[.07,.06],[.89,.02],[.1,.97],[.91,.94]]],
  "9": [[[.73,.35],[.81,.13],[.5,.03],[.14,.15],[.13,.43],[.45,.54],[.76,.35],[.73,.16],[.7,.62],[.48,.91],[.22,1.03]]],
  "3": [[[.1,.12],[.51,.02],[.86,.13],[.7,.34],[.39,.48],[.75,.52],[.92,.75],[.7,.98],[.17,.92]]],
  "7": [[[.04,.07],[.5,.03],[.94,.1],[.65,.43],[.38,.77],[.23,1.03]]],
  ".": [[[.36,.92],[.42,.96]]],
  "'": [[[.48,.04],[.35,.21]]],
};

// These are movements of a hand, including loops that never quite close,
// oversized ascenders and tails pulled back through an earlier stroke. Most
// phrases use this hurried lowercase; occasional capitals interrupt it.
const hand = {
  a: [[[.76,.18],[.44,.04],[.12,.28],[.09,.77],[.35,.98],[.72,.72],[.75,.19],[.71,.92],[1.04,.83]]],
  b: [[[.08,.92],[.16,-.57],[.4,-.78],[.36,-.33],[.11,.38],[.29,.12],[.69,.13],[.87,.47],[.72,.86],[.36,1.02],[.12,.83],[.99,.78]]],
  c: [[[.83,.18],[.53,.02],[.17,.2],[.07,.64],[.31,.98],[.66,.9],[.99,.68]]],
  d: [[[.72,.21],[.37,.04],[.1,.37],[.16,.83],[.46,.96],[.71,.63],[.85,-.64],[1.02,-.82],[.91,-.22],[.74,.94],[1.05,.8]]],
  e: [[[.08,.56],[.67,.45],[.79,.17],[.46,.02],[.12,.32],[.09,.76],[.44,.98],[.84,.78],[1.02,.63]]],
  f: [[[.05,1.43],[.3,.7],[.55,-.33],[.48,-.74],[.23,-.55],[.14,.01],[.42,.79],[.55,1.28],[.3,1.48],[.13,1.22]],[[.02,.29],[.87,.15]]],
  g: [[[.75,.18],[.43,.03],[.11,.25],[.09,.75],[.37,.98],[.74,.62],[.83,.13],[.69,1.34],[.4,1.72],[.07,1.53],[.44,1.22],[1.1,.85]]],
  h: [[[.11,.96],[.17,-.65],[.37,-.81],[.31,-.26],[.09,.62],[.4,.12],[.66,.07],[.78,.32],[.72,.97],[1.06,.83]]],
  i: [[[.19,.28],[.12,.92],[.42,1.02],[.79,.79]],[[.24,-.17],[.29,-.1]]],
  j: [[[.63,.2],[.58,.91],[.39,1.59],[.1,1.66],[-.11,1.4],[.42,1.19],[.94,.8]],[[.7,-.21],[.76,-.14]]],
  k: [[[.11,.98],[.16,-.65],[.36,-.79],[.32,-.19],[.11,.58]],[[.86,.03],[.31,.55],[.56,.59],[.81,.95],[1.03,.8]]],
  l: [[[.08,.88],[.58,-.51],[.47,-.79],[.21,-.58],[.15,.01],[.12,.74],[.42,1.02],[.93,.76]]],
  m: [[[.04,.94],[.13,.14],[.28,.06],[.32,.34],[.3,.89],[.59,.14],[.76,.08],[.85,.34],[.78,.94],[1.09,.12],[1.3,.11],[1.4,.43],[1.37,.98],[1.65,.82]]],
  n: [[[.05,.96],[.15,.1],[.27,.08],[.25,.74],[.56,.11],[.76,.08],[.86,.37],[.79,.96],[1.08,.8]]],
  o: [[[.73,.18],[.4,.02],[.11,.22],[.07,.68],[.36,.99],[.7,.84],[.83,.42],[.67,.13],[.45,.24],[1.03,.46]]],
  p: [[[.16,1.54],[.24,.22],[.21,.04],[.1,.76],[.39,.12],[.7,.05],[.91,.3],[.84,.76],[.49,.99],[.27,.84],[1.05,.77]]],
  q: [[[.72,.19],[.4,.02],[.11,.24],[.1,.78],[.4,.97],[.75,.62],[.83,.11],[.75,1.49],[1.12,1.25]]],
  r: [[[.06,.96],[.15,.12],[.29,.07],[.26,.57],[.51,.03],[.76,.16],[.92,.07]]],
  s: [[[.81,.12],[.53,-.03],[.19,.2],[.28,.5],[.7,.65],[.74,.89],[.36,1.02],[.07,.8],[1.02,.72]]],
  t: [[[.46,-.49],[.3,.77],[.39,.99],[.7,.87],[.92,.62]],[[.01,.24],[.89,.08]]],
  u: [[[.14,.09],[.06,.68],[.23,.99],[.53,.83],[.8,.12],[.71,.91],[1.05,.83]]],
  v: [[[.06,.12],[.16,.77],[.34,1.01],[.81,.15],[.98,.28]]],
  w: [[[.06,.1],[.13,.82],[.32,.98],[.65,.18],[.66,.78],[.84,1.02],[1.22,.15],[1.4,.28]]],
  x: [[[.08,.14],[.85,.96],[1.06,.79]],[[.9,.05],[.04,1.04]]],
  y: [[[.12,.12],[.06,.71],[.23,.99],[.58,.73],[.81,.1],[.66,1.37],[.36,1.69],[.04,1.46],[.47,1.2],[1.06,.83]]],
  z: [[[.05,.19],[.72,.08],[.24,.62],[.73,.62],[.88,.9],[.56,1.39],[.22,1.42],[.55,1.09],[1.05,.83]]],
  I: [[[.47,-.04],[.36,1.05]]],
  T: [[[.01,.13],[.46,-.02],[1.04,.08]],[[.52,.03],[.4,1.07]]],
};

// Deliberately composed scraps, not evenly fitted lines. Words intrude into
// each other, dwindle, restart lower down or lean against a larger thought.
// The fourth coordinate is x-height; lowercase ascenders/descenders overshoot.
const scraps = [
  null, null,
  [['the',53,112,70,-.2,205,'readable'],['radio',58,229,105,.1,410,'readable']],
  [['she',49,119,64,.17,176],['loved',197,171,86,-.2,277,'rewrite'],['the',35,307,47,-.08,150],['radio',150,322,78,.08,315]],
  [['rain',43,110,86,-.1,330,'readable'],['rain',194,187,66,.22,250,'cross'],['always',36,287,56,-.19,283],['rain',238,356,73,-.12,235,'rewrite']],
  [['I',38,97,86,-.18,45],['just',91,114,68,.12,178],['wanted',130,201,72,-.14,340,'cross'],['the',42,272,48,.2,125],['radio',131,320,86,-.17,313,'rewrite'],['STOP',216,408,62,-.03,249]],
  [['why',38,100,92,.15,232,'readable'],['wouldn\'t',95,200,53,-.1,365,'readable'],['she',49,282,45,-.25,148],['listen',180,320,68,.08,278,'readable'],['to me',94,413,51,-.18,327]],
  [['STOP',37,113,139,-.08,408,'rewrite'],['the',76,277,49,.2,137],['noise',134,333,93,-.12,333,'cross']],
  null,
  [['she',37,121,72,-.22,175],['wanted',153,163,68,.16,319,'rewrite'],['her',48,307,80,.12,183],['bath',220,342,90,-.18,250]],
  [['the',45,99,51,.16,133],['water',112,187,105,-.1,347,'rewrite'],['remembers',41,355,72,.07,421]],
  [['hands',38,131,98,-.13,370],['keep',219,256,65,.16,238],['turning',48,361,86,-.15,413,'rewrite']],
  [['I',39,91,93,.1,45],['still',107,133,85,-.16,269,'rewrite'],['hear',52,299,105,.15,303],['it',322,372,72,-.16,133]],
  [['Mum',50,143,132,-.16,363,'rewrite'],['is',343,173,48,.16,100],['waiting',44,348,91,.08,424,'cross']],
  [['rain',31,103,78,.13,308,'readable'],['RAIN',172,219,98,-.16,306,'rewrite'],['rain',54,356,113,-.1,403]],
  [['the',41,99,51,-.18,145],['radio',150,165,92,.12,310,'rewrite'],['never',39,294,82,-.14,302,'cross'],['stops',197,373,78,.12,268]],
];

export const BLOOD_RECIPES = Object.freeze([
  { text: "93.7", lines: ["93.7"], seed: 101 },
  { text: "93.7", lines: ["93.7"], seed: 387, overwrite: true },
  { text: "the radio", lines: ["THE RADIO"], seed: 551 },
  { text: "she loved the radio", lines: ["SHE LOVED", "THE RADIO"], seed: 787 },
  { text: "rain... always rain", lines: ["RAIN RAIN", "ALWAYS RAIN"], seed: 997 },
  { text: "I just wanted the radio to stop", lines: ["I JUST WANTED", "THE RADIO", "TO STOP"], seed: 1217 },
  { text: "why wouldn't she listen to me", lines: ["WHY WOULDN'T", "SHE LISTEN", "TO ME"], seed: 1373 },
  { text: "stop the noise", lines: ["STOP", "THE NOISE"], seed: 1559 },
  { text: "93.7 93.7", lines: ["93.7", "93.7"], seed: 1777 },
  { text: "she wanted her bath", lines: ["SHE WANTED", "HER BATH"], seed: 1993 },
  { text: "the water remembers", lines: ["THE WATER", "REMEMBERS"], seed: 2213 },
  { text: "hands keep turning", lines: ["HANDS KEEP", "TURNING"], seed: 2399 },
  { text: "I still hear it", lines: ["I STILL", "HEAR IT"], seed: 2591 },
  { text: "Mum is waiting", lines: ["MUM IS", "WAITING"], seed: 2797 },
  { text: "rain rain rain", lines: ["RAIN", "RAIN", "RAIN"], seed: 3011 },
  { text: "the radio never stops", lines: ["THE RADIO", "NEVER STOPS"], seed: 3209 },
].map(recipe => Object.freeze(recipe)));

function randomSequence(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function roundedStroke(points, width, random) {
  const samples = [];
  let travelled = 0;
  const phase = random() * 9;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[Math.max(0, i - 1)], b = points[i];
    const c = points[i + 1], d = points[Math.min(points.length - 1, i + 2)];
    const steps = Math.max(2, Math.ceil(Math.hypot(c[0] - b[0], c[1] - b[1]) / 2.2));
    for (let step = 0; step < steps; step++) {
      const t = step / steps, t2 = t * t, t3 = t2 * t;
      const point = [0, 1].map(axis => .5 * ((2 * b[axis]) + (-a[axis] + c[axis]) * t +
        (2 * a[axis] - 5 * b[axis] + 4 * c[axis] - d[axis]) * t2 +
        (-a[axis] + 3 * b[axis] - 3 * c[axis] + d[axis]) * t3));
      const last = samples.at(-1);
      if (last) travelled += Math.hypot(point[0] - last.x, point[1] - last.y);
      const direction = Math.atan2(c[1] - b[1], c[0] - b[0]);
      const shake = width * (.045 * Math.sin(travelled * .27 + phase) + .022 * Math.sin(travelled * 1.31));
      samples.push({ x: point[0] - Math.sin(direction) * shake,
        y: point[1] + Math.cos(direction) * shake, direction, travelled });
    }
  }
  const end = points.at(-1);
  samples.push({ x: end[0], y: end[1], direction: samples.at(-1)?.direction || 0, travelled: travelled + 2 });
  return samples;
}

function traceFinger(g, points, width, random, { clean = false, opacity = 1, loaded = false } = {}) {
  if (points.length < 2) return;
  const samples = roundedStroke(points, width, random), length = samples.at(-1).travelled || 1;
  const phase = random() * 8, breakAt = .32 + random() * .34;
  const broken = !clean && !loaded && random() < .21;
  // A loaded finger starts broad and wet, then leaves two ragged edges as it
  // runs dry. Strokes are individual pressure deposits, never a font outline.
  for (const sample of samples) {
    const t = sample.travelled / length;
    if (broken && t > breakAt && t < breakAt + .055) continue;
    const load = Math.max(.08, 1 - .8 * Math.pow(t, 1.9));
    const pressure = (.79 + .18 * Math.sin(sample.travelled * .105 + phase) + (random() - .5) * .13) *
      (clean ? .86 + .14 * load : .34 + .66 * load);
    const radius = width * pressure * .5;
    const wet = loaded ? .85 : clean ? .92 : .34 + .6 * load;
    g.fillStyle = `rgba(${113 + Math.floor(random() * 28)},${5 + Math.floor(random() * 5)},${6 + Math.floor(random() * 5)},${opacity * wet * .58})`;
    g.beginPath(); g.ellipse(sample.x, sample.y, radius * 1.28, radius * .86, sample.direction + .25, 0, Math.PI * 2); g.fill();
    g.fillStyle = `rgba(${65 + Math.floor(random() * 38)},3,5,${opacity * wet * .83})`;
    g.beginPath(); g.ellipse(sample.x + .4, sample.y + .35, radius * .91, radius * .67,
      sample.direction + .12, 0, Math.PI * 2); g.fill();
  }
  if (!clean && width > 5 && random() < .64) {
    g.save(); g.globalCompositeOperation = 'destination-out';
    g.strokeStyle = `rgba(0,0,0,${.22 + random() * .29})`; g.lineWidth = .55 + random() * 1.1; g.lineCap = 'round';
    g.beginPath();
    const side = (random() - .5) * width * .6;
    samples.slice(Math.floor(samples.length * .24)).forEach((point, index) => {
      const x = point.x - Math.sin(point.direction) * side, y = point.y + Math.cos(point.direction) * side;
      if (!index) g.moveTo(x, y); else g.lineTo(x, y);
    });
    g.stroke(); g.restore();
  }
}

function wordPlan(text, height, random, readable = false) {
  let x = 0;
  const plans = [], capitals = text === text.toUpperCase(), slope = (random() - .5) * (readable ? .16 : .52);
  for (const [index, character] of [...text].entries()) {
    if (character === ' ') { x += height * (.24 + random() * .28); continue; }
    const lower = character.toLowerCase();
    const uppercase = character === 'I' || (capitals ? random() < .7 : !readable && random() < .08);
    const shape = uppercase ? hand[character.toUpperCase()] || glyphs[character.toUpperCase()] : hand[lower] || glyphs[character];
    const narrow = 'ijl'.includes(lower) ? .29 : lower === 'm' ? .74 : lower === 'w' ? .7 : .57;
    const width = height * narrow * (readable ? .86 + random() * .29 : .65 + random() * .74);
    plans.push({ shape: shape || hand.i, x,
      y: height * ((random() - .5) * (readable ? .12 : .28) + Math.sin(index * 1.71) * (readable ? .04 : .12) + index / Math.max(1, text.length - 1) * slope),
      width, height: height * (readable ? .88 + random() * .24 : .67 + random() * .62), angle: (random() - .5) * (readable ? .16 : .47),
      shear: (random() - .35) * .2, pressure: height * (.115 + random() * .055) });
    x += width * (.78 + random() * .32) + height * (random() - .58) * .12;
  }
  return { plans, width: x + height * .5 };
}

function drawWord(g, scrap, random) {
  const [text, x, y, height, angle, maxWidth, damage] = scrap;
  const readable = damage === 'readable';
  const paint = (content, offsetX, offsetY, scale, alpha) => {
    const plan = wordPlan(content, height * scale, random, readable);
    const stretch = Math.min(1.13, maxWidth / Math.max(1, plan.width));
    g.save(); g.translate(x + offsetX, y + offsetY); g.rotate(angle); g.scale(stretch, 1);
    for (const letter of plan.plans) {
      g.save(); g.translate(letter.x, letter.y); g.rotate(letter.angle);
      for (const path of letter.shape) {
        const points = path.map(([u, v]) => [u * letter.width + (1 - v) * letter.shear * letter.height,
          v * letter.height]);
        traceFinger(g, points, letter.pressure, random, { opacity: alpha, clean: readable });
        if (random() < (readable ? .06 : .24)) traceFinger(g, points.map(([px, py]) => [px + 2 + random() * 4, py - 1 + random() * 5]),
          letter.pressure * .58, random, { opacity: alpha * .74 });
      }
      g.restore();
    }
    g.restore();
    return Math.min(maxWidth, plan.width * stretch);
  };
  if (damage === 'rewrite') {
    // The abandoned attempt uses different letter proportions and only gets
    // partway through the word. It cannot read as a repeated typeset stamp.
    paint(text.slice(0, Math.max(2, Math.ceil(text.length * .69))), 17, 22, 1.03, .65);
  }
  const width = paint(text, 0, 0, 1, 1);
  if (damage === 'cross') {
    g.save(); g.translate(x, y); g.rotate(angle);
    traceFinger(g, [[-8,height*.86],[width*.22,height*.45],[width*.61,height*.72],[width+12,height*.13]],
      Math.max(8,height*.14), random, { loaded:true, opacity:.94 });
    traceFinger(g, [[-2,height*.28],[width*.42,height*.59],[width+8,height*.9]],
      Math.max(5,height*.085), random, { opacity:.79 });
    g.restore();
  }
}

function wetDab(g, x, y, radius, random) {
  for (let i = 0; i < 6; i++) {
    g.fillStyle = i < 3 ? 'rgba(119,5,8,.89)' : 'rgba(55,2,4,.94)';
    g.beginPath();g.ellipse(x + (random()-.5)*radius*.7, y + (random()-.5)*radius*.45,
      radius*(i<3?1:.67),radius*(i<3?.72:.48),random()*.8,0,Math.PI*2);g.fill();
  }
}

function drawNumbers(g, random, { x = 34, y = 55, scale = 1, angle = 0, damaged = false } = {}) {
  g.save();g.translate(x,y);g.rotate(angle);g.scale(scale,scale);
  const numbers = [
    ['9',8,10,112,257,-.09],['3',145,34,105,231,.075],['7',326,-1,124,270,-.075],
  ];
  for (const [digit,px,py,width,height,rotation] of numbers) {
    g.save();g.translate(px,py);g.rotate(rotation);
    for (const path of glyphs[digit]) {
      const points = path.map(([u,v])=>[u*width+(random()-.5)*4,v*height+(random()-.5)*8]);
      traceFinger(g,points,damaged?20:24,random,{clean:!damaged});
      if(damaged)traceFinger(g,points.map(([u,v])=>[u+7,v+12]),11,random,{opacity:.55});
    }
    g.restore();
  }
  // A distinct pooled decimal is essential to the actual radio puzzle. It
  // stays isolated from the 3 and 7, rather than becoming a thin fourth stroke.
  wetDab(g,285,267,13,random);
  traceFinger(g,[[284,268],[288,277],[287,287]],6,random,{loaded:true});
  g.restore();
}

function smear(g, random, index) {
  // A wipe is a particular accident, not an underline beneath every phrase.
  // Most scraps have none. The few surviving pulls differ in reach and angle.
  const pulls = {
    1: [78,352,399,399,2,22],
    5: [49,267,424,320,3,24],
    7: [55,341,408,260,2,27],
    8: [190,203,449,218,1,30],
    13: [267,177,418,352,4,18],
    15: [128,379,423,414,1,34],
  };
  const pull = pulls[index];
  if(!pull)return;
  const [x0,y0,x1,y1,count,width]=pull;
  for(let finger=0;finger<count;finger++){
    const spread=finger*(9+random()*6),bow=(random()-.5)*46;
    traceFinger(g,[[x0+spread*.35,y0+spread],[x0+(x1-x0)*.29+spread,y0+(y1-y0)*.29+bow+spread],
      [x0+(x1-x0)*.72+spread,y0+(y1-y0)*.72+bow*.4+spread],[x1+spread*.2,y1+spread]],
      width-finger*2,random,{loaded:true,opacity:.3+random()*.26});
  }
}

function gravityRuns(g, random, numeric) {
  const data=g.getImageData(0,0,512,512).data,candidates=[];
  const alpha=(x,y)=>data[(y*512+x)*4+3];
  // Take the lower edge of actual deposits throughout the tile, not one
  // shared baseline. Pooled starts remain visibly attached to existing blood.
  for(let y=31;y<427;y+=3)for(let x=27;x<486;x+=3)
    if(alpha(x,y)>195&&alpha(x,Math.min(499,y+6))<100)candidates.push([x,y]);
  const used=[],target=numeric?12:14;
  let drips=0;
  for(let attempt=0;attempt<400&&drips<target&&candidates.length;attempt++){
    const [x,y]=candidates[Math.floor(random()*candidates.length)];
    if(used.some(([px,py])=>Math.abs(px-x)<11&&Math.abs(py-y)<35))continue;
    const heavy=drips%4===0;
    const length=Math.min(492-y,(heavy?102:19)+random()*(heavy?112:99));
    if(length<20)continue;
    used.push([x,y]);
    const drift=(random()-.5)*5.5, width=(heavy?4.4:1.6)+random()*(heavy?3.1:2.8);
    const endX=x+drift,endY=y+length;
    const phase=random()*7, dryAt=.28+random()*.4, interrupted=drips%3===1;
    const flow=[];
    const steps=Math.ceil(length/1.7);
    for(let step=0;step<=steps;step++){
      const t=step/steps;
      const dry = interrupted && t > dryAt && t < dryAt + .05 ? .18 : 1;
      const radius=Math.max(.42,width*(.53-.41*t)*(.84+.16*Math.sin(t*23+phase)))*dry;
      flow.push({x:x+drift*t+Math.sin(t*13+phase)*Math.sin(t*Math.PI)*.65,
        y:y-2+length*t,radius,ink:(numeric ? .98-t*.23 : .94-t*.52)*dry});
    }
    if(heavy){
      // Blood diluted into the wallpaper's grain leaves a broad faint skirt
      // around a few runs; it is separate from the narrow retained deposit.
      const wash=g.createLinearGradient(x,y,x,endY);
      wash.addColorStop(0,'rgba(115,5,8,.23)');wash.addColorStop(1,'rgba(97,3,6,0)');
      g.strokeStyle=wash;g.lineWidth=width*2.3;g.lineCap='round';g.beginPath();
      flow.forEach((point,index)=>{if(!index)g.moveTo(point.x,point.y);else g.lineTo(point.x,point.y);});g.stroke();
    }
    for(const point of flow){
      g.fillStyle=`rgba(119,5,8,${point.ink*.73})`;g.beginPath();
      g.ellipse(point.x,point.y,point.radius*1.3,1.7,0,0,Math.PI*2);g.fill();
    }
    for(const point of flow){
      g.fillStyle=`rgba(57,2,4,${point.ink*.86})`;g.beginPath();
      g.ellipse(point.x+.2,point.y,point.radius*.68,1.3,0,0,Math.PI*2);g.fill();
    }
    wetDab(g,x,y,heavy?6+random()*4:3+random()*3,random);
    if(drips%3===0)wetDab(g,endX,endY,2.1+random()*2.6,random);
    else if(drips%3===2){
      g.fillStyle='rgba(89,3,5,.72)';g.beginPath();g.ellipse(endX,endY-4,1.1+random(),3+random()*4,.1,0,Math.PI*2);g.fill();
    }
    if(heavy&&drips%8===0){
      const point=flow[Math.floor(flow.length*.57)];
      wetDab(g,point.x,point.y,2+random()*2,random);
    }
    drips++;
  }
  return drips;
}

function drawRecipe(canvas, recipe, index) {
  const g=canvas.getContext('2d',{willReadFrequently:true}),random=randomSequence(recipe.seed);
  g.save();g.beginPath();g.rect(13,13,486,486);g.clip();
  const numeric=index===0||index===1||index===8;
  if(index===0)drawNumbers(g,random);
  else if(index===1){
    smear(g,random,index);drawNumbers(g,random,{x:46,y:43,scale:.92,angle:.04,damaged:true});
    traceFinger(g,[[42,345],[201,302],[344,330],[467,286]],14,random,{loaded:true,opacity:.9});
  }else if(index===8){
    smear(g,random,index);drawNumbers(g,random,{x:28,y:43,scale:.8,angle:.07,damaged:true});
    drawNumbers(g,random,{x:85,y:229,scale:.79,angle:-.08,damaged:true});
  }else{
    smear(g,random,index);
    for(const scrap of scraps[index])drawWord(g,scrap,random);
  }
  const drips=gravityRuns(g,random,numeric);
  // Tiny local spatters belong to the writing, not a uniform noise field.
  for(let i=0;i<15;i++){
    const x=38+random()*427,y=75+random()*360;
    if(g.getImageData(Math.floor(x),Math.floor(y),1,1).data[3]){
      g.fillStyle='rgba(99,3,6,.76)';g.beginPath();g.ellipse(x+(random()-.5)*17,y+(random()-.5)*13,
        .6+random()*1.8,.8+random()*2.2,random()*3,0,Math.PI*2);g.fill();
    }
  }
  g.restore();
  return {drips,text:recipe.text};
}

let sharedAtlas;
export function createBloodAtlas() {
  if (sharedAtlas) return sharedAtlas;
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 2048;
  const g = canvas.getContext("2d");
  const stats = BLOOD_RECIPES.map((recipe, index) => {
    const tile = document.createElement("canvas"); tile.width = tile.height = 512;
    const result = drawRecipe(tile, recipe, index);
    g.drawImage(tile, (index % 4) * 512, Math.floor(index / 4) * 512);
    return result;
  });
  const texture = new T.CanvasTexture(canvas);
  texture.name = "Original blood-drenched finger ramblings atlas";
  texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 4;
  sharedAtlas = { texture, stats, recipes: BLOOD_RECIPES };
  return sharedAtlas;
}

export function bloodMaterial(atlas) {
  // A low, blood-tinted reflection keeps nearby white bulbs from turning a
  // single digit into pale pink while retaining a trace of wet sheen.
  return new T.MeshPhysicalMaterial({ map: atlas.texture, color: 0xffffff,
    transparent: true, opacity: 1, alphaTest: .025, depthWrite: false,
    side: T.FrontSide, roughness: .64, metalness: 0, envMapIntensity: .025,
    specularIntensity: .08, specularColor: 0x310301,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
}

export function bloodPatchGeometry(mark) {
  const geometry = new T.PlaneGeometry(mark.w, mark.h);
  const uv = geometry.attributes.uv, tile = mark.tile || 0;
  const col = tile % 4, row = Math.floor(tile / 4);
  for (let i = 0; i < uv.count; i++)
    uv.setXY(i, (col + uv.getX(i)) / 4, (3 - row + uv.getY(i)) / 4);
  const matrix = new T.Matrix4().compose(new T.Vector3(mark.x, mark.y, mark.z),
    new T.Quaternion().setFromEuler(new T.Euler(mark.pitch || 0, mark.yaw || 0, mark.tilt || 0)), new T.Vector3(1, 1, 1));
  return geometry.applyMatrix4(matrix);
}
