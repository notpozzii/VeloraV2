<script>
	import { onMount } from 'svelte';
	import SpeedPanel from '$lib/utils/developer/speed-panel.svelte';
	import { getActivityHub, setDeveloperMode } from '$lib/utils/developer/diagnostics.js';
	let enabled = $state(false);
	let hydrated = $state(false);
	let error = $state('');
	onMount(() => {
		let unsubscribe;
		const connect = () => { if (!unsubscribe) unsubscribe = getActivityHub().subscribe(state => { enabled = state.enabled; }); };
		const disconnect = () => { unsubscribe?.(); unsubscribe = undefined; };
		connect();
		window.addEventListener('pagehide', disconnect);
		window.addEventListener('pageshow', connect);
		hydrated = true;
		return () => { disconnect(); window.removeEventListener('pagehide', disconnect); window.removeEventListener('pageshow', connect); };
	});
	function toggle() {
		error = setDeveloperMode(!enabled) ? '' : 'Changed for this visit. This browser could not save the preference.';
	}
</script>

<div class="group">
	<div class="subGroup">
		<div class="developer-toggle"><div><p class="subHeading">Developer mode</p><p class="desc">Measure page speed and inspect live activity while you use Velora.</p></div><button role="switch" aria-checked={enabled} aria-label="Developer mode" disabled={!hydrated} onclick={toggle}><span></span></button></div>
		{#if error}<p class="desc" role="status">{error}</p>{/if}
		{#if enabled}<button class="open-console" onclick={() => getActivityHub().setOpen(true)}>Open developer console</button>{/if}
	</div>
	{#if enabled}
		<div class="speed-feature"><SpeedPanel /></div>
	{:else}
		<div class="speed-intro"><span>LOAD SPEED</span><h2>Find out where the wait is.</h2><p>Five-request server tests, median response times, and real browser load milestones. Enable Developer mode to start measuring.</p></div>
	{/if}
	<div class="subGroup">
		<p class="subHeading">What you can see</p>
		<p class="desc">App windows, page loads, engine and transport attempts, resource timings, connection failures, JavaScript errors, and console call counts.</p>
		<p class="desc">Activity covers this Velora tab and its app pages. Remote server internals and requests hidden inside third-party pages or background workers aren’t visible.</p>
	</div>
	<div class="subGroup">
		<p class="subHeading">Local activity only</p>
		<p class="desc">Keeps the latest 400 events in memory. Turning Developer mode off clears the activity. Page reloads start a new log.</p>
		<p class="desc">URLs show domains only. Passwords, cookies, page contents, request bodies, and console argument values aren’t collected.</p>
	</div>
</div>

<style>
	.speed-feature { border:1px solid #c7dfa42c; background:#111a15; border-radius:14px; overflow:hidden; margin:22px 0; }.speed-intro { border:1px solid #d3e5b028; background:linear-gradient(135deg,#d3e5b00b,transparent); border-radius:14px; padding:25px; margin:22px 0; }.speed-intro span { color:#b4c998; font:10px ui-monospace,monospace; letter-spacing:1.2px; }.speed-intro h2 { color:#e0e9d9; font-size:24px; font-weight:500; margin:9px 0; letter-spacing:-.5px; }.speed-intro p { font-size:12px; color:#94a488; line-height:1.7; max-width:480px; margin:0; }
	.developer-toggle { display:flex; align-items:center; justify-content:space-between; gap:24px; }
	.developer-toggle .desc { margin-bottom:0; }
	[role=switch] { width:44px; height:26px; flex-shrink:0; border:1px solid #ffffff30; background:#ffffff12; border-radius:20px; padding:3px; cursor:pointer; }
	[role=switch] span { display:block; height:18px; width:18px; border-radius:50%; background:#a3b09b; transition:transform .15s; }
	[role=switch][aria-checked=true] { background:#d3e5b0; border-color:#d3e5b0; }
	[role=switch][aria-checked=true] span { transform:translateX(17px); background:#263422; }
	[role=switch]:disabled { opacity:.4; }
	.open-console { margin-top:18px; border:1px solid #d3e5b044; color:#d3e5b0; background:#d3e5b00b; border-radius:9px; padding:10px 14px; font:inherit; font-size:12px; cursor:pointer; }
	button:focus-visible { outline:2px solid #d3e5b0; outline-offset:3px; }
	@media (prefers-reduced-motion:reduce) { [role=switch] span { transition:none; } }
</style>
