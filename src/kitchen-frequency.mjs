import * as T from "three";

export const KITCHEN_FREQUENCY = "93.7";

// These are interior wall faces, not free-floating cards. The north window,
// wall cupboards, fridge and doorway remain clear of every authored patch.
export const KITCHEN_FREQUENCY_MARKS = Object.freeze([
  { wall: "west", x: .903, y: 1.68, z: -2.24, w: 1.34, h: .59, yaw: Math.PI / 2, tilt: -.035, primary: true },
  { wall: "west", x: .903, y: 2.085, z: -3.48, w: .95, h: .275, yaw: Math.PI / 2, tilt: .025 },
  { wall: "east", x: 4.497, y: 1.60, z: -3.34, w: 1.18, h: .54, yaw: -Math.PI / 2, tilt: .025 },
  { wall: "east", x: 4.497, y: 1.15, z: -3.65, w: .68, h: .23, yaw: -Math.PI / 2, tilt: -.025 },
  { wall: "north", x: 1.74, y: 1.65, z: -4.597, w: .34, h: .30, yaw: 0, tilt: -.025 },
  { wall: "north", x: 3.56, y: 1.38, z: -4.597, w: .30, h: .29, yaw: 0, tilt: .025 },
  { wall: "west", x: .903, y: 2.07, z: -1.43, w: .65, h: .27, yaw: Math.PI / 2, tilt: -.02 },
  { wall: "entry", x: 1.38, y: 1.75, z: -.763, w: .70, h: .44, yaw: Math.PI, tilt: -.025 },
  { wall: "entry", x: 3.46, y: 2.05, z: -.763, w: .77, h: .27, yaw: Math.PI, tilt: .02 },
].map(mark => Object.freeze(mark)));

