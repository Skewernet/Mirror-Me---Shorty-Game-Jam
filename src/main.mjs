import * as T from "three";
import { Picture } from "./picture.mjs";
import { Player } from "./player.mjs";
import { buildHouse } from "./house.mjs";
import { Mirror } from "./mirror.mjs";
import { Story, VOICES } from "./story.mjs";
import { Sound } from "./sound.mjs";
import {
  MIRROR,
  ROOMS,
  roomAt,
  EXIT,
  SPAWN,
  PORTAL,
  inHall,
  atBackThreshold,
} from "./layout.mjs";
import { preloadCharacterAssets } from "./figure.mjs";
const $ = (id) => document.getElementById(id),
  scene = new T.Scene();
scene.background = new T.Color(0x101417);
scene.fog = new T.FogExp2(0x101417, 0.025);
const camera = new T.PerspectiveCamera(65, innerWidth / innerHeight, 0.055, 65);
let renderer;
try {
  renderer = new T.WebGLRenderer({
    antialias: false,
    powerPreference: "high-performance",
  });
} catch (error) {
  $("error").textContent =
    "WebGL could not start. Try a desktop browser with hardware acceleration.";
  throw error;
}
renderer.setPixelRatio(1);
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.13;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.domElement.setAttribute(
  "aria-label",
  "First-person view of the house",
);
document.body.prepend(renderer.domElement);
let house;
try {
  [house] = await Promise.all([buildHouse(scene), preloadCharacterAssets()]);
} catch (error) {
  $("error").textContent =
    "A house or character asset could not load. Reload the page; if it persists, inspect the asset request.";
  throw error;
}
const picture = new Picture(renderer, camera);
const player = new Player(camera),
  mirror = new Mirror(scene, house),
  story = new Story(),
  ray = new T.Raycaster(),
  sound = new Sound((text) => ($("subtitle").textContent = text));
let mode = "title",
  active = false,
  target = null,
  elapsed = 0,
  messageUntil = 0,
  pending = [],
  arrival = false,
  endingAt = 0,
  endingStart = 0,
  endingSpoken = false,
  lateSpoken = false,
  commandSpoken = false,
  flashlightOn = false,
  hintUntil = 0,
  portal = null,
  scaresEnabled = true,
  mirrorSnap = false,
  hallAppearance = false,
  apparitionUntil = 0,
  echoSteps = 0,
  echoStepNext = 0,
  quality = 1080,
  renderRequested = true;
