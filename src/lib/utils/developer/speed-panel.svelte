<script>
	import { onMount } from 'svelte';
	import Icon from '$lib/utils/browser/icon.svelte';
	import { activityOwner } from './diagnostics.js';
	import { getSpeedLab, readPageTimings, speedTargets, speedReport } from './speed.js';
	let lab;
	let state = $state({ running:false, target:'/', runs:[], summary:{}, cancelled:false });
	let target = $state('/');
	let page = $state({});
	let notice = $state('');
	const summary = $derived(state.summary);
	const scale = $derived(Math.max(1, ...state.runs.map(run => run.totalMs || 0)));
	const ms = value => typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value).toLocaleString()} ms` : '—';
	onMount(() => {
		lab = getSpeedLab();
		const unsubscribe = lab.subscribe(next => { state = next; if (next.running || next.runs.length) target = next.target; });
		const owner = activityOwner(window);
		const update = () => { page = readPageTimings(owner.performance); };
		update();
		const timer = setInterval(update, 1000);
		return () => { unsubscribe(); clearInterval(timer); };
	});
	async function run() {
		notice = '';
		try { await lab?.run(target); } catch { notice = 'Could not start the speed test. Try again.'; }
	}
	async function copy() {
		try { await navigator.clipboard.writeText(speedReport(state, page)); notice = 'Report copied.'; }
		catch { notice = 'This browser could not copy the report.'; }
	}
</script>

<section class="speed-panel" aria-label="Page load speed">
	<div class="speed-heading"><div><span class="eyebrow"><Icon name="activity" size={14}/> SPEED LAB</span><h2>Page load speed</h2><p>Measure the connection. See when the page loads.</p></div><span class="scope">Your browser</span></div>
	<div class="test-controls"><label><span>Test a Velora page</span><select aria-label="Page to test" bind:value={target} disabled={state.running}>{#each speedTargets as item}<option value={item.path}>{item.label}</option>{/each}</select></label><button class="run" onclick={state.running ? () => lab?.cancel() : run}>{state.running ? 'Stop test' : 'Run 5-request test'}<Icon name={state.running ? 'close' : 'arrow'} size={15}/></button></div>
	<div class="result-grid">
		<div class="result primary"><span>Median response</span><strong>{ms(summary.median)}</strong><small>{state.running ? `Testing · ${state.runs.length}/5 complete` : state.cancelled ? 'Stopped · partial results' : state.runs.length ? `${summary.succeeded}/${state.runs.length} successful requests` : 'Run a test to begin'}</small></div>
		<div class="result"><span>Fastest</span><strong>{ms(summary.fastest)}</strong><small>Response headers</small></div>
		<div class="result"><span>Slowest</span><strong>{ms(summary.slowest)}</strong><small>Response headers</small></div>
		<div class="result"><span>HTML complete</span><strong>{ms(summary.htmlMedian)}</strong><small>Median, including body</small></div>
	</div>
	{#if state.runs.length || state.running}
		<div class="request-heading"><strong>Request breakdown</strong><span>{speedTargets.find(item => item.path === state.target)?.label}{summary.failed ? ` · ${summary.failed} failed` : ''}</span></div>
		<ol class="requests" aria-label="Individual request timings">
			{#each state.runs as request}
				<li class:failed={!request.ok}><span class="number">{request.index}</span><div class="track"><div style:width={`${Math.max(1, (request.totalMs || 0) / scale * 100)}%`}></div></div><span class="duration">{ms(request.responseMs)}</span><span class="status">{request.error || `HTTP ${request.status}`}</span></li>
			{/each}
			{#if state.running}<li class="pending" role="status"><span class="pulse"></span>Waiting for request {state.runs.length + 1}…</li>{/if}
		</ol>
	{/if}
	<p class="measurement-note">Five requests, one at a time, with cache bypass requested. Response time includes the connection and ends when headers arrive. This does not measure when the desktop becomes usable.</p>
	<div class="navigation-heading"><h3>Current page load</h3><span>Since this tab’s last full navigation</span></div>
	<div class="page-grid">
		<div><span>First content</span><strong>{ms(page.contentPaint)}</strong></div>
		<div><span>Document ready</span><strong>{ms(page.domReady)}</strong></div>
		<div><span>Page load event</span><strong>{ms(page.pageLoad)}</strong></div>
	</div>
	<p class="measurement-note">These browser milestones describe the outer Velora page. They do not time websites inside apps or guarantee that everything is clickable. “—” means unavailable or still loading.</p>
	<div class="speed-footer"><span>{page.resources ?? 0} resource timings available</span><button onclick={copy} disabled={!state.runs.length || state.running}>Copy report</button></div>
	{#if notice}<p class="notice" role="status">{notice}</p>{/if}
</section>

<style>
	.speed-panel { padding:22px; color:#e0e9d9; font:12px/1.5 system-ui,sans-serif; color-scheme:dark; }
	.speed-heading { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:22px; }.eyebrow { display:flex; align-items:center; gap:6px; color:#c7dfa4; font:10px ui-monospace,monospace; letter-spacing:1.4px; }h2 { font-size:24px; font-weight:550; letter-spacing:-.6px; margin:7px 0 3px; }.speed-heading p { color:#93a38c; margin:0; }.scope { border:1px solid #d3e5b026; border-radius:20px; color:#aabd9d; padding:4px 9px; font-size:10px; white-space:nowrap; }
	.test-controls { display:flex; gap:10px; align-items:flex-end; margin-bottom:15px; }.test-controls label { flex:1; display:flex; flex-direction:column; gap:6px; min-width:0; }.test-controls label > span { font-size:10px; color:#99aa90; }select { width:100%; min-width:0; padding:9px 11px; border:1px solid #ffffff21; background:#1b281e; border-radius:8px; color:inherit; font:inherit; }button { color:inherit; font:inherit; cursor:pointer; border:1px solid #ffffff21; background:#ffffff06; border-radius:8px; padding:8px 12px; }button:hover { background:#ffffff10; }button:disabled,select:disabled { opacity:.45; cursor:default; }button.run { display:flex; justify-content:center; align-items:center; gap:14px; background:#d3e5b0; border-color:#d3e5b0; color:#25331d; font-weight:600; min-height:39px; white-space:nowrap; }button.run:hover { background:#e1efc8; }button:focus-visible,select:focus-visible { outline:2px solid #d3e5b0; outline-offset:3px; }
	.result-grid { display:grid; grid-template-columns:1.4fr 1fr 1fr 1.2fr; gap:8px; }.result { display:flex; flex-direction:column; padding:13px 12px; border:1px solid #ffffff12; border-radius:10px; background:#ffffff03; min-width:0; }.result.primary { border-color:#c7dfa43b; background:linear-gradient(135deg,#c7dfa414,#c7dfa404); }.result > span,.page-grid span { color:#96a78d; font-size:10px; }.result strong { font-size:22px; font-weight:500; letter-spacing:-.7px; white-space:nowrap; margin:5px 0 3px; }.result.primary strong { color:#d3e5b0; }.result small { color:#798c70; font-size:9px; }
	.request-heading { display:flex; justify-content:space-between; gap:10px; align-items:center; margin:20px 0 8px; }.request-heading strong { font-size:11px; font-weight:500; }.request-heading > span { color:#8da080; font-size:10px; }.requests { margin:0; padding:0; list-style:none; }.requests li { display:flex; align-items:center; gap:10px; padding:6px 0; font:10px ui-monospace,monospace; }.number { width:13px; color:#819075; }.track { flex:1; height:6px; border-radius:3px; background:#ffffff08; overflow:hidden; }.track > div { height:100%; border-radius:3px; background:#accb88; }.failed .track > div { background:#d99383; }.duration { width:68px; text-align:right; color:#d3dfc8; }.status { width:87px; text-align:right; color:#9db589; }.failed .status { color:#e0a390; }.requests li.pending { color:#91a481; padding:9px 0; }.pulse { width:5px; height:5px; border-radius:50%; background:#d3e5b0; }
	.measurement-note { color:#7f9275; font-size:10px; margin:12px 0 0; line-height:1.65; }.navigation-heading { border-top:1px solid #ffffff12; margin-top:20px; padding-top:17px; display:flex; align-items:baseline; justify-content:space-between; gap:10px; }.navigation-heading h3 { font-size:12px; font-weight:500; margin:0; }.navigation-heading > span { color:#7f9275; font-size:9px; }.page-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-top:12px; }.page-grid > div { display:flex; flex-direction:column; gap:3px; }.page-grid strong { font-size:17px; font-weight:450; }.speed-footer { border-top:1px solid #ffffff12; padding-top:14px; margin-top:16px; display:flex; align-items:center; justify-content:space-between; gap:10px; }.speed-footer > span { font-size:10px; color:#809173; }.speed-footer button { font-size:10px; }.notice { font-size:11px; color:#c7dfa4; margin:9px 0 0; }
	@media(max-width:600px) { .speed-panel { padding:16px; }.result-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }.navigation-heading { flex-direction:column; gap:3px; } }
	@media(max-width:380px) { .test-controls { flex-direction:column; align-items:stretch; }.scope { display:none; }.page-grid { grid-template-columns:1fr; }.page-grid > div { flex-direction:row; justify-content:space-between; align-items:center; } }
</style>
