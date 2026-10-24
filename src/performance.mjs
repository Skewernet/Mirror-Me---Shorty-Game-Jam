import { BackSide, DoubleSide, FrontSide, Mesh, MeshDepthMaterial, MeshDistanceMaterial,
  RGBADepthPacking, Scene, Vector4, WebGLRenderTarget } from '../vendor/three.module.js';

const uploadedTextures = new WeakMap();
const shadowPreparations = new WeakMap();
function textureVersions(renderer) {
  if (!uploadedTextures.has(renderer)) uploadedTextures.set(renderer, new WeakMap());
  return uploadedTextures.get(renderer);
}
function renderTextures(scene) {
  const textures = new Set();
  const add = value => {
    if (value?.isTexture && !value.isRenderTargetTexture) textures.add(value);
    else if (Array.isArray(value)) for (const entry of value) add(entry);
  };
  add(scene.environment); add(scene.background);
  scene.traverse(object => {
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material) continue;
      for (const value of Object.values(material)) add(value);
      for (const uniform of Object.values(material.uniforms || {})) add(uniform.value);
    }
  });
  return textures;
}

// Future-room textures are already decoded by the asset loader. Small batches
// yield to the browser without paying a timer's minimum delay for every map.
export async function prepareRenderTextures(renderer, scene, { yieldTask } = {}) {
  const versions = textureVersions(renderer), textures = renderTextures(scene);
  const next = yieldTask || (() => new Promise(resolve => setTimeout(resolve, 0)));
  let uploaded = 0, batch = 0, lastYield = performance.now();
  for (const texture of textures) {
    if (versions.get(texture) === texture.version) continue;
    renderer.initTexture(texture);
    versions.set(texture, texture.version);
    uploaded++; batch++;
    if (batch >= 8 || performance.now() - lastYield >= 6) {
      await next(); batch = 0; lastYield = performance.now();
    }
  }
  if (batch) await next();
  return { textures: textures.size, uploaded };
}

// Three's compileAsync visits every material, including invisible descendants.
// A descriptor view limits preparation to the scene state that will actually
// be rendered. Mesh descriptors retain shader features without invoking custom
// constructors (a Reflector constructor allocates another render target).
// Their transforms are snapshots and their render callbacks are intentionally
// absent: warmProgramView can draw them off-screen without triggering mirrors.
export function createProgramView(scene, { include = [], exclude = [] } = {}) {
  const view = new Scene();
  view.environment = scene.environment;
  view.background = scene.background;
  view.fog = scene.fog;
  view.environmentIntensity = scene.environmentIntensity;
  view.environmentRotation?.copy(scene.environmentRotation || view.environmentRotation);
  const included = new Set(include.filter(Boolean));
  const excluded = new Set(exclude.filter(Boolean));
  scene.updateMatrixWorld(true);
  let meshes = 0, lights = 0;
  const materials = new Set();
  function visit(node, parentVisible) {
    if (excluded.has(node)) return;
    const visible = included.has(node) || (parentVisible && node.visible);
    if (visible && (node.isMesh || node.isLine || node.isPoints || node.isSprite || node.isLight)) {
      const descriptor = node.isMesh ? new Mesh(node.geometry, node.material) : node.clone(false);
      if (node.isMesh) {
        descriptor.layers.mask = node.layers.mask;
        descriptor.castShadow = node.castShadow;
        descriptor.receiveShadow = node.receiveShadow;
        for (const key of ['isSkinnedMesh', 'isInstancedMesh', 'isBatchedMesh',
          'instanceColor', 'instanceMatrix', 'skeleton', 'bindMode', 'bindMatrix',
          'bindMatrixInverse', 'morphTargetInfluences', 'morphTargetDictionary'])
          if (key in node) descriptor[key] = node[key];
      }
      descriptor.name = node.name;
      descriptor.matrixAutoUpdate = false;
      descriptor.matrix.copy(node.matrixWorld);
      descriptor.matrixWorld.copy(node.matrixWorld);
      descriptor.frustumCulled = false;
      if (descriptor.shadow) {
        descriptor.shadow.autoUpdate = true;
        descriptor.shadow.needsUpdate = true;
        descriptor.shadow.mapSize.set(
          Math.min(32, descriptor.shadow.mapSize.x), Math.min(32, descriptor.shadow.mapSize.y));
      }
      descriptor.visible = true;
      view.add(descriptor);
      if (node.isLight) lights++;
      else {
        meshes++;
        for (const material of Array.isArray(node.material) ? node.material : [node.material])
          if (material) materials.add(material);
      }
    }
    for (const child of node.children) visit(child, visible);
  }
  visit(scene, true);
  return { view, meshes, lights, materials: materials.size };
}

