import * as T from "three";
import { RGBELoader } from "../vendor/RGBELoader.js";
let seed = 1709;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
function canvas(w = 512, h = w) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d", { willReadFrequently: true })];
}
function texture(c) {
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.magFilter = T.LinearFilter;
  t.minFilter = T.LinearMipmapLinearFilter;
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
function patina(g, size, amount = 6000) {
  for (let i = 0; i < amount; i++) {
    g.fillStyle =
      random() > 0.5 ? "rgba(0,0,0,.025)" : "rgba(255,235,200,.035)";
    g.fillRect(
      random() * size,
      random() * size,
      1 + random() * 2,
      1 + random() * 2,
    );
  }
}
function cloud(g, size, color, number = 18) {
  for (let i = 0; i < number; i++) {
    const x = random() * size,
      y = random() * size,
      r = 20 + random() * size * 0.55;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, color);
    grad.addColorStop(1, "transparent");
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}
async function imageAt(path) {
  const i = new Image();
  i.src = new URL(path, import.meta.url).href;
  await i.decode();
  return i;
}
function crop(image, x, y, w, h) {
  const [c, g] = canvas();
  g.drawImage(image, x, y, w, h, 0, 0, c.width, c.height);
  return c;
}
export async function createSurfaces() {
  // Keep colour in sRGB and all physical data in linear space. Each source has
  // independent relief/roughness; there is no albedo-as-bump fallback.
  const loader = new T.TextureLoader();
  const load = async (file, color = false) => {
    const map = await loader.loadAsync(
      new URL(`../assets/materials/${file}`, import.meta.url).href,
    );
    map.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace;
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.anisotropy = 8;
    map.magFilter = T.LinearFilter;
    map.minFilter = T.LinearMipmapLinearFilter;
    return map;
  };
  const sets = {};
  await Promise.all([
    ...[
      "wallpaper",
      "plaster",
      "panel",
      "tile",
      "linen",
      "concrete",
      "rust",
    ].map(async (name) => {
      const [map, normalMap, roughnessMap] = await Promise.all([
        load(`original/${name}-color.webp`, true),
        load(`original/${name}-normal.webp`),
        load(`original/${name}-roughness.webp`),
      ]);
      sets[name] = { map, normalMap, roughnessMap };
    }),
    (async () => {
      const [map, normalMap, roughnessMap] = await Promise.all([
        load("photographic/wood-color.jpg", true),
        load("photographic/wood-normal.jpg"),
        load("photographic/wood-roughness.jpg"),
      ]);
      sets.floor = sets.wood = { map, normalMap, roughnessMap };
    })(),
    (async () => {
      const [map, normalMap, arm] = await Promise.all([
        load("photographic/fabric-color.jpg", true),
        load("photographic/fabric-normal.jpg"),
        load("photographic/fabric-arm.jpg"),
      ]);
      sets.fabric = { map, normalMap, roughnessMap: arm, aoMap: arm };
    })(),
  ]);
  // Original photographic-style albedos supply natural paper/paint variation.
  // Their surface data stays independent: ink and discoloration are not relief.
  const albedoSheet = await imageAt(
    "../assets/materials/original/tactile-house-albedos.png",
  );
  const half = albedoSheet.width / 2;
  for (const [name, x, y] of [
    ["wallpaper", 0, 0],
    ["plaster", half, 0],
    ["panel", 0, half],
  ]) {
    sets[name].map.dispose();
    const [c, g] = canvas(1024);
    // Power-of-two upload also permits repeat+mipmaps on WebGL1. Source pixels
    // are 627 square; the upload size does not add photographic detail.
    g.drawImage(albedoSheet, x, y, half, half, 0, 0, 1024, 1024);
    sets[name].map = texture(c);
    sets[name].map.anisotropy = 8;
    // The generated photographic sheet is not an exact periodic scan. Mirrored
    // repeat joins identical edge texels instead of exposing a bright/dark seam.
    sets[name].map.wrapS = sets[name].map.wrapT = T.MirroredRepeatWrapping;
  }
  const environment = await new RGBELoader().loadAsync(
    new URL(
      "../assets/materials/photographic/interior-reflections.hdr",
      import.meta.url,
    ).href,
  );
  environment.mapping = T.EquirectangularReflectionMapping;
  const maps = Object.fromEntries(
    Object.entries(sets).map(([name, set]) => [name, set.map]),
  );
  function material(name, rx = 1, ry = 1, color = 0xffffff) {
    const source = sets[name];
    if (!source) throw new Error(`Unknown house surface: ${name}`);
    const channels = {};
    for (const [channel, original] of Object.entries(source)) {
      const map = original.clone();
      map.repeat.set(rx, ry);
      map.needsUpdate = true;
      channels[channel] = map;
    }
    const surface = new T.MeshStandardMaterial({
      ...channels,
      color,
      roughness: 1,
      metalness: name === "rust" ? 0.12 : 0,
      normalScale: new T.Vector2(1, 1),
      aoMapIntensity: 0.55,
      // Very faint, broad specular fill; localized house lights do the work.
      envMapIntensity: 0.06,
    });
    if (name === "floor") {
      // The source is a seamlessly tiling wood grain. Meter-scaled joints and
      // restrained board variation are authored here, rather than baked light.
      surface.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <map_fragment>",
          `#include <map_fragment>
          vec2 boardUV = vMapUv * vec2(12., 1.5);
          float board = floor(boardUV.x);
          vec2 jointUV = vec2(fract(boardUV.x), fract(boardUV.y + mod(board, 3.) / 3.));
          vec2 jointDistance = min(jointUV, 1. - jointUV);
          vec2 antialiasWidth = max(fwidth(boardUV), vec2(.0002));
          vec2 joint = 1. - smoothstep(vec2(.009, .0011),
            vec2(.009, .0011) + antialiasWidth, jointDistance);
          float boardJoint = max(joint.x, joint.y);
          float boardTone = .96 + .07 * fract(sin(board * 12.9898 + floor(boardUV.y + mod(board, 3.) / 3.) * 78.233) * 43758.5453);
          diffuseColor.rgb *= boardTone * (1. - boardJoint * .67);`,
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <roughnessmap_fragment>",
          "#include <roughnessmap_fragment>\nroughnessFactor = min(1., roughnessFactor + boardJoint * .24);",
        );
      };
      surface.customProgramCacheKey = () => "meter-scaled-floor-joints-v1";
    }
    return surface;
  }
  return { material, maps, environment };
}
export function writingTexture(
  lines,
  {
    background = "#c6bc94",
    color = "#39382b",
    size = 512,
    font = 30,
    mirrored = false,
  } = {},
) {
  const [c, g] = canvas(size);
  g.fillStyle = background;
  g.fillRect(0, 0, size, size);
  cloud(g, size, "rgba(55,41,19,.1)", 10);
  if (mirrored) {
    g.translate(size, 0);
    g.scale(-1, 1);
  }
  g.fillStyle = color;
  g.font = `${font}px Georgia`;
  g.textAlign = "center";
  lines.forEach((line, i) =>
    g.fillText(line, size / 2, size * 0.27 + i * font * 1.65),
  );
  patina(g, size, 1500);
  return texture(c);
}
export async function photoTextures() {
  const i = await imageAt("../assets/art/family-photographs.png");
  return [
    texture(crop(i, 0, 0, i.width / 2, i.height)),
    texture(crop(i, i.width / 2, 0, i.width / 2, i.height)),
  ];
}
export function rainTexture() {
  const [c, g] = canvas(256, 512);
  g.fillStyle = "#202d32";
  g.fillRect(0, 0, 256, 512);
  cloud(g, 512, "rgba(123,148,159,.22)", 12);
  for (let i = 0; i < 300; i++) {
    const x = random() * 256,
      y = random() * 512;
    g.strokeStyle = `rgba(160,186,190,${random() * 0.24})`;
    g.lineWidth = 0.4 + random();
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x - 2, y + 20 + random() * 50);
    g.stroke();
  }
  return texture(c);
}
export function grimeTexture() {
  const [c, g] = canvas();
  cloud(g, 512, "rgba(11,14,10,.38)", 28);
  return texture(c);
}

export function radioGrille() {
  const [c, g] = canvas(256);
  g.fillStyle = "#4d493a";
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 4)
    for (let x = 0; x < 256; x += 4) {
      g.fillStyle = (x + y) % 8 ? "#a49472" : "#6e614d";
      g.fillRect(x, y, 2, 3);
    }
  cloud(g, 256, "rgba(0,0,0,.15)", 12);
  return texture(c);
}
