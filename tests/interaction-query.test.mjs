import test from "node:test";
import assert from "node:assert/strict";
import * as T from "../vendor/three.module.js";
import { createInteractionQuery } from "../src/interaction-query.mjs";

const visible = object => {
  for (let current = object; current; current = current.parent) if (!current.visible) return false;
  return true;
};
function baseline(scene, ray, interactables, occluders, story = {}) {
  scene.updateMatrixWorld(true);
  const items = interactables.filter(item => (item.id !== "note" || !story.hasNote) &&
    (item.id !== "fuse" || (!story.hasFuse && !story.power)) && visible(item.mesh));
  const hit = ray.intersectObjects([...new Set([...items.map(item => item.mesh), ...occluders.filter(visible)])], false)[0] || null;
  if (!hit) return { hit: null, target: null };
  for (let object = hit.object; object; object = object.parent)
    if (object.userData.interactionId)
      return { hit, target: items.find(item => item.id === object.userData.interactionId && hit.distance <= item.range) || null };
  return { hit, target: items.find(item => item.mesh === hit.object && hit.distance <= item.range) || null };
}
function fixture() {
  const scene = new T.Scene(), pivot = new T.Group();
  const mesh = new T.Mesh(new T.BoxGeometry(1, 1, .2), new T.MeshBasicMaterial());
  mesh.position.z = -2; pivot.add(mesh); scene.add(pivot);
  const items = [{ id: "object", mesh, range: 2.2 }], occluders = [];
  const ray = new T.Raycaster(new T.Vector3(), new T.Vector3(0, 0, -1), 0, 8);
  return { scene, pivot, mesh, items, occluders, ray };
}
function same(actual, expected) {
  assert.equal(actual.target, expected.target);
  assert.equal(actual.hit?.object, expected.hit?.object);
  assert.equal(actual.hit?.distance, expected.hit?.distance);
  assert.deepEqual(actual.hit?.point.toArray(), expected.hit?.point.toArray());
}

test("target and physical clearance retain range, visibility, note/fuse and occlusion semantics", () => {
  const f = fixture();
  const blocker = new T.Mesh(new T.BoxGeometry(1, 1, .1), new T.MeshBasicMaterial());
  blocker.position.z = -1; blocker.visible = false; f.scene.add(blocker); f.occluders.push(blocker, f.mesh);
  const query = createInteractionQuery(f.items, f.occluders);
  for (const state of [{}, { hasNote: true }, { hasFuse: true }, { power: true }])
    for (const id of ["object", "note", "fuse"])
      for (const range of [1, 2.2])
        for (const blocked of [false, true])
          for (const hidden of [false, true]) {
            f.items[0].id = id; f.items[0].range = range;
            f.pivot.visible = !hidden; blocker.visible = blocked;
            same(query.query(f.ray, state), baseline(f.scene, f.ray, f.items, f.occluders, state));
          }
});

test("coincident item-first ordering stays stable and duplicate objects raycast once", () => {
  const f = fixture(), coincident = f.mesh.clone(); f.scene.add(coincident);
  f.occluders.push(coincident, f.mesh, coincident);
  let casts = 0;
  const original = f.mesh.raycast;
  f.mesh.raycast = function (...args) { casts++; return original.apply(this, args); };
  const query = createInteractionQuery(f.items, f.occluders);
  assert.equal(query.query(f.ray, {}).target, f.items[0]);
  assert.equal(casts, 1);
  assert.equal(query.stats.candidates, 2);
  same(query.query(f.ray, {}), baseline(f.scene, f.ray, f.items, f.occluders));
});

test("the first ancestor interactionId retains priority over direct mesh fallback", () => {
  const f = fixture(), query = createInteractionQuery(f.items, f.occluders);
  f.pivot.userData.interactionId = "not-eligible";
  assert.equal(query.query(f.ray, {}).target, null);
  f.pivot.userData.interactionId = "object";
  assert.equal(query.query(f.ray, {}).target, f.items[0]);
  f.mesh.userData.interactionId = "nearer-unknown";
  same(query.query(f.ray, {}), baseline(f.scene, f.ray, f.items, f.occluders));
  assert.equal(query.query(f.ray, {}).target, null);
});

