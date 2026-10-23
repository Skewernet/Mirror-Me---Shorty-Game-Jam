import * as T from "three";
import { Picture } from "./picture.mjs";
import { Player } from "./player.mjs";
import { buildHouse } from "./house.mjs";
import { Mirror } from "./mirror.mjs";
import { Story, VOICES, WRITINGS } from "./story.mjs";
import { Sound } from "./sound.mjs";
import { HorrorDirector } from "./horror.mjs";
import { backDoorPose, mirrorPose } from "./transitions.mjs";
import {
  MIRROR,
  ROOMS,
  roomAt,
  EXIT,
  SPAWN,
  inHall,
  atBackThreshold,
  atMirrorThreshold,
  atFrontThreshold,
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
  await house.wake?.prepare?.();
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
  sound = new Sound((text) => ($("subtitle").textContent = text)),
  horror = new HorrorDirector(scene, house);
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
  wakeTurned = false,
  lateSpoken = false,
  flashlightOn = false,
  hintUntil = 0,
  lastPortal = null,
  portalCount = 0,
  offeringTarget = null,
  chapterUntil = 0,
  flashingLights = true,
  scaresEnabled = true,
  mirrorSnap = false,
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
  house.portal?.setQuality(quality);
}
resize();
window.addEventListener("resize", resize);
function setText(element, text) {
  $(element).textContent = text;
}
const CHAPTER_NAMES = [
  "I · THE LIGHT LEFT ON",
  "II · THE DIFFICULT PART",
  "III · THREE SEVENTEEN",
  "IV · WHAT HER HANDS REMEMBER",
  "V · END THE EVENING",
  "VI · NO WAY BACK",
  "VII · A PLACE KEPT FOR YOU",
];
const safeText = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function updateInventory() {
  const cards = [];
  const item = (title, text, symbol = "⌑") =>
    cards.push(
      `<article class="item"><div class="item-symbol">${symbol}</div><h3>${safeText(title)}</h3><p>${safeText(text).replace(/\n/g, "<br>")}</p></article>`,
    );
  if (story.hasNote) item("The folded note", WRITINGS.note);
  if (story.hasFuse)
    item(
      "Ceramic fuse",
      "A spare from the kitchen. The fuse box is in the utility room.",
      "▥",
    );
  if (story.power)
    item(
      "The lights are on",
      "The fuse is installed. The back door only releases when this part of the evening is complete.",
      "◉",
    );
  if (story.hasKey)
    item("Bedroom key", "The little brass tag reads BEDROOM.", "⚿");
  if (story.hasDiary) item("Mara’s bedside diary", WRITINGS.diary);
  if (story.hasLetter) item("The hospital letter", WRITINGS.letter);
  if (story.hasTimeClue)
    item(
      "Writing in the steam",
      "71:30\n\nThe writing faces the other side of the glass.",
      "◷",
    );
  if (story.radioTuned)
    item(
      "The station",
      "93.7 FM. An empty carrier, keeping the line open.",
      "◌",
    );
  const names = {
    watch: "Mum’s watch",
    ring: "Wedding ring",
    ribbon: "Blue ribbon",
  };
  for (const [id, name] of Object.entries(names)) {
    if (story.keepsakes?.[id])
      item(name, "Carried. The diary remembers where she left it.", "◈");
    if (story.placedKeepsakes?.includes(id))
      item(name, "Returned to its place.", "◦");
  }
  if (story.stage === 3)
    item(
      "Her hands remembered",
      "The watch beside the kitchen radio. The ring before her bath. The ribbon around the music box.\n\nReturn them in that order.\nReturned: " +
        story.ritualIndex +
        " / 3.",
      "◌",
    );
  if (story.stage === 4)
    item(
      "End the evening",
      "Silence the last sound first: bedroom music box, bathroom tap, kitchen radio.\n\nThe sitting-room telephone is not part of her routine.\nQuiet: " +
        story.echoIndex +
        " / 3.",
      "◌",
    );
  if (story.stage >= 5)
    item(
      "The missing door",
      "The back door is gone. There is no one in the mirror.\n\nThe glass has depth now.",
      "↶",
    );
  if (story.inverted)
    item(
      "The other side",
      story.farewellSaid
        ? "The letter is on her bed. Leave the light when you are ready."
        : "Her room is still waiting for you. There is one thing to leave there.",
      "◐",
    );
  $("inventory").textContent = cards.length
    ? "TAB · " + cards.length + " MEMORIES"
    : "";
  $("items").innerHTML =
    cards.join("") ||
    '<article class="item"><h3>Nothing yet.</h3><p>The sitting-room telephone is ringing.</p></article>';
}
function announceChapter() {
  $("chapter-mark").textContent = CHAPTER_NAMES[story.stage];
  chapterUntil = elapsed + 6;
}

