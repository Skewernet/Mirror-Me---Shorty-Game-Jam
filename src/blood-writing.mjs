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

function traceFinger(g, points, width, random) {
  // Small overlapping pressure stamps keep a ragged physical finger margin
  // instead of the perfectly round, even vector stroke of the old clue.
  // A dragged finger rounds a change of direction; a little corner cutting
  // avoids the hard straight-edged polygon joints of a digital letter.
  if (points.length > 2) {
    const rounded = [points[0]];
    for (let i = 1; i < points.length - 1; i++) {
      const previous = points[i - 1], corner = points[i], next = points[i + 1];
      rounded.push([corner[0] * .82 + previous[0] * .18, corner[1] * .82 + previous[1] * .18],
        [corner[0] * .82 + next[0] * .18, corner[1] * .82 + next[1] * .18]);
    }
    rounded.push(points.at(-1)); points = rounded;
  }
  const phase = random() * Math.PI * 2;
  let distance = 0;
  for (let segment = 1; segment < points.length; segment++) {
    const a = points[segment - 1], b = points[segment];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.max(1, Math.ceil(length / Math.max(1.1, width * .14)));
    for (let step = 0; step <= steps; step++) {
      const t = step / steps;
      const pressure = .76 + .15 * Math.sin((distance + length * t) * .08 + phase) + (random() - .5) * .12;
      const radius = width * pressure * .5;
      const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
      g.fillStyle = `rgba(${73 + Math.floor(random() * 16)},${4 + Math.floor(random() * 4)},3,.96)`;
      g.beginPath();
      g.ellipse(x + (random() - .5) * .8, y + (random() - .5) * .8, radius, radius * (.72 + random() * .22), random() * .8, 0, Math.PI * 2);
      g.fill();
    }
    distance += length;
  }
}

function drawRecipe(canvas, recipe, index) {
  const g = canvas.getContext("2d", { willReadFrequently: true });
  const random = randomSequence(recipe.seed);
  const count = recipe.lines.length;
  const numeric = recipe.lines.every(line => /^[937.]+$/.test(line));
  const lineHeight = count === 1 ? (numeric ? 246 : 150) : count === 2 ? 131 : 97;
  const top = count === 1 ? (numeric ? 52 : 113) : 47;
  recipe.lines.forEach((line, lineIndex) => {
    const units = [...line].reduce((sum, letter) => sum + (letter === " " ? .53 : letter === "." ? .30 : letter === "'" ? .32 : 1), 0);
    const advance = Math.min(numeric ? 108 : 49, 434 / units);
    const height = lineHeight * (.93 + random() * .08);
    let x = 35 + random() * 10;
    const baseline = top + lineIndex * lineHeight * 1.15 + (random() - .5) * 8;
    for (const letter of line) {
      if (letter === " ") { x += advance * .53; continue; }
      const paths = glyphs[letter] || glyphs.I;
      const letterHeight = height * (.86 + random() * .19);
      const letterWidth = advance * (.69 + random() * .15);
      const slant = (random() - .46) * .16;
      const jitter = numeric ? .027 : .042;
      for (const path of paths) {
        const points = path.map(([u, v]) => [
          x + (u + (random() - .5) * jitter + v * slant) * letterWidth,
          baseline + (v + (random() - .5) * jitter) * letterHeight,
        ]);
        traceFinger(g, points, (numeric ? 18 : 7.6) * (.88 + random() * .3), random);
      }
      x += advance * (letter === "." ? .30 : letter === "'" ? .32 : .87 + random() * .18);
    }
  });
  if (recipe.overwrite) {
    g.strokeStyle = "rgba(47,2,2,.58)"; g.lineWidth = 3.5;
    g.beginPath(); g.moveTo(35, 347); g.lineTo(460, 319); g.stroke();
    g.beginPath(); g.moveTo(43, 337); g.lineTo(438, 361); g.stroke();
  }
  // Dry pull-lines run within the paint. They take narrow, unequal pieces
  // from the stroke, rather than lowering one entire digit to a pink opacity.
  g.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 42; i++) {
    g.fillStyle = `rgba(0,0,0,${.12 + random() * .2})`;
    g.fillRect(35 + random() * 430, 40 + random() * 335, .4 + random() * 1.1, 8 + random() * 28);
  }
  g.globalCompositeOperation = "source-over";
  const data = g.getImageData(0, 0, 512, 512).data;
  let drips = 0;
  for (let attempt = 0; attempt < 80 && drips < (numeric ? 11 : 9); attempt++) {
    const x = Math.floor(42 + random() * 420);
    let bottom = 0;
    for (let y = 42; y < 390; y++) if (data[(y * 512 + x) * 4 + 3] > 180) bottom = y;
    if (!bottom || bottom > 399) continue;
    const length = Math.min(490 - bottom, 28 + random() * 125);
    const drift = (random() - .5) * 5;
    g.strokeStyle = `rgba(58,3,2,${.55 + random() * .25})`;
    g.lineWidth = 1.0 + random() * 2.8; g.lineCap = "round";
    g.beginPath(); g.moveTo(x, bottom - 3);
    g.bezierCurveTo(x + drift, bottom + length * .36, x + drift * .2, bottom + length * .74, x + drift * .5, bottom + length);
    g.stroke();
    g.fillStyle = "rgba(68,3,2,.88)";
    g.beginPath(); g.ellipse(x + drift * .5, bottom + length, 1.4 + random(), 2.7 + random() * 1.4, 0, 0, Math.PI * 2); g.fill();
    drips++;
  }
  // A few actual finger pull-offs and small palm smears disrupt the spacing.
  if (index % 3 !== 0) {
    for (let finger = 0; finger < 4; finger++) {
      g.strokeStyle = `rgba(64,3,2,${.09 + finger * .025})`; g.lineWidth = 6 + finger;
      g.beginPath();g.moveTo(388 + finger * 15, 353);g.quadraticCurveTo(400 + finger * 15, 383, 377 + finger * 15, 406 + finger * 3);g.stroke();
    }
  }
  if (index % 4 === 2) {
    g.save();g.translate(427,435);g.rotate(-.28);
    g.strokeStyle = "rgba(64,3,2,.23)";g.lineWidth = .7;
    for (let ridge = 0; ridge < 8; ridge++) {
      g.beginPath();g.ellipse(0,0,2.7+ridge*1.4,4+ridge*1.8,0,.2,Math.PI*1.86);g.stroke();
    }
    g.restore();
  }
  return { drips, text: recipe.text };
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
