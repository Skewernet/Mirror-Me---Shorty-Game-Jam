const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const url = (process.env.MIRROR_TEST_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const out = process.env.MIRROR_TEST_OUTPUT || "/tmp/mirror-me-furniture";
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
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
    page.on("requestfailed", r => failed.push(r.url()));
    await page.route("**/__furniture__", route => route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><style>body{margin:0}</style><link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>',
    }));
    await page.goto(url + "/__furniture__");
    const report = await page.evaluate(async () => {
      const T = await import("three");
      const { buildHouse } = await import("/src/house.mjs");
      const { Story } = await import("/src/story.mjs");
      const { Picture } = await import("/src/picture.mjs");
      const check = (ok, why) => { if (!ok) throw new Error(why); };
      const scene = new T.Scene();
      scene.background = new T.Color(0x101417);
      const house = await buildHouse(scene);
      const story = new Story();
      story.power = true;
      house.reset(story);
      scene.updateMatrixWorld(true);
      const caseObject = scene.getObjectByName("Sitting-room bookcase");
      check(caseObject, "Actual sitting-room bookcase is missing");
      const bounds = (object, frame = caseObject) => {
        const box = new T.Box3();
        const p = object.geometry.attributes.position;
        const matrix = frame.matrixWorld.clone().invert().multiply(object.matrixWorld);
        for (let i = 0; i < p.count; i++)
          box.expandByPoint(new T.Vector3().fromBufferAttribute(p, i).applyMatrix4(matrix));
        return box;
      };
      const back = bounds(caseObject.getObjectByName("Bookcase back"));
      const books = caseObject.children.filter(o => /^Book \d-\d$/.test(o.name));
      check(books.length === 24, "Bookcase must retain all 24 books");
      let minGap = Infinity, maxGap = 0;
      for (const book of books) {
        const row = Number(book.name.split(" ")[1].split("-")[0]);
        const b = bounds(book), shelf = bounds(caseObject.getObjectByName(`Bookcase shelf ${row}`));
        const gap = b.min.y - shelf.max.y;
        minGap = Math.min(minGap, gap); maxGap = Math.max(maxGap, gap);
        check(gap >= .0005 && gap < .004, `${book.name} intersects or floats above its supporting shelf`);
        check(b.min.x > -.286 && b.max.x < .286, `${book.name} intersects a side panel`);
        check(b.min.z > back.max.z + .015 && b.max.z < .12, `${book.name} intersects its backing or protrudes from the case`);
        if (row < 3) {
          const above = bounds(caseObject.getObjectByName(`Bookcase shelf ${row + 1}`));
          check(b.max.y < above.min.y - .10, `${book.name} intersects the shelf above`);
        }
      }
      // Look between books: an open bay must remain clear until the thin back,
      // unlike the old full-depth solid slab filling the entire bookcase.
      const origin = new T.Vector3(-.186, .34, .40).applyMatrix4(caseObject.matrixWorld);
      const direction = new T.Vector3(0, 0, -1).transformDirection(caseObject.matrixWorld);
      const hits = new T.Raycaster(origin, direction).intersectObjects(caseObject.children, false)
        .filter(hit => hit.object.material.opacity !== 0);
      check(hits[0]?.object.name === "Bookcase back", "Shelf bay is filled by solid geometry in front of the backing");
      const colliderMesh = caseObject.children.find(o => o.material?.opacity === 0);
      const collider = bounds(colliderMesh);
      check(Math.abs(collider.max.x - .33) < .0001 && Math.abs(collider.max.z - .15) < .0001,
        "Bookcase collision footprint changed");
      const rack = scene.getObjectByName("Utility storage rack");
      const packages = rack.children.filter(o => /^Storage box \d-\d$/.test(o.name));
      check(packages.length === 12, "Utility rack must retain its 12 stored boxes");
      for (const item of packages) {
        const row = Number(item.name.split(" ")[2].split("-")[0]);
        const box = bounds(item, rack), board = bounds(rack.getObjectByName(`Utility shelf ${row}`), rack);
        const gap = box.min.y - board.max.y;
        check(gap > .0005 && gap < .002, `${item.name} floats above its utility shelf`);
      }
      let rearPlaques = 0;
      house.backDoor.pivot.traverse(object => {
        const p = object.geometry?.parameters;
        if (p && Math.abs(p.width - .27) < .0001 && Math.abs(p.height - .085) < .0001) rearPlaques++;
      });
      check(rearPlaques === 0, "Rear door still carries a destination plaque");
      check(house.roomDoors.kitchen.pivot.getObjectByName("Kitchen door label"), "Kitchen label was unintentionally removed");

      const renderer = new T.WebGLRenderer({ antialias: false });
      renderer.setSize(1000, 760);
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.13;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = T.PCFSoftShadowMap;
      document.body.append(renderer.domElement);
      const camera = new T.PerspectiveCamera(65, 1000 / 760, .055, 65);
      const picture = new Picture(renderer, camera);
      picture.resize(1000, 760, 1080);
      window.renderFurniture = detail => {
        camera.position.set(detail ? -1.62 : -2.60, detail ? 1.07 : 1.16, detail ? 4.16 : 4.60);
        camera.lookAt(-.96, detail ? 1.02 : .96, 3.88);
        camera.updateMatrixWorld(true);
        picture.render(scene, camera);
      };
      return { status: "PASS", books: books.length, storedBoxes: packages.length, minSupportingGap: minGap, maxSupportingGap: maxGap, rearPlaques, collisionFootprint: [.66, .30] };
    });
    for (const [name, detail] of [["bookcase", false], ["bookcase-detail", true]]) {
      await page.evaluate(detail => window.renderFurniture(detail), detail);
      await page.screenshot({ path: `${out}/${name}.png` });
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
    console.log(JSON.stringify({ ...report, errors, failed }));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
