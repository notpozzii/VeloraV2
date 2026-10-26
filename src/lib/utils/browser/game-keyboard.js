// Progressive enhancement for Chromium. The browser retains its long-Esc exit.
// Never cancel key events or synthesize input: the focused game receives real keys.
export function installGameKeyboard({ document: doc, navigator: nav, desktop }) {
  const keyboard = nav.keyboard;
  if (typeof keyboard?.lock !== 'function' || typeof keyboard?.unlock !== 'function') {
    return () => {};
  }

  let requested = false;
  let disposed = false;
  function release() {
    if (!requested) return;
    requested = false;
    keyboard.unlock();
  }
  function sync() {
    if (doc.fullscreenElement !== desktop) {
      release();
      return;
    }
    if (requested || disposed) return;
    requested = true;
    try {
      // Called from the fullscreen transition, without intercepting Esc ourselves.
      Promise.resolve(keyboard.lock(['Escape'])).then(() => {
        if (disposed || doc.fullscreenElement !== desktop) release();
      }).catch(() => {
        // Denied/unsupported capture leaves normal browser and game input intact.
        requested = false;
      });
    } catch {
      requested = false;
    }
  }

  doc.addEventListener('fullscreenchange', sync);
  return () => {
    disposed = true;
    doc.removeEventListener('fullscreenchange', sync);
    release();
  };
}
