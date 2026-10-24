import { MenuAtmosphere } from './menu-audio.mjs';

export const INTRO_SESSION_KEY = 'mirror-me.intro.v1';
const stages = [
  ['PRODUCED BY', 'SKEWER GAMES', 'A familiar house. An evening that will not end.'],
  ['CREATED FOR', 'SHORTY JAM 2026', 'Theme: INVERTED'],
  ['THE HOUSE THAT LEARNS', 'MIRROR ME', ''],
];

export function initIntro({ root = document, atmosphere, stageDuration = 1000 } = {}) {
  const byId = id => root.getElementById(id);
  const screen = byId('intro'), menu = byId('menu');
  if (!screen || !menu) return null;
  const view = root.defaultView;
  let stage = 0, acknowledged = false, ready = false, disposed = false, pageActive = true;
  const listeners = [], timers = [];
  const listen = (target, event, handler, options) => {
    target?.addEventListener(event, handler, options);
    listeners.push(() => target?.removeEventListener(event, handler, options));
  };
  const savedVolume = () => {
    try {
      const record = JSON.parse(view.localStorage.getItem('mirror-me.settings.v1') || 'null');
      const value = record?.version === 1 ? record.values?.volume : undefined;
      if (Number.isFinite(value) && value >= 0 && value <= 1) return value;
    } catch {}
    return Number(byId('volume')?.value || .55);
  };
  const syncButton = state => {
    const button = byId('menu-sound');
    if (!button) return;
    button.textContent = state.enabled ? 'MENU SOUND: ON' : 'MENU SOUND: OFF';
    button.setAttribute('aria-pressed', String(state.enabled));
  };
  atmosphere ||= new MenuAtmosphere({ volume: savedVolume(), onChange: syncButton });
  syncButton(atmosphere.snapshot());
  const syncAudio = () => atmosphere.setActive(pageActive && !root.hidden &&
    !root.pointerLockElement && !menu.hidden);
  const syncLoading = () => {
    ready = !byId('start')?.disabled;
    byId('intro-load-status').textContent = ready ? 'The house is ready when you are.' :
      byId('loading-status')?.textContent || 'The house is preparing in the background.';
  };
  const showStage = value => {
    stage = value;
    const [kicker, title, caption] = stages[value];
    byId('intro-kicker').textContent = kicker;
    byId('intro-title').textContent = title;
    byId('intro-caption').textContent = caption;
    byId('intro-caption').hidden = !caption;
    byId('intro-warning').hidden = value !== 2;
    byId('intro-skip').hidden = value === 2;
    screen.dataset.stage = String(value);
    if (value === 2) byId('intro-sound').focus({ preventScroll: true });
  };
  const warning = () => {
    if (acknowledged || disposed) return;
    for (const timer of timers) clearTimeout(timer);
    showStage(2);
  };
  const enableSound = () => atmosphere.setEnabled(true).catch(() => {
    const button = byId('menu-sound');
    if (button) button.title = 'Menu audio could not start. Click to try again.';
  });
  const accept = sound => {
    acknowledged = true;
    for (const timer of timers) clearTimeout(timer);
    try { view.sessionStorage.setItem(INTRO_SESSION_KEY, 'acknowledged'); } catch {}
    screen.hidden = true;
    menu.inert = false;
    if (sound) enableSound();
    else atmosphere.setEnabled(false).catch(() => {});
    syncAudio();
    const focus = byId('start')?.disabled ? byId('settings')?.querySelector('summary') : byId('start');
    focus?.focus({ preventScroll: true });
  };
  try { acknowledged = view.sessionStorage.getItem(INTRO_SESSION_KEY) === 'acknowledged'; } catch {}
  menu.inert = !acknowledged;
  screen.hidden = acknowledged;
  if (!acknowledged) {
    showStage(0);
    byId('intro-skip').focus({ preventScroll: true });
    // Schedule from each displayed stage. Heavy scene preparation may delay
    // timers; two absolute deadlines could otherwise skip the jam card.
    timers.push(setTimeout(() => {
      if (acknowledged || disposed) return;
      showStage(1);
      timers.push(setTimeout(warning, stageDuration));
    }, stageDuration));
  }
  listen(byId('intro-skip'), 'click', warning);
  listen(byId('intro-sound'), 'click', () => accept(true));
  listen(byId('intro-silent'), 'click', () => accept(false));
  listen(byId('menu-sound'), 'click', () => {
    if (atmosphere.snapshot().enabled) atmosphere.setEnabled(false).catch(() => {});
    else enableSound();
  });
  listen(byId('volume'), 'input', event => atmosphere.setVolume(Number(event.target.value)));
  listen(root, 'pointerlockchange', syncAudio);
  listen(root, 'visibilitychange', syncAudio);
  listen(view, 'blur', () => { pageActive = false; syncAudio(); });
  listen(view, 'focus', () => { pageActive = true; syncAudio(); });
  listen(root, 'keydown', event => {
    if (screen.hidden) return;
    if (event.code === 'Escape') { event.preventDefault(); warning(); return; }
    if (event.code !== 'Tab') return;
    const buttons = [...screen.querySelectorAll('button')].filter(button => !button.hidden && !button.closest('[hidden]'));
    const index = buttons.indexOf(root.activeElement);
    if ((!event.shiftKey && index === buttons.length - 1) || (event.shiftKey && index <= 0)) {
      event.preventDefault(); buttons[event.shiftKey ? buttons.length - 1 : 0]?.focus();
    }
  });
  const menuObserver = new view.MutationObserver(syncAudio);
  menuObserver.observe(menu, { attributes: true, attributeFilter: ['hidden'] });
  const loadingObserver = new view.MutationObserver(syncLoading);
  loadingObserver.observe(byId('start'), { attributes: true, attributeFilter: ['disabled'] });
  loadingObserver.observe(byId('loading-status'), { childList: true, characterData: true, subtree: true });
  syncLoading(); syncAudio();
  return {
    finishLoading() { ready = true; byId('intro-load-status').textContent = 'The house is ready when you are.'; },
    setMenuActive(active) { atmosphere.setActive(Boolean(active) && pageActive && !root.hidden); },
    snapshot: () => ({ stage, acknowledged, ready, visible: !screen.hidden, audio: atmosphere.snapshot() }),
    async dispose() {
      disposed = true;
      for (const timer of timers) clearTimeout(timer);
      for (const unlisten of listeners) unlisten();
      menuObserver.disconnect(); loadingObserver.disconnect();
      menu.inert = false; screen.hidden = true;
      await atmosphere.dispose();
    },
  };
}

if (typeof document !== 'undefined' && document.getElementById('intro'))
  window.__mirrorIntro = initIntro();
