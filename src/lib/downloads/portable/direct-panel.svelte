<script>
	import appCatalog from '$lib/a/a.json';
	import { normalizeWebUrl } from '$lib/utils/web-url.js';
	import { loadCatalog } from '$lib/books/catalog';
	import { loadSetting, saveSetting } from '$lib/utils/localspace.js';
	import { onMount } from 'svelte';

	let { url, appOrigin } = $props();
	const route = $derived(new URL(url, appOrigin).pathname);
	const isBrowser = $derived(route === '/slate');
	const isApps = $derived(route === '/apps');
	const isGames = $derived(route === '/books');
	const isSettings = $derived(route === '/settings');
	const title = $derived(isApps ? 'Apps' : isGames ? 'Games' : 'Browser');
	const initialQuery = new URL(url, appOrigin).searchParams.get('q') || '';
	let query = $state(initialQuery);
	let search = $state('');
	let opened = $state('');
	let selectedName = $state('');
	let history = $state([]);
	let historyIndex = $state(-1);
	let frame;
	let games = $state([]);
	let engine = $state('sj2');
	let transport = $state('libcurl');

	onMount(() => {
		if (isGames) void loadCatalog().then((items) => { games = items; });
		if (isBrowser && initialQuery) navigate(initialQuery);
		void Promise.all([loadSetting('lethe', 'sj2'), loadSetting('car', 'libcurl')]).then(([savedEngine, savedTransport]) => {
			engine = savedEngine;
			transport = savedTransport;
		});
	});

	function proxyUrl(target) {
		return new URL(`/api?${new URLSearchParams({ url: target, type: engine, transport })}`, appOrigin).href;
	}

	function targetUrl(raw) {
		const value = raw.trim();
		if (!value) return '';
		return normalizeWebUrl(value) || `https://www.google.com/search?${new URLSearchParams({ q: value })}`;
	}

	function navigate(raw) {
		const target = targetUrl(raw);
		if (!target) return;
		query = target;
		opened = proxyUrl(target);
		history = [...history.slice(0, historyIndex + 1), target];
		historyIndex = history.length - 1;
	}

	function step(direction) {
		const next = historyIndex + direction;
		if (next < 0 || next >= history.length) return;
		historyIndex = next;
		query = history[next];
		opened = proxyUrl(query);
	}

	function openApp(app) {
		selectedName = app.name;
		if (app.type === 'local' || app.url.startsWith('/')) {
			opened = new URL(app.url, appOrigin).href;
		} else if (app.type === 'direct') {
			opened = app.url;
		} else {
			opened = proxyUrl(app.url);
		}
	}

	function openGame(game) {
		selectedName = game.name;
		opened = game.url;
	}

	const filteredApps = $derived(appCatalog.filter((app) =>
		`${app.name} ${app.genre}`.toLowerCase().includes(search.trim().toLowerCase())));
	const filteredGames = $derived(games.filter((game) =>
		`${game.name} ${game.tags.join(' ')}`.toLowerCase().includes(search.trim().toLowerCase())));
</script>

