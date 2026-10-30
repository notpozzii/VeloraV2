<script>
	import { onMount, tick } from 'svelte';
	import Icon from '$lib/utils/browser/icon.svelte';
	import SpeedPanel from './speed-panel.svelte';
	import { activityOwner, getActivityHub, setDeveloperMode } from './diagnostics.js';
	let owner = $state(false);
	let state = $state({ enabled:false, paused:false, open:false, entries:[], dropped:0 });
	let panel = $state('speed');
	let filter = $state('all');
	let query = $state('');
	let follow = $state(true);
	let list = $state();
	let hub;
	const filters = ['all', 'apps', 'connection', 'network', 'errors', 'console', 'system'];
	const visible = $derived(state.entries.filter(entry => (filter === 'all' || (filter === 'errors' ? entry.severity === 'error' || entry.severity === 'warn' : entry.category === filter)) && `${entry.message} ${entry.source} ${Object.values(entry.details).join(' ')}`.toLowerCase().includes(query.toLowerCase())));
	const errors = $derived(state.entries.filter(entry => entry.severity === 'error').length);
	onMount(() => {
		owner = activityOwner(window) === window;
		if (!owner) return;
		hub = getActivityHub();
		let timer;
		const unsubscribe = hub.subscribe(next => {
			if (next.enabled !== state.enabled || next.open !== state.open || next.paused !== state.paused) { clearTimeout(timer); timer = undefined; state = next; }
			else if (!timer) timer = setTimeout(() => { timer = undefined; state = hub.snapshot(); }, 80);
		});
		const shortcut = event => { if (event.altKey && event.shiftKey && event.code === 'KeyD' && hub.snapshot().enabled) { event.preventDefault(); hub.setOpen(!hub.snapshot().open); } };
		window.addEventListener('keydown', shortcut);
		return () => { clearTimeout(timer); unsubscribe(); window.removeEventListener('keydown', shortcut); };
	});
	$effect(() => {
		state.entries.length; state.open; filter; query;
		if (follow) void tick().then(() => { if (list) list.scrollTop = list.scrollHeight; });
	});
	function time(value) { return new Date(value).toLocaleTimeString([], { hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit' }); }
	function details(entry) {
		const d = entry.details;
		return [d.target, d.engine && (d.engine === 'uv' ? 'UV' : d.engine.toUpperCase()), d.transport, d.attempt !== undefined && `attempt ${d.attempt}/${d.total ?? '?'}`, d.duration !== undefined && `${d.duration} ms`, d.status && `HTTP ${d.status}`, d.bytes > 0 && `${Math.round(d.bytes / 1024)} KB transferred`, d.kind, d.reason, d.errorClass, d.line !== undefined && `line ${d.line}:${d.column ?? 0}`, d.method && `console.${d.method}`, d.arguments !== undefined && `${d.arguments} argument${d.arguments === 1 ? '' : 's'}`].filter(value => value !== undefined && value !== false && value !== '').join(' · ');
	}
</script>

{#if owner && state.enabled}
	{#if state.open}
		<section class="activity-console" aria-label="Velora developer activity console">
			<header><div class="console-title"><span class="live" class:paused={state.paused}></span><strong>Developer console</strong><span class="local">This tab</span></div><button title="Minimize console" aria-label="Minimize developer console" onclick={() => hub.setOpen(false)}><Icon name="close" size={16}/></button></header>
			<div class="console-sections" role="group" aria-label="Developer tools"><button class:chosen={panel === 'speed'} aria-pressed={panel === 'speed'} onclick={() => (panel = 'speed')}><Icon name="activity" size={14}/>Load speed</button><button class:chosen={panel === 'activity'} aria-pressed={panel === 'activity'} onclick={() => (panel = 'activity')}>Activity <span>{state.entries.length}</span></button></div>
			{#if panel === 'speed'}
				<div class="speed-scroll"><SpeedPanel /></div>
			{:else}
			<div class="console-tools"><label><Icon name="search" size={14}/><input aria-label="Filter activity" placeholder="Filter activity…" bind:value={query}/></label><button onclick={() => hub.setPaused(!state.paused)}>{state.paused ? 'Resume' : 'Pause'}</button><button onclick={() => hub.clear()}>Clear</button></div>
			<nav aria-label="Activity categories">{#each filters as category}<button class:active={filter === category} aria-pressed={filter === category} onclick={() => (filter = category)}>{category === 'all' ? 'All activity' : category}</button>{/each}</nav>
			<div class="activity-list" bind:this={list} role="log" aria-live="off" aria-label="Recorded activity">
				{#each visible as entry (entry.id)}
					<div class="activity-row" class:error={entry.severity === 'error'} class:warning={entry.severity === 'warn'}><time>{time(entry.time)}</time><div class="event"><div><span class="category">{entry.category}</span><strong>{entry.message}</strong></div><p>{entry.source}{details(entry) ? ` · ${details(entry)}` : ''}</p></div></div>
				{:else}<div class="empty"><Icon name="activity" size={26}/><strong>{query || filter !== 'all' ? 'No matching activity' : 'Waiting for activity'}</strong><p>{state.paused ? 'Recording is paused.' : 'Open an app or browse a page to see what happens.'}</p></div>{/each}
			</div>
			{/if}
			<footer><span>{state.paused ? 'Paused' : 'Recording'} · {state.entries.length}/400{errors ? ` · ${errors} errors` : ''}{state.dropped ? ` · ${state.dropped} older events dropped` : ''}</span><label><input type="checkbox" bind:checked={follow}/> Follow</label><button onclick={() => setDeveloperMode(false)}>Turn off</button></footer>
		</section>
	{:else}
		<button class="developer-badge" onclick={() => hub.setOpen(true)} title="Open developer console (Alt+Shift+D)"><Icon name="activity" size={15}/><span>DEV</span><span>{state.entries.length}</span>{#if errors}<span class="error-count">{errors}!</span>{/if}</button>
	{/if}
{/if}

<style>
	.activity-console { position:fixed; right:20px; bottom:100px; z-index:2147483000; width:min(720px,calc(100vw - 40px)); height:min(690px,calc(100dvh - 155px)); display:flex; flex-direction:column; border:1px solid #baceb33b; border-radius:16px; overflow:hidden; background:#111a15f5; backdrop-filter:blur(20px); color:#e0e9d9; box-shadow:0 16px 80px #0007; font:11px/1.5 system-ui,sans-serif; color-scheme:dark; }
	button { color:inherit; font:inherit; border:1px solid #ffffff16; background:#ffffff04; border-radius:6px; padding:5px 9px; cursor:pointer; }
	button:hover { background:#ffffff0e; } button:focus-visible,input:focus-visible { outline:2px solid #d3e5b0; outline-offset:2px; }
	header { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:12px 15px; border-bottom:1px solid #ffffff12; }
	.console-title { display:flex; gap:9px; align-items:center; } .console-title strong { font-size:12px; font-weight:550; }
	.live { width:6px; height:6px; background:#c3e69c; border-radius:50%; box-shadow:0 0 8px #c3e65944; }.live.paused { background:#e4c27e; box-shadow:none; }.local { color:#81967d; font-size:10px; }
	header button { display:grid; place-items:center; padding:4px; border:0; background:transparent; }
	.console-sections { display:flex; gap:8px; flex-shrink:0; padding:10px 14px; border-bottom:1px solid #ffffff12; }.console-sections button { display:flex; align-items:center; gap:7px; border-color:transparent; color:#8fa181; padding:7px 10px; }.console-sections button.chosen { color:#d3e5b0; background:#d3e5b013; border-color:#d3e5b030; }.console-sections button > span { font:9px ui-monospace,monospace; color:#839773; }.speed-scroll { min-height:0; flex:1; overflow:auto; overscroll-behavior:contain; scrollbar-width:thin; }
	.console-tools { display:flex; gap:7px; padding:10px 13px; }.console-tools label { display:flex; align-items:center; gap:7px; flex:1; min-width:0; color:#83967c; background:#0003; border:1px solid #ffffff14; border-radius:7px; padding:0 9px; }.console-tools input { width:100%; background:none; border:0; color:#e0e9d9; padding:7px 0; font:inherit; outline:none; }
	nav { display:flex; gap:4px; overflow-x:auto; padding:0 13px 10px; border-bottom:1px solid #ffffff12; }nav button { text-transform:capitalize; white-space:nowrap; border-color:transparent; color:#92a68c; padding:4px 8px; }nav button.active { color:#d3e5b0; background:#d3e5b012; border-color:#d3e5b029; }
	.activity-list { min-height:0; flex:1; overflow:auto; overscroll-behavior:contain; scrollbar-width:thin; }
	.activity-row { display:flex; gap:13px; padding:9px 14px; border-bottom:1px solid #ffffff07; }.activity-row.error { background:#dc72630c; }.activity-row.warning { background:#e1bb6409; }
	time { color:#71816d; font:10px/1.8 ui-monospace,monospace; white-space:nowrap; }.event { min-width:0; }.event > div { display:flex; gap:7px; align-items:baseline; flex-wrap:wrap; }.event strong { font-weight:450; }.category { font-size:9px; text-transform:uppercase; color:#9db58c; letter-spacing:.5px; }.error .category { color:#edae9b; }.warning .category { color:#e4cc91; }.event p { font:10px/1.7 ui-monospace,monospace; color:#8c9e82; overflow-wrap:anywhere; margin:3px 0 0; }
	.empty { min-height:160px; display:flex; flex-direction:column; justify-content:center; align-items:center; gap:10px; color:#b0c0a5; }.empty p { margin:0; color:#81967d; font-size:11px; }.empty strong { font-weight:450; }
	footer { display:flex; align-items:center; gap:12px; padding:9px 13px; border-top:1px solid #ffffff12; color:#91a386; font-size:10px; }footer > span { flex:1; }footer label { display:flex; gap:4px; align-items:center; white-space:nowrap; }footer input { accent-color:#c3d9a3; }footer button { font-size:10px; padding:3px 6px; }
	.developer-badge { position:fixed; right:20px; bottom:20px; z-index:2147483000; display:flex; gap:8px; align-items:center; border:1px solid #c5d9a946; border-radius:10px; padding:10px 12px; background:#162119ed; color:#d3e5b0; box-shadow:0 4px 20px #0004; font:10px ui-monospace,monospace; }.error-count { color:#edae9b; }
	@media(max-width:560px) { .activity-console { right:8px; bottom:88px; width:calc(100vw - 16px); height:min(620px,calc(100dvh - 140px)); }footer { gap:7px; }time { font-size:9px; }.activity-row { gap:8px; padding:8px 10px; } }
</style>
