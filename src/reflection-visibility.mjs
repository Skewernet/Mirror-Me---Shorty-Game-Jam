import { BackSide, Box3, Matrix4, Vector3 } from 'three';

// A convex opaque wall can hide the whole rectangular glass. Test an expanded
// rectangle against one actual wall at a time: separate walls or a center ray
// alone cannot prove that a doorway/edge view is hidden. No scene traversal,
// ray-hit arrays or renderer/camera changes are needed on a live frame.
export class ReflectionVisibility {
  constructor(surface, occluders = []) {
    this.surface = surface;
    surface.geometry.computeBoundingBox();
    this.bounds = surface.geometry.boundingBox;
    this.corners = Array.from({ length: 4 }, () => new Vector3());
    this.surfaceMatrix = new Matrix4();
    // A NaN sentinel forces the first world-corner update even at identity.
    this.surfaceMatrix.elements[0] = NaN;
    this.eye = new Vector3();
    this.localEye = new Vector3();
    this.localEnd = new Vector3();
    this.normal = new Vector3();
    this.offset = new Vector3();
    this.forward = new Vector3();
    this.nearFractions = new Float64Array(4);
    this.checks = this.skipped = 0;
    this.walls = occluders.filter(object => object.userData.architecture === 'wall' &&
      object.geometry?.type === 'BoxGeometry').map(object => {
      object.geometry.computeBoundingBox();
      const bounds = new Box3().copy(object.geometry.boundingBox);
      // Shrinking the blocker and expanding the glass leave grazing views live.
      bounds.min.addScalar(.001);
      bounds.max.addScalar(-.001);
      const matrix = new Matrix4(); matrix.elements[0] = NaN;
      return { object, bounds, matrix, inverse: new Matrix4() };
    });
  }
  isOccluded(camera) {
    if (!camera.isPerspectiveCamera || !this.walls.length) return false;
    this.eye.setFromMatrixPosition(camera.matrixWorld);
    this.normal.set(0, 0, 1).transformDirection(this.surface.matrixWorld);
    this.offset.setFromMatrixPosition(this.surface.matrixWorld).sub(this.eye);
    // The existing Reflector handles its back face without a secondary render.
    if (this.offset.dot(this.normal) >= 0) return false;
    if (!this.surfaceMatrix.equals(this.surface.matrixWorld)) {
      this.surfaceMatrix.copy(this.surface.matrixWorld);
      const { min, max } = this.bounds;
      let corner = 0;
      for (const x of [min.x - .01, max.x + .01])
        for (const y of [min.y - .01, max.y + .01])
          this.corners[corner++].set(x, y, (min.z + max.z) * .5)
            .applyMatrix4(this.surfaceMatrix);
    }
    this.forward.setFromMatrixColumn(camera.matrixWorld, 2).negate().normalize();
    for (let index = 0; index < 4; index++) {
      const corner = this.corners[index];
      const depth = this.offset.copy(corner).sub(this.eye).dot(this.forward);
      if (depth <= camera.near) return false;
      this.nearFractions[index] = camera.near / depth + .0001;
    }
    this.checks++;
    for (const wall of this.walls) {
      const { object, bounds, inverse } = wall;
      const material = object.material;
      if (bounds.isEmpty() || !material || Array.isArray(material) || !material.visible || material.wireframe ||
        material.alphaMap || material.displacementMap || material.transparent || !material.depthWrite ||
        material.side === BackSide || material.alphaTest > 0 || !object.layers.test(camera.layers)) continue;
      let visible = true;
      for (let node = object; node; node = node.parent)
        if (!node.visible) { visible = false; break; }
      if (!visible) continue;
      if (!wall.matrix.equals(object.matrixWorld)) {
        wall.matrix.copy(object.matrixWorld);
        inverse.copy(object.matrixWorld).invert();
      }
      this.localEye.copy(this.eye).applyMatrix4(inverse);
      // Never make an aggressive decision while the camera is inside a blocker.
      if (bounds.containsPoint(this.localEye)) continue;
      let covered = true;
      for (let index = 0; index < 4; index++) {
        this.localEnd.copy(this.corners[index]).applyMatrix4(inverse);
        if (!segmentCrossesBox(this.localEye, this.localEnd, bounds, this.nearFractions[index])) {
          covered = false; break;
        }
      }
      if (covered) { this.skipped++; return true; }
    }
    return false;
  }
}

function segmentCrossesBox(origin, end, bounds, nearFraction) {
  let enter = 0, exit = 1;
  for (let axis = 0; axis < 3; axis++) {
    const start = origin.getComponent(axis), direction = end.getComponent(axis) - start;
    const low = bounds.min.getComponent(axis), high = bounds.max.getComponent(axis);
    if (Math.abs(direction) < 1e-12) {
      if (start < low || start > high) return false;
      continue;
    }
    let near = (low - start) / direction, far = (high - start) / direction;
    if (near > far) { const swap = near; near = far; far = swap; }
    enter = Math.max(enter, near); exit = Math.min(exit, far);
    if (enter > exit) return false;
  }
  return enter > nearFraction && enter < .9999 && exit > .0001;
}
