// One DOM animation after the ending; no gameplay renderer or audio loop.
export function createEndCredits(dialog, onFinish) {
  const track = dialog.querySelector('.credits-roll-track');
  const viewport = dialog.querySelector('.credits-roll-viewport');
  const pause = dialog.querySelector('[data-roll-pause]');
  let animation = null, paused = false, active = false;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  function stop() {
    active = false;
    if (animation) { animation.onfinish = null; animation.cancel(); animation = null; }
    if (dialog.open) dialog.close();
  }
  function finish() { if (!active) return; stop(); onFinish(); }
  function sync() {
    pause.textContent = paused ? 'RESUME CREDITS' : 'PAUSE CREDITS';
    pause.setAttribute('aria-pressed', String(paused));
    if (animation) paused || document.hidden ? animation.pause() : animation.play();
  }
  function animate(progress = 0) {
    if (animation) { animation.onfinish = null; animation.cancel(); animation = null; }
    dialog.classList.toggle('credits-roll-static', reduced.matches);
    pause.hidden = reduced.matches;
    if (reduced.matches) return; // Manual scrolling and an explicit return button.
    const height = viewport.clientHeight;
    animation = track.animate([
      { transform: `translateY(${height}px)` },
      { transform: `translateY(-${track.scrollHeight}px)` },
    ], { duration: Math.max(60000, (height + track.scrollHeight) / 36 * 1000), easing: 'linear', fill: 'forwards' });
    animation.currentTime = progress * animation.effect.getTiming().duration;
    animation.onfinish = finish;
    sync();
  }
  pause.onclick = () => { paused = !paused; sync(); };
  dialog.querySelector('[data-roll-skip]').onclick = finish;
  dialog.addEventListener('cancel', event => { event.preventDefault(); finish(); });
  dialog.addEventListener('keydown', event => {
    if (event.code === 'Space' && event.target === pause) return;
    if (event.code === 'Space' && !event.target.closest('button, a')) {
      event.preventDefault(); paused = !paused; sync();
    }
  });
  dialog.addEventListener('focusin', event => {
    if (event.target.closest('.credits-roll-track a')) { paused = true; sync(); }
  });
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('resize', () => {
    if (!active) return;
    const progress = animation ? animation.currentTime / animation.effect.getTiming().duration : 0;
    animate(progress);
  });
  reduced.addEventListener('change', () => { if (active) animate(); });
  return {
    start() { stop(); active = true; paused = false; dialog.showModal(); viewport.scrollTop = 0; animate(); pause.hidden ? dialog.querySelector('[data-roll-skip]').focus() : pause.focus(); },
    stop,
    // Reloading the source register can finish after the ending on a slow connection.
    refresh() { if (active) animate(); },
  };
}

export function populateEndCredits(track, data) {
  for (const old of track.querySelectorAll('[data-asset-credit]')) old.remove();
  const marker = track.querySelector('[data-assets-end]');
  for (const entry of data.entries) {
    const card = document.createElement('section'); card.dataset.assetCredit = entry.id;
    const work = document.createElement('h3'); work.textContent = entry.screenCredit?.work || entry.title;
    const creator = document.createElement('p'); creator.textContent = entry.screenCredit?.creator || entry.creator;
    const license = document.createElement('p'); license.className = 'credits-roll-license';
    license.textContent = entry.screenCredit?.note || entry.license;
    const links = document.createElement('p'); links.className = 'credits-roll-links';
    for (const [label, url] of [['Source', entry.source], ['License', entry.licenseUrl]]) {
      if (!url) continue;
      const a = document.createElement('a'); a.textContent = label; a.href = url;
      a.target = '_blank'; a.rel = 'noopener noreferrer'; links.append(a);
    }
    card.append(work, creator, license, links); marker.before(card);
  }
  track.querySelector('[data-credit-load]').hidden = true;
}