export async function prepareRenderPrograms(renderer, scene, camera, {
  target = renderer.getRenderTarget(), include = [], exclude = [],
} = {}) {
  const descriptor = createProgramView(scene, { include, exclude });
  const began = performance.now();
  const destination = renderer.getRenderTarget();
  const face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();
  const viewport = renderer.getViewport(new Vector4());
  const scissor = renderer.getScissor(new Vector4()), scissorTest = renderer.getScissorTest();
  let compiling;
  try {
    renderer.setRenderTarget(target);
    compiling = renderer.compileAsync(descriptor.view, camera);
  } finally {
    // compileAsync starts compilation synchronously but waits asynchronously.
    // Restore before awaiting, so a live RAF never sees our temporary target.
    renderer.setRenderTarget(destination, face, mip);
    renderer.setViewport(viewport);
    renderer.setScissor(scissor);
    renderer.setScissorTest(scissorTest);
  }
  await compiling;
  return { ...descriptor, programs: renderer.info.programs.length, ms: performance.now() - began };
}

function shadowProgramScene(view) {
  const scene = new Scene(), shadowLights = view.children.filter(node => node.isLight && node.castShadow);
  const kinds = new Set(shadowLights.map(light => light.isPointLight ? 'distance' : 'depth'));
  for (const light of view.children.filter(node => node.isLight)) scene.add(light.clone(false));
  const shadowSide = { [FrontSide]: BackSide, [BackSide]: FrontSide, [DoubleSide]: DoubleSide };
  const features = new Set();
  for (const source of view.children.filter(node => node.isMesh && node.castShadow)) {
    for (const material of Array.isArray(source.material) ? source.material : [source.material]) {
      if (!material?.visible) continue;
      for (const kind of kinds) {
        // Match this pinned Three version's WebGLShadowMap.getDepthMaterial.
        // Double-sided depth also occurs when its shared depth material has
        // just processed a double-sided object in a differently culled view.
        const sides = new Set([material.shadowSide ?? shadowSide[material.side], DoubleSide]);
        for (const side of sides) {
          const morph = source.geometry.morphAttributes;
          const feature = JSON.stringify([kind, side, !!source.isSkinnedMesh, !!source.isInstancedMesh,
            !!source.isBatchedMesh, source.instanceColor !== null,
            morph.position?.length || 0, morph.normal?.length || 0, morph.color?.length || 0,
            material.map?.channel ?? -1, material.alphaMap?.channel ?? -1, material.alphaTest > 0,
            material.displacementMap?.channel ?? -1, material.displacementScale !== 0,
            material.clippingPlanes?.length || 0, !!material.clipIntersection]);
          if (features.has(feature)) continue;
          features.add(feature);
          const depth = kind === 'distance' ? new MeshDistanceMaterial() :
            new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
          depth.side = side;
          for (const key of ['map', 'alphaMap', 'alphaTest', 'displacementMap', 'displacementScale',
            'displacementBias', 'clipShadows', 'clippingPlanes', 'clipIntersection']) depth[key] = material[key];
          const mesh = new Mesh(source.geometry, depth);
          for (const key of ['isSkinnedMesh', 'isInstancedMesh', 'isBatchedMesh', 'instanceColor',
            'instanceMatrix', 'skeleton', 'bindMode', 'bindMatrix', 'bindMatrixInverse',
            'morphTargetInfluences', 'morphTargetDictionary']) if (key in source) mesh[key] = source[key];
          mesh.layers.mask = source.layers.mask;
          scene.add(mesh);
        }
      }
    }
  }
  return scene;
}

