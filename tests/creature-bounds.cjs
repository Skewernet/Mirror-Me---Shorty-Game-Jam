// Exercise actual skinned geometry and world-space contacts without a renderer.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const url = (process.env.MIRROR_TEST_URL || "http://127.0.0.1:8000").replace(
  /\/$/,
  "",
);
const out = process.env.MIRROR_TEST_OUTPUT || "/tmp/mirror-me-creature-checks";
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  try {
    const page = await browser.newPage();
    const errors = [],
      failed = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("requestfailed", (request) => failed.push(request.url()));
    await page.route("**/__creature-bounds__", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: '<!doctype html><link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script><body></body>',
      }),
    );
    await page.goto(url + "/__creature-bounds__");
    const result = await page.evaluate(async () => {
      const T = await import("/vendor/three.module.js");
      const { preloadCharacterAssets, createFigure } = await import(
        "/src/figure.mjs"
      );
      const { CREATURE_STRIDE_METERS } = await import("/src/figure-motion.mjs");
      const { CEILING_HEIGHT, ROOMS } = await import("/src/layout.mjs");
      await preloadCharacterAssets();
      const measurements = [];
      const visible = (mesh) => {
        for (let object = mesh; object; object = object.parent)
          if (!object.visible) return false;
        return true;
      };
      for (const mode of ["crawl", "ceiling"])
        for (const direction of [-1, 1]) {
          const figure = createFigure(null, 0),
            previousContacts = new Map(),
            samples = [];
          let minX = Infinity,
            maxX = -Infinity,
            minY = Infinity,
            maxY = -Infinity,
            maxWidth = 0,
            maxContactError = 0,
            maxAnchorError = 0,
            maxStanceDrift = 0;
          for (let frame = 0; frame <= 120; frame++) {
            const time = frame / 120,
              distance = CREATURE_STRIDE_METERS * time;
            figure.body.position.set(
              0,
              mode === "ceiling" ? CEILING_HEIGHT - 0.08 : 0,
              direction * distance,
            );
            figure.body.rotation.y = 0;
            figure.setCreaturePose(time, time, {
              mode,
              intensity: 1,
              distance,
              delta: 1 / 120,
              vx: 0,
              vz: direction * CREATURE_STRIDE_METERS,
            });
            figure.body.updateMatrixWorld(true);
            for (const contact of figure.body.userData.creatureGait.contacts) {
              const bone = figure.body.getObjectByName(contact.name),
                actual = bone.getWorldPosition(new T.Vector3()),
                target = new T.Vector3().fromArray(contact.target),
                anchor = new T.Vector3().fromArray(contact.anchor),
                previous = previousContacts.get(contact.name);
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
            if (frame % 10 !== 0) continue;
            const bounds = new T.Box3();
            figure.body.traverse((mesh) => {
              if (!mesh.isSkinnedMesh || !visible(mesh)) return;
              mesh.skeleton.update();
              mesh.computeBoundingBox();
              bounds.union(
                mesh.boundingBox.clone().applyMatrix4(mesh.matrixWorld),
              );
            });
            const width = bounds.max.x - bounds.min.x;
            minX = Math.min(minX, bounds.min.x);
            maxX = Math.max(maxX, bounds.max.x);
            minY = Math.min(minY, bounds.min.y);
            maxY = Math.max(maxY, bounds.max.y);
            maxWidth = Math.max(maxWidth, width);
            samples.push({ distance, width });
          }
          measurements.push({
            mode,
            direction,
            maxWidth,
            minX,
            maxX,
            minY,
            maxY,
            maxContactError,
            maxAnchorError,
            maxStanceDrift,
            samples,
          });
        }
      return {
        doorwayWidth: ROOMS.find((room) => room.id === "bedroom").doorWidth,
        ceilingHeight: CEILING_HEIGHT,
        stride: CREATURE_STRIDE_METERS,
        measurements,
      };
    });
    const clearancePerJamb = 0.04;
    const limit = result.doorwayWidth / 2 - clearancePerJamb;
    const report = {
      result: "PASS",
      ...result,
      clearancePerJamb,
      errors,
      failed,
      rendered: false,
      note: "Thirteen skinned vertex bounds samples per full stride; world contact positions checked at 120 Hz, forward/backward on floor and ceiling.",
    };
    try {
      assert.deepEqual(errors, []);
      assert.deepEqual(failed, []);
      for (const measurement of result.measurements) {
        const label = measurement.mode + " direction " + measurement.direction;
        assert.ok(
          measurement.minX >= -limit && measurement.maxX <= limit,
          `${label}: skinned width ${measurement.maxWidth.toFixed(3)} m must fit the ${result.doorwayWidth} m bedroom door with ${clearancePerJamb} m clearance at each jamb`,
        );
        assert.ok(measurement.maxContactError < 1e-5, label + " contact solve");
        assert.ok(measurement.maxAnchorError < 1e-5, label + " planted anchor");
        assert.ok(measurement.maxStanceDrift < 1e-5, label + " stance drift");
        if (measurement.mode === "ceiling")
          assert.ok(
            measurement.maxY <= result.ceilingHeight + 0.005,
            label + " remains below the ceiling surface",
          );
        else
          assert.ok(
            measurement.minY >= -0.015,
            label + " remains above the floor surface",
          );
      }
    } catch (error) {
      report.result = "FAIL";
      throw error;
    } finally {
      fs.writeFileSync(
        out + "/creature-bounds.json",
        JSON.stringify(report, null, 2) + "\n",
      );
      console.log(JSON.stringify(report, null, 2));
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
