// CPU geometry/regression checks. Rendering and subjective horror are reviewed
// separately: this harness never creates a WebGLRenderer.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const url = (process.env.MIRROR_TEST_URL || "http://127.0.0.1:8000").replace(
  /\/$/,
  "",
);
const out = process.env.MIRROR_TEST_OUTPUT || "/tmp/mirror-me-demon-checks";
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const report = { result: "FAIL", rendered: false, errors: [], failed: [] };
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(120000);
    page.on("pageerror", (error) => report.errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") report.errors.push(message.text());
    });
    page.on("requestfailed", (request) => report.failed.push(request.url()));
    await page.route("**/__demon-checks__", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: '<!doctype html><link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>',
      }),
    );
    await page.goto(url + "/__demon-checks__");
    Object.assign(
      report,
      await page.evaluate(async () => {
        const T = await import("/vendor/three.module.js");
        const { preloadCharacterAssets, createFigure } = await import(
          "/src/figure.mjs"
        );
        const { createDemon, preloadDemonAssets } = await import(
          "/src/demon.mjs"
        );
        const { HorrorDirector } = await import("/src/horror.mjs");
        const { CREATURE_STRIDE_METERS } = await import(
          "/src/figure-motion.mjs"
        );
        const { CEILING_HEIGHT, ROOMS } = await import("/src/layout.mjs");
        await Promise.all([preloadCharacterAssets(), preloadDemonAssets()]);

        const check = (condition, message) => {
          if (!condition) throw new Error(message);
        };
        const visible = (mesh) => {
          for (let object = mesh; object; object = object.parent)
            if (!object.visible) return false;
          return true;
        };
        const meshes = (figure) => {
          const result = [];
          figure.body.traverse((object) => {
            if (object.isMesh) result.push(object);
          });
          return result;
        };
        const materials = (figure) =>
          meshes(figure).flatMap((mesh) =>
            Array.isArray(mesh.material) ? mesh.material : [mesh.material],
          );
        const bones = (figure) => {
          const result = [];
          figure.body.traverse((object) => {
            if (object.isBone) result.push(object);
          });
          return result;
        };
        const hash = (array) => {
          const bytes = new Uint8Array(
            array.buffer,
            array.byteOffset,
            array.byteLength,
          );
          let value = 2166136261;
          for (const byte of bytes) value = Math.imul(value ^ byte, 16777619);
          return (value >>> 0).toString(16);
        };
        const geometryFingerprint = (geometry) => ({
          index: geometry.index ? hash(geometry.index.array) : null,
          attributes: Object.fromEntries(
            Object.entries(geometry.attributes).map(([name, attribute]) => [
              name,
              hash(attribute.array),
            ]),
          ),
          morphs: Object.fromEntries(
            Object.entries(geometry.morphAttributes).map(
              ([name, attributes]) => [
                name,
                attributes.map((attribute) => hash(attribute.array)),
              ],
            ),
          ),
        });
        const materialFingerprint = (material) => ({
          name: material.name,
          color: material.color?.getHex(),
          roughness: material.roughness,
          metalness: material.metalness,
          emissive: material.emissive?.getHex(),
          emissiveIntensity: material.emissiveIntensity,
          transparent: material.transparent,
          alphaTest: material.alphaTest,
          opacity: material.opacity,
          side: material.side,
          program: material.customProgramCacheKey(),
          textures: Object.fromEntries(
            Object.keys(material)
              .filter((key) => material[key]?.isTexture)
              .map((key) => [key, material[key].uuid]),
          ),
        });
        const poseFingerprint = (figure) => {
          const result = [];
          figure.body.traverse((object) =>
            result.push({
              name: object.name,
              position: object.position.toArray(),
              quaternion: object.quaternion.toArray(),
              scale: object.scale.toArray(),
              visible: object.visible,
              morphs: object.morphTargetInfluences?.slice(),
            }),
          );
          return JSON.stringify(result);
        };
        const fingerprint = (figure) =>
          JSON.stringify({
            meshes: meshes(figure).map((mesh) => ({
              name: mesh.name,
              geometry: geometryFingerprint(mesh.geometry),
            })),
            materials: materials(figure).map(materialFingerprint),
            pose: poseFingerprint(figure),
          });
        const budget = (figure) => {
          const shown = meshes(figure).filter(visible);
          return {
            meshes: shown.length,
            triangles: shown.reduce(
              (total, mesh) =>
                total +
                (mesh.geometry.index?.count ||
                  mesh.geometry.attributes.position.count) /
                  3,
              0,
            ),
            materials: new Set(
              shown.flatMap((mesh) =>
                Array.isArray(mesh.material) ? mesh.material : [mesh.material],
              ),
            ).size,
          };
        };

        const human = createFigure(null, 0);
        human.animate(1.3, 0, true);
        const beforeHuman = fingerprint(human);
        const demon = createDemon(null, 0);
        const secondDemon = createDemon(null, 0);
        const humanMaterials = new Set(materials(human));
        const firstMaterials = new Set(materials(demon));
        const firstBones = new Set(bones(demon));
        check(
          materials(demon).every((material) => !humanMaterials.has(material)),
          "Demon materials alias the normal human",
        );
        check(
          materials(secondDemon).every(
            (material) => !firstMaterials.has(material),
          ),
          "Two demons share mutable materials",
        );
        check(
          bones(secondDemon).every((bone) => !firstBones.has(bone)),
          "Two demons share a posed skeleton",
        );
        const humanSkin = human.body.getObjectByName("Mara_Skin");
        const demonSkin = demon.body.getObjectByName("Mara_Skin");
        const secondSkin = secondDemon.body.getObjectByName("Mara_Skin");
        check(
          demonSkin.geometry !== humanSkin.geometry,
          "Demon facial sculpt aliases normal human geometry",
        );
        check(
          demonSkin.geometry !== secondSkin.geometry,
          "Two demons share mutable sculpt geometry",
        );

        demon.resetPose();
        const resetPose = poseFingerprint(demon);
        const resetMaterials = JSON.stringify(
          materials(demon).map(materialFingerprint),
        );
        for (const mode of ["twisted", "crawl", "ceiling"]) {
          demon.setCreaturePose(1.7, 0.6, {
            mode,
            intensity: 1,
            distance: 0.45,
            delta: 1 / 60,
            vx: 0,
            vz: -0.45,
          });
          demon.resetPose();
          check(
            poseFingerprint(demon) === resetPose,
            `${mode} did not reset to the same skeleton and morph state`,
          );
          check(
            JSON.stringify(materials(demon).map(materialFingerprint)) ===
              resetMaterials,
            `${mode} did not restore consistent demon materials`,
          );
        }
        check(
          fingerprint(human) === beforeHuman,
          "Constructing, posing or resetting demons changed the normal human",
        );
        const normalBudget = budget(human),
          demonBudget = budget(demon);
        // Bound additional art cost relative to the existing character. The
        // thresholds allow detailed teeth/facial layers while catching accidental
        // whole-character duplication or unbounded procedural geometry.
        check(
          demonBudget.triangles <= normalBudget.triangles + 20000,
          "Demon adds more than 20,000 triangles to the existing character",
        );
        check(
          demonBudget.meshes <= normalBudget.meshes + 24,
          "Demon adds more than 24 visible meshes",
        );

        const measurements = [];
        const profiles = [0.8, 0.84, 0.9, 0.95, 1].map((intensity) => ({
          intensity,
          gaze: "none",
          yaw: 0,
        }));
        for (const intensity of [0.8, 1])
          profiles.push(
            { intensity, gaze: "left", yaw: 0, target: [-2, 1.64, -2] },
            { intensity, gaze: "right", yaw: 0, target: [2, 1.64, -2] },
            {
              intensity,
              gaze: "rotated-ceiling",
              yaw: Math.PI / 2,
              target: [-2, 1.64, -2],
              modes: ["ceiling"],
            },
          );
        for (const profile of profiles)
          for (const mode of profile.modes || ["crawl", "ceiling"])
            for (const direction of [-1, 1]) {
              demon.resetPose();
              demon.resetMotion();
              demon.body.position.set(
                0,
                mode === "ceiling" ? CEILING_HEIGHT - 0.08 : 0,
                0,
              );
              demon.body.rotation.set(0, profile.yaw, 0);
              const intentDirection = new T.Vector3(
                0,
                0,
                direction,
              ).applyAxisAngle(new T.Vector3(0, 1, 0), profile.yaw);
              const travelIntent = [intentDirection.x, intentDirection.z];
              if (profile.target) {
                // Enter the real still -> orient -> withdraw sequence so a
                // phase-driven gaze cannot silently remain inactive here.
                demon.setCreaturePose(-0.6, 0, {
                  mode,
                  intensity: profile.intensity,
                  distance: 0,
                  delta: 1 / 120,
                  phase: "still",
                  still: true,
                  gazeTarget: profile.target,
                  gazeWeight: 0,
                  travelIntent,
                });
                demon.setCreaturePose(-0.42, 0, {
                  mode,
                  intensity: profile.intensity,
                  distance: 0,
                  delta: 1 / 120,
                  phase: "orient",
                  gazeTarget: profile.target,
                  gazeWeight: 1,
                  travelIntent,
                });
              }
              const previousContacts = new Map();
              let minX = Infinity,
                maxX = -Infinity,
                minY = Infinity,
                maxY = -Infinity;
              let maxContactError = 0,
                maxAnchorError = 0,
                maxStanceDrift = 0,
                gazeTurn = null;
              for (let frame = 0; frame <= 120; frame++) {
                const time = frame / 120,
                  distance = CREATURE_STRIDE_METERS * time;
                demon.body.position
                  .set(
                    0,
                    mode === "ceiling" ? CEILING_HEIGHT - 0.08 : 0,
                    direction * distance,
                  )
                  .applyAxisAngle(new T.Vector3(0, 1, 0), profile.yaw);
                demon.body.rotation.set(0, profile.yaw, 0);
                const velocity = new T.Vector3(
                  0,
                  0,
                  direction * CREATURE_STRIDE_METERS,
                ).applyAxisAngle(new T.Vector3(0, 1, 0), profile.yaw);
                const poseOptions = {
                  mode,
                  intensity: profile.intensity,
                  distance,
                  delta: 1 / 120,
                  vx: velocity.x,
                  vz: velocity.z,
                  phase: "withdraw",
                  still: false,
                  gazeTarget: profile.target,
                  gazeWeight: profile.target ? 1 : 0,
                  travelIntent,
                };
                if (profile.target && frame === 0) {
                  demon.setCreaturePose(time, time, {
                    ...poseOptions,
                    gazeWeight: 0,
                  });
                  const head = demon.body.getObjectByName("head");
                  const before = head.getWorldQuaternion(new T.Quaternion());
                  demon.setCreaturePose(time, time, poseOptions);
                  gazeTurn = before.angleTo(
                    head.getWorldQuaternion(new T.Quaternion()),
                  );
                  check(
                    gazeTurn > 0.005 && gazeTurn <= 0.351,
                    `${profile.gaze}: head gaze should activate and remain within twenty degrees`,
                  );
                } else demon.setCreaturePose(time, time, poseOptions);
                demon.body.updateMatrixWorld(true);
                for (const contact of demon.body.userData.creatureGait
                  .contacts) {
                  const bone = demon.body.getObjectByName(contact.name);
                  const actual = bone.getWorldPosition(new T.Vector3());
                  const target = new T.Vector3().fromArray(contact.target);
                  const anchor = new T.Vector3().fromArray(contact.anchor);
                  const previous = previousContacts.get(contact.name);
                  maxContactError = Math.max(
                    maxContactError,
                    actual.distanceTo(target),
                  );
                  if (contact.stance) {
                    maxAnchorError = Math.max(
                      maxAnchorError,
                      actual.distanceTo(anchor),
                    );
                    if (previous?.stance)
                      maxStanceDrift = Math.max(
                        maxStanceDrift,
                        actual.distanceTo(previous.position),
                      );
                  }
                  previousContacts.set(contact.name, {
                    position: actual,
                    stance: contact.stance,
                  });
                }
                if (frame % 10) continue;
                const bounds = new T.Box3();
                const inverseYaw = new T.Matrix4().makeRotationY(-profile.yaw);
                for (const mesh of meshes(demon).filter(visible)) {
                  const projectedWorld = inverseYaw
                    .clone()
                    .multiply(mesh.matrixWorld);
                  if (mesh.isSkinnedMesh) {
                    mesh.skeleton.update();
                    mesh.computeBoundingBox();
                    bounds.union(
                      mesh.boundingBox.clone().applyMatrix4(projectedWorld),
                    );
                  } else {
                    mesh.geometry.computeBoundingBox();
                    bounds.union(
                      mesh.geometry.boundingBox
                        .clone()
                        .applyMatrix4(projectedWorld),
                    );
                  }
                }
                minX = Math.min(minX, bounds.min.x);
                maxX = Math.max(maxX, bounds.max.x);
                minY = Math.min(minY, bounds.min.y);
                maxY = Math.max(maxY, bounds.max.y);
              }
              measurements.push({
                intensity: profile.intensity,
                gaze: profile.gaze,
                yaw: profile.yaw,
                gazeTurn,
                mode,
                direction,
                minX,
                maxX,
                minY,
                maxY,
                maxContactError,
                maxAnchorError,
                maxStanceDrift,
              });
            }
        const scene = new T.Scene();
        const camera = new T.PerspectiveCamera(65, 1.6, 0.05, 30);
        camera.position.set(2, 1.64, 0);
        camera.lookAt(5.75, 0.55, 0);
        camera.updateMatrixWorld(true);
        const director = new HorrorDirector(scene, { occluders: [] });
        const story = {
          stage: 3,
          doors: { bedroom: true },
          hasDiary: true,
          hasTimeClue: true,
        };
        const player = { x: 2, z: 0, yaw: -Math.PI / 2 };
        const directorPhases = new Set();
        let directorAnchorError = 0,
          directorStraightSamples = 0;
        for (let frame = 0; frame <= 840; frame++) {
          director.update(frame / 120, 1 / 120, story, player, camera);
          const state = director.snapshot();
          if (!state.active) continue;
          directorPhases.add(state.phase);
          // The first straight section is deliberately before the authored
          // doorway turn: direction is fixed while the body changes from its
          // stationary observation to a backwards retreat.
          if (director.figure.body.position.x < 6.15)
            for (const contact of state.gait?.contacts || []) {
              if (!contact.stance) continue;
              const actual = director.figure.body
                .getObjectByName(contact.name)
                .getWorldPosition(new T.Vector3());
              directorAnchorError = Math.max(
                directorAnchorError,
                actual.distanceTo(new T.Vector3().fromArray(contact.anchor)),
              );
              directorStraightSamples++;
            }
        }
        const directorResult = {
          phases: [...directorPhases],
          straightSamples: directorStraightSamples,
          maxStraightAnchorError: directorAnchorError,
          completed: director.snapshot().completed["far-hall-crawler"],
        };
        check(
          fingerprint(human) === beforeHuman,
          "Demon stride sampling changed the normal human",
        );
        return {
          checks: [
            "normal human geometry/material/pose unchanged",
            "independent demon materials, facial geometry and skeletons",
            "deterministic reset after each creature mode",
            "bounded added render geometry",
            "all visible rigid and skinned geometry sampled",
            "independent world-space contacts checked at 120 Hz",
            "bounded head gaze and rotated ceiling surface checked",
            "real director's stationary-to-backward contact handoff checked",
          ],
          normalBudget,
          demonBudget,
          measurements,
          director: directorResult,
          doorwayWidth: ROOMS.find((room) => room.id === "bedroom").doorWidth,
          ceilingHeight: CEILING_HEIGHT,
        };
      }),
    );

    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.failed, []);
    const clearancePerJamb = 0.04;
    const limit = report.doorwayWidth / 2 - clearancePerJamb;
    for (const measurement of report.measurements) {
      const label =
        measurement.mode +
        " direction " +
        measurement.direction +
        " intensity " +
        measurement.intensity +
        " gaze " +
        measurement.gaze;
      assert.ok(
        measurement.minX >= -limit && measurement.maxX <= limit,
        label +
          " must fit the real bedroom doorway with 4 cm clearance at each jamb",
      );
      assert.ok(measurement.maxContactError < 1e-5, label + " solved contacts");
      assert.ok(
        measurement.maxAnchorError < 1e-5,
        label + " planted contact anchors",
      );
      assert.ok(measurement.maxStanceDrift < 1e-5, label + " stance drift");
      if (measurement.mode === "ceiling")
        assert.ok(
          measurement.maxY <= report.ceilingHeight + 0.005,
          label + " remains below ceiling",
        );
      else
        assert.ok(measurement.minY >= -0.015, label + " remains above floor");
    }
    assert.ok(
      report.director.completed,
      "The actual director encounter must complete",
    );
    assert.ok(
      report.director.straightSamples > 50,
      "The actual stationary-to-backward contact handoff must be exercised",
    );
    assert.ok(
      report.director.maxStraightAnchorError < 1e-5,
      "The actual director must preserve planted contacts while beginning its backward retreat",
    );
    report.result = "PASS";
  } catch (error) {
    report.failure = error.stack || String(error);
    throw error;
  } finally {
    fs.writeFileSync(
      out + "/demon.json",
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(JSON.stringify(report, null, 2));
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
