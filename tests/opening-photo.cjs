// Actual-house regression: power failure, visible entrance-hall photo and its
// physical straightening animation. No WebGL or synthetic story bypasses.
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
    const errors = [], failed = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("requestfailed", request => failed.push(request.url()));
    await page.route("**/opening-photo-fixture.html", route => route.fulfill({
      contentType: "text/html",
      body: '<link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>',
    }));
    await page.goto(url + "/opening-photo-fixture.html");
    const report = await page.evaluate(async () => {
      const T = await import("three");
      const { buildHouse } = await import("/src/house.mjs");
      const { Story } = await import("/src/story.mjs");
      const { SPAWN } = await import("/src/layout.mjs");
      const check = (value, message) => { if (!value) throw new Error(message); };
      const scene = new T.Scene(), story = new Story();
      const house = await buildHouse(scene);
      house.reset(story);
      const mains = house.lights.filter(light => light.userData.powerCircuit === "mains");
      const windows = house.lights.filter(light => light.userData.powerCircuit === "window");
      check(mains.length > 10 && mains.every(light => light.intensity === 0), "A failed fuse must extinguish every practical light");
      check(windows.length === 4 && windows.every(light => light.intensity > 0 && light.intensity <= light.userData.base * .121), "Only restrained exterior light may survive the outage");
      check(house.shade.emissiveIntensity === 0, "Unpowered lamp shades must not glow");
      // Horror envelopes must not resurrect an extinguished mains circuit.
      house.applyHorrorLighting({ lightMultiplier: 1.2, lightSource: "all" });
      check(mains.every(light => light.intensity === 0), "Scare lighting restarted the failed circuit");
      const target = house.interactables.find(item => item.id === "photo");
      scene.updateMatrixWorld(true);
      const photo = target.mesh.getWorldPosition(new T.Vector3());
      const origin = new T.Vector3(SPAWN.x, 1.64, SPAWN.z);
      const ray = new T.Raycaster(origin, photo.clone().sub(origin).normalize(), 0, origin.distanceTo(photo) + .1);
      const visible = object => { for (let p = object; p; p = p.parent) if (!p.visible) return false; return true; };
      const hits = ray.intersectObjects(house.occluders.filter(visible), false);
      check(hits[0]?.object === target.mesh, "The photograph is not directly visible down the entrance hall");
      check(story.noticePhoto() === null, "Opening cannot describe an already-crooked photo");
      story.interact("telephone");
      story.interact("fuse");
      story.interact("panel");
      story.observe(1.4, true, true);
      check(story.crossBackDoor() === "pass-1", "Opening chapter must retain its original gates");
      house.animate(1, 0, story);
      check(house.lights.some(light => light.userData.powerCircuit === "mains" && light.intensity > 1), "Replacing the fuse must restore the practical lighting");
      check(target.label === "STRAIGHTEN FAMILY PHOTOGRAPH", "Crooked photograph has no corrective prompt");
      const start = house.props.family.group.rotation.z;
      check(Math.abs(start) > .1, "Returned photograph is not visibly crooked");
      check(story.noticePhoto() === "photo-crooked", "The visible crooked photo should produce one observation");
      check(story.interact("photo") === "photo-straightened", "The photograph cannot be fixed explicitly");
      let previous = Math.abs(start);
      for (let frame = 1; frame <= 100; frame++) {
        house.animate(1 + frame / 60, 1 / 60, story);
        const current = Math.abs(house.props.family.group.rotation.z);
        check(current <= previous, "Frame does not settle continuously after straightening");
        previous = current;
      }
      check(previous < .001, "Photograph stays crooked after its correction animation");
      check(target.label === "EXAMINE FAMILY PHOTOGRAPH", "Straightened photograph still asks to be fixed");
      story.reset();
      house.reset(story);
      check(house.props.family.group.rotation.z === 0 && !story.photoStraightened, "Restart must clear the photograph interaction and pose");
      return { status: "PASS", mainsLights: mains.length, windowLights: windows.length, photoPosition: photo.toArray(), checks: 12 };
    });
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
    console.log(JSON.stringify(report));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
