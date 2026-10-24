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
// Signed clearance also works when a moving door or restored wall already
// overlaps the body. Escape must remain possible without allowing new entry.
function clearance(x, z, c) {
  const dx = Math.max(c.minX - x, 0, x - c.maxX);
  const dz = Math.max(c.minZ - z, 0, z - c.maxZ);
  if (dx || dz) return Math.hypot(dx, dz) - RADIUS;
  return -Math.min(x - c.minX, c.maxX - x, z - c.minZ, c.maxZ - z) - RADIUS;
}
function blocked(fromX, fromZ, x, z, colliders) {
  return colliders.some((c) => {
    if (!overlaps(x, z, c)) return false;
    const before = clearance(fromX, fromZ, c);
    // A restored obstacle can meet a shoulder between updates. Permit only
    // outward/tangent recovery; movement farther into that obstacle is blocked.
    return before >= 0 || clearance(x, z, c) < before - 1e-9;
  });
}
function moveAxis(position, amount, axis, colliders) {
  if (!amount) return;
  const fromX = position.x, fromZ = position.z;
  const allowed = (fraction) => !blocked(
    fromX, fromZ,
    fromX + (axis === "x" ? amount * fraction : 0),
    fromZ + (axis === "z" ? amount * fraction : 0), colliders,
  );
  if (allowed(1)) {
    position[axis] += amount;
    return;
  }
  // Reach contact instead of dropping the entire frame's displacement. This
  // avoids the coarse stop/start gap that was most visible at narrow jambs.
  let low = 0, high = 1;
  for (let i = 0; i < 12; i++) {
    const fraction = (low + high) / 2;
    if (allowed(fraction)) low = fraction;
    else high = fraction;
  }
  position[axis] += amount * low;
}
// Substeps prevent tunnelling. Separate axes preserve sliding along walls.
export function moveWithCollision(position, dx, dz, colliders) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (RADIUS * 0.4)));
  for (let i = 0; i < steps; i++) {
    moveAxis(position, dx / steps, "x", colliders);
    moveAxis(position, dz / steps, "z", colliders);
  }
}