const testMode = new URLSearchParams(location.search).get("test") === "1";
const flashlight = new T.SpotLight(0xe2dfc5, 0, 13, Math.PI * 0.14, 0.7, 1.8);
flashlight.castShadow = false;
flashlight.shadow.mapSize.set(768, 768);
flashlight.shadow.bias = -0.0004;
flashlight.shadow.normalBias = 0.025;
scene.add(flashlight, flashlight.target);
function say(text, duration = 4) {
  $("message").textContent = text;
  messageUntil = elapsed + duration;
}
function queueVoice(id, delay = 0) {
  if (VOICES[id] && !pending.some((q) => q.id === id))
    pending.push({ id, at: elapsed + delay });
}
function resize() {
  renderRequested = true;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  const h = Math.min(quality, innerHeight);
  const w = Math.round(h * camera.aspect);
  renderer.setSize(w, h, false);
  picture.resize(w, h, quality);
  mirror.setQuality(quality);
}
resize();
window.addEventListener("resize", resize);
function setText(element, text) {
  $(element).textContent = text;
}
function updateInventory() {
  const count =
    Number(story.hasNote) +
    Number(story.hasFuse) +
    Number(story.hasKey) +
    Number(story.hasDiary) +
    Number(story.hasLetter) +
    Number(story.hasTimeClue);
  $("inventory").textContent = count ? "TAB · " + count + " MEMORIES" : "";
  const cards = [];
  const item = (title, text, symbol = "⌑") =>
    cards.push(
      `<article class="item"><div class="item-symbol">${symbol}</div><h3>${title}</h3><p>${text}</p></article>`,
    );
  if (story.hasNote)
    item(
      "The folded note",
      "IF THE HALL RETURNS, WATCH THE GLASS.<br><br>WHEN IT LEADS, YOU LEAVE.<br><br>I know this handwriting.",
    );
  if (story.hasFuse)
    item(
      "Ceramic fuse",
      "A spare from the kitchen. The utility room has a fuse box.",
      "▥",
    );
  if (story.power)
    item(
      "The lights are on",
      "The fuse is installed. The house is awake.",
      "◉",
    );
  if (story.hasKey)
    item(
      "Bedroom key",
      "A small brass key from the hall drawer. Its tag reads BEDROOM.",
      "⚿",
    );
  if (story.hasDiary)
    item(
      "Mara’s bedside diary",
      "“Kitchen radio for company. Run Mum’s bath. Wind the bedroom music box so she can sleep.<br><br>The nurse called at the hour I wrote on the bathroom glass. I kept doing the evening after that. I thought stopping would mean leaving her.<br><br>End it in reverse. Don’t let something else finish it for me.”",
    );
  if (story.hasLetter)
    item(
      "The hospital letter",
      "PERSONAL EFFECTS — E. VALE<br>Collected by: Mara Vale.<br><br>They gave me her watch in a plastic bag. I left it beside her keys. I never opened the bag.",
    );
  if (story.heardCall)
    item(
      "Two calls",
      "The first caller sounded like Mum.<br>The second sounded like me.<br><br>The sitting-room telephone is only a telephone. The three sounds belong to Mum’s evening: kitchen radio, bathroom tap, bedroom music box.",
    );
  if (story.hasTimeClue)
    item(
      "Writing in the steam",
      "71:30<br><br>A reflection of a time. Read it from the other end.",
      "◷",
    );
  if (story.stage === 3)
    item(
      "The sounds",
      "Kitchen radio → bathroom tap → bedroom music box.<br><br>Silence them in reverse. The sitting-room telephone is not part of this sequence.<br>Quiet: " +
        story.echoIndex +
        " / 3.",
      "◌",
    );
  if (story.stage === 4)
    item(
      "The last instruction",
      "It wants me to come closer.<br><br>The folded note says: when it leads, you leave.",
      "↶",
    );
  $("items").innerHTML =
    cards.join("") ||
    '<article class="item"><h3>Nothing yet.</h3><p>The sitting-room telephone is ringing. Start there.</p></article>';
}
function reset() {
  story.reset();
  player.reset();
  mirror.reset();
  sound.reset();
  elapsed = messageUntil = endingAt = endingStart = 0;
  pending = [];
  target = null;
  arrival =
    lateSpoken =
    commandSpoken =
    endingSpoken =
    mirrorSnap =
    hallAppearance =
      false;
  portal = null;
  apparitionUntil = 0;
  $("transition").style.opacity = "0";
  $("ending-credits").hidden = true;
  echoSteps = 0;
  echoStepNext = 0;
  hintUntil = 0;
  flashlightOn = false;
  flashlight.intensity = 0;
  house.reset(story);
  $("veil").classList.remove("closing");
  $("message").textContent =
    $("subtitle").textContent =
    $("prompt").textContent =
      "";
  $("title").innerHTML = "MIRROR<span>ME</span>";
  $("description").innerHTML =
    "Someone left the house awake.<br>Someone else is learning your way home.";
  $("chapter").textContent = "THE HOUSE THAT LEARNS";
  mode = "title";
  updateInventory();
}
function showMenu() {
  active = false;
  player.clear();
  sound.pause();
  $("pocket").hidden = $("inspect").hidden = $("credits").hidden = true;
  $("transition").style.opacity = "0";
  $("menu").hidden = false;
  $("hud").hidden = true;
  if (mode === "ending") {
    $("chapter").textContent = "YOU KNOW WHICH SIDE YOU ARE ON NOW";
    $("title").innerHTML = "THE OTHER<span>SIDE</span>";
    $("description").textContent =
      "Your mother’s light is still on. Someone has gone to sit with her. You cannot follow.";
    $("start").textContent = "PLAY AGAIN";
    $("restart").hidden = true;
    $("ending-credits").hidden = false;
  } else if (mode !== "title") {
    mode = "paused";
    $("start").textContent = "RETURN TO THE HOUSE";
    $("restart").hidden = false;
    $("chapter").textContent = "THE HOUSE CAN WAIT";
  }
  $("start").focus({ preventScroll: true });
}
async function enter() {
  $("error").textContent = "";
  if (mode === "ending") reset();
  try {
    await sound.start();
  } catch {
    $("error").textContent =
      "Audio could not start. You can still play with subtitles.";
  }
  try {
    await renderer.domElement.requestPointerLock();
  } catch {
    showMenu();
    $("error").textContent =
      "Mouse capture was refused. Click RETURN again. Progress is kept.";
  }
}
function pocket() {
  if (mode === "pocket") {
    enter();
    return;
  }
  if (!active) return;
  mode = "pocket";
  active = false;
  player.clear();
  sound.pause();
  updateInventory();
  $("pocket").hidden = false;
  $("hud").hidden = true;
  document.exitPointerLock();
}
function clock() {
  mode = "clock";
  active = false;
  player.clear();
  sound.pause();
  $("inspect").hidden = false;
  $("hud").hidden = true;
  $("clock-hour").value = story.clockHour || 12;
  $("clock-minute").value = String(story.clockMinute).padStart(2, "0");
  document.exitPointerLock();
  $("clock-hour").focus();
}
$("clock-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const event = story.setClock($("clock-hour").value, $("clock-minute").value);
  $("inspect").hidden = true;
  enter().then(() => respond(event));
});
$("clock-back").onclick = () => {
  $("inspect").hidden = true;
  enter();
};
let creditsReturnMode = "title";
async function loadCredits() {
  try {
    const response = await fetch("assets/credits.json");
    if (!response.ok) throw Error(`credits: ${response.status}`);
    const data = await response.json();
    for (const entry of data.entries) {
      const item = document.createElement("article");
      const title = document.createElement("h3");
      title.textContent = entry.title;
      const text = document.createElement("p");
      text.textContent = `${entry.creator} · ${entry.license}`;
      const source = document.createElement("a");
      source.textContent = "Source";
      source.href = entry.source;
      source.target = "_blank";
      source.rel = "noopener noreferrer";
      const changes = document.createElement("p");
      changes.textContent = entry.changes;
      const license = document.createElement("a");
      license.textContent = "License";
      license.href = entry.licenseUrl;
      license.target = "_blank";
      license.rel = "noopener noreferrer";
      item.append(title, text, source);
      if (entry.licenseUrl)
        item.append(document.createTextNode(" · "), license);
      item.append(changes);
      $("credit-list").append(item);
    }
    for (const entry of data.entries) {
      const credit = document.createElement("span");
      credit.className = "ending-credit";
      credit.append(
        document.createTextNode(
          `${entry.title} — ${entry.creator}. ${entry.license}. `,
        ),
      );
      const source = document.createElement("a");
      source.href = entry.source;
      source.textContent = "Source";
      source.target = "_blank";
      source.rel = "noopener noreferrer";
      credit.append(source);
      if (entry.licenseUrl) {
        const license = source.cloneNode();
        license.href = entry.licenseUrl;
        license.textContent = "License";
        credit.append(document.createTextNode(" · "), license);
      }
      credit.append(document.createTextNode(". " + entry.changes));
      $("ending-credit-names").append(credit);
    }
  } catch (error) {
    $("credit-list").textContent =
      "Credits could not load. See ATTRIBUTIONS.md in this build for the complete asset register.";
    console.warn(error.message);
  }
}
$("credits-open").onclick = () => {
  creditsReturnMode = mode;
  active = false;
  player.clear();
  sound.pause();
  mode = "credits";
  $("menu").hidden = true;
  $("credits").hidden = false;
  document.exitPointerLock();
  $("credits-close").focus();
};
$("credits-close").onclick = () => {
  mode = creditsReturnMode;
  showMenu();
};
loadCredits();
$("start").disabled = false;
$("start").textContent = "ENTER THE HOUSE";
$("start").onclick = enter;
$("restart").onclick = () => {
  reset();
  enter();
};
$("sensitivity").oninput = (e) => (player.sensitivity = Number(e.target.value));
$("bob").onchange = (e) => (player.bob = e.target.checked);
$("volume").oninput = (e) => sound.setVolume(Number(e.target.value));
$("voice").onchange = (e) => sound.setVoice(e.target.checked);
$("sudden-scares").onchange = (e) => (scaresEnabled = e.target.checked);
$("quality").onchange = (e) => {
  quality = Number(e.target.value);
  renderer.shadowMap.enabled = quality >= 720;
  flashlight.castShadow = flashlightOn && quality >= 720;
  resize();
};
$("brightness").oninput = (e) => {
  renderer.toneMappingExposure = Number(e.target.value);
  renderRequested = true;
};
$("contact-shadows").onchange = (e) => {
  picture.contactShadows = e.target.checked;
  renderRequested = true;
};
$("grain").onchange = (e) =>
  $("veil").classList.toggle("clean", !e.target.checked);
