<script>
 import { tick } from 'svelte';
 import { PRIMARY_WISP, BACKUP_WISP, normalizeRelayUrl } from '$lib/lethe/relay-config.js';
 let { value = '', disabled = false, onchange } = $props();
 let provider = $state('main');
 let draft = $state('');
 let message = $state('');
 let saving = $state(false);
 const pickerId = $props.id();
 const providers = [
  { value: 'main', label: 'Main relay' },
  { value: 'backup', label: 'Backup relay' },
  { value: 'custom', label: 'Custom relay', detail: 'Enter your own relay address' }
 ];
 let open = $state(false);
 let above = $state(false);
 let menuHeight = $state(200);
 let picker;
 let trigger;
 let options = [];
 $effect(() => { if (disabled || saving) open = false; });
 function positionMenu() {
  if (!trigger) return;
  const rect = trigger.getBoundingClientRect();
  const viewport = window.visualViewport;
  const top = viewport?.offsetTop || 0;
  const bottom = top + (viewport?.height || window.innerHeight);
  const below = Math.max(0, bottom - rect.bottom - 14);
  const before = Math.max(0, rect.top - top - 14);
  above = below < 200 && before > below;
  menuHeight = Math.min(200, above ? before : below);
 }
 function focusOption(index) {
  const option = options[index];
  if (!option) return;
  option.focus({ preventScroll: true });
  const menu = option.parentElement;
  const top = option.offsetTop - 5;
  const bottom = option.offsetTop + option.offsetHeight + 5;
  if (top < menu.scrollTop) menu.scrollTop = top;
  else if (bottom > menu.scrollTop + menu.clientHeight) menu.scrollTop = bottom - menu.clientHeight;
 }
 function containScroll(node) {
  const wheel = event => {
   if (event.ctrlKey) return;
   event.preventDefault();
   event.stopPropagation();
   const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? node.clientHeight : 1;
   node.scrollTop += event.deltaY * unit;
  };
  node.addEventListener('wheel', wheel, { passive: false });
  window.addEventListener('resize', positionMenu);
  window.visualViewport?.addEventListener('resize', positionMenu);
  return { destroy() {
   node.removeEventListener('wheel', wheel);
   window.removeEventListener('resize', positionMenu);
   window.visualViewport?.removeEventListener('resize', positionMenu);
  } };
 }
 async function openMenu(position) {
  if (disabled || saving) return;
  positionMenu();
  open = true;
  await tick();
  focusOption(position ?? providers.findIndex(item => item.value === provider));
 }
 function closeMenu(restoreFocus = false) {
  open = false;
  if (restoreFocus) trigger?.focus({ preventScroll: true });
 }
 function outside(event) {
  if (open && !picker?.contains(event.target)) closeMenu();
 }
 function triggerKey(event) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  void openMenu(event.key === 'Home' ? 0 : event.key === 'End' ? providers.length - 1 : undefined);
 }
 function optionKey(event, index) {
  let next;
  if (event.key === 'ArrowDown') next = (index + 1) % providers.length;
  else if (event.key === 'ArrowUp') next = (index + providers.length - 1) % providers.length;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = providers.length - 1;
  else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeMenu(true); return; }
  else if (event.key === 'Tab') { closeMenu(); return; }
  else if (event.key.length === 1 && /[a-z]/i.test(event.key)) next = providers.findIndex(item => item.label.toLowerCase().startsWith(event.key.toLowerCase()));
  if (next === undefined || next < 0) return;
  event.preventDefault();
  focusOption(next);
 }
 $effect(() => {
  const selected = normalizeRelayUrl(value) || PRIMARY_WISP;
  open = false;
  draft = selected === PRIMARY_WISP || selected === BACKUP_WISP ? '' : selected;
  provider = selected === PRIMARY_WISP ? 'main' : selected === BACKUP_WISP ? 'backup' : 'custom';
  message = '';
 });
 async function save(url) {
  if (saving || disabled) return;
  const normalized = normalizeRelayUrl(url);
  if (!normalized) { message = 'Enter a valid wss:// or ws:// relay URL.'; return; }
  saving = true;
  message = '';
  try {
   await onchange(normalized === PRIMARY_WISP ? '' : normalized);
   message = 'Saved. Reopen your app to use this connection.';
  } catch { message = 'Could not save this relay. Please try again.'; }
  finally { saving = false; }
 }
 function choose(choice) {
  closeMenu(true);
  provider = choice;
  message = '';
  if (choice !== 'custom') void save(choice === 'main' ? PRIMARY_WISP : BACKUP_WISP);
 }
</script>

<svelte:document onpointerdown={outside} onfocusin={outside} />

