// House raycasts need current door/prop transforms, not another recursive
// update of every hidden character, bone, light and decoration in the scene.
// Lists remain owned by the house; this cache never reparents their objects.
export function createInteractionQuery(interactables, occluders) {
  const nodes = [], records = new Map();
  const eligible = [], candidates = [], hits = [];
  const result = { hit: null, target: null };
  const stats = { topologyBuilds: 0, nodes: 0, matrixUpdates: 0, candidates: 0, hits: 0 };
  let itemCount = -1, occluderCount = -1;

  const addAncestors = object => {
    if (records.has(object)) return records.get(object);
    const parent = object.parent, ancestor = parent ? addAncestors(parent) : null;
    const record = { object, parent, ancestor, visible: true, needed: false, candidate: false };
    records.set(object, record);
    nodes.push(record);
    return record;
  };
  const rebuild = () => {
    nodes.length = 0;
    records.clear();
    for (const item of interactables) addAncestors(item.mesh);
    for (const object of occluders) addAncestors(object);
    itemCount = interactables.length;
    occluderCount = occluders.length;
    stats.topologyBuilds++;
    stats.nodes = nodes.length;
  };
  const topologyChanged = () => {
    if (itemCount !== interactables.length || occluderCount !== occluders.length) return true;
    for (const record of nodes) if (record.object.parent !== record.parent) return true;
    // Replacing a list entry without changing its length is supported too.
    for (const item of interactables) if (!records.has(item.mesh)) return true;
    for (const object of occluders) if (!records.has(object)) return true;
    return false;
  };
  const append = object => {
    const record = records.get(object);
    if (!record.visible || record.candidate) return;
    record.candidate = true;
    candidates.push(object);
    for (let current = record; current && !current.needed; current = current.ancestor)
      current.needed = true;
  };
  rebuild();

  return {
    // The returned record and intersections belong to the query and are
    // reused. Callers consume hit/target before the next query invocation.
    query(ray, story) {
      if (topologyChanged()) rebuild();
      eligible.length = candidates.length = hits.length = 0;
      for (const record of nodes) {
        record.visible = record.object.visible && (!record.ancestor || record.ancestor.visible);
        record.needed = record.candidate = false;
      }
      for (const item of interactables) {
        if ((item.id === "note" && story.hasNote) ||
            (item.id === "fuse" && (story.hasFuse || story.power)) ||
            !records.get(item.mesh).visible) continue;
        eligible.push(item);
        append(item.mesh);
      }
      // Keep the old item-first order. Raycaster's stable distance sort then
      // retains exactly the same winner for coincident target/occluder faces.
      for (const object of occluders) append(object);
      stats.matrixUpdates = 0;
      for (const record of nodes) if (record.needed) {
        record.object.updateWorldMatrix(false, false);
        stats.matrixUpdates++;
      }
      ray.intersectObjects(candidates, false, hits);
      result.hit = hits[0] || null;
      result.target = null;
      stats.candidates = candidates.length;
      stats.hits = hits.length;
      if (!result.hit) return result;
      const hit = result.hit;
      for (let object = hit.object; object; object = object.parent) {
        const id = object.userData.interactionId;
        if (!id) continue;
        for (const item of eligible) if (item.id === id && hit.distance <= item.range) {
          result.target = item;
          break;
        }
        return result;
      }
      for (const item of eligible) if (item.mesh === hit.object && hit.distance <= item.range) {
        result.target = item;
        break;
      }
      return result;
    },
    stats,
  };
}
