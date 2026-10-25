import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import { createProgramView, prepareRenderPrograms, prepareRenderTextures, waitForRenderResources } from '../src/performance.mjs';

test('program views include the requested scene state without changing gameplay hierarchy', () => {
  const scene = new T.Scene(), future = new T.Group(), creature = new T.Group();
  future.visible = creature.visible = false;
  const base = new T.Mesh(new T.BoxGeometry(), new T.MeshStandardMaterial());
  const later = new T.Mesh(new T.BoxGeometry(), new T.MeshStandardMaterial({ alphaTest: .3 }));
  const actor = new T.Mesh(new T.BoxGeometry(), new T.MeshStandardMaterial());
  const zeroLight = new T.SpotLight(0xffffff, 0); zeroLight.castShadow = true;
  const laterLight = new T.PointLight();
  future.add(later, laterLight); creature.add(actor); scene.add(base, zeroLight, future, creature);
  const before = scene.children.slice();
  const normal = createProgramView(scene, { include: [creature], exclude: [future] });
  assert.equal(normal.meshes, 2); assert.equal(normal.lights, 1);
  assert.equal(normal.view.children.find(node => node.isLight).castShadow, true);
  assert.equal(normal.view.children.find(node => node.isLight).shadow.mapSize.x, 32);
  assert.equal(zeroLight.shadow.mapSize.x, 512);
  assert.equal(normal.view.children.find(node => node.material === base.material).geometry, base.geometry);
  assert.deepEqual(scene.children, before);
  assert.equal(base.parent, scene); assert.equal(actor.parent, creature);
  assert.equal(future.visible, false); assert.equal(creature.visible, false);
  const laterView = createProgramView(scene, { include: [future, creature] });
  assert.equal(laterView.meshes, 3); assert.equal(laterView.lights, 2);
});

test('compile descriptors retain skinning, morph, material and camera-layer features', () => {
  const scene = new T.Scene(), bone = new T.Bone();
  const geometry = new T.BoxGeometry();
  geometry.morphAttributes.position = [geometry.attributes.position.clone()];
  const material = new T.MeshStandardMaterial({ side: T.DoubleSide, alphaTest: .2 });
  const skin = new T.SkinnedMesh(geometry, material);
  skin.add(bone); skin.bind(new T.Skeleton([bone]));
  skin.layers.set(2); scene.add(skin);
  const descriptor = createProgramView(scene).view.children[0];
  assert.equal(descriptor.isSkinnedMesh, true);
  assert.equal(descriptor.skeleton, skin.skeleton);
  assert.equal(descriptor.geometry, geometry); assert.equal(descriptor.material, material);
  assert.deepEqual(descriptor.morphTargetInfluences, skin.morphTargetInfluences);
  assert.equal(descriptor.layers.mask, skin.layers.mask);
  assert.equal(skin.parent, scene); assert.equal(bone.parent, skin);
});

test('a focused late-mesh view keeps normal lights without compiling hidden-room lighting', () => {
  const scene = new T.Scene(), late = new T.Group(), future = new T.Group();
  late.visible = future.visible = false;
  const normal = new T.Mesh(new T.BoxGeometry(), new T.MeshStandardMaterial());
  const arm = new T.InstancedMesh(new T.BoxGeometry(), new T.MeshStandardMaterial(), 24);
  const normalLight = new T.SpotLight(), futureLight = new T.PointLight();
  late.add(arm); future.add(futureLight); scene.add(normal, normalLight, late, future);
  scene.fog = new T.FogExp2();
  const focused = createProgramView(scene, { include: [arm], exclude: [future], onlyMeshes: [arm] });
  assert.equal(focused.meshes, 1);
  assert.equal(focused.lights, 1);
  assert.equal(focused.view.children.find(object => object.isMesh).geometry, arm.geometry);
  assert.equal(focused.view.children.find(object => object.isLight).type, normalLight.type);
  assert.equal(focused.view.fog, scene.fog);
  assert.equal(late.visible, false);
  assert.equal(future.visible, false);
  const otherLighting = createProgramView(scene, { include: [arm, future], onlyMeshes: new Set([arm]) });
  assert.equal(otherLighting.meshes, 1);
  assert.equal(otherLighting.lights, 2, 'Future point light really changes the shader state');
});

test('compile views do not invoke custom mesh constructors or copy cyclic gameplay data', () => {
  let constructions = 0;
  class MirrorMesh extends T.Mesh {
    constructor(...args) { super(...args); constructions++; }
  }
  const scene = new T.Scene(), mirror = new MirrorMesh(new T.PlaneGeometry(), new T.ShaderMaterial());
  mirror.userData.owner = mirror;
  scene.add(mirror);
  const descriptor = createProgramView(scene).view.children[0];
  assert.equal(constructions, 1);
  assert.equal(descriptor.material, mirror.material);
  assert.equal(descriptor.geometry, mirror.geometry);
  assert.equal(mirror.parent, scene);
});

test('instanced compile descriptors retain the active draw count and morph storage', () => {
  const scene = new T.Scene();
  const mesh = new T.InstancedMesh(new T.BoxGeometry(), new T.MeshStandardMaterial(), 24);
  mesh.count = 19;
  mesh.morphTexture = new T.DataTexture(new Float32Array(24 * 4), 4, 24);
  scene.add(mesh);
  const descriptor = createProgramView(scene).view.children[0];
  assert.equal(descriptor.isInstancedMesh, true);
  assert.equal(descriptor.count, 19);
  assert.equal(descriptor.instanceMatrix, mesh.instanceMatrix);
  assert.equal(descriptor.morphTexture, mesh.morphTexture);
});

