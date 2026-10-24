// Actual house/circuit integration without a GPU renderer or pose teleports.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const url = (process.env.MIRROR_TEST_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(120000);
    const errors = [], failed = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    page.on("requestfailed", request => failed.push(request.url()));
    await page.route("**/__crawler-lighting__", route => route.fulfill({
      contentType: "text/html",
      body: '<link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>',
    }));
    await page.goto(url + "/__crawler-lighting__");
    const report = await page.evaluate(async () => {
      const T = await import("three");
      const { buildHouse } = await import("/src/house.mjs");
      const { Story } = await import("/src/story.mjs");
      const { HorrorDirector } = await import("/src/horror.mjs");
      const { BLACKOUT_ENVIRONMENT, CRAWLER_FLICKER, crawlerFlickerAt } = await import("/src/crawler-flicker.mjs");
      const check = (value, message) => { if (!value) throw new Error(message); };
      const scene = new T.Scene(), state = new Story(), house = await buildHouse(scene);
      const player = { x: 2, z: 0, yaw: -Math.PI / 2 };
      state.power = true; state.stage = 3;
      state.doors = { lounge: true, kitchen: true, bathroom: true, utility: true, bedroom: true };
      house.reset(state);
      house.animate(2, 2, state, player);
      const baseline = new Map(house.lights.map(light => [light, light.intensity]));
      const ambientBase = house.ambientLight.intensity;
      const ambientSky = house.ambientLight.color.clone(), ambientGround = house.ambientLight.groundColor.clone();
      const environmentBase = house.materials.wood.envMapIntensity;
      const visibility = new Map(house.lights.map(light => [light, light.visible]));
      const windowLights = house.lights.filter(light => light.userData.powerCircuit === "window");
      check(windowLights.length === 4, "House moonlight fixtures changed unexpectedly");
      const fixtures = [];
      scene.traverse(mesh => {
        if (mesh.isMesh && mesh.userData.lightCircuit) fixtures.push({
          mesh, zone: mesh.userData.lightCircuit, color: mesh.material.color.clone(),
          emissive: mesh.material.emissiveIntensity,
        });
      });
      const restore = () => {
        house.applyHorrorLighting({ lightMultiplier: 1, lightSource: null });
        for (const [light, value] of baseline) check(light.intensity === value, "A circuit failed to restore its light intensity");
        for (const fixture of fixtures) {
          check(fixture.mesh.material.color.equals(fixture.color), "A circuit failed to restore its bulb color");
          check(fixture.mesh.material.emissiveIntensity === fixture.emissive, "A circuit failed to restore its shade emission");
        }
        check(house.ambientLight.intensity === ambientBase && house.materials.wood.envMapIntensity === environmentBase,
          "Electrical restoration retained dim indirect light");
        check(house.ambientLight.color.equals(ambientSky) && house.ambientLight.groundColor.equals(ambientGround),
          "Electrical restoration retained the outage's ambient palette");
      };
      const circuits = [];
      for (const [zone, lights] of Object.entries(house.lightingGroups)) {
        restore();
        const practical = lights.filter(light => light.userData.powerCircuit !== "window");
        check(practical.length > 0 && practical.some(light => baseline.get(light) > 0), zone + " has no powered practical light");
        const localFixtures = fixtures.filter(fixture => fixture.zone === zone);
        check(localFixtures.length > 0, zone + " has no owned visible lamp fixtures");
        house.applyHorrorLighting({ lightMultiplier: 0, lightSource: zone });
        check(practical.every(light => light.intensity === 0), zone + " did not switch fully off");
        for (const light of windowLights) check(light.intensity === baseline.get(light), zone + " switched off exterior moonlight");
        for (const [light, value] of baseline)
          if (!practical.includes(light)) check(light.intensity === value, zone + " interrupted another room's light");
        for (const fixture of fixtures) {
          const material = fixture.mesh.material;
          if (fixture.zone === zone) {
            if (material.isMeshBasicMaterial) check(material.color.r === 0 && material.color.g === 0 && material.color.b === 0, zone + " bulb kept glowing without power");
            if (fixture.emissive !== undefined) {
              check(material.emissiveIntensity === 0, zone + " shade kept emitting without power");
              check(material.color.equals(fixture.color), zone + " darkened shade diffuse color instead of only electrical emission");
            }
          } else {
            check(material.color.equals(fixture.color) && material.emissiveIntensity === fixture.emissive,
              zone + " changed another circuit's fixture material");
          }
        }
        restore();
        circuits.push({ zone, mains: practical.length, fixtures: localFixtures.length });
      }
      const encounterSources = {
        "bathroom-ceiling": "bathroom", "far-hall-crawler": "far-hall",
        "sitting-room-return": "entry", "last-ceiling": "far-hall",
      };
      for (const [id, source] of Object.entries(encounterSources)) {
        const first = CRAWLER_FLICKER[id][0];
        house.applyHorrorLighting({ ...crawlerFlickerAt(id, (first.from + first.to) / 2),
          lightSource: "all", ...BLACKOUT_ENVIRONMENT });
        check(house.lights.filter(light => light.userData.powerCircuit !== "window").every(light => light.intensity === 0),
          id + " did not turn off every practical in the house");
        for (const light of windowLights) check(light.intensity === light.userData.base * BLACKOUT_ENVIRONMENT.exteriorBaseScale,
          id + " did not preserve the failed-fuse exterior fill");
        check(house.ambientLight.intensity === BLACKOUT_ENVIRONMENT.ambientIntensity &&
          house.materials.wood.envMapIntensity === environmentBase * BLACKOUT_ENVIRONMENT.environmentMultiplier,
          id + " did not preserve readable arrival ambient/image fill");
        check(house.lights.every(light => light.visible === visibility.get(light)),
          id + " changed shader light counts instead of light intensity");
        restore();
      }

      const camera = new T.PerspectiveCamera(65, 1.6, .05, 30);
      camera.position.set(2, 1.64, 0); camera.lookAt(5.75, .44, 0); camera.updateMatrixWorld(true);
      const invalidations = [];
      const invalidate = house.invalidateShadows;
      house.invalidateShadows = time => { invalidations.push(time); invalidate(time); };
      const director = new HorrorDirector(scene, house, { figureFactory: () => ({
        body: new T.Group(), setCreaturePose() {}, resetPose() {}, resetMotion() {},
      }) });
      let time = 3, lighting;
      for (let frame = 0; frame < 180; frame++) {
        time += 1 / 60;
        house.animate(time, 1 / 60, state, player);
        lighting = director.update(time, 1 / 60, state, player, camera);
        house.applyHorrorLighting(lighting);
        if (lighting.lightMultiplier === 0) break;
      }
      check(director.snapshot().active === "far-hall-crawler" && lighting.lightMultiplier === 0,
        "Actual-house crawler did not produce a power interruption");
      check(invalidations.length > 2 && invalidations.every(Number.isFinite),
        "Creature did not delegate its real-house shadow invalidation");
      lighting = director.update(time, 0, state, player, camera, { flashes: false });
      house.applyHorrorLighting(lighting);
      check(lighting.lightMultiplier === 1 && house.lightingGroups["far-hall"].every(light => light.intensity > 0),
        "Disabling flashing did not immediately restore the actual dark circuit");
      director.reset();
      house.applyHorrorLighting(director.snapshot());
      check(house.lightingGroups["far-hall"].every(light => light.intensity > 0), "Director reset retained an outage");
      state.stage = 6; state.inverted = true; state.lampOff = true;
      house.animate(time + 1, 1 / 60, state, player);
      const bedside = [];
      house.props.bedsideLamp.traverse(mesh => {
        if (mesh.isMesh) bedside.push({
          mesh, material: mesh.material, color: mesh.material.color.clone(), emissive: mesh.material.emissiveIntensity,
        });
      });
      check(bedside.some(item => item.mesh.userData.lightCircuit === "bedroom"),
        "The puzzle-owned bedside lamp was not registered with its electrical circuit");
      house.applyHorrorLighting({ lightMultiplier: 0, lightSource: "bedroom" });
      house.applyHorrorLighting({ lightMultiplier: 1, lightSource: "bedroom" });
      for (const fixture of bedside) check(fixture.mesh.material === fixture.material &&
        fixture.material.color.equals(fixture.color) && fixture.material.emissiveIntensity === fixture.emissive,
        "Electrical restoration changed the switched-off puzzle lamp or replaced its owned material");
      house.animate(time + 1.02, 1 / 60, state, player);
      house.applyHorrorLighting({ lightMultiplier: 1, lightSource: null });
      for (const fixture of bedside) check(fixture.material.color.equals(fixture.color) &&
        fixture.material.emissiveIntensity === fixture.emissive,
        "The puzzle lamp resumed glowing on the frame after a circuit interruption");
      state.reset(); house.reset(state);
      house.applyHorrorLighting({ lightMultiplier: 1, lightSource: "all" });
      check(house.lights.filter(light => light.userData.powerCircuit === "mains").every(light => light.intensity === 0),
        "Restart or a stale lighting envelope resurrected the failed fuse");
      for (const fixture of fixtures) {
        const material = fixture.mesh.material;
        if (material.emissiveIntensity !== undefined) check(material.emissiveIntensity === 0,
          "An unpowered lamp shade kept glowing after reset");
        if (material.isMeshBasicMaterial) check(Math.max(material.color.r, material.color.g, material.color.b) < .01,
          "An unpowered bulb kept glowing after reset");
      }
      for (const fixture of bedside) {
        if (fixture.material.emissive?.getHex() > 0) check(fixture.material.emissiveIntensity === 0,
          "The puzzle-owned bedside shade glows while the fuse is out");
        if (fixture.material.isMeshBasicMaterial) check(Math.max(fixture.material.color.r, fixture.material.color.g, fixture.material.color.b) < .01,
          "The puzzle-owned bedside bulb glows while the fuse is out");
      }
      return { status: "PASS", rendered: false, circuits, encounters: Object.keys(encounterSources).length,
        moonlightSources: windowLights.length, fixtures: fixtures.length,
        shadowInvalidations: invalidations.length,
        checks: ["actual circuit power off/on", "all four whole-house crawling blackouts", "failed-fuse exterior/ambient/image fill and palette restored",
          "local bulb/shade emission and material isolation", "comfort toggle restores real lights", "shared shadow scheduler delegation",
          "puzzle-owned lampOff/material pointers preserved", "restart keeps failed fuse and fixture emission off"] };
    });
    assert.deepEqual(errors, []); assert.deepEqual(failed, []);
    console.log(JSON.stringify({ ...report, errors, failed }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