document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement === renderer.domElement) {
    mode = "playing";
    active = true;
    $("menu").hidden =
      $("pocket").hidden =
      $("inspect").hidden =
      $("credits").hidden =
        true;
    $("hud").hidden = false;
    player.clear();
    if (!arrival) {
      arrival = true;
      queueVoice("arrival", 0.8);
      say("The sitting-room telephone is ringing.", 4);
    }
  } else if (!["pocket", "clock", "credits"].includes(mode)) showMenu();
});
document.addEventListener("pointerlockerror", () => {
  showMenu();
  $("error").textContent = "Mouse capture was refused. Click RETURN again.";
});
window.addEventListener("blur", () => {
  player.clear();
  if (document.pointerLockElement) document.exitPointerLock();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    player.clear();
    if (document.pointerLockElement) document.exitPointerLock();
  }
});
document.addEventListener("mousemove", (e) => {
  if (active && !endingAt && !portal) player.look(e.movementX, e.movementY);
});
document.addEventListener("keydown", (e) => {
  if (e.code === "Tab" && (active || mode === "pocket")) {
    e.preventDefault();
    if (!e.repeat && !endingAt && !portal) pocket();
    return;
  }
  if (["pocket", "clock", "credits"].includes(mode) && e.code === "Escape") {
    if (mode === "credits") mode = creditsReturnMode;
    showMenu();
    return;
  }
  if (!active) return;
  if (e.code === "Escape") {
    document.exitPointerLock();
    return;
  }
  if (endingAt || portal) return;
  if (
    ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
      e.code,
    )
  )
    e.preventDefault();
  player.keys.add(e.code);
  if (e.code === "KeyF" && !e.repeat) {
    flashlightOn = !flashlightOn;
    flashlight.castShadow = flashlightOn && quality >= 720;
    sound.effect("switch");
  }
  if (e.code === "KeyH" && !e.repeat) {
    hintUntil = elapsed + 8;
    say(story.hint(), 5);
  }
  if (e.code === "KeyE" && !e.repeat) {
    target = findTarget();
    if (target) interact(target.id);
  }
});
document.addEventListener("keyup", (e) => player.keys.delete(e.code));
renderer.domElement.addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  active = false;
  player.clear();
  sound.pause();
  if (document.pointerLockElement) document.exitPointerLock();
  showMenu();
  $("start").disabled = true;
  $("error").textContent =
    "The graphics context was lost. Reload to restart the house.";
});
function visibleInTree(object) {
  for (let p = object; p; p = p.parent) if (!p.visible) return false;
  return true;
}
function findTarget() {
  scene.updateMatrixWorld(true);
  ray.setFromCamera(new T.Vector2(0, 0), camera);
  const items = house.interactables.filter(
    (i) =>
      (i.id !== "note" || !story.hasNote) &&
      (i.id !== "fuse" || (!story.hasFuse && !story.power)) &&
      visibleInTree(i.mesh),
  );
  const hit = ray.intersectObjects(
    [
      ...new Set([
        ...items.map((i) => i.mesh),
        ...house.occluders.filter(visibleInTree),
      ]),
    ],
    false,
  )[0];
  if (!hit) return null;
  for (let object = hit.object; object; object = object.parent) {
    const id = object.userData.interactionId;
    if (id)
      return items.find((i) => i.id === id && hit.distance <= i.range) || null;
  }
  return (
    items.find((i) => i.mesh === hit.object && hit.distance <= i.range) || null
  );
}
function interact(id) {
  if (id.startsWith("room-")) {
    const d = house.roomDoors[id.slice(5)];
    if (story.doors[id.slice(5)] && d.containsThreshold(player.x, player.z)) {
      say("Take a step away from the doorway first.", 2);
      return;
    }
  }
  if (
    id === "door" &&
    story.doorOpen &&
    house.backDoor.containsThreshold(player.x, player.z)
  ) {
    say("Take a step away from the doorway first.", 2);
    return;
  }
  const event = story.interact(id);
  if (event) respond(event);
  updateInventory();
}
function respond(event) {
  sound.effect(event);
  const lines = {
    note: "“If the hall returns, watch the glass. When it leads, you leave.”",
    "arrival-recording":
      "Mum asks you to stay until she is asleep. There is a spare fuse by the kitchen sink.",
    "telephone-repeat": "Only a dead line now. You remember what she asked.",
    "telephone-dead":
      "The telephone is dead. The kitchen radio is still playing; that is the sound in the diary.",
    "radio-no-power":
      "The switch clicks, but the tuning scale stays dark. The kitchen has no power.",
    "radio-on": "The kitchen radio catches the valley weather service.",
    "radio-off": "The tuning light goes out. A small, ordinary silence.",
    letter:
      "ST. ANNE’S — PERSONAL EFFECTS. E. Vale. Collected by Mara Vale. The envelope has been opened and folded shut again.",
    "letter-repeat": "Mum’s things. My signature. The date I stopped coming.",
    fuse: "A spare ceramic fuse. The utility room is across from the bathroom, near the corner.",
    "panel-empty": "One fuse is missing. Someone left its outline in the dust.",
    "panel-on": "Power is restored. Every switch is on.",
    power: "The lights come on. Something else wakes up.",
    "mirror-first": "The room behind you. Your face. Everything in its place.",
    "mirror-late": "You move. It remembers how, a moment later.",
    "mirror-held": "Something is in the console drawer, back down the hall.",
    "mirror-command": "When it leads, you leave.",
    "drawer-open":
      story.keyAvailable && !story.hasKey
        ? "Something small catches the light. [ E ] TAKE KEY"
        : "Only dust. A shape where a key used to lie.",
    key: "A small brass key. The tag reads BEDROOM.",
    "bedroom-locked": "Locked. The key is small; it must be nearby.",
    diary:
      "“Kitchen radio for company. Mum’s bath. The bedroom music box. I kept doing the evening after the nurse called. End it in reverse.”",
    "diary-repeat":
      "The diary remembers: kitchen radio, bathroom tap, bedroom music box. End it in reverse.",
    "bath-clouded":
      "The glass is cold and dry. There is nothing to wipe away yet.",
    "time-clue": "71:30. A time, written backward in the steam.",
    "clock-set": "You leave the hands where you put them. The house waits.",
    "clock-solved":
      "A latch clicks inside the clock. A telephone starts ringing.",
    call: "The voice sounds like yours. End Mum’s evening in reverse: bedroom music box, bathroom tap, kitchen radio.",
    musicbox: "A few notes turn in the little wooden box.",
    tap: "Water runs into an empty basin.",
    photo:
      "Mum, Dad, and you before you learned to leave quietly. Someone has turned the photograph toward the room again.",
    "photo-changed": "The same room. Three places left empty.",
    "echo-silenced": "One sound stops. The others seem farther away.",
    "house-quiet": "Nothing. For the first time, nothing.",
    "wrong-order": "That was not the last sound. The house begins again.",
    "already-quiet": "It is already quiet.",
    locked: "The front door will not move.",
    "front-locked":
      "The front door will not move. The back door is down the far hall.",
    "backdoor-open": "A little cold air. The way out.",
    "backdoor-close": "The latch catches.",
    "door-wait":
      "The glass is giving you an instruction. Remember the folded note.",
    unlocked: "The latch gives way. Someone has opened it from the other side.",
    released: "You turn away. Behind you, a latch releases.",
  };
  if (event === "note") house.note.visible = false;
  if (event === "arrival-recording" || event === "call")
    story.phoneLiftUntil = elapsed + 13;
  if (event === "radio-on" || event === "radio-off") sound.effect("switch");
  if (event === "clock") {
    clock();
    return;
  }
  if (lines[event])
    say(
      lines[event],
      ["diary", "letter", "note", "time-clue", "call"].includes(event) ? 7 : 4,
    );
  const voiced = {
    "arrival-recording": "recording",
    power: "power",
    key: "key",
    diary: "diary",
    letter: "letter",
    "time-clue": "time",
    call: "call",
    "mirror-command": "command",
    unlocked: "unlocked",
    released: "released",
  };
  if (voiced[event]) queueVoice(voiced[event], 0.35);
  if (event === "room-open" || event === "room-close")
    sound.effect("door-wood");
  if (event === "power") hintUntil = elapsed + 5;
}
function finish() {
  if (story.ended) return;
  story.ended = true;
  endingAt = 0;
  mode = "ending";
  active = false;
  player.clear();
  pending = [];
  sound.stopVoice();
  $("veil").classList.remove("closing");
  document.exitPointerLock();
  showMenu();
}
function beginEnding() {
  endingStart = elapsed;
  endingAt = elapsed + 9;
  pending = [];
  player.clear();
  house.endingGlass.visible = true;
  story.doors.bedroom = true;
  mirror.replacement.body.visible = false;
  say("Someone leaves. You don’t.", 6);
  sound.effect("glass");
}
function updateFlashlight(dt) {
  const direction = new T.Vector3();
  camera.getWorldDirection(direction);
  flashlight.position
    .copy(camera.position)
    .add(new T.Vector3(0.07, -0.14, 0).applyQuaternion(camera.quaternion));
  flashlight.target.position
    .copy(camera.position)
    .addScaledVector(direction, 10);
  flashlight.intensity = T.MathUtils.damp(
    flashlight.intensity,
    flashlightOn ? 19 : 0,
    12,
    dt,
  );
}
// Each sudden encounter is authored once per run; none advances a puzzle.
function updateApparition() {
  if (apparitionUntil) {
    if (elapsed >= apparitionUntil) {
      apparitionUntil = 0;
      mirror.replacement.body.visible = false;
      echoSteps = 2;
      echoStepNext = elapsed + 0.7;
    }
    return;
  }
  const inEntry = Math.abs(player.x) < 0.46 && player.z > 2.0 && player.z < 6.3;
  const inFarHall = Math.abs(player.z) < 0.42;
  let appearance = null;
  if (inEntry && Math.cos(player.yaw) > 0.82)
    appearance = { x: 0, z: player.z - 1.55 };
  else if (
    inFarHall &&
    player.x > 1.2 &&
    player.x < 7.25 &&
    -Math.sin(player.yaw) > 0.82
  )
    appearance = { x: player.x + 1.55, z: 0 };
  else if (
    inFarHall &&
    player.x > 2 &&
    player.x < 8.4 &&
    Math.sin(player.yaw) > 0.82
  )
    appearance = { x: player.x - 1.55, z: 0 };
  // Keep the beat available if Mara leaves during the call, then present it at
  // the next clear sightline. The completed silence puzzle stays quiet.
  const scarePass =
    story.stage === 2 || (story.stage === 3 && story.echoIndex < 3);
  const visibleEncounter =
    appearance &&
    camera
      .getWorldDirection(new T.Vector3())
      .dot(
        new T.Vector3(appearance.x, 1.62, appearance.z)
          .sub(camera.position)
          .normalize(),
      ) > 0.94;
  if (
    scaresEnabled &&
    !hallAppearance &&
    scarePass &&
    story.heardCall &&
    !sound.busy &&
    !pending.length &&
    visibleEncounter
  ) {
    hallAppearance = true;
    apparitionUntil = elapsed + 0.48;
    const figure = mirror.replacement;
    figure.body.position.set(appearance.x, 0, appearance.z);
    figure.body.rotation.y = Math.atan2(
      -(player.x - appearance.x),
      -(player.z - appearance.z),
    );
    figure.setUnease(2);
    figure.animate(elapsed, 0, true);
    figure.body.visible = true;
    sound.effect("hall-appearance", {
      x: appearance.x,
      y: 1.4,
      z: appearance.z,
    });
  }
}
function beginPortal() {
  portal = { started: elapsed, returned: false };
  player.clear();
  target = null;
  $("prompt").textContent = "";
}
function updatePortal() {
  const t = elapsed - portal.started;
  $("transition").style.opacity = String(
    t < 0.24 ? Math.min(1, t / 0.2) : Math.max(0, 1 - (t - 0.24) / 0.32),
  );
  if (t >= 0.24 && !portal.returned) {
    portal.returned = true;
    const event = story.crossBackDoor();
    sound.effect("loop-latch", { x: EXIT.x, y: 1, z: EXIT.z });
    if (event === "ending") {
      beginEnding();
    } else {
      player.x = SPAWN.x;
      player.z = SPAWN.z;
      player.yaw = Math.atan2(
        Math.sin(player.yaw + PORTAL.yawDelta),
        Math.cos(player.yaw + PORTAL.yawDelta),
      );
      player.bobOffset = 0;
      player.clear();
      player.syncCamera();
      mirror.clearHistory();
      house.doorPivot.rotation.y = 0;
      house.doorCollider.disabled = false;
      house.setStage(story.stage);
      hintUntil = elapsed + 6;
      if (event === "incomplete-pass")
        say("The front entrance. Again. " + story.hint(), 6);
      if (event === "pass-1") {
        say(
          "The back door opened onto the front hall. The photograph is crooked again.",
          6,
        );
        queueVoice("repeat", 1.2);
        sound.effect("knock");
      }
      if (event === "pass-2")
        say(
          "The same entrance. There is writing on the bathroom glass now.",
          5,
        );
      if (event === "pass-3") {
        queueVoice("inverted", 1.2);
        say("The other side of the same house.", 4);
      }
      if (event === "pass-4")
        say("There is only one instruction left to disobey.", 5);
      updateInventory();
    }
  }
  if (t >= 0.58) {
    portal = null;
    $("transition").style.opacity = "0";
  }
}