test('isolated view keeps world transforms without sharing mutable transform objects', () => {
  const scene = new T.Scene(), group = new T.Group(), mesh = new T.Mesh(new T.BoxGeometry(), new T.MeshStandardMaterial());
  group.position.set(4, 2, -3); group.rotation.y = .7;
  mesh.position.set(.5, 1, 2); group.add(mesh); scene.add(group);
  const isolated = createProgramView(scene).view.children[0];
  assert.notEqual(isolated.matrixWorld, mesh.matrixWorld);
  assert.ok(isolated.matrixWorld.equals(mesh.matrixWorld));
  assert.equal(mesh.parent, group);
});

test('pending and rejected async compilation restore the live renderer immediately', async () => {
  const scene = new T.Scene(); scene.add(new T.Mesh(new T.BoxGeometry(), new T.MeshStandardMaterial()));
  const original = {}, temporary = {}, viewport = new T.Vector4(1, 2, 30, 40), scissor = new T.Vector4(2, 3, 28, 38);
  let target = original, face = 3, mip = 1, resolve;
  const renderer = {
    info: { programs: [{}, {}] },
    getRenderTarget: () => target, getActiveCubeFace: () => face, getActiveMipmapLevel: () => mip,
    getViewport: out => out.copy(viewport), getScissor: out => out.copy(scissor), getScissorTest: () => true,
    setRenderTarget: (next, f = 0, m = 0) => { target = next; face = f; mip = m; },
    setViewport: value => assert.ok(value.equals(viewport)),
    setScissor: value => assert.ok(value.equals(scissor)), setScissorTest: value => assert.equal(value, true),
    compileAsync: () => { assert.equal(target, temporary); return new Promise(r => { resolve = r; }); },
  };
  const compiling = prepareRenderPrograms(renderer, scene, new T.PerspectiveCamera(), { target: temporary });
  assert.equal(target, original); assert.equal(face, 3); assert.equal(mip, 1);
  resolve();
  const result = await compiling;
  assert.equal(result.programs, 2); assert.equal(result.meshes, 1);
  renderer.compileAsync = () => Promise.reject(new Error('compile failed'));
  await assert.rejects(prepareRenderPrograms(renderer, scene, new T.PerspectiveCamera(), { target: temporary }), /compile failed/);
  assert.equal(target, original);
});

test('future texture upload is version-aware, yields and skips render-target feedback textures', async () => {
  const scene = new T.Scene(), texture = new T.DataTexture(new Uint8Array(4), 1, 1);
  texture.needsUpdate = true;
  const feedback = new T.WebGLRenderTarget(1, 1);
  const material = new T.MeshStandardMaterial({ map: texture });
  material.uniforms = { feedback: { value: feedback.texture } };
  scene.add(new T.Mesh(new T.BoxGeometry(), material));
  let calls = 0, yields = 0;
  const renderer = { initTexture: value => { assert.equal(value, texture); calls++; } };
  const options = { yieldTask: async () => { yields++; } };
  assert.deepEqual(await prepareRenderTextures(renderer, scene, options), { textures: 1, uploaded: 1 });
  assert.deepEqual(await prepareRenderTextures(renderer, scene, options), { textures: 1, uploaded: 0 });
  texture.needsUpdate = true;
  await prepareRenderTextures(renderer, scene, options);
  assert.equal(calls, 2); assert.equal(yields, 2);
});

test('future texture uploads wait again if play resumes between background batches', async () => {
  const scene = new T.Scene();
  for (let i = 0; i < 17; i++) {
    const texture = new T.DataTexture(new Uint8Array(4), 1, 1);
    texture.needsUpdate = true;
    scene.add(new T.Mesh(new T.BoxGeometry(), new T.MeshBasicMaterial({ map: texture })));
  }
  let uploads = 0, active = true, release, blocked, batches = 0;
  const gateReached = () => new Promise(resolve => { blocked = resolve; });
  const beforeBatch = async () => {
    batches++;
    if (active) {
      blocked?.();
      await new Promise(resolve => { release = resolve; });
    }
  };
  let reached = gateReached();
  const preparation = prepareRenderTextures({ initTexture: () => { uploads++; } }, scene, {
    beforeBatch,
    yieldTask: async () => { active = true; },
  });
  await reached;
  assert.equal(uploads, 0, 'Initial preparation ran during play');
  while (uploads < 17) {
    const previous = uploads;
    reached = gateReached();
    active = false;
    release();
    await Promise.race([reached, preparation]);
    assert.ok(uploads - previous <= 8, 'Upload batch exceeded its bound');
    assert.equal(active, true);
  }
  assert.deepEqual(await preparation, { textures: 17, uploaded: 17 });
  assert.ok(batches >= 3);
});

test('GPU completion yields without a synchronous finish and releases its fence', async () => {
  let polled = 0, flushed = 0, deleted = 0;
  const sync = {}, gl = {
    SYNC_GPU_COMMANDS_COMPLETE: 1, CONDITION_SATISFIED: 2, ALREADY_SIGNALED: 3, WAIT_FAILED: 4,
    fenceSync: () => sync, flush: () => { flushed++; }, isContextLost: () => false,
    clientWaitSync: value => { assert.equal(value, sync); return ++polled > 1 ? 2 : 0; },
    deleteSync: value => { assert.equal(value, sync); deleted++; },
  };
  const renderer = { capabilities: { isWebGL2: true }, getContext: () => gl };
  await waitForRenderResources(renderer);
  assert.equal(polled, 2); assert.equal(flushed, 1); assert.equal(deleted, 1);
  gl.isContextLost = () => true;
  await assert.rejects(waitForRenderResources(renderer), /context lost/);
  assert.equal(deleted, 2);
});
