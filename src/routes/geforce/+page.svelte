<script>
  import { onMount } from 'svelte';
  import { startGeForce } from '$lib/lethe/geforce.js';
  import { loadSetting } from '$lib/utils/localspace.js';
  import { installGameKeyboard } from '$lib/utils/browser/game-keyboard.js';
  import Icon from '$lib/utils/browser/icon.svelte';

  let frame;
  let app;
  let loading = $state(true);
  let error = $state('');
  let fullscreen = $state(false);

  onMount(() => {
    let disposed = false;
    const syncFullscreen = () => { fullscreen = Boolean(document.fullscreenElement); };
    const stopAppKeys = window.top === window
      ? installGameKeyboard({ document, navigator, desktop: app }) : () => {};
    const stopFrameKeys = window.top === window
      ? installGameKeyboard({ document, navigator, desktop: frame }) : () => {};
    document.addEventListener('fullscreenchange', syncFullscreen);
    async function launch() {
      try {
        const wisp = await loadSetting('customWisp', '');
        if (disposed) return;
        await startGeForce(frame, wisp, () => !disposed);
      } catch (cause) {
        if (!disposed) {
          loading = false;
          error = cause instanceof Error ? cause.message : 'GeForce NOW could not start.';
        }
      }
    }
    launch();
    return () => {
      disposed = true;
      stopAppKeys();
      stopFrameKeys();
      document.removeEventListener('fullscreenchange', syncFullscreen);
    };
  });

  async function enterFullscreen() {
    try {
      await app.requestFullscreen({ navigationUI: 'hide' });
      frame.focus();
    } catch {
      error = 'Fullscreen is unavailable here. Use your browser’s fullscreen control.';
    }
  }
</script>

<svelte:head>
  <title>Velora — GeForce NOW</title>
  <meta name="description" content="Open GeForce NOW directly in Velora." />
</svelte:head>

<section class="geforce-app" bind:this={app} aria-label="GeForce NOW app">
  <iframe bind:this={frame} title="GeForce NOW"
    allow="fullscreen; autoplay; gamepad; clipboard-read; clipboard-write; encrypted-media; picture-in-picture"
    allowfullscreen onload={() => { if (frame?.getAttribute('src')) loading = false; }}></iframe>
  {#if loading && !error}
    <div class="startup" role="status"><span class="spinner" aria-hidden="true"></span>Connecting to GeForce NOW…</div>
  {/if}
  {#if error}
    <div class="error" role="alert">
      <p>{error}</p>
      <button onclick={() => window.location.reload()}>Try again</button>
      <button onclick={() => { error = ''; }}>Dismiss</button>
    </div>
  {/if}
  {#if !fullscreen}
    <button class="fullscreen" onclick={enterFullscreen} aria-label="Enter fullscreen" title="Enter fullscreen">
      <Icon name="fullscreen" size={20} />
    </button>
  {/if}
</section>

<style>
  .geforce-app { position: fixed; inset: 0; width: 100%; height: 100%; overflow: hidden; background: #101010; color: #eee; font: 14px system-ui, sans-serif; }
  iframe { display: block; width: 100%; height: 100%; border: 0; background: #101010; }
  .startup { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 12px; background: #101010; pointer-events: none; }
  .spinner { width: 16px; height: 16px; border: 2px solid #ffffff24; border-top-color: #d2c3a5; border-radius: 50%; animation: spin 800ms linear infinite; }
  .fullscreen { position: absolute; left: max(12px, env(safe-area-inset-left)); bottom: max(12px, env(safe-area-inset-bottom)); display: grid; place-items: center; width: 40px; height: 40px; padding: 0; opacity: .5; transition: opacity 180ms ease-out; }
  button { border: 1px solid #ffffff24; border-radius: 8px; background: #181818e6; color: #eee; cursor: pointer; font: inherit; padding: 10px 16px; }
  button:hover, button:focus-visible { opacity: 1; }
  button:focus-visible { outline: 2px solid #cbbb9c; outline-offset: 3px; }
  .error { position: absolute; left: 50%; bottom: 64px; transform: translateX(-50%); width: min(440px, calc(100vw - 64px)); padding: 18px; border: 1px solid #ffffff24; border-radius: 8px; background: #181818f5; line-height: 1.6; }
  .error p { margin: 0 0 12px; }
  .error button + button { margin-left: 8px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .spinner { animation: none; } .fullscreen { transition: none; } }
</style>
