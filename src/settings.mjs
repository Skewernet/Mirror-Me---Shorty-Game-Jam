// Preferences stay local to this browser. Only known, validated game settings
// are restored; browser storage may be unavailable without preventing play.
export const SETTINGS_STORAGE_KEY = "mirror-me.settings.v1";
export const SETTINGS_DEFAULTS = Object.freeze({
  quality: "1080",
  "auto-quality": true,
  brightness: 1.13,
  "post-processing": true,
  "contact-shadows": true,
  grain: false,
  volume: .55,
  voice: true,
  subtitles: true,
  sensitivity: 1,
  bob: false,
  "sudden-scares": true,
  "flashing-lights": true,
});

const ranges = {
  brightness: [.8, 1.6],
  volume: [0, 1],
  sensitivity: [.3, 2],
};
const format = {
  brightness: value => Math.round(value * 100) + "%",
  volume: value => Math.round(value * 100) + "%",
  sensitivity: value => value.toFixed(1) + "×",
};

export function validateSettings(values) {
  const source = values && typeof values === "object" ? values : {};
  return Object.fromEntries(Object.entries(SETTINGS_DEFAULTS).map(([id, fallback]) => {
    const value = source[id];
    let valid;
    if (id === "quality") valid = ["720", "1080", "1440"].includes(value);
    else if (ranges[id]) valid = typeof value === "number" && Number.isFinite(value) &&
      value >= ranges[id][0] && value <= ranges[id][1];
    else valid = typeof value === "boolean";
    return [id, valid ? value : fallback];
  }));
}

// Call after the game's oninput/onchange handlers have been installed. Restored
// preferences use those same handlers, keeping renderer/audio state in sync.
export function initSettings({ root = document, storage } = {}) {
  const byId = id => root.getElementById(id);
  const controls = Object.keys(SETTINGS_DEFAULTS).map(byId).filter(Boolean);
  const listeners = [];
  let applying = false, storageAvailable = true;
  const listen = (element, name, handler) => {
    if (!element) return;
    element.addEventListener(name, handler);
    listeners.push(() => element.removeEventListener(name, handler));
  };
  const status = message => {
    const element = byId("settings-status");
    if (element && element.textContent !== message) element.textContent = message;
  };
  try {
    if (storage === undefined) storage = root.defaultView.localStorage;
  } catch { storageAvailable = false; }
  if (!storage) storageAvailable = false;

  function snapshot() {
    const values = {};
    for (const control of controls)
      values[control.id] = control.type === "checkbox" ? control.checked :
        control.type === "range" ? Number(control.value) : control.value;
    return validateSettings(values);
  }
  function renderValues() {
    for (const [id, formatter] of Object.entries(format)) {
      const control = byId(id), output = byId(id + "-value");
      if (!control) continue;
      const label = formatter(Number(control.value));
      if (output) output.value = label;
      control.setAttribute("aria-valuetext", label);
    }
  }
  function persist() {
    if (storageAvailable) {
      try { storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ version: 1, values: snapshot() })); }
      catch { storageAvailable = false; }
    }
    status(storageAvailable ? "Settings are saved on this browser." : "Settings apply to this session.");
  }
  function apply(values) {
    const validated = validateSettings(values);
    applying = true;
    try {
      for (const control of controls) {
        const value = validated[control.id];
        if (control.type === "checkbox") control.checked = value;
        else control.value = String(value);
      }
      const EventType = root.defaultView.Event;
      for (const control of controls)
        control.dispatchEvent(new EventType(control.type === "range" ? "input" : "change", { bubbles: true }));
    } finally { applying = false; }
    renderValues();
  }
  function changed() {
    if (applying) return;
    renderValues();
    persist();
  }
  for (const control of controls) {
    listen(control, "input", changed);
    listen(control, "change", changed);
  }
  let saved;
  if (storageAvailable) {
    let raw;
    try { raw = storage.getItem(SETTINGS_STORAGE_KEY); }
    catch { storageAvailable = false; }
    try {
      const record = JSON.parse(raw || "null");
      if (record?.version === 1) saved = record.values;
    } catch { /* Malformed preferences fall back to safe defaults. */ }
  }
  apply(saved);
  if (!storageAvailable) status("Settings apply to this session.");

  const details = byId("settings"), summary = details?.querySelector("summary"), menu = byId("menu");
  function syncPanel() {
    if (menu) menu.dataset.settingsOpen = String(Boolean(details?.open));
    summary?.setAttribute("aria-expanded", String(Boolean(details?.open)));
  }
  function close() {
    if (!details) return;
    details.open = false;
    syncPanel();
    summary?.focus({ preventScroll: true });
  }
  function reset() {
    apply(SETTINGS_DEFAULTS);
    persist();
    status(storageAvailable ? "Default settings restored." : "Default settings restored for this session.");
  }
  listen(details, "toggle", syncPanel);
  listen(byId("settings-close"), "click", close);
  listen(byId("settings-reset"), "click", reset);
  listen(root, "keydown", event => {
    if (event.key === "Escape" && details?.open && menu && !menu.hidden) {
      event.preventDefault();
      close();
    }
  });
  syncPanel();
  return { snapshot, reset, dispose() { for (const remove of listeners) remove(); } };
}
