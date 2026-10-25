import { SETTINGS_STORAGE_KEY, validateSettings } from './settings.mjs';

// Brief, uneven glimpses rather than a looping strobe. The normal portrait
// remains beneath the finite CSS overlay, so a busy driver cannot hold a
// distorted frame indefinitely while JavaScript is occupied elsewhere.
export const MENU_MIRROR_PERIOD = 37800;
export const MENU_MIRROR_GLIMPSES = Object.freeze([
  [4400, 4540], [11200, 11420], [11740, 11860],
  [20900, 21160], [28500, 28610], [29080, 29260],
].map(([start, end], index) => Object.freeze({ start, end, index })));

export function menuMirrorAt(elapsed = 0) {
  const time = (Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0) % MENU_MIRROR_PERIOD;
  for (const glimpse of MENU_MIRROR_GLIMPSES) {
    if (time < glimpse.start)
      return { state: 'normal', motion: 'still', index: -1, nextIn: glimpse.start - time };
    if (time < glimpse.end)
      return { state: 'distorted', motion: 'glimpse', index: glimpse.index, nextIn: glimpse.end - time };
  }
  return { state: 'normal', motion: 'still', index: -1,
    nextIn: MENU_MIRROR_PERIOD - time + MENU_MIRROR_GLIMPSES[0].start };
}

