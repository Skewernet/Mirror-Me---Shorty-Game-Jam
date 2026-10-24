import { MenuAtmosphere } from './menu-audio.mjs';
import { renderHorrorText, decorateHorrorText } from './ui-text.mjs';

export const INTRO_SESSION_KEY = 'mirror-me.intro.v1';
export const INTRO_TIMING = Object.freeze({ fade: 2000, hold: 2400, blank: 200 });
const stages = [
  ['PRODUCED BY', 'SKEWER GAMES', 'A familiar house. An evening that will not end.'],
  ['CREATED FOR', 'SHORTY JAM 2026', 'Theme: INVERTED'],
  ['THE HOUSE THAT LEARNS', 'MIRROR ME', ''],
];

export function initIntro({ root = document, atmosphere, fadeDuration = INTRO_TIMING.fade,
  holdDuration = INTRO_TIMING.hold, blankDuration = INTRO_TIMING.blank } = {}) {
  const byId = id => root.getElementById(id);
  const screen = byId('intro'), menu = byId('menu');
  if (!screen || !menu) return null;
  const view = root.defaultView;
  const reducedMotion = view.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const fadeMs = reducedMotion ? 100 : Math.max(0, fadeDuration);
  const holdMs = Math.max(0, holdDuration), blankMs = Math.max(0, blankDuration);
  screen.style.setProperty('--intro-fade-ms', fadeMs + 'ms');
  let stageToken = 0;
  let stage = 0, phase = 'blank', acknowledged = false, accepting = false, ready = false, disposed = false, pageActive = true;
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
  const later = (callback, duration) => {
    const timer = setTimeout(() => { if (!disposed) callback(); }, duration);
    timers.push(timer);
    return timer;
  };
  const clearTimers = () => { for (const timer of timers) clearTimeout(timer); timers.length = 0; };
  const setPhase = value => { phase = value; screen.dataset.fade = value; };
  const showStage = value => {
    const token = ++stageToken;
    const current = () => !disposed && !acknowledged && !accepting && token === stageToken;
    stage = value;
    const [kicker, title, caption] = stages[value];
    renderHorrorText(byId('intro-kicker'), kicker);
    renderHorrorText(byId('intro-title'), title);
    renderHorrorText(byId('intro-caption'), caption);
    byId('intro-caption').hidden = !caption;
    byId('intro-warning').hidden = value !== 2;
    byId('intro-skip').hidden = value === 2;
    screen.dataset.stage = String(value);
    setPhase('blank');
    // Two paints establish black before a new card. Scheduling each phase
    // from the displayed phase prevents scene-preparation stalls skipping it.
    view.requestAnimationFrame(() => view.requestAnimationFrame(() => {
      if (!current()) return;
      setPhase('in');
      later(() => {
        if (!current()) return;
        setPhase('hold');
        if (value === 2) {
          byId('intro-sound').focus({ preventScroll: true });
          return;
        }
        later(() => {
          if (!current()) return;
          setPhase('out');
          later(() => {
            if (!current()) return;
            setPhase('blank');
            later(() => { if (current()) showStage(value + 1); }, blankMs);
          }, fadeMs);
        }, holdMs);
      }, fadeMs);
    }));
  };
  const warning = () => {
    if (acknowledged || disposed || accepting) return;
    clearTimers();
    showStage(2);
  };
  const enableSound = () => atmosphere.setEnabled(true).catch(() => {
    const button = byId('menu-sound');
    if (button) button.title = 'Menu audio could not start. Click to try again.';
  });
  const accept = sound => {
    if (accepting || acknowledged || disposed) return;
    accepting = true;
    clearTimers();
    byId('intro-sound').disabled = byId('intro-silent').disabled = true;
    try { view.sessionStorage.setItem(INTRO_SESSION_KEY, 'acknowledged'); } catch {}
    if (sound) enableSound();
    else atmosphere.setEnabled(false).catch(() => {});
    setPhase('out');
    later(() => {
      acknowledged = true; accepting = false;
      screen.hidden = true;
      menu.inert = false;
      syncAudio();
      const focus = byId('start')?.disabled ? byId('settings')?.querySelector('summary') : byId('start');
      focus?.focus({ preventScroll: true });
    }, fadeMs);
  };
  try { acknowledged = view.sessionStorage.getItem(INTRO_SESSION_KEY) === 'acknowledged'; } catch {}
  menu.inert = !acknowledged;
  screen.hidden = acknowledged;
  decorateHorrorText(byId('intro-warning'));
  if (!acknowledged) {
    showStage(0);
    byId('intro-skip').focus({ preventScroll: true });
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
    snapshot: () => ({ stage, phase, accepting, acknowledged, ready, visible: !screen.hidden,
      timing: { fade: fadeMs, hold: holdMs, blank: blankMs }, audio: atmosphere.snapshot() }),
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
