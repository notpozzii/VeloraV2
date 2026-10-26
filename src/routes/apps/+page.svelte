<script>
	import apps from '$lib/a/a.json';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { createProxyRuntime } from '$lib/lethe/runtime.js';

	import pin from '$lib/img/icons/pin.png';
	import Icon from '$lib/utils/browser/icon.svelte';
	import '$lib/style/apps.css';
	const pinsKey = 'galaxy_appPins';
	const genreOrder = [
		'AI',
		'Shopping',
		'Streaming',
		'Cloud Gaming',
		'Development',
		'Social Media',
		'Design',
		'Other'
	];

	let query = $state('');
	let activeGenres = $state([]);
	let pins = $state(loadPins());
	let openingApp = $state(false);
	let launchId = 0;
	let loadError = $state('');
	let iframeEl;
	const runtime = createProxyRuntime();
	let car = $state('libcurl');
	let prismController;
	let prismFrame;

	let frameDisplay = $state('none');
	let location = '/img/';
	let overflow = $state(false);

	const genres = $derived.by(() => {
		const usedGenres = new Set();
		for (const app of apps) {
			usedGenres.add(app.genre);
		}

		const ordered = genreOrder.filter((genre) => usedGenres.has(genre));

		const extras = Array.from(usedGenres)
			.filter((genre) => !genreOrder.includes(genre))
			.sort();

		return ordered.concat(extras);
	});

	const filtered = $derived.by(() => {
		const queryText = query.trim().toLowerCase();
		return apps.filter((app) => {
			const noQuery = queryText === '';
			const nameMatches = app.name.toLowerCase().includes(queryText);
			const genreMatches = app.genre.toLowerCase().includes(queryText);
			const matchesQuery = noQuery || nameMatches || genreMatches;

			const matchesGenre = activeGenres.length === 0 || activeGenres.includes(app.genre);

			return matchesQuery && matchesGenre;
		});
	});

	const pinnedApps = $derived(filtered.filter((app) => pins.includes(app.name)));

	function toggleGenre(genre) {
		if (activeGenres.includes(genre)) {
			activeGenres = activeGenres.filter((activeGenre) => activeGenre !== genre);
		} else {
			activeGenres = activeGenres.concat([genre]);
		}
	}

	function loadPins() {
		if (!browser) return [];
		try {
			let stored = localStorage.getItem(pinsKey);
			if (!stored) {
				stored = '[]';
			}
			const parsed = JSON.parse(stored);

			if (Array.isArray(parsed)) {
				return parsed;
			}
			return [];
		} catch {
			return [];
		}
	}

	function isPinned(name) {
		return pins.includes(name);
	}

	function togglePin(name) {
		if (pins.includes(name)) {
			pins = pins.filter((pinnedName) => pinnedName !== name);
		} else {
			pins = pins.concat([name]);
		}

		if (browser) {
			try {
				localStorage.setItem(pinsKey, JSON.stringify(pins));
			} catch {}
		}
	}

	$effect(() => {
		document.body.style.overflow = overflow ? 'hidden' : 'auto';
	});

	onMount(() => {
		// Warm the default engine without blocking app selection.
		void runtime.prepare('sj2', car).catch(() => {});
	});

	function closeFrame() {
		launchId++;
		openingApp = false;
		frameDisplay = 'none';
		overflow = false;
		iframeEl.src = '';
	}
	async function handleSubmit(url, type) {
		if (openingApp) return;
		const request = ++launchId;
		loadError = '';
		openingApp = true;
		frameDisplay = 'block';
		overflow = true;
		try {
			const session = await runtime.prepare(type, car);
			if (request !== launchId) return;
			if (session.engine === 'uv') {
				iframeEl.src = window.__uv$config.prefix + window.__uv$config.encodeUrl(url);
			} else if (session.engine === 'sj') {
				iframeEl.src = session.polygon.encodeUrl(url);
			} else {
				prismController = session.controller;
				if (!prismFrame) prismFrame = prismController.createFrame(iframeEl);
				prismFrame.go(url);
			}
		} catch (error) {
			if (request === launchId)
				loadError = error instanceof Error ? error.message : 'Could not open this app.';
		} finally {
			if (request === launchId) openingApp = false;
		}
	}
</script>

{#if openingApp}
	<div class="app-opening" role="status">Opening app…</div>
{/if}

{#if loadError}
	<div
		role="alert"
		style="position:fixed;inset:16px 16px auto;z-index:10000;padding:16px;border-radius:8px;background:#242526;color:#eee;font:14px system-ui"
	>
		{loadError}
	</div>
{/if}

<button
	class="library-back"
	title="Go Back"
	style="top: {overflow ? '10px' : '-80px'}"
	onclick={closeFrame}
>
	<Icon name="back" size={15} /> Back to apps
</button>
<iframe
	class="library-frame"
	allow="fullscreen; autoplay; picture-in-picture"
	allowfullscreen
	bind:this={iframeEl}
	title=""
	style="display: {frameDisplay};"
></iframe>

{#snippet appCard(app)}
	<div class="appDiv">
		<button
			class="pinBtn"
			class:pinned={isPinned(app.name)}
			title={isPinned(app.name) ? 'Unpin' : 'Pin'}
			onclick={(e) => {
				e.stopPropagation();
				togglePin(app.name);
			}}
		>
			<img src={pin} alt="" class="pinIcon" />
		</button>
		<button
			class="appLaunch"
			onclick={() => handleSubmit(app.url, app.type)}
			aria-label={`Open ${app.name}`}
		>
			<img src={location + app.image} alt="" class="appImg" loading="lazy" />
			<span class="appMeta">
				<span class="appMetaText">
					<span class="appName">{app.name}</span>
					<span class="appGenre">{app.genre}</span>
				</span>
				<span class="appArrow"><Icon name="arrow" size={15} /></span>
			</span>
		</button>
	</div>
{/snippet}

<div class="library-page">
	<header class="library-header">
		<div>
			<h1 class="library-title">Apps</h1>
		</div>
		<span class="library-count">{apps.length} apps</span>
	</header>
	<div class="search">
		<Icon name="search" size={16} />
		<input
			type="text"
			placeholder="Search apps"
			aria-label="Search apps"
			bind:value={query}
			autocomplete="off"
		/>
	</div>

	<div class="filters">
		<button
			class="pill"
			class:active={activeGenres.length === 0}
			onclick={() => (activeGenres = [])}
		>
			All
		</button>
		{#each genres as g (g)}
			<button class="pill" class:active={activeGenres.includes(g)} onclick={() => toggleGenre(g)}>
				{g}
			</button>
		{/each}
	</div>

	{#if pinnedApps.length > 0}
		<div class="sectionHeader">Pinned apps <span>{pinnedApps.length} pinned</span></div>
		<div class="container">
			{#each pinnedApps as app (app.name)}
				{@render appCard(app)}
			{/each}
		</div>
	{/if}

	<div class="sectionHeader">
		{activeGenres.length ? 'Filtered apps' : 'All apps'} <span>{filtered.length} apps</span>
	</div>

	{#if filtered.length === 0}
		<p class="empty">No apps match your search.</p>
	{:else}
		<div class="container">
			{#each filtered as app (app.name)}
				{@render appCard(app)}
			{/each}
		</div>
	{/if}
</div>

<style>
	:global(body) {
		background: #20221f;
	}
	.app-opening {
		position: fixed;
		inset: 0;
		display: grid;
		place-items: center;
		z-index: 999;
		pointer-events: none;
		color: #eeeae1;
		background: #20221f;
		font: 14px var(--zen-font);
	}
</style>
