import * as T from "three";
export function createFigure(house, layer = 1) {
  const body = new T.Group(),
    head = new T.Group(),
    arms = [],
    legs = [];
  const skin = new T.MeshStandardMaterial({ color: 0x9c9485, roughness: 0.77 }),
    hair = new T.MeshStandardMaterial({ color: 0x1b1b18, roughness: 1 }),
    shirt = house.surfaces.material("linen", 1.8, 2.7, 0x46534c),
    trousers = house.surfaces.material("linen", 2, 3, 0x292f2b);
  function mesh(geometry, material, parent, x = 0, y = 0, z = 0) {
    const o = new T.Mesh(geometry, material);
    o.position.set(x, y, z);
    o.castShadow = true;
    parent.add(o);
    return o;
  }
  function ellipsoid(rx, ry, rz, x, y, z, material, parent = body) {
    const o = mesh(new T.SphereGeometry(1, 28, 20), material, parent, x, y, z);
    o.scale.set(rx, ry, rz);
    return o;
  }
  const torso = mesh(
    new T.LatheGeometry(
      [
        [0.16, 0.78],
        [0.2, 0.82],
        [0.205, 1.03],
        [0.225, 1.29],
        [0.19, 1.39],
        [0.075, 1.43],
      ].map((p) => new T.Vector2(...p)),
      32,
    ),
    shirt,
    body,
  );
  torso.scale.z = 0.64;
  ellipsoid(0.19, 0.1, 0.125, 0, 0.8, 0, trousers);
  mesh(new T.CylinderGeometry(0.061, 0.075, 0.14, 24), skin, body, 0, 1.43, 0);
  for (const side of [-1, 1]) {
    const arm = new T.Group();
    arm.position.set(side * 0.225, 1.32, 0);
    body.add(arm);
    arms.push(arm);
    const upper = mesh(
      new T.CapsuleGeometry(0.066, 0.2, 8, 16),
      shirt,
      arm,
      side * 0.02,
      -0.12,
      0,
    );
    upper.rotation.z = side * 0.08;
    const lower = mesh(
      new T.CapsuleGeometry(0.052, 0.2, 8, 16),
      shirt,
      arm,
      side * 0.035,
      -0.39,
      -0.025,
    );
    lower.rotation.x = -0.07;
    ellipsoid(0.045, 0.073, 0.021, side * 0.04, -0.59, -0.03, skin, arm);
    for (let f = 0; f < 4; f++) {
      const finger = mesh(
        new T.CapsuleGeometry(0.0085, 0.06 + (f === 1 ? 0.015 : 0), 4, 8),
        skin,
        arm,
        side * 0.011 + f * 0.018 * side,
        -0.67,
        -0.03,
      );
      finger.rotation.x = -0.09;
    }
    const thumb = mesh(
      new T.CapsuleGeometry(0.011, 0.045, 4, 8),
      skin,
      arm,
      -side * 0.007,
      -0.61,
      -0.04,
    );
    thumb.rotation.z = side * 0.4;
    const leg = new T.Group();
    leg.position.set(side * 0.102, 0.77, 0);
    body.add(leg);
    legs.push(leg);
    mesh(new T.CapsuleGeometry(0.078, 0.23, 8, 16), trousers, leg, 0, -0.2, 0);
    mesh(
      new T.CapsuleGeometry(0.065, 0.23, 8, 16),
      trousers,
      leg,
      0,
      -0.54,
      0.01,
    );
    ellipsoid(0.078, 0.065, 0.15, 0, -0.704, -0.055, house.black, leg);
  }
  head.position.y = 1.64;
  body.add(head);
  ellipsoid(0.105, 0.138, 0.115, 0, 0, 0, skin, head);
  ellipsoid(0.081, 0.064, 0.083, 0, -0.073, -0.013, skin, head);
  const cap = mesh(
    new T.SphereGeometry(0.111, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.5),
    hair,
    head,
    0,
    0.005,
    0.012,
  );
  cap.scale.set(1, 1.27, 1.04);
  ellipsoid(0.085, 0.1, 0.038, 0, 0.011, 0.092, hair, head);
  for (const side of [-1, 1]) {
    ellipsoid(0.017, 0.031, 0.013, side * 0.106, -0.004, 0, skin, head);
    const socket = ellipsoid(
      0.021,
      0.009,
      0.007,
      side * 0.04,
      0.007,
      -0.105,
      hair,
      head,
    );
    ellipsoid(
      0.01,
      0.0048,
      0.004,
      side * 0.04,
      0.007,
      -0.112,
      house.black,
      head,
    );
    const brow = ellipsoid(
      0.025,
      0.004,
      0.009,
      side * 0.04,
      0.027,
      -0.104,
      hair,
      head,
    );
    brow.rotation.z = side * -0.06;
  }
  ellipsoid(0.013, 0.031, 0.021, 0, -0.019, -0.113, skin, head);
  ellipsoid(0.016, 0.012, 0.019, 0, -0.04, -0.122, skin, head);
  ellipsoid(0.024, 0.0025, 0.0035, 0, -0.069, -0.1, hair, head);
  body.traverse((o) => o.layers.set(layer));
  function animate(time, speed = 0, frozen = false) {
    const walking = frozen ? 0 : Math.min(speed / 2, 1);
    const phase = time * 7.1;
    arms.forEach((arm, i) => {
      arm.rotation.x = Math.sin(phase + i * Math.PI) * 0.15 * walking;
      arm.rotation.z =
        (i === 0 ? -0.045 : 0.045) + Math.sin(time * 0.6) * 0.004;
    });
    legs.forEach(
      (leg, i) =>
        (leg.rotation.x = Math.sin(phase + (i + 1) * Math.PI) * 0.14 * walking),
    );
    torso.scale.x = 1 + (frozen ? 0 : Math.sin(time * 1.1) * 0.006);
  }
  return { body, head, arms, legs, animate };
}