test("moving pivots, transformed scene parents and manual matrices refresh in parent-first order", () => {
  const f = fixture(), outer = new T.Group(); outer.add(f.scene);
  outer.position.set(3, 1, 2); outer.rotation.y = .4; outer.scale.set(1.2, .9, 1.1);
  const query = createInteractionQuery(f.items, f.occluders), origin = new T.Vector3(), target = new T.Vector3();
  for (const angle of [0, .35, 1.1, -.65]) {
    f.pivot.rotation.y = angle;
    outer.position.x += .3;
    outer.updateMatrixWorld(true);
    origin.set(0, 0, 0).applyMatrix4(f.pivot.matrixWorld);
    target.set(0, 0, -2).applyMatrix4(f.pivot.matrixWorld);
    // Deliberately dirty ancestors again after the renderer's earlier update.
    outer.position.y += .1; origin.y += .1; target.y += .1;
    f.ray.set(origin, target.sub(origin).normalize());
    same(query.query(f.ray, {}), baseline(outer, f.ray, f.items, f.occluders));
  }
  f.pivot.matrixAutoUpdate = false;
  f.pivot.matrix.makeTranslation(.2, 0, -.4);
  same(query.query(f.ray, {}), baseline(outer, f.ray, f.items, f.occluders));
  assert.equal(query.stats.topologyBuilds, 1, "Transform changes do not rebuild object topology");
});

test("detach, reparent and same-length list replacement never mutate source hierarchy", () => {
  const f = fixture(), query = createInteractionQuery(f.items, f.occluders);
  query.query(f.ray, {});
  f.mesh.removeFromParent();
  assert.equal(query.query(f.ray, {}).target, f.items[0], "A detached listed mesh remains queryable in its local coordinates");
  const replacement = f.mesh.clone(), parent = new T.Group(); parent.add(replacement); f.scene.add(parent);
  f.items[0] = { id: "replacement", mesh: replacement, range: 2.2 };
  const children = f.scene.children.slice();
  assert.equal(query.query(f.ray, {}).target, f.items[0]);
  assert.deepEqual(f.scene.children, children); assert.equal(replacement.parent, parent);
  parent.visible = false;
  assert.equal(query.query(f.ray, {}).hit, null);
  f.occluders.push(f.mesh);
  assert.equal(query.query(f.ray, {}).hit.object, f.mesh);
  assert.ok(query.stats.topologyBuilds >= 3);
});

test("raycast buffers are reused and unrelated hidden skeleton branches are never traversed", () => {
  const f = fixture(), actor = new T.Group(); actor.visible = false;
  let traversals = 0;
  actor.updateMatrixWorld = () => { traversals++; };
  actor.updateWorldMatrix = () => { traversals++; };
  f.scene.add(actor);
  const query = createInteractionQuery(f.items, f.occluders), real = f.ray.intersectObjects.bind(f.ray);
  let previousCandidates, previousHits;
  f.ray.intersectObjects = (candidates, recursive, hits) => {
    assert.equal(recursive, false);
    if (previousCandidates) { assert.equal(candidates, previousCandidates); assert.equal(hits, previousHits); }
    previousCandidates = candidates; previousHits = hits;
    return real(candidates, recursive, hits);
  };
  const record = query.query(f.ray, {});
  for (let frame = 0; frame < 20; frame++) {
    f.pivot.rotation.y = frame / 100;
    assert.equal(query.query(f.ray, {}), record);
  }
  assert.equal(traversals, 0);
  assert.equal(query.stats.matrixUpdates, 3, "Only scene, pivot and selected mesh refresh");
});
