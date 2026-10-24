import * as T from "three";
import { Picture } from "./picture.mjs";
import { Player } from "./player.mjs";
import { LookInput } from "./look-input.mjs";
import { requestGamePointerLock } from "./pointer-lock.mjs";
import { initSettings } from "./settings.mjs";
import { createFirstPerson } from "./first-person.mjs";
import {
  AdaptiveResolution, prepareRenderPrograms, prepareRenderTextures,
  warmProgramView, warmRenderResources, waitForRenderResources,
} from "./performance.mjs";
import { CrawlerFailure } from "./crawler-threat.mjs";
import { renderHorrorText, decorateHorrorText } from "./ui-text.mjs";
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
import { preloadDemonAssets } from "./demon.mjs";
import { preloadEvelynAssets } from "./evelyn.mjs";
import { FUNERAL_RADIO } from "./wake.mjs";
import { CHAPTERS } from "./chapters.mjs";
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
function loadingStatus(text) {
  const status = $("loading-status");
  if (status) status.textContent = text;
}
loadingStatus("Opening the house…");
let house;
try {
  [house] = await Promise.all([
    buildHouse(scene),
    preloadCharacterAssets(),
    preloadDemonAssets(),
    preloadEvelynAssets(),
  ]);
  await house.wake?.prepare?.();
  await house.revelation?.prepare?.();
} catch (error) {
  $("error").textContent =
    "A house or character asset could not load. Reload the page; if it persists, inspect the asset request.";
  throw error;
}
const picture = new Picture(renderer, camera);
let subtitlesEnabled = true, currentCaption = "";
const player = new Player(camera),
  lookInput = new LookInput(),
  mirror = new Mirror(scene, house),
  story = new Story(),
  ray = new T.Raycaster(),
  sound = new Sound(showSubtitle),
  horror = new HorrorDirector(scene, house);