function reset() {
  story.reset();
  player.reset();
  mirror.reset();
  sound.reset();
  horror.reset();
  elapsed = messageUntil = endingAt = endingStart = 0;
  pending = [];
  target = null;
  arrival = lateSpoken = endingSpoken = wakeTurned = mirrorSnap = false;
  lastPortal = null;
  portalCount = 0;
  offeringTarget = null;
  chapterUntil = 0;
  $("transition").style.opacity = "0";
  $("chapter-mark").textContent = "";
  $("ending-credits").hidden = true;
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
  for (const id of [
    "pocket",
    "inspect",
    "credits",
    "radio-inspect",
    "offering",
  ])
    $(id).hidden = true;
  $("transition").style.opacity = "0";
  $("menu").hidden = false;
  $("hud").hidden = true;
  if (mode === "ending") {
    $("chapter").textContent = "THEY KEPT YOUR PLACE";
    $("title").innerHTML = "WELCOME<span>HOME</span>";
    $("description").textContent =
      "You left the light off. They knew you would come back.";
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
  enter().then(() => {
    respond(event);
    drainStoryEvents();
    updateInventory();
  });
});
$("clock-back").onclick = () => {
  $("inspect").hidden = true;
  enter();
};
function inspectPanel(id, nextMode) {
  mode = nextMode;
  active = false;
  player.clear();
  sound.pause();
  $(id).hidden = false;
  $("hud").hidden = true;
  document.exitPointerLock();
}
function tuneRadio() {
  inspectPanel("radio-inspect", "radio");
  $("radio-frequency").value = Number(story.radioFrequency || 88.1).toFixed(1);
  $("radio-frequency").focus();
}
$("radio-form").onsubmit = (e) => {
  e.preventDefault();
  const event = story.tuneRadio($("radio-frequency").value);
  $("radio-inspect").hidden = true;
  enter().then(() => {
    respond(event);
    drainStoryEvents();
    updateInventory();
  });
};
$("radio-back").onclick = () => {
  $("radio-inspect").hidden = true;
  enter();
};
function offerKeepsake(id) {
  offeringTarget = id;
  inspectPanel("offering", "offering");
  const labels = {
    "radio-altar": "Beside the radio",
    "bath-dish": "The little dish by the bath",
    "musicbox-base": "Beside the music box",
  };
  $("offering-title").textContent = labels[id] || "What belongs here?";
  for (const button of $("offering-choices").querySelectorAll("button"))
    button.disabled = !story.keepsakes?.[button.dataset.item];
  $("offering-back").focus();
}
for (const button of $("offering-choices").querySelectorAll("button"))
  button.onclick = () => {
    const event = story.placeKeepsake(offeringTarget, button.dataset.item);
    $("offering").hidden = true;
    offeringTarget = null;
    enter().then(() => {
      respond(event);
      drainStoryEvents();
      updateInventory();
    });
  };
