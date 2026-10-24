// Project every architectural box from the same house-space origin. A box's
// default 0..1 UVs restart at every doorway/floor patch, breaking otherwise
// continuous boards, tile grout and wallpaper across adjacent meshes.
export function alignArchitectureUV(mesh, metersU = 1.8, metersV = metersU) {
  // Builders cache box geometries: never change a prop or another wall's UVs.
  const geometry = mesh.geometry.clone();
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const uv = geometry.attributes.uv;
  mesh.updateWorldMatrix(true, false);
  const matrix = mesh.matrixWorld.elements;
  for (let i = 0; i < position.count; i++) {
    const px = position.getX(i), py = position.getY(i), pz = position.getZ(i);
    const x = matrix[0] * px + matrix[4] * py + matrix[8] * pz + matrix[12];
    const y = matrix[1] * px + matrix[5] * py + matrix[9] * pz + matrix[13];
    const z = matrix[2] * px + matrix[6] * py + matrix[10] * pz + matrix[14];
    const nx = matrix[0] * normal.getX(i) + matrix[4] * normal.getY(i) + matrix[8] * normal.getZ(i);
    const ny = matrix[1] * normal.getX(i) + matrix[5] * normal.getY(i) + matrix[9] * normal.getZ(i);
    const nz = matrix[2] * normal.getX(i) + matrix[6] * normal.getY(i) + matrix[10] * normal.getZ(i);
    if (Math.abs(ny) > 0.5) uv.setXY(i, x / metersU, (ny > 0 ? -z : z) / metersV);
    else if (Math.abs(nx) > 0.5) uv.setXY(i, (nx > 0 ? -z : z) / metersU, y / metersV);
    else uv.setXY(i, (nz > 0 ? x : -x) / metersU, y / metersV);
  }
  mesh.geometry = geometry;
  return mesh;
}