function update(dt) {
  if (!active) return;
  elapsed += dt;
  if (portal) {
    updatePortal();
    house.animate(elapsed, dt, story, player);
    sound.update(story, player);
    updateFlashlight(dt);
    return;
  }
  if (endingAt) {
    const t = elapsed - endingStart;
    const angle = Math.atan2(Math.sin(-player.yaw), Math.cos(-player.yaw));
    player.yaw += angle * (1 - Math.exp(-dt * 2.2));
    player.pitch = T.MathUtils.damp(player.pitch, 0, 3, dt);
    player.syncCamera();
    mirror.finale(t);
    house.animate(elapsed, dt, story, player);
    sound.update(story, player);
    if (t > 2.6 && !endingSpoken) {
      endingSpoken = true;
      sound.voice("ending");
    }
    if (t > 4) $("veil").classList.add("closing");
    updateFlashlight(dt);
    if (elapsed >= endingAt) finish();
    return;
  }
  player.update(dt, house.colliders);
  const room = roomAt(player.x, player.z),
    visit = story.visit(room);
  if (visit && story.stage === 0 && room === "bathroom") sound.effect("drip");
  const looking = mirror.looking(player, camera),
    distance = Math.hypot(player.x - MIRROR.x, player.z - MIRROR.z),
    near = inHall(player.x, player.z) && distance < 4;
  for (const event of story.observe(
    dt,
    looking,
    near,
    distance,
    player.speed > 0.15,
  )) {
    if (event === "held") {
      sound.stopVoice();
      pending = [];
    }
    if (event === "returned") {
      if (scaresEnabled && !mirrorSnap) {
        mirrorSnap = true;
        mirror.triggerShock(elapsed);
        sound.effect("mirror-snap", { x: MIRROR.x, y: 1.5, z: MIRROR.z });
      } else sound.effect("key");
      say("You left. It stayed.", 4);
      queueVoice("returned", 2.8);
    }
    if (event === "released") respond(event);
  }
  if (story.stage === 1 && story.secondSeen > 0.8 && !lateSpoken) {
    lateSpoken = true;
    queueVoice("late", 0.3);
  }
  if (story.stage === 4 && looking && !commandSpoken) {
    commandSpoken = true;
    queueVoice("command", 0.7);
  }
  mirror.update(elapsed, player, story, looking);
  house.animate(elapsed, dt, story, player);
  for (const event of house.dressing?.drainEvents() || [])
    sound.effect(event.id, event);
  updateApparition();
  updateFlashlight(dt);
  if (story.stage === 2 && echoSteps > 0 && elapsed >= echoStepNext) {
    sound.effect("behind");
    echoSteps--;
    echoStepNext = elapsed + 0.65;
  }
  sound.step(
    player.distance,
    player.speed,
    room !== "bathroom" && room !== "kitchen" && room !== "utility",
  );
  sound.update(story, player);
  const ready = pending.findIndex((q) => q.at <= elapsed);
  if (ready >= 0 && !sound.busy) {
    const [line] = pending.splice(ready, 1);
    sound.voice(line.id);
  }
  target = findTarget();
  let label = target?.label || "";
  if (target?.id === "drawer" && story.drawerOpen)
    label =
      story.keyAvailable && !story.hasKey ? "TAKE BEDROOM KEY" : "CLOSE DRAWER";
  if (target?.id.startsWith("room-")) {
    const id = target.id.slice(5);
    label =
      (story.doors[id] ? "CLOSE " : "OPEN ") +
      (ROOMS.find((r) => r.id === id)?.name || id);
  }
  if (target?.id === "panel")
    label = story.power
      ? "INSPECT RESTORED POWER"
      : story.hasFuse
        ? "INSTALL CERAMIC FUSE"
        : "INSPECT FUSE BOX";
  if (target?.id === "radio")
    label =
      story.stage >= 3
        ? story.echoIndex >= 3
          ? "THE KITCHEN RADIO IS OFF"
          : "SWITCH OFF KITCHEN RADIO"
        : "TURN KITCHEN RADIO " + (story.radioOn ? "OFF" : "ON");
  if (target?.id === "telephone")
    label =
      story.stage === 3 ? "CHECK DEAD TELEPHONE" : "LIFT TELEPHONE RECEIVER";
  if (target?.id === "tap" && story.stage >= 3)
    label = story.echoIndex >= 2 ? "THE TAP IS OFF" : "TURN OFF TAP";
  if (target?.id === "musicbox" && story.stage >= 3)
    label =
      story.echoIndex >= 1 ? "THE MUSIC BOX IS CLOSED" : "CLOSE MUSIC BOX";
  if (target?.id === "door")
    label = story.doorOpen ? "CLOSE BACK DOOR" : "OPEN BACK DOOR";
  $("prompt").textContent = label ? "[ E ] " + label : "";
  $("prompt").classList.toggle("mirror-prompt", target?.id === "mirror");
  $("cross").classList.toggle("active", !!target);
  $("location").textContent =
    ROOMS.find((r) => r.id === room)?.name ||
    (story.stage >= 3 ? "THE OTHER HALL" : "THE HALL");
  $("hint").textContent =
    elapsed < hintUntil
      ? story.hint()
      : elapsed < 12
        ? "F · LIGHT     TAB · REMEMBER     H · A THOUGHT"
        : "";
  if (elapsed > messageUntil) $("message").textContent = "";
  if (story.doorOpen && atBackThreshold(player.x, player.z)) beginPortal();
}
let previous = performance.now(),
  firstFrame = true;
