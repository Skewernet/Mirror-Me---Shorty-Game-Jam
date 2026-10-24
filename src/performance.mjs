import { Vector4 } from '../vendor/three.module.js';

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
  target = renderer.getRenderTarget(), objects = [], finish = true,
} = {}) {
  const textures = new Set();
  const add = value => {
    if (value?.isTexture && !value.isRenderTargetTexture) textures.add(value);
    else if (Array.isArray(value)) for (const entry of value) add(entry);
  };
  add(scene.environment);
  add(scene.background);
  scene.traverse(object => {
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material) continue;
      for (const value of Object.values(material)) add(value);
      for (const uniform of Object.values(material.uniforms || {})) add(uniform.value);
    }
  });
  const previousTarget = renderer.getRenderTarget();
  const cubeFace = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();
  const viewport = renderer.getViewport(new Vector4());
  const scissor = renderer.getScissor(new Vector4()), scissorTest = renderer.getScissorTest();
  const renderInfo = { ...renderer.info.render };
  const visibility = objects.map(object => [object, object.visible]);
  const culling = [];
  try {
    for (const texture of textures) renderer.initTexture(texture);
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
