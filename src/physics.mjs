export const RADIUS = 0.22;
export function wishDirection(forward, strafe, yaw) {
  const len = Math.hypot(forward, strafe) || 1;
  return {
    x: (Math.cos(yaw) * strafe - Math.sin(yaw) * forward) / len,
    z: (-Math.cos(yaw) * forward - Math.sin(yaw) * strafe) / len,
  };
}
export function overlaps(x, z, c, radius = RADIUS) {
  if (c.disabled) return false;
  const cx = Math.max(c.minX, Math.min(x, c.maxX)),
    cz = Math.max(c.minZ, Math.min(z, c.maxZ));
  return (x - cx) ** 2 + (z - cz) ** 2 < radius ** 2;
}
// Substeps prevent tunnelling. Separate axes preserve sliding along walls.
export function moveWithCollision(position, dx, dz, colliders) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (RADIUS * 0.4)));
  for (let i = 0; i < steps; i++) {
    if (
      !colliders.some((c) => overlaps(position.x + dx / steps, position.z, c))
    )
      position.x += dx / steps;
    if (
      !colliders.some((c) => overlaps(position.x, position.z + dz / steps, c))
    )
      position.z += dz / steps;
  }
}