function randomSequence(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

// Original continuous finger paths: a closed upper bowl and descending stem
// distinguish 9 from 6; the open lobes of 3, decimal and crossed 7 stay legible.
function fingerNumber(context, offset = 0) {
  const digit = (x, draw) => {
    context.save();
    context.translate(x, 58 + offset);
    context.scale(208, 292);
    context.beginPath();
    draw(context);
    context.restore();
    context.stroke();
  };
  digit(100, g => {
    g.moveTo(.77, .28);
    g.bezierCurveTo(.78, .04, .22, -.02, .14, .23);
    g.bezierCurveTo(.02, .52, .60, .60, .77, .28);
    g.moveTo(.77, .23);
    g.bezierCurveTo(.84, .52, .66, .84, .24, .96);
  });
  digit(342, g => {
    g.moveTo(.14, .16);
    g.bezierCurveTo(.78, -.10, 1.00, .39, .47, .47);
    g.bezierCurveTo(.99, .43, 1.05, 1.02, .13, .91);
  });
  context.beginPath();
  context.ellipse(608, 330 + offset, 13, 15, -.2, 0, Math.PI * 2);
  context.fill();
  digit(680, g => {
    g.moveTo(.08, .11);
    g.bezierCurveTo(.30, .08, .62, .12, .91, .10);
    g.bezierCurveTo(.69, .35, .45, .65, .29, .97);
    g.moveTo(.32, .52);
    g.bezierCurveTo(.49, .52, .62, .50, .73, .48);
  });
}

function fingerTexture(variant) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const g = canvas.getContext("2d", { willReadFrequently: true });
  const random = randomSequence(1709 + variant * 413);
  const trace = (color, width, offset) => {
    g.strokeStyle = g.fillStyle = color;
    g.lineWidth = width;
    g.lineCap = "round";
    g.lineJoin = "round";
    // Paths retain their pixel-space positions when each digit transform is
    // restored, so the final line width remains one uneven finger swipe.
    fingerNumber(g, offset);
  };
  trace("rgba(55,3,2,.80)", 31, 1);
  trace("rgba(112,10,7,.93)", 25, 0);
  trace("rgba(145,24,16,.35)", 15, -1);

  // Fine dry gaps, wipe striations and edge breakup affect only existing ink.
  g.globalCompositeOperation = "destination-out";
  const edgeMask = g.getImageData(0, 0, canvas.width, canvas.height).data;
  const alpha = (x, y) => edgeMask[(y * canvas.width + x) * 4 + 3];
  for (let i = 0; i < 2200; i++) {
    const x = Math.floor(90 + random() * 820), y = Math.floor(45 + random() * 325);
    if (alpha(x, y) < 50 || [alpha(x - 8, y), alpha(x + 8, y), alpha(x, y - 8), alpha(x, y + 8)].every(value => value > 150)) continue;
    g.fillStyle = `rgba(0,0,0,${.15 + random() * .45})`;
    g.beginPath();
    g.ellipse(x, y, 1.0 + random() * 4.2, .5 + random() * 2.8, random(), 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 16; i++) {
    g.globalAlpha = .10;
    g.fillRect(90 + random() * 820, 50 + random() * 300, 1, 18 + random() * 45);
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";
  const pixels = g.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let i = 0; i < 19; i++) {
    const x = Math.floor(115 + random() * 755);
    let bottom = 0;
    for (let y = 65; y < 380; y++)
      if (pixels[(y * canvas.width + x) * 4 + 3] > 145) bottom = y;
    if (!bottom) continue;
    const length = 18 + random() * 92;
    const bend = (random() - .5) * 8;
    g.strokeStyle = `rgba(80,5,3,${.38 + random() * .35})`;
    g.lineWidth = 1.5 + random() * 3;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(x, bottom - 5);
    g.bezierCurveTo(x + bend, bottom + length * .35,
      x - bend * .3, bottom + length * .7, x + bend * .2, bottom + length);
    g.stroke();
    g.beginPath();
    g.ellipse(x + bend * .2, bottom + length, 2.5, 4, 0, 0, Math.PI * 2);
    g.fillStyle = "rgba(91,6,3,.77)";
    g.fill();
  }
  for (let i = 0; i < 30; i++) {
    g.fillStyle = `rgba(77,4,2,${.15 + random() * .42})`;
    g.beginPath();
    g.ellipse(70 + random() * 860, 70 + random() * 370,
      1 + random() * 3.5, 1 + random() * 4, random(), 0, Math.PI * 2);
    g.fill();
  }
  const texture = new T.CanvasTexture(canvas);
  texture.name = `Original finger-written ${KITCHEN_FREQUENCY} / ${variant}`;
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function createKitchenFrequency(parent, builders) {
  const root = new T.Group();
  root.name = "The kitchen remembers its station";
  root.visible = false;
  parent.add(root);
  const textures = [0, 1, 2].map(fingerTexture);
  const materials = textures.map(map => new T.MeshStandardMaterial({
    map, color: 0xffffff, transparent: true, opacity: .98,
    alphaTest: .018, depthWrite: false, side: T.FrontSide,
    roughness: .48, metalness: 0, envMapIntensity: .05,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  }));
  const markings = KITCHEN_FREQUENCY_MARKS.map((mark, index) => {
    const mesh = new T.Mesh(new T.PlaneGeometry(mark.w, mark.h), materials[index % 3]);
    mesh.name = `Kitchen blood-written ${KITCHEN_FREQUENCY} / ${mark.wall} ${index + 1}`;
    mesh.position.set(mark.x, mark.y, mark.z);
    mesh.rotation.set(0, mark.yaw, 0);
    mesh.rotateZ(mark.tilt);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.userData.stationClue = KITCHEN_FREQUENCY;
    mesh.userData.wall = mark.wall;
    mesh.userData.primary = Boolean(mark.primary);
    root.add(mesh);
    builders.target("station-clue", mesh, "READ THE BLOOD-WRITTEN STATION", 2.4);
    return mesh;
  });
  return {
    root, markings, materials, textures, primary: markings[0],
    setVisible(value) { root.visible = Boolean(value); },
    animate(state) { root.visible = state.stage === 2 && Boolean(state.clockSolved); },
    reset() { root.visible = false; },
    snapshot: () => ({ visible: root.visible, text: KITCHEN_FREQUENCY,
      count: markings.length, primary: markings[0].getWorldPosition(new T.Vector3()).toArray() }),
  };
}