// A completion fence avoids gl.finish's long synchronous loading/UI pause.
export async function waitForRenderResources(renderer) {
  const gl = renderer.getContext();
  const sync = renderer.capabilities.isWebGL2 ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
  const began = performance.now();
  gl.flush();
  try {
    if (!sync) { await new Promise(resolve => setTimeout(resolve, 0)); return; }
    for (;;) {
      if (gl.isContextLost()) throw new Error('WebGL context lost while preparing a room.');
      const state = gl.clientWaitSync(sync, 0, 0);
      if (state === gl.ALREADY_SIGNALED || state === gl.CONDITION_SATISFIED) return;
      if (state === gl.WAIT_FAILED) throw new Error('Could not finish preparing a room.');
      if (performance.now() - began > 120000) throw new Error('Room graphics preparation timed out.');
      await new Promise(resolve => setTimeout(resolve, 8));
    }
  } finally { if (sync) gl.deleteSync(sync); }
}

// compileAsync covers beauty programs but never Three's generated shadow
// programs or vertex/skin buffers. Submit one tiny isolated view to prepare
// those too. A fence yields while the GPU works instead of blocking JS with
// gl.finish; source gameplay visibility, light shadows and callbacks are safe.
export async function warmProgramView(renderer, view, camera, {
  target = renderer.getRenderTarget(), size = 8, beforeSubmit,
} = {}) {
  const began = performance.now();
  const warmCamera = camera.clone();
  // The reflected Mara and torch use layer 1; all room lights remain layer 0.
  warmCamera.layers.enable(1);
  // Depth programs must be linked before the tiny draw asks for uniforms.
  // Otherwise that first draw can synchronously wait on a slow driver.
  const shadowScene = shadowProgramScene(view);
  await prepareRenderPrograms(renderer, shadowScene, warmCamera, { target });
  // Retain the bounded three room-state preparations until renderer disposal;
  // disposing these materials now would evict still-unused depth variants.
  if (!shadowPreparations.has(renderer)) shadowPreparations.set(renderer, []);
  shadowPreparations.get(renderer).push(shadowScene);
  // The player may have resumed while async linking was pending.
  if (beforeSubmit) await beforeSubmit();
  const destination = renderer.getRenderTarget();
  const face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();
  const viewport = renderer.getViewport(new Vector4()), scissor = renderer.getScissor(new Vector4());
  const scissorTest = renderer.getScissorTest(), renderInfo = { ...renderer.info.render };
  const warmTarget = new WebGLRenderTarget(size, size, {
    type: target?.texture.type, format: target?.texture.format, depthBuffer: true,
  });
  if (target) warmTarget.texture.colorSpace = target.texture.colorSpace;
  try {
    try {
      renderer.setRenderTarget(warmTarget);
      renderer.setScissorTest(false);
      renderer.render(view, warmCamera);
    } finally {
      renderer.setRenderTarget(destination, face, mip);
      renderer.setViewport(viewport); renderer.setScissor(scissor); renderer.setScissorTest(scissorTest);
      const submittedFrame = renderer.info.render.frame;
      Object.assign(renderer.info.render, renderInfo);
      // Skeleton and geometry upload caches key on this monotonically growing
      // frame number. Restoring it would skip a newly resumed pose update.
      renderer.info.render.frame = submittedFrame;
    }
    await waitForRenderResources(renderer);
    return { programs: renderer.info.programs.length, geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures, ms: performance.now() - began };
  } finally {
    warmTarget.dispose();
    // Light descriptors own any shadow targets created by the isolated draw.
    view.traverse(object => {
      object.shadow?.map?.dispose();
      object.shadow?.mapPass?.dispose();
    });
  }
}

