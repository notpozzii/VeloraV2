<script>
	import appCatalog from '$lib/a/a.json';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { createProxyRuntime } from '$lib/lethe/runtime.js';
	import { prepareProxyFrame, resetProxyFrame } from '$lib/lethe/prepare-frame.js';
	import { isAutoConnection, autoLauncherUrl } from '$lib/lethe/auto.js';
	import { loadSetting } from '$lib/utils/localspace.js';
	import { subscribeSettings } from '$lib/utils/settingsSync.js';

	import Shell from '$lib/utils/library/shell.svelte';
	import Icon from '$lib/utils/browser/icon.svelte';
	import { mediaPermissions } from '$lib/utils/browser/media-permissions.js';

	const displayNames = {
		Discor: 'Discord',
		'Cool Math G': 'Coolmath Games',
		'Crazy G': 'CrazyGames',
		Github: 'GitHub'
	};
	const apps = appCatalog.map((app) => ({
		...app,
		displayName: displayNames[app.name] || app.name
	}));
	const pinsKey = 'galaxy_appPins';
	const genreOrder = [
		'Streaming',
		'Music',
		'Social Media',
		'Cloud Gaming',
		'Productivity',
		'Design',
		'Education',
		'Development',
		'Utilities',
		'Shopping',
		'AI',
		'Other'
	];

	let query = $state('');
	let activeGenre = $state('');
	let collection = $state('all');
	let sort = $state('az');
	let failedImages = $state([]);
	let pins = $state(loadPins());
	let openingApp = $state(false);
	let launchId = 0;
	let launchAbort;
	onDestroy(() => launchAbort?.abort());
	let loadError = $state('');
	let iframeEl;
	const runtime = createProxyRuntime();
	let car = $state('libcurl');
	let preferredEngine = 'sj2';
	let customWisp = '';
	let resolveSettings;
	const settingsReady = new Promise(resolve => { resolveSettings = resolve; });
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
		return apps
			.filter((app) => {
				const noQuery = queryText === '';
				const nameMatches = app.displayName.toLowerCase().includes(queryText);
				const genreMatches = app.genre.toLowerCase().includes(queryText);
				const matchesQuery = noQuery || nameMatches || genreMatches;

				const matchesGenre = !activeGenre || activeGenre === app.genre;

				return matchesQuery && matchesGenre && (collection !== 'saved' || pins.includes(app.name));
			})
			.sort((a, b) =>
				sort === 'za'
					? b.displayName.localeCompare(a.displayName)
					: a.displayName.localeCompare(b.displayName)
			);
	});

	const savedCount = $derived(apps.filter((app) => pins.includes(app.name)).length);
	const categories = $derived(
		genres.map((id) => ({ id, label: id, count: apps.filter((app) => app.genre === id).length }))
	);
	function hostname(url) {
		try {
			return new URL(url).hostname.replace(/^www\./, '');
		} catch {
			return '';
		}
	}
	function clearFilters() {
		query = '';
		activeGenre = '';
		collection = 'all';
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

	onMount(async () => {
		try {
			[preferredEngine, car, customWisp] = await Promise.all([
				loadSetting('lethe', 'sj2'), loadSetting('car', 'libcurl'), loadSetting('customWisp', '')
			]);
		} catch {} finally { resolveSettings(); }
		if (!isAutoConnection(preferredEngine, car)) void runtime.prepare(preferredEngine, car, customWisp || undefined).catch(() => {});
	});
	onMount(() => subscribeSettings((key, value) => {
		if (key === 'lethe') preferredEngine = value;
		else if (key === 'car') car = value;
		else if (key === 'customWisp') customWisp = value;
	}));

	function closeFrame() {
		launchId++;
		launchAbort?.abort();
		openingApp = false;
		loadError = '';
		frameDisplay = 'none';
		overflow = false;
		resetProxyFrame(iframeEl);
		iframeEl.src = 'about:blank';
	}
	async function handleSubmit(url, type) {
		if (openingApp) return;
		const request = ++launchId;
		launchAbort = new AbortController();
		loadError = '';
		openingApp = true;
		frameDisplay = 'block';
		overflow = true;
		try {
			await settingsReady;
			if (request !== launchId) return;
			const selectedEngine = preferredEngine === 'auto' ? 'auto' : type || preferredEngine;
			if (isAutoConnection(selectedEngine, car)) {
				await prepareProxyFrame(iframeEl, { signal: launchAbort.signal });
				if (request === launchId) iframeEl.src = autoLauncherUrl(url, selectedEngine, car, customWisp);
				return;
			}
			const session = await runtime.prepare(selectedEngine, car, customWisp || undefined);
			if (request !== launchId) return;
			await prepareProxyFrame(iframeEl, { signal: launchAbort.signal });
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

<svelte:head><title>Velora — Apps</title></svelte:head>
<Shell
	section="apps"
	count={apps.length}
	{savedCount}
	{categories}
	category={activeGenre}
	{collection}
	oncategory={(value) => (activeGenre = value)}
	oncollection={(value) => (collection = value)}
>
	<section aria-labelledby="apps-heading">
		<div class="collection-section-heading collection-results collection-browse-toolbar">
			<div>
				<h2 id="apps-heading">
					{collection === 'saved'
						? 'Pinned apps'
						: activeGenre || (query.trim() ? 'Search results' : 'All apps')}
				</h2>
				<span>{filtered.length} {filtered.length === 1 ? 'app' : 'apps'}</span>
			</div>
			<label class="collection-search"
				><Icon name="search" size={17} /><input
					aria-label="Search apps"
					placeholder="Search apps"
					bind:value={query}
				/>{#if query}<button aria-label="Clear search" onclick={() => (query = '')}
						><Icon name="close" size={15} /></button
					>{/if}</label
			>
			<label class="collection-sort"
				>Sort<select aria-label="Sort apps" bind:value={sort}
					><option value="az">Name A–Z</option><option value="za">Name Z–A</option></select
				></label
			>
		</div>
		{#if !filtered.length}<div class="collection-empty">
				<Icon name={collection === 'saved' ? 'bookmark' : 'search'} size={32} />
				<h3>
					{collection === 'saved' && !query && !activeGenre
						? 'No pinned apps yet'
						: 'No matching apps'}
				</h3>
				<p>
					{collection === 'saved' && !query && !activeGenre
						? 'Use the bookmark on an app to pin it here.'
						: 'Try a different search or category.'}
				</p>
				{#if query || activeGenre}<button class="secondary-action" onclick={clearFilters}
						>Clear filters</button
					>{/if}
			</div>
		{:else}<div class="apps-grid">
				{#each filtered as app (app.name)}
					<article class="app-card">
						<button
							class="app-card-open"
							onclick={() => handleSubmit(app.url, app.type)}
							aria-label={`Open ${app.displayName}`}
							><span class="app-tile" class:missing-icon={failedImages.includes(app.image)}
								>{#if failedImages.includes(app.image)}{app.name
										.slice(0, 2)
										.toUpperCase()}{:else}<img
										src={location + app.image}
										alt=""
										loading="lazy"
										decoding="async"
										onerror={() => (failedImages = [...failedImages, app.image])}
									/>{/if}</span
							><span class="app-details"
								><strong>{app.displayName}</strong><span>{hostname(app.url)}</span></span
							><span class="app-open-arrow"><Icon name="arrow" size={17} /></span></button
						>
						<div class="app-card-footer">
							<span>{app.genre}</span><button
								class="app-save"
								class:is-saved={isPinned(app.name)}
								aria-pressed={isPinned(app.name)}
								aria-label={`${isPinned(app.name) ? 'Unpin' : 'Pin'} ${app.displayName}`}
								onclick={() => togglePin(app.name)}
								><Icon name="bookmark" size={15} /><span
									>{isPinned(app.name) ? 'Pinned' : 'Pin'}</span
								></button
							>
						</div>
					</article>
				{/each}
			</div>{/if}
	</section>
</Shell>
{#if overflow}
	<button class="app-return" onclick={closeFrame} aria-label="Back to apps" title="Back to apps"
		><Icon name="back" size={19} /></button
	>
{/if}
<iframe
	class="library-frame"
	allow={mediaPermissions}
	allowfullscreen
	bind:this={iframeEl}
	title="App content"
	style:display={frameDisplay}
></iframe>
{#if loadError}<div class="app-launch-error" role="alert">
		<span>{loadError}</span><button onclick={closeFrame}>Back to apps</button>
	</div>{/if}