function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min((now - previous) / 1000, 0.05);
  previous = now;
  if (!testMode) {
    update(dt);
    if (active || firstFrame || renderRequested) {
      picture.render(scene, camera);
      firstFrame = renderRequested = false;
    }
  } else if (firstFrame) {
    picture.render(scene, camera);
    firstFrame = false;
  }
}
requestAnimationFrame(tick);
if (testMode) {
  const snapshot = () => ({
    mode,
    active,
    time: elapsed,
    pose: player.pose(),
    speed: player.speed,
    story: JSON.parse(JSON.stringify(story)),
    target: target?.id || null,
    body: {
      x: mirror.body.position.x,
      z: mirror.body.position.z,
      yaw: mirror.body.rotation.y,
      headYaw: mirror.head.rotation.y,
      visible: mirror.body.visible,
    },
    audio: sound.context?.state,
    dialogue: {
      id: sound.currentVoice,
      busy: sound.busy,
      queued: pending.map((q) => q.id),
    },
    roomSound: {
      radio: sound.radio?.gain.value,
      water: sound.water?.gain.value,
    },
    doorAngle: house.doorPivot.rotation.y,
    flashlight: flashlightOn,
    portal: portal ? { ...portal } : null,
    scares: {
      mirrorSnap,
      hallAppearance,
      visible: !!apparitionUntil,
      enabled: scaresEnabled,
    },
    quality,
    dressing: house.dressing?.snapshot(),
    character: mirror.figure.identity,
    drawCalls: picture.stats?.calls,
    triangles: picture.stats?.triangles,
  });
  window.__mirror = {
    snapshot,
    render() {
      picture.render(scene, camera);
    },
    advance(seconds) {
      for (let t = 0; t < seconds; t += 1 / 60)
        update(Math.min(1 / 60, seconds - t));
      return snapshot();
    },
    pose(x, z, yaw = 0, pitch = 0) {
      player.x = x;
      player.z = z;
      player.yaw = yaw;
      player.pitch = pitch;
      player.clear();
      player.syncCamera();
      return snapshot();
    },
    face(yaw, pitch = 0) {
      player.yaw = yaw;
      player.pitch = pitch;
      player.syncCamera();
    },
    reset,
    colliders: house.colliders,
    targets: house.interactables.map((i) => ({
      id: i.id,
      position: i.mesh.getWorldPosition(new T.Vector3()).toArray(),
    })),
  };
}
house.reset(story);
updateInventory();