<div class="relay-settings">
 <p class="relay-help">Choose Main, Backup, or enter your own relay.</p>
 <div class="relay-label">
  <span id={pickerId + '-label'}>Relay</span>
  <div class="relay-picker" bind:this={picker}>
   <button class="relay-trigger" class:expanded={open} bind:this={trigger} type="button"
    aria-labelledby={pickerId + '-label ' + pickerId + '-value'} aria-haspopup="menu"
    aria-expanded={open} aria-controls={open ? pickerId + '-options' : undefined}
    disabled={disabled || saving} onkeydown={triggerKey}
    onclick={() => { if (open) closeMenu(); else void openMenu(); }}>
    <span class="relay-symbol" aria-hidden="true">
     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <rect x="4" y="3" width="16" height="7" rx="2" /><rect x="4" y="14" width="16" height="7" rx="2" /><path d="M8 6.5h.01M8 17.5h.01M12 7h4M12 18h4" />
     </svg>
    </span>
    <span class="relay-value" id={pickerId + '-value'}>{providers.find(item => item.value === provider)?.label}</span>
    <svg class="relay-chevron" class:up={open} aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m7 10 5 5 5-5" /></svg>
   </button>
   {#if open}
    <div class="relay-menu" class:above style:max-height={menuHeight + 'px'} use:containScroll id={pickerId + '-options'} role="menu" aria-labelledby={pickerId + '-label'}>
     {#each providers as item, index}
      <button class="relay-option" class:selected={provider === item.value} type="button" role="menuitemradio"
       aria-checked={provider === item.value} tabindex="-1" bind:this={options[index]}
       onkeydown={(event) => optionKey(event, index)} onclick={() => choose(item.value)}>
       <span class="option-copy"><span class="option-name">{item.label}</span>{#if item.detail}<span class="option-detail">{item.detail}</span>{/if}</span>
       {#if provider === item.value}
        <svg class="option-check" aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6" /></svg>
       {/if}
      </button>
     {/each}
    </div>
   {/if}
  </div>
 </div>
 {#if provider === 'custom'}
  <form onsubmit={(event) => { event.preventDefault(); void save(draft); }}>
   <label class="relay-label">
    Relay URL
    <input aria-label="Custom relay URL" type="text" inputmode="url" autocomplete="off" spellcheck="false" placeholder="wss://your-relay.example/wisp/" bind:value={draft} disabled={disabled || saving} />
   </label>
   <button class="actionBtn" type="submit" disabled={disabled || saving}>{saving ? 'Saving…' : 'Save relay'}</button>
  </form>
 {/if}
 {#if message}<p class="relay-help" role="status">{message}</p>{/if}
</div>

<style>
 .relay-settings { display: grid; gap: 14px; max-width: 580px; color: var(--color-text, #e7eddf); }
 .relay-help { margin: 0; font-size: 12px; line-height: 1.6; color: var(--color-text-muted, #abb5a0); }
 .relay-label { display: grid; gap: 8px; font-size: 12px; }
 input { box-sizing: border-box; width: 100%; min-height: 38px; padding: 10px 12px; border: 1px solid #e7eddf28; border-radius: 6px; background: #1e241c; color: var(--color-text, #e7eddf); font: 400 13px/1.4 var(--font-family-body, sans-serif); }
 .relay-picker { position: relative; min-width: 0; }
 .relay-trigger { display: flex; align-items: center; gap: 11px; width: 100%; min-height: 44px; margin: 0; padding: 10px 13px; border: 1px solid #e7eddf28; border-radius: 9px; background: #1e241c; color: var(--color-text, #e7eddf); text-align: left; font: 400 13px/1.4 var(--font-family-body, sans-serif); cursor: pointer; transition: background 160ms ease, border-color 160ms ease; }
 .relay-trigger:hover, .relay-trigger.expanded { background: #2b3326; border-color: #b5c99780; }
 .relay-symbol { display: grid; place-items: center; flex: none; color: #cfddbb; }
 .relay-value { flex: 1; min-width: 0; }
 .relay-chevron { flex: none; color: #a5b298; transition: transform 160ms ease; }
 .relay-chevron.up { transform: rotate(180deg); }
 .relay-menu { position: absolute; z-index: 40; inset: calc(100% + 7px) 0 auto; box-sizing: border-box; max-height: 200px; overflow-y: auto; overscroll-behavior: contain; touch-action: pan-y; scrollbar-width: thin; scrollbar-color: #8f9e7b66 transparent; padding: 5px; border: 1px solid #a6ba8a42; border-radius: 11px; background: #252d22; box-shadow: 0 12px 30px #0005; animation: relay-menu-in 130ms ease-out; }
 .relay-menu.above { inset: auto 0 calc(100% + 7px); }
 .relay-option { display: flex; align-items: center; gap: 12px; width: 100%; margin: 0; padding: 11px 12px; border: 0; border-radius: 7px; background: transparent; color: var(--color-text, #e7eddf); text-align: left; font: inherit; cursor: pointer; }
 .relay-option:hover, .relay-option:focus-visible { outline: none; background: #d3e5b01c; }
 .relay-option.selected { background: #d3e5b00d; }
 .relay-option.selected:hover, .relay-option.selected:focus-visible { background: #d3e5b024; }
 .option-copy { display: grid; gap: 3px; min-width: 0; flex: 1; }
 .option-name { font-size: 13px; font-weight: 500; }
 .option-detail { color: #a9b59c; font-size: 11px; overflow-wrap: anywhere; }
 .option-check { flex: none; color: #d3e5b0; }
 @keyframes relay-menu-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
 @media (prefers-reduced-motion: reduce) { .relay-menu { animation: none; } .relay-trigger, .relay-chevron { transition: none; } }
 form { display: grid; gap: 12px; }
 form button { justify-self: start; padding: 9px 14px; border: 1px solid #e7eddf28; border-radius: 6px; background: #e7eddf08; color: var(--color-text, #e7eddf); font: inherit; cursor: pointer; }
 button:focus-visible, input:focus-visible { outline: 2px solid #d3e5b0; outline-offset: 3px; }
 button:disabled, input:disabled { opacity: .5; cursor: default; }
</style>