$("offering-back").onclick = () => {
  $("offering").hidden = true;
  offeringTarget = null;
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
$("flashing-lights").onchange = (e) => (flashingLights = e.target.checked);
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
    $("radio-inspect").hidden = $("offering").hidden = true;
    $("hud").hidden = false;
    player.clear();
    if (!arrival) {
      arrival = true;
      announceChapter();
      queueVoice("arrival", 0.8);
      say("The sitting-room telephone is ringing.", 4);
    }
  } else if (
    !["pocket", "clock", "credits", "radio", "offering"].includes(mode)
  )
    showMenu();
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
  if (active) player.look(e.movementX, e.movementY);
});
document.addEventListener("keydown", (e) => {
  if (e.code === "Tab" && (active || mode === "pocket")) {
    e.preventDefault();
    if (!e.repeat && !endingAt) pocket();
    return;
  }
  if (
    ["pocket", "clock", "credits", "radio", "offering"].includes(mode) &&
    e.code === "Escape"
  ) {
    if (mode === "credits") mode = creditsReturnMode;
    showMenu();
    return;
  }
  if (!active) return;
  if (e.code === "Escape") {
    document.exitPointerLock();
    return;
  }
  if (
    ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
      e.code,
    )
  )
    e.preventDefault();
  player.keys.add(e.code);
  if (endingAt && e.code !== "KeyF") return;
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
  const event = story.interact(id);
  if (event) respond(event);
  drainStoryEvents();
  updateInventory();
}
function drainStoryEvents() {
  for (const event of story.drainEvents()) respond(event);
}
function respond(event) {
  if (!event) return;
  sound.effect(event);
  const lines = {
    note: WRITINGS.note,
    "arrival-recording":
      "Mum asks you to stay until she is asleep. There is a spare fuse by the kitchen sink.",
    "telephone-repeat": "Only a dead line now. You remember what she asked.",
    "telephone-dead":
      "Only a dead line. The telephone was never one of her evening sounds.",
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
      "Her station: 93.7 FM. Her watch, her ring, the blue ribbon. The diary remembers where she left them, and in what order.",
    "diary-repeat":
      "Her station is 93.7 FM. Watch beside the radio, ring by the bath, ribbon beside the music box. The evening ends in reverse.",
    "bath-clouded":
      "The glass is cold and dry. There is nothing to wipe away yet.",
    "time-clue": "71:30. A time, written backward in the steam.",
    "clock-set": "You leave the hands where you put them. The house waits.",
    "clock-solved":
      "The hands agree. A faint carrier comes from the kitchen radio.",
    call: "The caller sounds like you. The keepsakes are still here. The diary remembers their places.",
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
      "The front door will not move. Something is still unfinished.",
    "backdoor-open": "A little cold air. The way out.",
    "backdoor-close": "The latch catches.",
    "door-wait":
      "The glass is giving you an instruction. Remember the folded note.",
    unlocked: "The latch gives way. Someone has opened it from the other side.",
    released: "A latch releases.",
    "backdoor-locked":
      "The handle refuses. This part of the evening is not finished.",
    "backdoor-unlocked": "A heavy latch releases at the back of the house.",
    "backdoor-gone": "Wallpaper. It has always been wallpaper.",
    "radio-await-clock": "A voice keeps circling the same unfinished hour.",
    "radio-static": "Only static. The bedside diary kept the station number.",
    "radio-tuned":
      "93.7. The static stops. Somewhere else, a telephone begins to ring.",
    "keepsake-watch": "Her watch. Stopped at the hour the house remembers.",
    "keepsake-ring": "It is warm. The little dish by the bath is empty.",
    "keepsake-ribbon": "The blue ribbon she wound around the music box.",
    "keepsake-missing": "You haven't found what belongs here yet.",
    "keepsake-wrong": "That was not where she left it.",
    "ritual-order": "The kitchen first. Then the water. The bedroom last.",
    "keepsake-placed": "It settles into an old mark in the dust.",
    "ritual-complete":
      "Everything where her hands remembered it. Something in the walls exhales.",
    "mirror-empty":
      "There is no one on the other side. The glass is deeper than the frame.",
    "mirror-crossed":
      "The air on this side is warm. Nothing has been touched for years.",
    farewell:
      "You leave the letter on her bed. There is nothing left to collect.",
    "farewell-repeat": "The letter is where it belongs.",
    "bed-waiting": "The bed is waiting. You cannot name what is in it.",
    "lamp-stay": "She asked you to leave the light on.",
    "lamp-already-off": "Her light is off.",
    "ritual-wrong": "Not there. Not yet. The diary remembers her evening.",
    "keepsake-not-held": "You have not found that keepsake yet.",
    "keepsake-already-placed": "It is already in its place.",
    "ritual-inactive": "The little mark has been here a long time.",
    "mirror-enter":
      "Nothing returns your gaze. You can walk through the glass.",
    "mirror-inverted": "The glass is a wall on this side.",
    "front-open": "The front door is open.",
    "invalid-time": "Leave an hour from 1 to 12, and minutes from 0 to 59.",
    "lamp-not-yet": "You have not said goodbye.",
    "lamp-off": "The room is dark. For once, nothing asks you to fix it.",
    "front-unlocked":
      "At the front of the house, a door opens against the daylight.",
    "ending-open": "Cold daylight. A place outside.",
  };
  if (event === "note") house.note.visible = false;
  if (event === "arrival-recording" || event === "call")
    story.phoneLiftUntil = elapsed + 13;
  if (event === "radio-on" || event === "radio-off") sound.effect("switch");
  if (event === "radio-tune") {
    tuneRadio();
    return;
  }
  if (event === "ritual-choice") {
    offerKeepsake(target.id);
    return;
  }
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
    "keepsake-watch": "watch",
    "keepsake-ring": "ring",
    "keepsake-ribbon": "ribbon",
    "ritual-complete": "ritual",
    "mirror-crossed": "inverted",
    farewell: "farewell",
    "front-unlocked": "unlocked",
    "house-quiet": "released",
    "mirror-enter": "command",
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
  endingAt = elapsed + 20;
  wakeTurned = false;
  pending = [];
  sound.stopVoice();
  mirror.body.visible = false;
  house.wake?.begin?.(elapsed, player);
  sound.effect("wake-entered", { x: 0, y: 1.4, z: 11 });
  say("They kept a place for you.", 5);
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
function renderView() {
  house.portal?.render(renderer, camera, story);
  picture.render(scene, camera);
}
function crossRear() {
  const from = player.pose();
  const event = story.crossBackDoor();
  if (!event) return;
  Object.assign(player, backDoorPose(from));
  player.syncCamera();
  mirror.clearHistory();
  mirror.figure.resetMotion?.({ ...player.pose(), time: elapsed });
  house.doorPivot.rotation.y = 0;
  house.doorCollider.disabled = false;
  house.setStage(story.stage);
  lastPortal = { kind: "rear", time: elapsed, from, to: player.pose() };
  portalCount++;
  sound.effect("loop-latch", { x: SPAWN.x, y: 1, z: SPAWN.z });
  announceChapter();
  hintUntil = elapsed + 5;
  if (event === "pass-1") queueVoice("repeat", 1.0);
  if (event === "pass-5") queueVoice("empty", 1.0);
  updateInventory();
}
function crossGlass() {
  const from = player.pose();
  const event = story.crossMirror();
  if (!event) return;
  Object.assign(player, mirrorPose(from));
  player.syncCamera();
  mirror.clearHistory();
  mirror.figure.resetMotion?.({ ...player.pose(), time: elapsed });
  house.setStage(story.stage);
  lastPortal = { kind: "mirror", time: elapsed, from, to: player.pose() };
  portalCount++;
  sound.effect("mirror-crossed", { x: MIRROR.x, y: 1.5, z: 0 });
  respond(event);
  drainStoryEvents();
  updateInventory();
  announceChapter();
}

function update(dt) {
  if (!active) return;
  elapsed += dt;
  if (endingAt) {
    const t = elapsed - endingStart;
    player.update(dt, house.colliders);
    house.animate(elapsed, dt, story, player);
    sound.update(story, player);
    if (t > 7 && !wakeTurned) {
      wakeTurned = true;
      sound.effect("wake-turn", { x: 1.62, y: 1.2, z: 9.65 });
    }
    if (t > 15 && !endingSpoken) {
      endingSpoken = true;
      sound.voice("ending");
    }
    if (t > 17) $("veil").classList.add("closing");
    updateFlashlight(dt);
    if (elapsed >= endingAt) finish();
    return;
  }
  player.update(dt, house.colliders);
  if (story.doorOpen && atBackThreshold(player.x, player.z)) crossRear();
  if (story.mirrorReady && atMirrorThreshold(player.x, player.z)) crossGlass();
  if (story.frontOpen && atFrontThreshold(player.x, player.z)) {
    const event = story.enterWake();
    if (event) {
      beginEnding();
      return;
    }
  }
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
    if (!["held", "returned"].includes(event)) respond(event);
  }
  if (story.stage === 1 && story.secondSeen > 0.8 && !lateSpoken) {
    lateSpoken = true;
    queueVoice("late", 0.3);
  }
  mirror.update(elapsed, player, story, looking);
  house.animate(elapsed, dt, story, player);
  for (const event of house.dressing?.drainEvents() || [])
    sound.effect(event.id, event);
  const light = horror.update(elapsed, dt, story, player, camera, {
    enabled: scaresEnabled,
    flashes: flashingLights,
    dialogueBusy: sound.busy || pending.length > 0,
  });
  house.applyHorrorLighting?.(light);
  for (const event of horror.drainEvents()) sound.effect(event.id, event);
  updateFlashlight(dt);
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
      story.stage >= 4
        ? story.echoIndex >= 3
          ? "THE KITCHEN RADIO IS OFF"
          : "SWITCH OFF KITCHEN RADIO"
        : "TURN KITCHEN RADIO " + (story.radioOn ? "OFF" : "ON");
  if (target?.id === "telephone")
    label =
      story.stage >= 3 ? "CHECK DEAD TELEPHONE" : "LIFT TELEPHONE RECEIVER";
  if (target?.id === "tap" && story.stage >= 4)
    label = story.echoIndex >= 2 ? "THE TAP IS OFF" : "TURN OFF TAP";
  if (target?.id === "musicbox" && story.stage >= 4)
    label =
      story.echoIndex >= 1 ? "THE MUSIC BOX IS CLOSED" : "CLOSE MUSIC BOX";
  if (target?.id === "radio" && story.stage === 2)
    label = story.clockSolved ? "TUNE KITCHEN RADIO" : "CHECK KITCHEN RADIO";
  if (target?.id === "door")
    label = story.doorOpen ? "THE BACK DOOR IS OPEN" : "CHECK BACK DOOR";
  if (target?.id === "front-door")
    label = story.frontReleased ? "OPEN FRONT DOOR" : "TRY FRONT DOOR";
  if (target?.id === "mirror" && story.mirrorReady) label = "THE GLASS IS OPEN";
  $("prompt").textContent = label ? "[ E ] " + label : "";
  $("prompt").classList.toggle("mirror-prompt", target?.id === "mirror");
  $("cross").classList.toggle("active", !!target);
  $("location").textContent =
    ROOMS.find((r) => r.id === room)?.name ||
    (story.inverted ? "THE OTHER HALL" : "THE HALL");
  $("hint").textContent =
    elapsed < hintUntil
      ? story.hint()
      : elapsed < 12
        ? "F · LIGHT     TAB · REMEMBER     H · A THOUGHT"
        : "";
  if (elapsed > messageUntil) $("message").textContent = "";
  if (elapsed > chapterUntil) $("chapter-mark").textContent = "";
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
      renderView();
      firstFrame = renderRequested = false;
    }
  } else if (firstFrame) {
    renderView();
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
    portal: null,
    lastPortal,
    portalCount,
    input: { keys: [...player.keys], vx: player.vx, vz: player.vz },
    scares: {
      mirrorSnap,
      ...horror.snapshot(),
      enabled: scaresEnabled,
      flashes: flashingLights,
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
      renderView();
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
