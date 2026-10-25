const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const url = (process.env.MIRROR_TEST_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const out = process.env.MIRROR_TEST_OUTPUT || "/tmp/mirror-first-person";
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  const errors = [], failed = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
    page.setDefaultTimeout(120000);
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    page.on("requestfailed", request => failed.push(request.url()));
    await page.route("**/__first-person__", route => route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><style>body{margin:0}</style><link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>',
    }));
    await page.goto(url + "/__first-person__");
    const report = await page.evaluate(async () => {
      const T = await import("three");
      const { preloadCharacterAssets, createFigure } = await import("/src/figure.mjs");
      const { createFirstPerson, FIRST_PERSON_LAYER, FLASHLIGHT_DRAW_SECONDS, INTERACTION_SECONDS } = await import("/src/first-person.mjs");
      await preloadCharacterAssets();
      const check = (condition, message) => { if (!condition) throw new Error(message); };
      const near = (a, b, tolerance, message) => check(Math.abs(a - b) < tolerance, message + ": " + a + " vs " + b);
      const scene = new T.Scene();
      scene.background = new T.Color(0x151a16);
      const camera = new T.PerspectiveCamera(65, 1000 / 760, .055, 30);
      camera.layers.enable(FIRST_PERSON_LAYER);
      camera.rotation.order = "YXZ";
      const player = { x: 0, z: 0, yaw: 0, pitch: 0, distance: 0, speed: 0, vx: 0, vz: 0 };
      const before = createFigure(null, 0);
      const skinBefore = before.body.getObjectByName("Mara_Skin");
      const originalCount = skinBefore.geometry.index.count;
      const originalMaterial = skinBefore.material;
      const fp = createFirstPerson(scene, camera);
      const skin = fp.body.getObjectByName("Mara_Skin");
      check(skin.geometry !== skinBefore.geometry && skin.geometry.index.count < originalCount, "Head cut is shared or incomplete");
      check(skin.material !== originalMaterial && skinBefore.material.emissiveIntensity === 1, "First-person adaptation modifies normal Mara");
      for (const name of ["Mara_Hair", "Mara_Eyes", "Mara_Brows", "Mara_Lashes"])
        check(!fp.body.getObjectByName(name).visible, "A face accessory remains visible: " + name);
      fp.body.traverse(object => {
        check(object.layers.mask === 1 << FIRST_PERSON_LAYER, "First-person object leaked onto world/reflection layer");
        if (object.isMesh) check(!object.castShadow, "Animated first-person body invalidates world shadow maps");
      });
      const later = createFigure(null, 0);
      check(later.body.getObjectByName("Mara_Skin").geometry.index.count === originalCount, "Head cut mutated the shared template");
      let clock = 0;
      const step = (seconds, flashlightOn, options = {}) => {
        const frames = Math.ceil(seconds * 120);
        for (let index = 0; index < frames; index++) {
          const dt = Math.min(1 / 120, seconds - index / 120);
          clock += dt;
          camera.position.set(player.x, 1.64, player.z);
          camera.rotation.set(player.pitch, player.yaw, 0, "YXZ");
          camera.updateMatrixWorld(true);
          fp.update(dt, player, { flashlightOn, time: clock, ...options });
        }
        return fp.snapshot();
      };
      step(1 / 60, false);
      check(!fp.snapshot().flashlightVisible && fp.getBeam().visibility === 0, "Stowed torch is visible or casts a beam");
      step(.12, true);
      check(fp.snapshot().draw > 0 && fp.snapshot().draw < 1, "Flashlight teleports to the drawn pose");
      check(fp.snapshot().flashlightVisible, "Drawing flashlight has no physical model");
      step(FLASHLIGHT_DRAW_SECONDS, true);
      near(fp.snapshot().draw, 1, .00001, "Flashlight draw never completes");
      near(fp.getBeam().visibility, 1, .00001, "Held flashlight has no beam");
      const drawPose = fp.snapshot();
      const wristBend = side => {
        const wrist = fp.rig.point(`hand_${side}`);
        const forearm = wrist.clone().sub(fp.rig.point(`lowerarm_${side}`)).normalize();
        const palm = fp.rig.point(`middle_01_${side}`).sub(wrist).normalize();
        return Math.acos(T.MathUtils.clamp(forearm.dot(palm), -1, 1));
      };
      const heldWristRadians = wristBend("r");
      check(heldWristRadians < Math.PI / 3, "Holding the torch folds the wrist back against the forearm");
      const gripContacts = ["index", "middle", "ring", "pinky"].map(finger => {
        const point = fp.flashlight.worldToLocal(fp.rig.point(`${finger}_02_r`));
        return { finger, radius: Math.hypot(point.x, point.y), z: point.z };
      });
      check(gripContacts.every(point => point.radius > .024 && point.radius < .036 && point.z > -.085 && point.z < .085),
        "Fingers close around empty air rather than the physical flashlight barrel");
      const lensToEye = fp.getBeam().position.clone().sub(camera.position).applyQuaternion(camera.quaternion.clone().invert());
      check(lensToEye.z < -.2 && lensToEye.x > .05 && lensToEye.y < -.05, "Flashlight is not physically held below/right of view");
      check(fp.getBeam().direction.dot(camera.getWorldDirection(new T.Vector3())) > .99999, "Beam disagrees with torch/camera aim");
      const hand = fp.rig.joint("hand_r").bone;
      const torchOffset = hand.worldToLocal(fp.flashlight.getWorldPosition(new T.Vector3()));
      const beamOrigin = fp.getBeam().position.clone();
      step(.20, true, { clearance: .23 });
      const nearWall = fp.getBeam().position.clone().sub(camera.position).applyQuaternion(camera.quaternion.clone().invert());
      check(nearWall.z > lensToEye.z + .10 && nearWall.y < lensToEye.y, "Flashlight does not withdraw from nearby walls");
      const wallClearance = [];
      for (const distance of [.26, .35, .5]) {
        fp.reset();
        let maximumDepth = -Infinity, minVisibleDepth = Infinity;
        // Inspect actual barrel vertices through both transitions, not just
        // the light origin: an unclipped beam can hide a torch inside a wall.
        for (const flashlightOn of [true, false]) for (let frame = 0; frame < 45; frame++) {
          step(1 / 120, flashlightOn, { clearance: distance });
          if (!fp.flashlight.visible) continue;
          fp.flashlight.traverse(mesh => {
            if (!mesh.isMesh) return;
            for (let vertex = 0; vertex < mesh.geometry.attributes.position.count; vertex++) {
              const point = mesh.localToWorld(new T.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, vertex));
              const view = point.clone().applyMatrix4(camera.matrixWorldInverse);
              maximumDepth = Math.max(maximumDepth, -view.z);
              const ndc = point.project(camera);
              if (Math.abs(ndc.x) < .98 && Math.abs(ndc.y) < .98 && -view.z > 0)
                minVisibleDepth = Math.min(minVisibleDepth, -view.z);
            }
          });
        }
        check(maximumDepth < distance - .015,
          `Physical flashlight crosses the ${distance}m wall: ${maximumDepth}`);
        check(minVisibleDepth === Infinity || minVisibleDepth > camera.near + .02,
          "Lowered flashlight crosses the visible near plane");
        wallClearance.push({ distance, maximumDepth, margin: distance - maximumDepth, minVisibleDepth: Number.isFinite(minVisibleDepth) ? minVisibleDepth : null });
      }
      step(FLASHLIGHT_DRAW_SECONDS, true);
      step(.20, true);
      const afterOffset = hand.worldToLocal(fp.flashlight.getWorldPosition(new T.Vector3()));
      check(torchOffset.distanceTo(afterOffset) < 1e-7, "Flashlight floats away from the real hand");
      const leftStart = fp.rig.point("hand_l");
      check(fp.interact(new T.Vector3(-.22, 1.22, -.40), "pickup"), "Interaction cannot start");
      const reaching = step(INTERACTION_SECONDS * .38, true);
      check(reaching.interaction.side === "l" && fp.rig.point("hand_l").distanceTo(leftStart) > .10, "A held flashlight does not free the other hand to interact");
      check(fp.getBeam().position.distanceTo(beamOrigin) < .025, "Interaction moves the flashlight into the reaching hand");
      check(wristBend("l") < .12, "Free-hand reaching resets the wrist to a downward standing pose");
      check(!fp.interact(new T.Vector3(.15, 1.2, -.4)), "Repeated prompts restart an unfinished reach and snap its arm");
      step(INTERACTION_SECONDS, true);
      check(fp.snapshot().interaction === null, "Interaction animation does not complete");
      let minHandDepth = Infinity;
      for (const pitch of [-1.25, -.7, 0, .7, 1.25]) {
        player.pitch = pitch;
        step(.10, true);
        const handPosition = fp.rig.point("hand_r").applyMatrix4(camera.matrixWorldInverse);
        minHandDepth = Math.min(minHandDepth, -handPosition.z);
        check(-handPosition.z > camera.near + .09, "Held hand clips into the eye at pitch " + pitch);
        fp.body.traverse(mesh => {
          if (!mesh.isSkinnedMesh || !mesh.visible) return;
          mesh.skeleton.update();
          const values = mesh.geometry.attributes.position;
          for (let index = 0; index < values.count; index += 79) {
            const point = mesh.getVertexPosition(index, new T.Vector3());
            check([point.x, point.y, point.z].every(Number.isFinite), "Non-finite articulated body vertices");
          }
        });
      }
      player.pitch = 0;
      step(.10, true);
      step(.10, false);
      check(fp.snapshot().draw > 0 && fp.snapshot().draw < 1 && fp.getBeam().visibility === 0, "Putting away flashlight teleports or leaves beam on");
      step(FLASHLIGHT_DRAW_SECONDS, false);
      check(!fp.snapshot().flashlightVisible, "Stowed torch never disappears");
      check(fp.interact(new T.Vector3(.22, 1.22, -.40), "pickup"), "Empty right hand cannot reach");
      step(INTERACTION_SECONDS * .38, false);
      check(fp.snapshot().interaction.side === "r" && wristBend("r") < .12,
        "Empty-hand reach folds the right wrist or uses the wrong hand");
      step(.10, true);
      check(fp.snapshot().draw === 0, "Flashlight draws into an occupied reaching hand");
      step(INTERACTION_SECONDS, true); step(FLASHLIGHT_DRAW_SECONDS, true);
      check(fp.snapshot().draw === 1 && fp.snapshot().interaction === null,
        "Queued torch draw does not recover after the right hand finishes reaching");
      step(FLASHLIGHT_DRAW_SECONDS, false);
      const walkStart = fp.rig.point("foot_l");
      player.speed = 1.85; player.vz = -1.85;
      for (let frame = 0; frame < 60; frame++) {
        player.z -= 1.85 / 60; player.distance += 1.85 / 60;
        step(1 / 60, false);
      }
      check(fp.rig.point("foot_l").distanceTo(walkStart) > 1, "Walking body does not follow real player displacement");
      step(.10, true, { inverted: true });
      check(fp.snapshot().evidenceBlood === 1 && before.body.userData.evidenceBlood === 0, "Truth-state blood leaks into the clean model");
      fp.reset();
      check(fp.snapshot().draw === 0 && !fp.snapshot().flashlightVisible && fp.snapshot().interaction === null && fp.snapshot().evidenceBlood === 0, "Reset retains body/flashlight/interaction state");
      step(.10, false, { active: false });
      check(!fp.body.visible && fp.getBeam().visibility === 0, "Inactive body remains visible");
      const updateCosts = [];
      for (let frame = 0; frame < 132; frame++) {
        const started = performance.now();
        step(1 / 60, true);
        if (frame >= 12) updateCosts.push(performance.now() - started);
      }
      updateCosts.sort((a, b) => a - b);
      const updateCpuMs = { samples: updateCosts.length, median: updateCosts[Math.floor(updateCosts.length * .5)], p95: updateCosts[Math.floor(updateCosts.length * .95)] };

      const floor = new T.Mesh(new T.PlaneGeometry(20, 20), new T.MeshStandardMaterial({ color: 0x38392c, roughness: .9 }));
      floor.rotation.x = -Math.PI / 2; scene.add(floor);
      const wall = new T.Mesh(new T.BoxGeometry(6, 2.5, .1), new T.MeshStandardMaterial({ color: 0x6b6b52, roughness: .9 }));
      wall.position.set(0, 1.25, -2); scene.add(wall);
      scene.add(new T.HemisphereLight(0xd9decb, 0x23251c, .75));
      const key = new T.PointLight(0xffdec0, 9, 7, 2); key.position.set(-1, 2, -1); scene.add(key);
      const renderer = new T.WebGLRenderer({ antialias: true });
      renderer.setSize(1000, 760); renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      document.body.append(renderer.domElement);
      player.x = player.z = player.yaw = player.pitch = player.distance = player.speed = player.vx = player.vz = 0;
      window.drawFirstPerson = view => {
        player.pitch = view === "down" ? -1.16 : 0;
        step(.45, view !== "stowed");
        renderer.render(scene, camera);
        return fp.snapshot();
      };
      await renderer.compileAsync(scene, camera);
      window.firstPersonFixture = { fp, scene, camera, renderer, player, step };
      window.drawFirstPerson("forward");
      return { status: "PASS", triangles: fp.snapshot().triangles, drawPose, gripContacts, heldWristRadians, wallClearance, minHandDepth, originalTriangles: originalCount / 3, updateCpuMs, layer: FIRST_PERSON_LAYER };
    });
    for (const view of ["forward", "down", "stowed"]) {
      await page.evaluate(view => window.drawFirstPerson(view), view);
      await page.screenshot({ path: out + "/" + view + ".png", timeout: 60000 });
    }
    await page.evaluate(async () => {
      const T = await import("three");
      const { fp, scene, renderer, camera, player } = window.firstPersonFixture;
      player.pitch = 0; camera.rotation.set(0, 0, 0, "YXZ"); camera.updateMatrixWorld(true);
      fp.prepare(player);
      const detail = new T.PerspectiveCamera(43, 1000 / 760, .035, 5);
      detail.layers.enable(2); detail.position.set(.57, 1.64, -.84);
      detail.lookAt(.23, 1.37, -.40);
      renderer.render(scene, detail);
    });
    await page.screenshot({ path: out + "/grip-detail.png", timeout: 60000 });
    assert.deepEqual(errors, []); assert.deepEqual(failed, []);
    const result = { ...report, checks: ["private headless body geometry", "normal/NPC material and template isolation", "primary-camera-only layer", "finite draw/stow animations", "bone-attached physical flashlight and matching beam", "near-wall withdrawal", "neutral two-hand reach, input overlap and repeat suppression", "safe held-hand depth at all pitch limits", "walking follows real displacement", "truth-state blood isolation", "inactive/reset cleanup", "actual PBR render poses"], errors, failed };
    fs.writeFileSync(out + "/report.json", JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