const firstPerson = createFirstPerson(scene, camera);
const failure = new CrawlerFailure();
const adaptive = new AdaptiveResolution();
camera.layers.enable(2);
const aimCenter = new T.Vector2(), interactionPoint = new T.Vector3();
const flashlightDirection = new T.Vector3(), safeBeamOffset = new T.Vector3();
const interactionRange = Math.max(...house.interactables.map(item => item.range));
let forwardClearance = Infinity;
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
  newsStarted = false,
  newsStartedAt = 0,
  newsFinished = false,
  newsFinishedAt = 0,
  lastLineFinished = false,
  funeralAttack = false,
  funeralRush = false,
  funeralImpact = false,
  goodnightStarted = false,
  goodnightFinished = false,
  sobQueued = false,
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
let failing = false;
const testMode = new URLSearchParams(location.search).get("test") === "1";
const evidenceSeen = new Set();
const flashlight = new T.SpotLight(0xe2dfc5, 0, 13, Math.PI * 0.14, 0.7, 1.8);
// Keep the shader's shadow-light count stable. F changes intensity only.
flashlight.castShadow = true;
flashlight.shadow.autoUpdate = false;
flashlight.shadow.mapSize.set(768, 768);
flashlight.shadow.bias = -0.0004;
flashlight.shadow.normalBias = 0.025;
scene.add(flashlight, flashlight.target);
function showSubtitle(text) {
  currentCaption = text || "";
  renderHorrorText($("subtitle"), subtitlesEnabled ? currentCaption : "");
  $("subtitle").hidden = !subtitlesEnabled || !currentCaption;
  $("message").hidden = subtitlesEnabled && Boolean(currentCaption);
}
function say(text, duration = 4) {
  renderHorrorText($("message"), text);
  messageUntil = elapsed + duration;
}
function queueVoice(id, delay = 0, options = {}) {
  if (VOICES[id] && !pending.some((q) => q.id === id))
    pending.push({ id, at: elapsed + delay, options });
}
function playPendingVoice() {
  const ready = pending.findIndex((line) => line.at <= elapsed);
  if (!sound.busy && ready >= 0) {
    const [line] = pending.splice(ready, 1);
    sound.voice(line.id, line.options);
  }
}
function resize() {
  renderRequested = true;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  const h = Math.max(1, Math.round(Math.min(quality, innerHeight) * adaptive.scale));
  const w = Math.round(h * camera.aspect);
  renderer.setSize(w, h, false);
  picture.resize(w, h, quality);
  mirror.setQuality(quality);
  house.portal?.setQuality(quality);
}
resize();
window.addEventListener("resize", () => { adaptive.reset(); resize(); });
const fullscreenButton = $("fullscreen");
function syncFullscreenButton() {
  fullscreenButton.hidden = !document.fullscreenEnabled ||
    typeof document.documentElement.requestFullscreen !== "function";
  const fullscreen = Boolean(document.fullscreenElement);
  fullscreenButton.textContent = fullscreen ? "EXIT FULLSCREEN" : "FULLSCREEN";
  fullscreenButton.setAttribute("aria-pressed", String(fullscreen));
}
syncFullscreenButton();
fullscreenButton.disabled = false;
fullscreenButton.onclick = async () => {
  $("error").textContent = "";
  fullscreenButton.disabled = true;
  const leaving = Boolean(document.fullscreenElement);
  try {
    // Fullscreen the document so dialogue, menus and HUD remain with the view.
    if (leaving) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    $("error").textContent = leaving
      ? "Fullscreen could not close. You can use your browser's fullscreen control."
      : "Fullscreen could not start. You can keep playing in this window.";
  } finally {
    fullscreenButton.disabled = false;
    syncFullscreenButton();
  }
};
document.addEventListener("fullscreenchange", (event) => {
  lookInput.reset(event.timeStamp);
  player.clear();
  syncFullscreenButton();
  adaptive.reset();
  resize();
});
function setText(element, text) {
  $(element).textContent = text;
}
const CHAPTER_NAMES = CHAPTERS.map(
  ({ title }, index) =>
    `${["I", "II", "III", "IV", "V", "VI", "VII"][index]} · ${title}`,
);
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
  const item = (title, text, symbol = "⌑", id = "") =>
    cards.push(
      `<article class="item"${id ? ` data-memory="${safeText(id)}" tabindex="-1"` : ""}><div class="item-symbol">${symbol}</div><h3>${safeText(title)}</h3><p>${safeText(text).replace(/\n/g, "<br>")}</p></article>`,
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
  if (story.hasDiary) item("The bedside diary", WRITINGS.diary);
  if (story.hasLetter) item("The discharge receipt", WRITINGS.letter);
  if (story.hasTimeClue)
    item(
      "Writing in the steam",
      "03:17\n\nThe mirror has 03:17 written on it. Set the hall clock to that time.",
      "◷",
    );
  if (story.hasStationClue || story.radioTuned)
    item(
      "The kitchen walls",
      story.radioTuned
        ? "93.7 FM. An empty carrier, keeping the line open."
        : "93.7 FM. The same number, repeated in blood across the kitchen walls.",
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
  if (story.stage >= 3 && story.hasDiary)
    item(
      "The diary's last page",
      WRITINGS.routine + (story.stage === 4 ? "\n\nQuiet: " + story.echoIndex + " / 3." : ""),
      "◌", "routine",
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
      story.truthFound
        ? WRITINGS.truth
        : "The glass has brought you back to her room. Look at what you left there.",
      "◐",
    );
  for (const id of evidenceSeen)
    item(
      { "evidence-bathroom": "Where it began", "evidence-trail": "Her way to the bedroom", "evidence-kitchen": "The kitchen knife" }[id],
      VOICES[{ "evidence-bathroom": "crimeBathroom", "evidence-trail": "crimeTrail", "evidence-kitchen": "crimeKitchen" }[id]].text,
      "◐",
    );
  $("inventory").textContent = cards.length
    ? "TAB · " + cards.length + " MEMORIES"
    : "";
  $("items").innerHTML =
    cards.join("") ||
    '<article class="item"><h3>Nothing yet.</h3><p>The sitting-room telephone is ringing.</p></article>';
  decorateHorrorText($("items"));
}
function announceChapter() {
  renderHorrorText($("chapter-mark"), CHAPTER_NAMES[story.stage]);
  chapterUntil = elapsed + 6;
}

function reset() {
  failing = false;
  document.body.classList.remove("is-dying");
  failure.reset();
  $("death-screen").hidden = true;
  picture.setThreat(0, 0);
  lookInput.reset();
  story.reset();
  player.reset();
  mirror.reset();
  firstPerson.reset();
  sound.reset();
  horror.reset();
  elapsed = messageUntil = endingAt = endingStart = 0;
  pending = [];
  target = null;
  arrival = lateSpoken = endingSpoken = wakeTurned = mirrorSnap = false;
  newsStarted = newsFinished = lastLineFinished = sobQueued = false;
  funeralAttack = funeralRush = funeralImpact = false;
  goodnightStarted = goodnightFinished = false;
  evidenceSeen.clear();
  newsStartedAt = newsFinishedAt = 0;
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
  $("veil").style.removeProperty("background-color");
  $("veil").style.removeProperty("transition");
  $("message").textContent =
    $("subtitle").textContent =
    $("prompt").textContent =
      "";
  showSubtitle("");
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
    $("chapter").textContent = "THE CALL WAS YOURS";
    $("title").innerHTML = "MIRROR<span>ME</span>";
    $("description").textContent = "No one else was in the room.";
    $("start").textContent = "PLAY AGAIN";
    $("restart").hidden = true;
    $("ending-credits").hidden = false;
  } else if (mode !== "title") {
    mode = "paused";
    $("start").textContent = "RETURN TO THE HOUSE";
    $("restart").hidden = false;
    $("chapter").textContent = "THE HOUSE CAN WAIT";
  } else {
    $("start").textContent = "ENTER THE HOUSE";
    $("restart").hidden = true;
    $("ending-credits").hidden = true;
  }
  $("start").focus({ preventScroll: true });
}
async function enter() {
  $("error").textContent = "";
  if (mode === "ending") reset();
  // Capture starts inside the activation click. Audio initialization must not
  // consume that activation, and a raw-input fallback owns its own errors.
  const capture = requestGamePointerLock(renderer.domElement).then(
    () => null,
    error => error,
  );
  try {
    await sound.start();
  } catch {
    sound.resumeDialogue();
    $("error").textContent =
      "Audio could not start. You can still play with subtitles.";
  }
  const captureError = await capture;
  if (captureError) {
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
    // Keep the ending readable; the adjacent Credits & Assets button opens
    // every source, license and modification in the complete register above.
    for (const line of [
      "Skewernet · Skewer Games · AI-assisted development with Codex",
      "Wood textures: Eric Chadwick / Wayfair · CC BY 4.0 · modified in game",
    ]) {
      const credit = document.createElement("span");
      credit.className = "ending-credit";
      credit.textContent = line;
      $("ending-credit-names").append(credit);
    }
    decorateHorrorText($("credit-list"));
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
$("start").onclick = enter;
$("restart").onclick = () => {
  reset();
  enter();
};
$("death-retry").onclick = () => { reset(); enter(); };
$("death-menu").onclick = () => { reset(); showMenu(); };
$("sensitivity").oninput = (e) => (player.sensitivity = Number(e.target.value));
$("bob").onchange = (e) => (player.bob = e.target.checked);
$("volume").oninput = (e) => sound.setVolume(Number(e.target.value));
$("voice").onchange = (e) => sound.setVoice(e.target.checked);
$("subtitles").onchange = (e) => {
  subtitlesEnabled = e.target.checked;
  showSubtitle(currentCaption);
};
$("post-processing").onchange = (e) => {
  picture.setOptions({ postProcessing: e.target.checked });
  renderRequested = true;
};
$("auto-quality").onchange = (e) => {
  if (adaptive.setEnabled(e.target.checked) !== null) resize();
};
$("sudden-scares").onchange = (e) => {
  scaresEnabled = e.target.checked;
  if (!scaresEnabled) sound.stopCreatureCues();
  if (!scaresEnabled && funeralAttack) house.wake.reduceAttack?.(elapsed);
};
$("flashing-lights").onchange = (e) => {
  flashingLights = e.target.checked;
  house.wake.setBlackoutEnabled?.(flashingLights);
};
$("quality").onchange = (e) => {
  quality = Number(e.target.value);
  adaptive.reset();
  renderer.shadowMap.enabled = quality >= 720;
  flashlight.castShadow = quality >= 720;
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
document.addEventListener("pointerlockchange", (e) => {
  lookInput.reset(e.timeStamp);
  if (document.pointerLockElement === renderer.domElement) {
    if (mode === "dead") { document.exitPointerLock(); return; }
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
    !["pocket", "clock", "credits", "radio", "offering", "dead"].includes(mode)
  )
    showMenu();
});
window.addEventListener("blur", () => {
  lookInput.reset();
  player.clear();
  if (document.pointerLockElement) document.exitPointerLock();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    lookInput.reset();
    player.clear();
    if (document.pointerLockElement) document.exitPointerLock();
  }
});
document.addEventListener("mousemove", (e) => {
  if (!active || funeralAttack || failing || document.pointerLockElement !== renderer.domElement) return;
  lookInput.enqueue(e, performance.now());
});
document.addEventListener("keydown", (e) => {
  if (mode === "dead" && e.code === "Escape") {
    e.preventDefault();
    reset();
    showMenu();
    return;
  }
  if (e.code === "Tab" && (active || mode === "pocket")) {
    e.preventDefault();
    if (!e.repeat && !endingAt && !failing) pocket();
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
  if (failing) return;
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
    sound.effect("switch");
  }
  if (e.code === "KeyH" && !e.repeat) {
    hintUntil = elapsed + 8;
  }
  if (e.code === "KeyE" && !e.repeat) {
    target = findTarget();
    if (target) {
      firstPerson.interact(interactionPoint);
      interact(target.id);
    }
  }
});
document.addEventListener("keyup", (e) => player.keys.delete(e.code));
renderer.domElement.addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  active = false;
  player.clear();
  sound.pause();
  $("death-screen").hidden = true;
  document.body.classList.remove("is-dying");
  if (document.pointerLockElement) document.exitPointerLock();
  showMenu();
  $("start").disabled = true;
  $("restart").disabled = true;
  $("error").textContent =
    "The graphics context was lost. Reload to restart the house.";
});
function visibleInTree(object) {
  for (let p = object; p; p = p.parent) if (!p.visible) return false;
  return true;
}
function findTarget() {
  scene.updateMatrixWorld(true);
  ray.setFromCamera(aimCenter, camera);
  // Nothing is usable beyond these authored ranges; don't raycast distant
  // room triangles just to discover that their prompt cannot be displayed.
  ray.far = interactionRange;
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
  forwardClearance = hit?.distance ?? Infinity;
  if (!hit) return null;
  interactionPoint.copy(hit.point);
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
  // A reflection reply never interrupts essential dialogue or builds a long
  // queue when E is held/repeated; its cycle advances only on an actual reply.
  if (id === "mirror" && story.hasKey && story.frozen && story.stage < 5 &&
      (sound.busy || pending.length)) return;
  if (id.startsWith("evidence-")) {
    if (!story.inverted) return;
    if (!evidenceSeen.has(id)) {
      evidenceSeen.add(id);
      respond(id);
      updateInventory();
    } else say("The marks lead from the bathroom to her bed. You followed her.", 5);
    return;
  }
  if (id.startsWith("room-")) {
    const d = house.roomDoors[id.slice(5)];
    if (story.doors[id.slice(5)] && d.containsThreshold(player.x, player.z)) {
      say("Take a step away from the doorway first.", 2);
      return;
    }
  }
  const event = story.interact(id);
  if (event) respond(event);
  if (event === "diary-routine") return; // Keep the focused last page intact.
  drainStoryEvents();
  updateInventory();
}
function drainStoryEvents() {
  for (const event of story.drainEvents()) respond(event);
}
function respond(event) {
  if (!event) return;
  if (event === "diary-routine") {
    pocket();
    const lastPage = $("items").querySelector('[data-memory="routine"]');
    lastPage?.scrollIntoView({ block: "start" });
    lastPage?.focus({ preventScroll: true });
    return;
  }
  sound.effect(event);
  const mirrorClock = /^mirrorClock[0-2]$/.test(event);
  const mirrorTaunt = /^mirror[0-7]$/.test(event) || mirrorClock;
  if (mirrorTaunt) {
    const index = mirrorClock ? 8 + Number(event.slice(11)) : Number(event.slice(6));
    mirror.react(elapsed, index, { enabled: scaresEnabled });
    if (scaresEnabled) sound.effect("reflection-twitch", { x: MIRROR.x, y: 1.6, z: MIRROR.z });
  }
  const lines = {
    note: WRITINGS.note,
    "arrival-recording":
      "Mum asks you not to leave before saying goodnight. There are spare fuses in the kitchen.",
    "telephone-repeat": "Only a dead line now. You remember what she asked.",
    "telephone-dead":
      "Only a dead line. The telephone was never one of her evening sounds.",
    "radio-no-power":
      "The switch clicks, but the tuning scale stays dark. The kitchen has no power.",
    "radio-on": "The kitchen radio catches the valley weather service.",
    "radio-off": "The tuning light goes out. A small, ordinary silence.",
    letter:
      "The discharge receipt. Her things came home with her. The care did not end at the hospital.",
    "letter-repeat": "A discharge to home care. My signature under the list.",
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
      "Her watch, her ring, the blue ribbon. The diary remembers where she left them, and in what order.",
    "diary-repeat":
      "Watch beside the radio, ring by the bath, ribbon beside the music box. The evening ends in reverse.",
    "station-clue": "93.7 FM. The same number, written again and again across the kitchen.",
    "bath-clouded":
      "The moisture is uneven. There is nothing legible yet.",
    "time-clue": "The mirror has 03:17 written on it.",
    "clock-set": "You leave the hands where you put them. The house waits.",
    "clock-solved":
      "The hands agree. Fresh writing has appeared on the kitchen walls.",
    call: "Mum's voice. The music box. The bath. The radio. The diary remembers their places.",
    musicbox: "A few notes turn in the little wooden box.",
    tap: "Water runs into an empty basin.",
    photo:
      "Mum, Dad, and you. Before the empty place at the table.",
    "photo-crooked": VOICES.repeat.text,
    "photo-straightened": VOICES.photoMemory.text,
    "evidence-bathroom": VOICES.crimeBathroom.text,
    "evidence-trail": VOICES.crimeTrail.text,
    "evidence-kitchen": VOICES.crimeKitchen.text,
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
    "radio-static": "Only static. Look at the blood-written numbers on the kitchen walls.",
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
      "The glass has not changed the house. It has stopped hiding it.",
    farewell: WRITINGS.truth,
    "farewell-repeat": "You cannot make this into a different evening.",
    "bed-waiting": "Her side of the bed. You remember keeping it clean.",
    "lamp-stay": "She asked you to leave the light on.",
    "lamp-already-off": "Her light is off.",
    "ritual-wrong": "Not there. Not yet. The diary remembers her evening.",
    "keepsake-not-held": "You have not found that keepsake yet.",
    "keepsake-already-placed": "It is already in its place.",
    "ritual-inactive": "The little mark has been here a long time.",
    "mirror-enter":
      "Nothing returns your gaze. You can walk through the glass.",
    "mirror-inverted":
      "Your hands are steady in the glass. The blood is yours to remember.",
    "front-open": "The front door is open.",
    "invalid-time": "Leave an hour from 1 to 12, and minutes from 0 to 59.",
    "lamp-not-yet": "Look at the bed. You have not said what happened.",
    "lamp-off": "The light goes out. It does not change what is on the sheets.",
    "front-unlocked":
      "At the front of the house, a door opens against the daylight.",
    "ending-open": "Cold daylight. A place outside.",
  };
  if (event === "note") house.note.visible = false;
  if (event === "arrival-recording" || event === "call" || event === "routine-call")
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
  const voiced = {
    "photo-crooked": "repeat",
    "photo-straightened": "photoMemory",
    "evidence-bathroom": "crimeBathroom",
    "evidence-trail": "crimeTrail",
    "evidence-kitchen": "crimeKitchen",
    "arrival-recording": "recording",
    power: "power",
    key: "key",
    diary: "diary",
    letter: "letter",
    "time-clue": "time",
    call: "call",
    "routine-call": "routineCall",
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
  const voiceId = voiced[event] || (mirrorTaunt ? event : null);
  if (voiceId) {
    // Spoken dialogue owns one caption channel; never print the same thought
    // above it as a second toast while the voice is queued or playing.
    $("message").textContent = "";
    const telephone = event === "arrival-recording" || event === "call" || event === "routine-call";
    queueVoice(voiceId, 0.35, telephone ? {
      onDuration: (duration) => {
        story.phoneLiftUntil = elapsed + Math.max(0, duration - sound.voiceElapsed()) + .4;
      },
      onComplete: () => { story.phoneLiftUntil = elapsed + .4; },
    } : {});
  } else if (lines[event]) {
    say(lines[event], ["diary", "letter", "note", "time-clue"].includes(event) ? 7 : 4);
  }
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
  $("veil").style.removeProperty("background-color");
  $("veil").style.removeProperty("transition");
  document.exitPointerLock();
  showMenu();
}
function beginEnding() {
  picture.setThreat(0, elapsed);
  forwardClearance = Infinity;
  endingStart = elapsed;
  endingAt = elapsed + 45;
  wakeTurned = false;
  newsStarted = newsFinished = lastLineFinished = false;
  funeralAttack = funeralRush = funeralImpact = false;
  goodnightStarted = goodnightFinished = false;
  newsStartedAt = newsFinishedAt = 0;
  endingSpoken = false;
  const essential = ["sob", "farewell", "unlocked"];
  pending = pending.filter((line) => essential.includes(line.id));
  if (!essential.includes(sound.currentVoice)) sound.stopVoice();
  target = null;
  $("prompt").textContent = $("chapter-mark").textContent = "";
  $("cross").classList.remove("active");
  $("location").textContent = "THE FUNERAL ROOM";
  $("hint").textContent =
    "WASD · WALK    SHIFT · RUN    F · FLASHLIGHT    ESC · PAUSE";
  mirror.body.visible = false;
  house.wake?.begin?.(elapsed, player);
  sound.effect("wake-entered", { x: 0, y: 1.4, z: 11 });
  say("Someone has left a radio on.", 4);
}
function beginFailure(event) {
  if (!event.playerInitiated || failing || endingAt || story.ended) return;
  if (!failure.begin(elapsed, player)) return;
  failing = true;
  player.clear();
  lookInput.reset();
  target = null;
  pending = [];
  sound.stopVoice();
  sound.stopCreatureCues();
  sound.effect("crawler-failure", event);
  document.body.classList.add("is-dying");
  $("prompt").textContent = $("hint").textContent = $("message").textContent = "";
  $("cross").classList.remove("active");
}
function showDeath() {
  active = false;
  mode = "dead";
  player.clear();
  lookInput.reset();
  sound.pause();
  picture.setThreat(0, elapsed);
  $("hud").hidden = $("menu").hidden = true;
  $("death-screen").hidden = false;
  $("death-retry").focus({ preventScroll: true });
  document.exitPointerLock();
}
function updateFlashlight(dt) {
  firstPerson.update(dt, player, {
    flashlightOn, active: active && !failing, inverted: story.inverted, time: elapsed,
    clearance: forwardClearance,
  });
  const beam = firstPerson.getBeam();
  flashlightDirection.copy(beam.direction);
  flashlight.position.copy(beam.position);
  // Keep the light on our side of nearby walls even during a rapid turn.
  safeBeamOffset.copy(flashlight.position).sub(camera.position);
  if (Number.isFinite(forwardClearance) && forwardClearance < safeBeamOffset.length() + .08)
    flashlight.position.copy(camera.position).addScaledVector(
      safeBeamOffset.normalize(), Math.max(.025, forwardClearance - .08),
    );
  flashlight.target.position
    .copy(flashlight.position)
    .addScaledVector(flashlightDirection, 10);
  flashlight.intensity = T.MathUtils.damp(
    flashlight.intensity,
    flashlightOn ? 19 * beam.visibility : 0,
    12,
    dt,
  );
  flashlight.shadow.autoUpdate = flashlight.intensity > .025;
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
  const look = lookInput.consume(dt, player.sensitivity);
  if (look && !funeralAttack && !failing) player.look(look.x, look.y);
  elapsed += dt;
  if (failing) {
    horror.updateFailure(elapsed);
    const hit = failure.update(elapsed);
    player.yaw = hit.yaw;
    player.pitch = hit.pitch;
    player.syncCamera();
    camera.position.y = hit.eyeHeight;
    camera.updateMatrixWorld();
    updateFlashlight(dt);
    picture.setThreat(.35 + hit.strike * .65, elapsed, {
      enabled: scaresEnabled, flashes: flashingLights,
    });
    $("transition").style.opacity = String(hit.fade);
    // The strike resolves quickly; let its complete finite audio tail play.
    if (hit.done && elapsed - failure.startedAt >= 1.42) showDeath();
    return;
  }
  if (endingAt) {
    const t = elapsed - endingStart;
    if (!funeralAttack) player.update(dt, house.colliders);
    house.wake.setBlackoutEnabled(flashingLights);
    house.animate(elapsed, dt, story, player);
    for (const event of house.wake.drainEvents()) sound.effect(event.id, event);
    sound.update(story, player);
    if (elapsed >= messageUntil) $("message").textContent = "";
    playPendingVoice();
    if (newsStarted && elapsed - newsStartedAt > 7 && !wakeTurned) {
      wakeTurned = true;
      sound.effect("wake-turn", { x: 1.62, y: 1.2, z: 9.65 });
    }
    if (t >= 1.8 && !newsStarted && !sound.busy && !pending.length) {
      newsStarted = true;
      newsStartedAt = elapsed;
      house.wake.beginReport(elapsed);
      const startedAt = endingStart;
      sound.voice("news", {
        position: FUNERAL_RADIO,
        radio: true,
        segmented: true,
        onComplete: () => {
          if (!endingAt || startedAt !== endingStart) return;
          newsFinished = true;
          newsFinishedAt = elapsed;
          house.wake.beginBlackout(elapsed, { flashes: flashingLights });
          endingAt = elapsed + 10;
        },
      });
    }
    if (newsFinished && elapsed - newsFinishedAt >= 2.6 && !endingSpoken) {
      endingSpoken = true;
      const startedAt = endingStart;
      sound.voice("ending", {
        position: { x: 1.62, y: 1.2, z: 9.65 },
        gain: 1.05,
        postGap: .06,
        onComplete: () => {
          if (!endingAt || startedAt !== endingStart) return;
          lastLineFinished = true;
          funeralAttack = true;
          if (scaresEnabled) sound.effect("funeral-turn", { x: 1.62, y: 1.2, z: 9.65 });
          house.wake.beginAttack(elapsed, player, { enabled: scaresEnabled });
          $("veil").style.transition = "none";
          endingAt = elapsed + 10;
        },
      });
    }
    if (funeralAttack) {
      const attack = house.wake.attackCamera(elapsed);
      if (attack.yaw !== null && attack.yaw !== undefined) {
        player.yaw = attack.yaw;
        player.pitch = attack.pitch;
        player.syncCamera();
      }
      if (attack.phase === "lunge" && !funeralRush) {
        funeralRush = true;
        sound.effect("funeral-lunge");
        goodnightStarted = true;
        const startedAt = endingStart;
        sound.voice("goodnight", {
          position: { x: attack.x, y: 1.5, z: attack.z },
          gain: 1.05,
          postGap: .05,
          onComplete: () => {
            if (!endingAt || startedAt !== endingStart) return;
            goodnightFinished = true;
          },
        });
      }
      if (attack.phase === "impact" && !funeralImpact) {
        funeralImpact = true;
        sound.effect("funeral-impact");
      }
      $("veil").style.backgroundColor = `rgba(0,0,0,${attack.fade})`;
      // The visual strike is deliberately much faster than the spoken word.
      // Hold black long enough for Mum's complete "Goodnight" (or captions).
      if (attack.done && (!goodnightStarted || goodnightFinished)) finish();
    }
    // The parlor has its own walls; don't retain the last house-door clearance.
    findTarget();
    updateFlashlight(dt);
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
  if (story.inverted && room === "bedroom" && !sobQueued) {
    sobQueued = true;
    queueVoice("sob", 0.4, {
      position: { x: 7.2, y: 1.1, z: -2.6 },
      gain: 1.05,
    });
    sound.effect("broken-breath", { x: 7.2, y: 1.1, z: -2.6 });
  }
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
  house.animate(elapsed, dt, story, player);
  for (const event of house.dressing?.drainEvents() || [])
    sound.effect(event.id, event);
  const light = horror.update(elapsed, dt, story, player, camera, {
    enabled: scaresEnabled,
    flashes: flashingLights,
    dialogueBusy: sound.busy || pending.length > 0,
  });
  house.applyHorrorLighting?.(light);
  for (const event of horror.drainEvents()) {
    if (event.id === "crawler-contact") beginFailure(event);
    else sound.effect(event.id, event);
  }
  picture.setThreat(horror.threat.amount, elapsed, {
    enabled: scaresEnabled, flashes: flashingLights,
  });
  if (failing) return;
  target = findTarget();
  updateFlashlight(dt);
  mirror.update(elapsed, player, story, looking, firstPerson.capturePose());
  sound.step(
    player.distance,
    player.speed,
    room !== "bathroom" && room !== "kitchen" && room !== "utility",
  );
  sound.update(story, player);
  playPendingVoice();
  if (target?.id === "photo") {
    const event = story.noticePhoto();
    if (event) respond(event);
  }
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
      (((story.stage === 3 && story.ritualIndex === 3) || (story.stage === 4 && !story.silenceComplete)) && !story.heardRoutineCall) || story.stage < 3
        ? "LIFT TELEPHONE RECEIVER" : "CHECK DEAD TELEPHONE";
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
  renderHorrorText($("prompt"), label ? "[ E ] " + label : "");
  $("prompt").classList.toggle("mirror-prompt", target?.id === "mirror");
  $("cross").classList.toggle("active", !!target);
  renderHorrorText($("location"),
    ROOMS.find((r) => r.id === room)?.name ||
    (story.inverted ? "THE OTHER HALL" : "THE HALL"));
  renderHorrorText($("hint"),
    elapsed < hintUntil
      ? story.hint()
      : elapsed < 12
        ? "[ H ] ASK FOR A HINT"
        : "");
  if (elapsed > messageUntil) $("message").textContent = "";
  if (elapsed > chapterUntil) $("chapter-mark").textContent = "";
}
// Restore preferences before preparing the actual selected render targets.
const settings = initSettings();
house.reset(story);
updateInventory();
showSubtitle("");
loadingStatus("Preparing the sounds of the house…");
await sound.prepare();
loadingStatus("Preparing your view…");
const warmupTarget = renderer.getRenderTarget();
const warmupStats = [];
const preparation = { essential: false, revelation: false, wake: false, error: null };
const essentialObjects = [
  firstPerson.body, firstPerson.flashlight, mirror.flashlight.root,
  horror.figure.body, house.props.kitchenFrequency.root, house.props.hallBlood.root,
];
const nextPreparationTask = () => new Promise(resolve => setTimeout(resolve, active ? 25 : 0));
const idlePreparation = async () => {
  // Small texture batches may progress during play; render submissions wait
  // for the title, journal or a mandatory puzzle form to cover the world.
  while (active) await new Promise(resolve => setTimeout(resolve, 100));
};
async function preparePhase(phase, include, exclude, { essential = false } = {}) {
  const began = performance.now();
  const programs = await prepareRenderPrograms(renderer, scene, camera, {
    target: picture.target, include, exclude,
  });
  const textures = await prepareRenderTextures(renderer, programs.view, {
    yieldTask: nextPreparationTask,
  });
  if (!essential) await idlePreparation();
  const resources = await warmProgramView(renderer, programs.view, camera, {
    target: picture.target, beforeSubmit: essential ? undefined : idlePreparation,
  });
  const stats = { phase, meshes: programs.meshes, lights: programs.lights,
    materials: programs.materials, textures: textures.textures, uploaded: textures.uploaded,
    programs: resources.programs, ms: performance.now() - began };
  warmupStats.push(stats);
  if (!essential) preparation[phase] = true;
  return programs;
}
try {
  firstPerson.prepare(player);
  const preparedBeam = firstPerson.getBeam();
  flashlight.position.copy(preparedBeam.position);
  flashlight.target.position.copy(preparedBeam.position).addScaledVector(preparedBeam.direction, 10);
  flashlight.intensity = 1;
  flashlight.shadow.needsUpdate = true;
  const essential = await preparePhase("essential", essentialObjects,
    [house.revelation.group, house.wake.group], { essential: true });
  // Allocate the real flashlight target and room caches only once. Future
  // lighting states use tiny isolated views instead of full-world warm draws.
  warmRenderResources(renderer, scene, camera, {
    target: picture.target, objects: essentialObjects, textureScene: essential.view, finish: false,
  });
  house.portal.warmup(renderer, camera);
  await picture.warmup();
} catch (error) {
  $("error").textContent = "Graphics preparation could not finish. Reload the page to try again.";
  throw error;
} finally {
  flashlight.intensity = 0;
  flashlight.shadow.autoUpdate = false;
  firstPerson.reset();
  // Temporary warmup bodies must never remain in a cached room shadow.
  for (const light of house.architecture.shadowLights) light.shadow.needsUpdate = true;
  renderer.setRenderTarget(warmupTarget);
}
// A compiled post-process can still have first-draw driver work. Complete a
// real F-off world/reflection/presentation frame before declaring play ready.
renderView();
await waitForRenderResources(renderer);
preparation.essential = true;
async function prepareFutureRooms() {
  await idlePreparation();
  await preparePhase("revelation", [...essentialObjects, house.revelation.group], [house.wake.group]);
  await idlePreparation();
  await preparePhase("wake", [...essentialObjects, house.revelation.group,
    house.wake.group, house.wake.attackBody], []);
}
// This promise is deliberately independent of the entry button: late rooms
// have minutes of gameplay and several mandatory forms to prepare under.
prepareFutureRooms().catch(error => {
  preparation.error = error.message;
  console.warn("Background room preparation:", error.message);
});
loadingStatus("");
$("start").disabled = false;
$("start").textContent = "ENTER THE HOUSE";
let previous = performance.now(),
  firstFrame = true;
function tick(now) {
  requestAnimationFrame(tick);
  const frameMs = now - previous;
  const dt = Math.min(frameMs / 1000, 0.05);
  previous = now;
  if (!testMode) {
    if (adaptive.sample(frameMs, active) !== null) resize();
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
    failure: { active: failing, ...failure.update(elapsed) },
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
    reflection: mirror.snapshot(),
    audio: sound.context?.state,
    dialogue: {
      id: sound.currentVoice,
      busy: sound.busy,
      queued: pending.map((q) => q.id),
      offset: sound.voiceElapsed(),
      duration: sound.voiceDuration,
      position:
        sound.voiceOptions?.position ||
        sound.resumeVoice?.options.position ||
        null,
    },
    ending: {
      startedAt: endingStart,
      newsStarted,
      newsStartedAt,
      newsFinished,
      lastLineFinished,
      goodnightStarted,
      goodnightFinished,
      attack: house.wake.snapshot().attack,
      endsAt: endingAt,
    },
    roomSound: {
      radio: sound.radio?.gain.value,
      water: sound.water?.gain.value,
    },
    doorAngle: house.doorPivot.rotation.y,
    flashlight: flashlightOn,
    firstPerson: firstPerson.snapshot(),
    rendering: {
      programs: renderer.info.programs?.length, flashlightShadow: flashlight.castShadow,
      adaptive: adaptive.snapshot(), warmup: warmupStats, preparation: { ...preparation },
      postProcessing: picture.postProcessing,
      width: renderer.domElement.width, height: renderer.domElement.height,
    },
    settings: settings.snapshot(),
    portal: null,
    lastPortal,
    portalCount,
    input: { keys: [...player.keys], vx: player.vx, vz: player.vz, look: lookInput.snapshot() },
    scares: {
      mirrorSnap,
      ...horror.snapshot(),
      enabled: scaresEnabled,
      flashes: flashingLights,
    },
    quality,
    dressing: house.dressing?.snapshot(),
    revelation: house.revelation?.snapshot?.(),
    funeralRoom: house.wake.snapshot(),
    evidence: [...evidenceSeen],
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
