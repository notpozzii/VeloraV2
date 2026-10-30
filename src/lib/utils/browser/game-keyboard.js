// Progressive enhancement for Chromium. The browser retains its long-Esc exit.
// Never cancel key events or synthesize input: the focused game receives real keys.
export function installGameKeyboard({ document: doc, navigator: nav, desktop, targets = [desktop], allApps = false }) {
  const keyboard = nav.keyboard;
  if (typeof keyboard?.lock !== 'function' || typeof keyboard?.unlock !== 'function') {
    return () => {};
  }

  let requested = false;
  let disposed = false;
  let generation = 0;
  function active() {
    const fullscreen = doc.fullscreenElement;
    // The top-level layout owns one lock across all app windows and routes.
    if (allApps) return Boolean(fullscreen);
    return Boolean(fullscreen && targets.some(target => target && (
      fullscreen === target ||
      (fullscreen === doc.documentElement && doc.activeElement === target)
    )));
  }
  function release() {
    if (!requested) return;
    requested = false;
    generation += 1;
    keyboard.unlock();
  }
  function sync() {
    if (!active()) {
      release();
      return;
    }
    if (requested || disposed) return;
    requested = true;
    const request = ++generation;
    try {
      // Called from the fullscreen transition, without intercepting Esc ourselves.
      Promise.resolve(keyboard.lock(['Escape'])).then(() => {
        if (request !== generation) return;
        if (disposed || !active()) release();
      }).catch(() => {
        // Denied/unsupported capture leaves normal browser and game input intact.
        if (request === generation) requested = false;
      });
    } catch {
      if (request === generation) requested = false;
    }
  }

  doc.addEventListener('fullscreenchange', sync);
  // The desktop may already be fullscreen when the layout mounts or gains focus.
  doc.addEventListener('focusin', sync);
  sync();
  return () => {
    disposed = true;
    doc.removeEventListener('fullscreenchange', sync);
    doc.removeEventListener('focusin', sync);
    release();
  };
}