// Adjust infrequently from sustained frame delivery, not a single doorway or
// loading spike. The selected picture quality remains the upper bound.
export class AdaptiveResolution {
  constructor({ enabled = true } = {}) {
    this.enabled = enabled;
    this.reset();
  }
  clearMeasurements() {
    this.averageMs = null;
    this.activeMs = this.badMs = this.goodMs = this.cooldownMs = 0;
    this.samples = 0;
  }
  reset(scale = 1) {
    this.scale = Number.isFinite(scale) ? Math.max(.6, Math.min(1, scale)) : 1;
    this.adjustments = 0;
    this.clearMeasurements();
  }
  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    this.clearMeasurements();
    if (!this.enabled && this.scale !== 1) {
      this.scale = 1;
      return this.scale;
    }
    return null;
  }
  sample(frameMs, active = true) {
    if (!active || !this.enabled || !Number.isFinite(frameMs) || frameMs <= 0 || frameMs > 1000) {
      this.clearMeasurements();
      return null;
    }
    const elapsed = Math.min(frameMs, 100);
    this.averageMs = this.averageMs === null ? elapsed :
      this.averageMs + (elapsed - this.averageMs) * (1 - Math.exp(-elapsed / 600));
    this.activeMs += elapsed;
    this.samples++;
    this.cooldownMs = Math.max(0, this.cooldownMs - elapsed);
    if (this.activeMs < 2500 || this.cooldownMs > 0) return null;
    this.badMs = this.averageMs > 21 ? this.badMs + elapsed : Math.max(0, this.badMs - elapsed * 2);
    this.goodMs = this.averageMs < 17.1 ? this.goodMs + elapsed : 0;
    let next = this.scale;
    if (this.badMs >= 1500 && this.scale > .6) next = Math.max(.6, this.scale - .1);
    else if (this.goodMs >= 12000 && this.scale < 1) next = Math.min(1, this.scale + .05);
    if (Math.abs(next - this.scale) < .001) return null;
    this.scale = Math.round(next * 100) / 100;
    this.adjustments++;
    this.badMs = this.goodMs = 0;
    this.cooldownMs = 6000;
    return this.scale;
  }
  snapshot() {
    return { enabled: this.enabled, scale: this.scale, averageMs: this.averageMs,
      samples: this.samples, adjustments: this.adjustments };
  }
}

// compileAsync prepares programs, but not mesh buffers, skinning textures or
// texture uploads. Do those once while the loading menu still covers the view.
export function warmRenderResources(renderer, scene, camera, {
  target = renderer.getRenderTarget(), objects = [], finish = true, textureScene = scene,
} = {}) {
  const textures = renderTextures(textureScene), versions = textureVersions(renderer);
  const previousTarget = renderer.getRenderTarget();
  const cubeFace = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();
  const viewport = renderer.getViewport(new Vector4());
  const scissor = renderer.getScissor(new Vector4()), scissorTest = renderer.getScissorTest();
  const renderInfo = { ...renderer.info.render };
  const visibility = objects.map(object => [object, object.visible]);
  const culling = [];
  try {
    for (const texture of textures) {
      if (versions.get(texture) === texture.version) continue;
      renderer.initTexture(texture);
      versions.set(texture, texture.version);
    }
    for (const [object] of visibility) {
      object.visible = true;
      object.traverse(child => {
        if (!child.isMesh) return;
        culling.push([child, child.frustumCulled]);
        child.frustumCulled = false;
      });
    }
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    if (finish) renderer.getContext().finish();
    return { textures: textures.size, geometries: renderer.info.memory.geometries,
      programs: renderer.info.programs.length };
  } finally {
    for (const [object, visible] of visibility) object.visible = visible;
    for (const [object, culled] of culling) object.frustumCulled = culled;
    renderer.setRenderTarget(previousTarget, cubeFace, mip);
    renderer.setViewport(viewport);
    renderer.setScissor(scissor);
    renderer.setScissorTest(scissorTest);
    Object.assign(renderer.info.render, renderInfo);
  }
}