export function initMenuMirror({ root = document, clock = {}, storage } = {}) {
  const view = root.defaultView;
  const mirror = root.getElementById('menu-mirror');
  const menu = root.getElementById('menu');
  if (!view || !mirror || !menu) return null;
  const now = clock.now ? clock.now.bind(clock) : () => view.performance.now();
  const setTimer = clock.setTimeout ? clock.setTimeout.bind(clock) : (callback, delay) => view.setTimeout(callback, delay);
  const clearTimer = clock.clearTimeout ? clock.clearTimeout.bind(clock) : id => view.clearTimeout(id);
  const reducedMotion = view.matchMedia('(prefers-reduced-motion: reduce)');
  const intro = root.getElementById('intro'), settings = root.getElementById('settings');
  const endingCredits = root.getElementById('ending-credits');
  const comfort = ['flashing-lights', 'sudden-scares'].map(id => root.getElementById(id)).filter(Boolean);
  const listeners = [], pendingChoices = new Map(), storedChoices = new Map(), restored = new Set();
  let disposed = false, focused = root.hasFocus?.() ?? true, pageActive = true, intersecting = true;
  let timer = null, startedAt = null, reason = 'assets', lastVisual = null, assets = 'pending';
  let storageAvailable = true, cachedValues = validateSettings({});
  let settingsReady = menu.dataset.settingsReady === 'true';
  const listen = (target, event, handler, options) => {
    if (!target) return;
    target.addEventListener(event, handler, options);
    listeners.push(() => target.removeEventListener(event, handler, options));
  };

  // Main restores all settings after loading the house. Honor saved comfort
  // preferences now, including explicit edits made while those assets load.
  // A first synthetic restore consumes a pending session choice before the
  // later-installed game handler reads the checkbox; Restore Defaults after
  // the handoff is therefore free to apply its usual values.
  try { if (storage === undefined) storage = view.localStorage; }
  catch { storageAvailable = false; }
  const readRecord = () => {
    try {
      const record = JSON.parse(storage?.getItem(SETTINGS_STORAGE_KEY) || 'null');
      if (record?.version === 1 && record.values && typeof record.values === 'object') {
        cachedValues = validateSettings(record.values);
        return record.values;
      }
    } catch { storageAvailable = false; }
    return null;
  };
  const saved = readRecord();
  if (!settingsReady && saved) for (const control of comfort) {
    if (typeof saved[control.id] !== 'boolean') continue;
    control.checked = saved[control.id];
    storedChoices.set(control.id, control.checked);
  }
  const persistComfort = () => {
    readRecord();
    const values = { ...cachedValues };
    for (const control of comfort) values[control.id] = control.checked;
    cachedValues = validateSettings(values);
    try {
      if (!storage) { storageAvailable = false; return; }
      storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ version: 1, values: cachedValues }));
    } catch { storageAvailable = false; }
  };

  const cancel = () => {
    if (timer !== null) clearTimer(timer);
    timer = null;
  };
  const paint = phase => {
    const key = phase.state + ':' + phase.index;
    if (key === lastVisual) return;
    lastVisual = key;
    mirror.dataset.state = phase.state;
    mirror.dataset.motion = phase.motion;
    if (phase.state === 'distorted') {
      mirror.style.setProperty('--mirror-glimpse-ms', Math.max(1, phase.nextIn) + 'ms');
      mirror.style.setProperty('--mirror-glimpse-index', String(phase.index));
    } else {
      mirror.style.removeProperty('--mirror-glimpse-ms');
      mirror.style.removeProperty('--mirror-glimpse-index');
    }
  };
  const still = () => paint({ state: 'normal', motion: 'still', index: -1 });
  const blocked = () => {
    if (disposed) return 'disposed';
    if (!pageActive || root.hidden) return 'page-hidden';
    if (!focused) return 'blurred';
    if (root.pointerLockElement) return 'playing';
    if (menu.hidden || menu.inert) return 'menu-hidden';
    if (intro && !intro.hidden) return 'intro';
    if (settings?.open || menu.dataset.settingsOpen === 'true') return 'settings';
    if (reducedMotion.matches) return 'reduced-motion';
    if (comfort.some(control => !control.checked)) return 'comfort';
    if (!mirror.isConnected || !intersecting) return 'layout-hidden';
    for (let node = mirror; node; node = node.parentElement) {
      const style = view.getComputedStyle(node);
      if (node.hidden || style.display === 'none' || style.visibility === 'hidden' ||
          style.visibility === 'collapse' || style.opacity === '0') return 'layout-hidden';
      if (node === menu) break;
    }
    const bounds = mirror.getBoundingClientRect();
    if (!bounds.width || !bounds.height || bounds.bottom <= 0 || bounds.top >= view.innerHeight ||
        bounds.right <= 0 || bounds.left >= view.innerWidth) return 'layout-hidden';
    return assets === 'ready' ? null : 'assets';
  };
  const arm = () => {
    if (disposed || startedAt === null) return;
    const phase = menuMirrorAt(now() - startedAt);
    paint(phase);
    timer = setTimer(() => {
      timer = null;
      if (blocked()) sync();
      else arm();
    }, Math.max(8, phase.nextIn));
  };
  function sync() {
    if (!settingsReady && menu.dataset.settingsReady === 'true') {
      settingsReady = true;
      pendingChoices.clear(); storedChoices.clear();
    }
    const nextReason = blocked();
    reason = nextReason;
    if (nextReason) {
      cancel(); startedAt = null; still();
    } else if (startedAt === null) {
      startedAt = now();
      arm();
    }
  }
  const changedComfort = event => {
    const control = event.currentTarget;
    if (!settingsReady && event.type === 'change' && !event.isTrusted && !restored.has(control.id)) {
      restored.add(control.id);
      if (pendingChoices.has(control.id)) control.checked = pendingChoices.get(control.id);
      else if (storedChoices.has(control.id)) control.checked = storedChoices.get(control.id);
      pendingChoices.delete(control.id); storedChoices.delete(control.id);
    }
    if (event.isTrusted) {
      if (!settingsReady && !restored.has(control.id)) pendingChoices.set(control.id, control.checked);
      persistComfort();
    }
    sync();
  };
  for (const control of comfort) {
    listen(control, 'input', changedComfort);
    listen(control, 'change', changedComfort);
  }
  listen(root, 'pointerlockchange', sync);
  listen(root, 'visibilitychange', sync);
  listen(view, 'focus', () => { focused = true; sync(); });
  listen(view, 'blur', () => { focused = false; sync(); });
  listen(view, 'pageshow', () => { pageActive = true; sync(); });
  listen(view, 'pagehide', () => { pageActive = false; sync(); });
  listen(view, 'resize', sync);
  listen(menu, 'scroll', sync, { passive: true });
  if (reducedMotion.addEventListener) listen(reducedMotion, 'change', sync);
  else {
    reducedMotion.addListener(sync);
    listeners.push(() => reducedMotion.removeListener(sync));
  }
  const observer = new view.MutationObserver(sync);
  for (let node = mirror; node; node = node.parentElement) {
    observer.observe(node, { attributes: true, childList: true,
      attributeFilter: ['hidden', 'inert', 'class', 'style', 'data-settings-open', 'data-settings-ready'] });
    if (node === menu) break;
  }
  if (intro) observer.observe(intro, { attributes: true, attributeFilter: ['hidden'] });
  if (settings) observer.observe(settings, { attributes: true, attributeFilter: ['open'] });
  if (endingCredits) observer.observe(endingCredits, { attributes: true, attributeFilter: ['hidden'] });
  const intersection = view.IntersectionObserver ? new view.IntersectionObserver(entries => {
    if (disposed) return;
    intersecting = entries[0]?.isIntersecting ?? true;
    sync();
  }, { threshold: .01 }) : null;
  intersection?.observe(mirror);

  const decode = image => {
    if (!image || !image.naturalWidth) return Promise.resolve(false);
    return Promise.resolve().then(() => image.decode?.()).then(() => image.naturalWidth > 0, () => false);
  };
  const portrait = (selector, property) => {
    const image = mirror.querySelector(selector);
    const loaded = !image ? Promise.resolve(false) : image.complete ? decode(image) : new Promise(resolve => {
      const complete = () => { cleanup(); decode(image).then(resolve); };
      const fail = () => { cleanup(); resolve(false); };
      const cleanup = () => { image.removeEventListener('load', complete); image.removeEventListener('error', fail); };
      image.addEventListener('load', complete, { once: true });
      image.addEventListener('error', fail, { once: true });
      listeners.push(cleanup);
    });
    return loaded.then(success => {
      if (disposed) return false;
      if (success) mirror.style.setProperty(property, 'url(' + JSON.stringify(image.currentSrc || image.src) + ')');
      return success;
    });
  };
  mirror.dataset.ready = 'pending';
  still(); sync();
  Promise.all([
    portrait('.menu-reflection-normal', '--mirror-normal-image'),
    portrait('.menu-reflection-distorted', '--mirror-distorted-image'),
  ]).then(results => {
    if (disposed) return;
    assets = results.every(Boolean) ? 'ready' : 'fallback';
    mirror.dataset.ready = assets;
    sync();
  });
  portrait('.menu-mirror__room', '--mirror-room-image');
  return {
    snapshot: () => ({ active: startedAt !== null, state: mirror.dataset.state,
      motion: mirror.dataset.motion, assets, reason, timerPending: timer !== null,
      elapsed: startedAt === null ? 0 : Math.max(0, now() - startedAt),
      settingsReady, pendingChoices: pendingChoices.size, storageAvailable }),
    dispose() {
      if (disposed) return;
      disposed = true; cancel(); startedAt = null; reason = 'disposed';
      observer.disconnect(); intersection?.disconnect();
      for (const remove of listeners) remove();
      still();
    },
  };
}

// Separate from main.mjs: cached portraits can be present while the game
// prepares, without constructing another renderer or waiting for its models.
export const menuMirror = typeof document === 'undefined' ? null : initMenuMirror();