<div class="direct-panel">
	{#if isSettings}
		<div class="direct-settings">
			<h2>Settings</h2>
			<p>Connection preferences for the Browser and Apps in this file.</p>
			<label>Proxy engine
				<select bind:value={engine} onchange={() => saveSetting('lethe', engine)}>
					<option value="sj2">Velora SJ2</option><option value="sj">SJ1</option><option value="uv">Ultraviolet</option>
				</select>
			</label>
			<label>Transport
				<select bind:value={transport} onchange={() => saveSetting('car', transport)}>
					<option value="libcurl">Velora Libcurl</option><option value="libcurl-original">Libcurl</option><option value="epoxy">Epoxy</option>
				</select>
			</label>
		</div>
	{:else}
	{#if isBrowser}
		<div class="direct-toolbar">
			<button aria-label="Back" disabled={historyIndex < 1} onclick={() => step(-1)}>←</button>
			<button aria-label="Forward" disabled={historyIndex >= history.length - 1} onclick={() => step(1)}>→</button>
			<button aria-label="Reload" disabled={!opened} onclick={() => { if (frame) frame.src = opened; }}>↻</button>
			<form onsubmit={(event) => { event.preventDefault(); navigate(query); }}>
				<input aria-label="Search or enter address" placeholder="Search or enter an address" bind:value={query} />
			</form>
			<button aria-label="New page" onclick={() => { opened = ''; query = ''; }}>＋</button>
		</div>
	{:else if !opened}
		<div class="direct-library-heading">
			<h2>{title}</h2>
			<input aria-label={`Search ${title.toLowerCase()}`} placeholder={`Search ${title.toLowerCase()}`} bind:value={search} />
		</div>
	{/if}
	{#if !isBrowser && opened}
		<div class="direct-toolbar">
			<button onclick={() => { opened = ''; selectedName = ''; }} aria-label={`Back to ${title}`}>←</button>
			<strong>{selectedName}</strong>
			<button onclick={() => { if (frame) frame.src = opened; }} aria-label="Reload">↻</button>
		</div>
	{/if}
	{#if opened}
		<iframe bind:this={frame} src={opened} title={selectedName || query} allow="autoplay; fullscreen; gamepad; clipboard-read; clipboard-write" allowfullscreen></iframe>
	{:else if isBrowser}
		<div class="direct-home">
			<div class="direct-mark">V.</div>
			<h2>Where to?</h2>
			<p>Search or enter a website in the address bar.</p>
		</div>
	{:else if isApps}
		<div class="direct-grid">
			{#each filteredApps as app}
				<button onclick={() => openApp(app)} title={app.name}>
					<img src={new URL(`/img/${app.image}`, appOrigin).href} alt="" loading="lazy" />
					<span>{app.name}</span>
				</button>
			{/each}
		</div>
	{:else if isGames}
		<div class="direct-grid">
			{#each filteredGames as game}
				<button onclick={() => openGame(game)} title={game.name}>
					{#if game.thumb}<img src={game.thumb} alt="" loading="lazy" />{/if}
					<span>{game.name}</span>
				</button>
			{/each}
		</div>
	{/if}
	{/if}
</div>

<style>
	.direct-panel { display:flex; flex:1; flex-direction:column; width:100%; height:100%; min-height:0; background:#171d19; color:#ecf2e6; font:14px system-ui; }
	.direct-toolbar { display:flex; align-items:center; gap:8px; padding:10px 12px; background:#1d251f; border-bottom:1px solid #ffffff19; flex:0 0 auto; }
	.direct-toolbar form { flex:1; min-width:0; }
	.direct-toolbar input, .direct-library-heading input { width:100%; box-sizing:border-box; padding:9px 13px; border:1px solid #ffffff26; border-radius:11px; background:#101611; color:inherit; font:inherit; outline:none; }
	.direct-toolbar input:focus, .direct-library-heading input:focus { border-color:#b4d197; }
	.direct-toolbar button { border:0; border-radius:8px; background:#ffffff13; color:inherit; font:20px system-ui; min-width:36px; height:36px; cursor:pointer; }
	.direct-toolbar button:disabled { opacity:.35; cursor:default; }
	.direct-toolbar strong { flex:1; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
	.direct-library-heading { display:flex; align-items:center; gap:20px; padding:18px 22px; }
	.direct-library-heading h2 { margin:0; font-size:24px; flex:1; }
	.direct-library-heading input { max-width:340px; }
	.direct-grid { overflow:auto; flex:1; padding:4px 22px 24px; display:grid; grid-template-columns:repeat(auto-fill,minmax(120px,1fr)); align-content:start; gap:13px; }
	.direct-grid button { border:1px solid #ffffff1e; border-radius:14px; background:#202a22; color:inherit; min-height:133px; padding:10px; display:flex; flex-direction:column; gap:8px; align-items:center; justify-content:center; cursor:pointer; }
	.direct-grid button:hover { background:#2d3b30; }
	.direct-grid img { width:76px; height:76px; object-fit:cover; border-radius:11px; }
	.direct-grid span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:100%; }
	.direct-panel iframe { border:0; width:100%; height:100%; flex:1; min-height:0; background:#101511; }
	.direct-home { flex:1; display:flex; align-items:center; justify-content:center; flex-direction:column; text-align:center; color:#dbe8d0; }
	.direct-home h2 { margin:12px 0 0; font-size:28px; }
	.direct-home p { opacity:.7; }
	.direct-mark { font:italic bold 54px Georgia,serif; color:#cde9ac; }
	.direct-settings { padding:28px; overflow:auto; }
	.direct-settings h2 { margin:0 0 8px; font-size:24px; }
	.direct-settings p { color:#a8b7a7; margin:0 0 28px; }
	.direct-settings label { display:flex; flex-direction:column; gap:9px; max-width:420px; margin:0 0 18px; font-weight:600; }
	.direct-settings select { background:#202a22; border:1px solid #ffffff26; border-radius:9px; padding:11px 12px; color:inherit; font:inherit; }
</style>
