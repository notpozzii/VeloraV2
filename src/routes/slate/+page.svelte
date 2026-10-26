<script>
	import '$lib/style/browser.css';
	import Tab from '$lib/utils/browser/tab.svelte';
	import Iframe from '$lib/utils/browser/iframe.svelte';
	import Home from '$lib/utils/browser/home.svelte';
	import Icon from '$lib/utils/browser/icon.svelte';
	import veloraLogo from '$lib/assets/velora.svg';
	import { toggleElementFullscreen } from '$lib/utils/browser/fullscreen.js';
	import { getGeForceLauncherUrl } from '$lib/utils/browser/geforce.js';
	let fullscreenError = $state('');
	import Modal from '$lib/utils/browser/modal.svelte';
	import { loadSetting, saveSetting } from '$lib/utils/localspace.js';
	import {
		deleteTab,
		activeTab,
		reloadSignal,
		goBackSignal,
		goForwardSignal,
		slotsDragged,
		draggedOverLeft,
		draggedOverRight,
		isTabDragging
	} from '$lib/stores/index.js';
	import { onMount, onDestroy, tick } from 'svelte';
	import { loadScript } from '$lib/lethe/loader';
	import { search } from '$lib/lethe/search';
	import { createProxyRuntime } from '$lib/lethe/runtime.js';
	import { createTabFrames } from '$lib/lethe/tab-frames.js';
	import { createBrowserSearchBridge } from '$lib/utils/browser/desktop-search-bridge.js';
	import { subscribeSettings } from '$lib/utils/settingsSync.js';
	let tabs = $state([]);
	let frames = $state([]);
	let query = $state('');
	/** @type {HTMLInputElement | undefined} */
	let inputEl = $state();
	let tabCounter = 0;
	let inputFocused = $state(false);
	let hydrated = $state(false);
	let letheEngine = $state('sj2');
	let ready = $state(false);
	const runtime = createProxyRuntime({ interceptPopups: true });
	const tabFrames = createTabFrames(async () => (await prepareBrowserEngine('sj2')).controller);
	onDestroy(() => tabFrames.clear());
	let customWisp = $state('');
	let searchEngine = $state('google');
	let car = $state('libcurl');
	let bookmarks = $state([]);
	let releaseSettings;
	const settingsReady = new Promise((resolve) => { releaseSettings = resolve; });
	let startupError;
	let previewMode = false;
	async function prepareBrowserEngine(engine) {
		await settingsReady;
		if (browserDestroyed) throw new DOMException('Browser closed', 'AbortError');
		if (startupError) throw startupError;
		if (previewMode) throw new Error('Open the browser from your desktop to browse.');
		return runtime.prepare(engine ?? letheEngine, car, customWisp || undefined);
	}
	let activeFrame = $derived(frames.find((frame) => frame.id === $activeTab));
	let draggedTab = null;
	let tabID = null;
	let LastPopupIntState = $state(true);
	let desktopSearchBridge;
	let browserDestroyed = false;
	onDestroy(() => { browserDestroyed = true; });

	$effect(() => {
		if ($deleteTab) {
			tabFrames.release($deleteTab);
			tabs = tabs.filter((tab) => tab.id !== $deleteTab);
			frames = frames.filter((frame) => frame.id !== $deleteTab);
			if ($deleteTab == $activeTab && tabs.length > 0) {
				const lastTab = tabs[tabs.length - 1];
				$activeTab = lastTab.id;
				$deleteTab = null;
			} else {
				$deleteTab = null;
			}
		}
		if ($activeTab) {
			tabID = $activeTab;
		}
	});

	function addTab() {
		// @ts-ignore
		tabID = Math.max(Date.now(), Number(tabID || 0) + 1);
		// @ts-ignore
		$activeTab = tabID;
		const newTab = {
			id: tabID
		};
		const newFrame = {
			id: tabID,
			url: null,
			displayUrl: '',
			title: 'New Tab'
		};
		let updatedTabs = [];
		let updatedFrames = [];
		for (let i = 0; i < tabs.length; i++) {
			let existingTab = tabs[i];
			let existingFrame = frames[i];
			updatedFrames.push(existingFrame);
			updatedTabs.push(existingTab);
		}
		updatedTabs.push(newTab);
		updatedFrames.push(newFrame);
		tabs = updatedTabs;
		frames = updatedFrames;
		tabCounter++;
	}
	onMount(async () => {
		try {
			LastPopupIntState = popupInterceptor;
			addTab();

			// hydrate saved settings
			const [lethe, savedCar, wisp, engine, marks, intercept, LastPopupIntStateX] = await Promise.all(
				[
					loadSetting('lethe', 'sj2'),
					loadSetting('car', 'libcurl'),
					loadSetting('customWisp', ''),
					loadSetting('searchEngine', 'google'),
					loadSetting('bookmarks', [], JSON.parse),
					loadSetting('popupInterceptor', true, (raw) => raw === 'true'),
					loadSetting('LastPopupIntState', true)
				]
			);
			if (browserDestroyed) return;
			letheEngine = lethe;
			car = savedCar;
			customWisp = wisp;
			searchEngine = engine;
			bookmarks = marks;
			LastPopupIntState = LastPopupIntStateX;
			popupInterceptor = LastPopupIntState; //intercept
			hydrated = true;

			// Rendered inside the settings theme preview: show the chrome, skip the proxy stack
			// so opening /settings doesn't load the transports or open a wisp connection.
			if (new URLSearchParams(location.search).has('preview')) {
				previewMode = true;
				ready = true;
				return;
			}

			// Accept navigation immediately; share engine warmup with the first click.
			ready = true;
			releaseSettings();
			void prepareBrowserEngine().catch(() => {});
			desktopSearchBridge?.setReady();
		} catch (error) {
			startupError = error;
			await reportDesktopSearchError(error, {
				query: new URLSearchParams(location.search).get('q') || ''
			});
		} finally {
			releaseSettings();
		}
	});

	onMount(() => {
		desktopSearchBridge = createBrowserSearchBridge({
			host: window,
			async onSearch({ query: nextQuery, newTab }, signal) {
				if (signal.aborted) return;
				if (newTab || !activeFrame) addTab();
				await tick();
				if (!signal.aborted) await navigateTo(nextQuery, { signal });
			},
			onError: reportDesktopSearchError
		});
		desktopSearchBridge.enqueueInitialQuery(new URLSearchParams(location.search).get('q'));
		if (ready) desktopSearchBridge.setReady();
		return () => desktopSearchBridge.destroy();
	});

	onMount(() =>
		subscribeSettings((key, value) => {
			if (key === 'lethe') letheEngine = value;
			else if (key === 'car') car = value;
			else if (key === 'customWisp') customWisp = value;
			else if (key === 'searchEngine') searchEngine = value;
		})
	);

	function prismEncode(fixedUrl, sjFrame) {
		// @ts-ignore
		return window.$scramjet.rewriteUrl(fixedUrl, sjFrame.context, {
			origin: new URL(location.href),
			base: new URL(location.href)
		});
	}

	async function navigateTo(rawQuery, { signal } = {}) {
		inputFocused = false;
		const target = activeFrame;
		if (!target || signal?.aborted) return;
		const navigation = (target.navigation || 0) + 1;
		target.navigation = navigation;
		target.preparing = true;
		try {
			const session = await prepareBrowserEngine();
			if (signal?.aborted || !target) {
				return;
			}
			const fixedUrl = search(rawQuery, searchEngine);
			let encoded;
			if (session.engine === 'sj2') {
				const sjFrame = await tabFrames.get(target.id);
				encoded = prismEncode(fixedUrl, sjFrame);
			} else if (session.engine === 'uv') {
				// @ts-ignore
				encoded = window.__uv$config.prefix + window.__uv$config.encodeUrl(fixedUrl);
			} else {
				encoded = session.polygon.encodeUrl(fixedUrl);
			}
			if (signal?.aborted || !frames.includes(target) || target.navigation !== navigation) return;
			target.url = encoded;
			if (rawQuery.includes('discord')) {
				LastPopupIntState = popupInterceptor;
				popupInterceptor = false;
			}
			if (!rawQuery.includes('discord')) {
				popupInterceptor = LastPopupIntState;
			}
		} finally {
			if (target.navigation === navigation) target.preparing = false;
		}
	}

	let lastOpenedUrl = '';
	let lastOpenedTime = 0;
	async function openInNewTab(targetUrl) {
		if (!targetUrl || !popupInterceptor) {
			return;
		}
		const currentTime = Date.now();
		const timeSinceLastOpen = currentTime - lastOpenedTime;
		const isSameUrl = targetUrl === lastOpenedUrl;
		if (isSameUrl && timeSinceLastOpen < 800) {
			return;
		}
		lastOpenedUrl = targetUrl;
		lastOpenedTime = currentTime;
		addTab();
		await tick();
		navigateTo(targetUrl);
	}

	async function handleSubmit(e) {
		e.preventDefault();
		navigateTo(query);
		inputEl?.blur();
	}
	let bookmarkMenu = $state(false);
	let activeFrameURL = $state();
	let activeFrameTitle = $state();
	let activeFrameEngine = $state();

	function startBookmark() {
		settingsOpen = false;
		activeFrameURL = activeFrame.displayUrl;
		activeFrameTitle = activeFrame.title;
		activeFrameEngine = letheEngine;
		bookmarkMenu = true;
	}
	function toggleBookmarks() {
		bookmarkMenu = !bookmarkMenu;
	}
	function addBookmark() {
		if (!activeFrame?.displayUrl) return;
		bookmarks.push({ url: activeFrameURL, title: activeFrameTitle, lethe: activeFrameEngine });
		bookmarkMenu = false;
	}
	function removeBookmark(index) {
		bookmarks.splice(index, 1);
	}
	async function bookmarkSearch(url, lethe) {
		const session = await prepareBrowserEngine(lethe);
		const target = activeFrame;
		if (!target) return;
		let encoded;
		if (lethe === 'sj2') {
			const sjFrame = await tabFrames.get(target.id);
			encoded = prismEncode(url, sjFrame);
		} else if (lethe === 'uv') {
			// @ts-ignore
			encoded = window.__uv$config.prefix + window.__uv$config.encodeUrl(url);
		} else {
			encoded = session.polygon.encodeUrl(url);
		}
		if (!frames.includes(target)) return;
		target.url = encoded;
		inputEl?.blur();
	}

	function handleNavigate(id, { url, title }) {
		const frame = frames.find((frame) => frame.id === id);
		if (!frame) {
			return;
		}
		frame.displayUrl = url;
		frame.title = title;
	}
	$effect(() => {
		let current = $state(activeFrame?.displayUrl ?? '');
		console.log('current frameURL is: ' + current);
		if (!inputFocused) {
			query = current;
		}
	});
	let activeIndex;
	$effect(() => {
		if ($isTabDragging) {
			activeIndex = tabs.findIndex((tab) => tab.id === $activeTab);
			if (activeIndex > activeIndex + $slotsDragged) {
				$draggedOverRight = tabs[activeIndex + $slotsDragged].id;
			} else if (activeIndex < activeIndex + $slotsDragged) {
				$draggedOverLeft = tabs[activeIndex + $slotsDragged].id;
			}
		}
	});

	function moveTab(id) {
		const from = tabs.findIndex((tab) => tab.id === id);
		console.log('moving from: ' + from);
		if (from === -1) return;
		const temp = tabs.splice(from, 1)[0];
		const newIndex = Math.max(0, Math.min(from + ($slotsDragged ?? 0), tabs.length));
		console.log('moving to:' + newIndex);
		``;
		tabs.splice(newIndex, 0, temp);
		$slotsDragged = null;
		$draggedOverLeft = null;
		$draggedOverRight = null;
	}
	$effect(() => {
		if (ready && !previewMode) {
			runtime.prepare(letheEngine, car, customWisp || undefined).catch((error) => console.error('Could not prepare browser:', error));
		}
	});
	function goBack() {
		$goBackSignal = $activeTab;
	}
	function goForward() {
		$goForwardSignal = $activeTab;
	}

	function reloadTab() {
		$reloadSignal = $activeTab;
	}

	let settingsOpen = $state(false);
	let extensionsOpen = $state(false);
	let popupInterceptor = $state(true); // hydrated from localspace in onMount
	function toggleSettings() {
		settingsOpen = !settingsOpen;
	}
	function closeSettings() {
		settingsOpen = false;
	}
	function toggleExtensions() {
		extensionsOpen = !extensionsOpen;
	}
	function togglePopupInterceptor() {
		popupInterceptor = !popupInterceptor;
	}
	function openInNewWindow() {
		if (!activeFrame || !activeFrame.url) {
			return;
		}
		window.open(activeFrame.url, '_blank', 'noopener');
		closeSettings();
	}

	async function openInspector() {
		closeSettings();
		try {
			await loadScript('https://cdn.jsdelivr.net/npm/eruda');
			window.eruda?.init();
			inputEl;
			window.eruda?.show();
		} catch (e) {
			console.error('Failed to load inspector:', e);
		}
	}

	async function toggleFullscreen() {
		fullscreenError = '';
		closeSettings();
		const target = document.querySelector('.webview-panel.active iframe');
		try {
			await toggleElementFullscreen(target);
		} catch (error) {
			fullscreenError = error instanceof Error ? error.message : 'Could not enter full screen.';
		}
	}

	$effect(() => {
		if (!hydrated) return;
		saveSetting('lethe', letheEngine);
		saveSetting('car', car);
		saveSetting('customWisp', customWisp);
		saveSetting('searchEngine', searchEngine);
		saveSetting('bookmarks', $state.snapshot(bookmarks));
		saveSetting('popupInterceptor', popupInterceptor);
		saveSetting('LastPopupIntState', LastPopupIntState);
	});

	// Presentation state only. Navigation and proxy controllers above remain shared.
	let toolbarInput;
	let toolbarQuery = $state('');
	let toolbarFocused = $state(false);
	let toolbarBusy = $state(false);
	$effect(() => {
		if (!toolbarFocused) toolbarQuery = activeFrame?.displayUrl || '';
	});
	async function submitToolbar(event) {
		event.preventDefault();
		if (!toolbarQuery.trim() || toolbarBusy) return;
		toolbarBusy = true;
		try {
			await openHomeShortcut(toolbarQuery.trim());
			toolbarInput?.blur();
		} finally {
			toolbarBusy = false;
		}
	}
	let paletteOpen = $state(false);
	let paletteBusy = $state(false);
	let paletteError = $state('');
	let bookmarkListOpen = $state(false);
	let uiMounted = false;

	async function reportDesktopSearchError(error, request, signal) {
		if (browserDestroyed || signal?.aborted) return;
		query = request.query;
		paletteError = error instanceof Error ? error.message : 'Could not open this page. Check your connection settings and try again.';
		paletteOpen = true;
		inputFocused = true;
		await tick();
		if (!browserDestroyed && !signal?.aborted) inputEl?.focus();
	}

	onMount(() => {
		uiMounted = true;
	});

	function closePalette() {
		paletteOpen = false;
		inputFocused = false;
	}

	async function openPalette(clear = false) {
		if (!uiMounted) return;
		settingsOpen = false;
		extensionsOpen = false;
		bookmarkListOpen = false;
		bookmarkMenu = false;
		inputFocused = true;
		query = clear ? '' : activeFrame?.displayUrl || '';
		paletteError = '';
		paletteOpen = true;
		await tick();
		inputEl?.focus();
		inputEl?.select();
	}

	async function submitPalette(event) {
		event.preventDefault();
		if (!query.trim() || paletteBusy) return;
		paletteBusy = true;
		const target = query.trim();
		paletteError = '';
		try {
			if (!activeFrame) {
				addTab();
				await tick();
			}
			await navigateTo(target);
			closePalette();
		} catch (error) {
			query = target;
			paletteError = error instanceof Error ? error.message : 'Could not open this page. Check your connection settings and try again.';
			inputFocused = true;
		} finally {
			paletteBusy = false;
		}
	}

	async function openHomeShortcut(url, { useAppLoader = false } = {}) {
		await settingsReady;
		if (browserDestroyed) return;
		if (!activeFrame) {
			addTab();
			await tick();
		}
		if (useAppLoader) {
			// Load the existing app launcher directly; it handles proxying after the user's click.
			activeFrame.url = getGeForceLauncherUrl(customWisp, url);
			activeFrame.displayUrl = url;
			activeFrame.title = 'GeForce NOW';
			return;
		}
		try {
			await navigateTo(url);
		} catch {
			await openPalette();
			query = url;
			paletteError = 'Could not open this page. Check your connection settings and try again.';
		}
	}

	function handleShortcut(event) {
		if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'l') {
			event.preventDefault();
			event.stopPropagation();
			toolbarInput?.focus();
			toolbarInput?.select();
		}
	}

	// Keyboard events do not bubble out of iframe documents. Bind only a UI shortcut
	// to accessible documents; leave iframe loading, routing and navigation untouched.
	function frameShortcuts(node) {
		const documents = new Map();
		function attach(frame) {
			if (!(frame instanceof HTMLIFrameElement)) return;
			documents.get(frame)?.removeEventListener('keydown', handleShortcut, true);
			documents.delete(frame);
			try {
				const doc = frame.contentDocument;
				if (doc) {
					doc.addEventListener('keydown', handleShortcut, true);
					documents.set(frame, doc);
				}
			} catch {
				/* Cross-origin documents retain the clickable URL control. */
			}
		}
		function loaded(event) {
			attach(event.target);
		}
		node.addEventListener('load', loaded, true);
		const observer = new MutationObserver(() => {
			for (const [frame, doc] of documents) {
				if (!node.contains(frame)) {
					doc.removeEventListener('keydown', handleShortcut, true);
					documents.delete(frame);
				}
			}
		});
		observer.observe(node, { childList: true, subtree: true });
		node.querySelectorAll('iframe').forEach(attach);
		return {
			destroy() {
				node.removeEventListener('load', loaded, true);
				observer.disconnect();
				for (const doc of documents.values())
					doc.removeEventListener('keydown', handleShortcut, true);
			}
		};
	}

</script>

<svelte:head><title>Velora — Browser</title></svelte:head>
<svelte:window onkeydown={handleShortcut} />

<div class="browser-shell">
	<header class="browser-chrome" aria-label="Browser controls">
		<div class="tab-row">
			<img class="browser-brand" src={veloraLogo} alt="Velora" />
			<div class="horizontal-tabs" id="browser-tabs" role="tablist" aria-label="Browser tabs" aria-orientation="horizontal">
				{#each tabs as tab (tab.id)}
					{@const frame = frames.find((frame) => frame.id === tab.id)}
					<Tab id={tab.id} title={frame?.title || 'New Tab'} displayUrl={frame?.displayUrl ?? ''} onDrop={moveTab} />
				{/each}
			</div>
			<button class="icon-button new-tab-button" onclick={addTab} aria-label="New tab" title="New tab"><Icon name="plus" size={18} /></button>
			<a class="desktop-return" href="/os" target="_top" aria-label="Back to desktop" title="Back to desktop"><Icon name="desktop" size={16} /><span>Back to desktop</span></a>
		</div>
		<div class="browser-toolbar">
			<nav class="navigation-controls" aria-label="Page navigation">
				<button class="icon-button" onclick={goBack} aria-label="Back" title="Back"><Icon name="back" /></button>
				<button class="icon-button" onclick={goForward} aria-label="Forward" title="Forward"><Icon name="forward" /></button>
				<button class="icon-button" onclick={reloadTab} aria-label="Reload" title="Reload"><Icon name="reload" size={17} /></button>
			</nav>
			<form class="address-bar" onsubmit={submitToolbar} aria-busy={toolbarBusy}>
				<Icon name={activeFrame?.url ? 'globe' : 'search'} size={16} />
				<input bind:this={toolbarInput} bind:value={toolbarQuery} aria-label="Address bar" placeholder="Search or enter a URL" autocomplete="off" spellcheck="false" onfocus={() => (toolbarFocused = true)} onblur={() => (toolbarFocused = false)} onkeydown={(event) => {
					if (event.key === 'Escape') { toolbarQuery = activeFrame?.displayUrl || ''; toolbarInput?.blur(); }
				}} />
				<button class="icon-button" type="button" onclick={startBookmark} disabled={!activeFrame?.displayUrl} aria-label="Bookmark this page" title="Bookmark this page"><Icon name="star" size={17} /></button>
			</form>
			<div class="toolbar-tools">
				<button class="icon-button" onclick={() => (bookmarkListOpen = true)} aria-label="Bookmarks" title="Bookmarks"><Icon name="bookmark" size={17} /></button>
				<a class="icon-button toolbar-games" href="/books" target="_blank" rel="noopener" aria-label="Games" title="Games"><Icon name="games" size={17} /></a>
				<button class="icon-button" onclick={toggleExtensions} aria-label="Extensions" aria-haspopup="dialog" title="Extensions"><Icon name="extensions" size={17} /></button>
				<button class="icon-button" onclick={toggleSettings} aria-label="Settings" aria-haspopup="dialog" title="Settings"><Icon name="settings" size={17} /></button>
				<button class="icon-button toolbar-fullscreen" onclick={toggleFullscreen} aria-label="Fullscreen" title="Fullscreen"><Icon name="fullscreen" size={17} /></button>
			</div>
		</div>
	</header>

	<main class="frameContainer" aria-label="Webpage" use:frameShortcuts>
		{#if fullscreenError}<div class="media-notice" role="alert">
				<span>{fullscreenError}</span><button
					onclick={() => {
						fullscreenError = '';
					}}
					aria-label="Dismiss fullscreen message">×</button
				>
			</div>{/if}
		{#each frames as frame (frame.id)}
			<div
				class="webview-panel"
				class:active={frame.id === $activeTab}
				hidden={frame.id !== $activeTab}
			>
				<Iframe
					id={frame.id}
					src={frame.url}
					onnavigate={(info) => handleNavigate(frame.id, info)}
					onnewtab={(url) => openInNewTab(url)}
					interceptEnabled={popupInterceptor}
				/>
				{#if frame.id === $activeTab && !frame.url && !frame.preparing}<Home
						{ready}
						onsearch={openHomeShortcut}
						onopen={openHomeShortcut}
					/>{/if}
			</div>
		{/each}
		{#if !tabs.length}<Home
				{ready}
				onsearch={openHomeShortcut}
				onopen={openHomeShortcut}
			/>{/if}
	</main>

	{#if paletteOpen}
		<Modal label="Search or enter a URL" onclose={closePalette} palette>
			<form class="palette-form" onsubmit={submitPalette}>
				<div class="palette-input-row">
					<Icon name="search" size={20} /><input
						bind:this={inputEl}
						bind:value={query}
						aria-label="Search or enter a URL"
						placeholder="Search or enter a URL"
						autocomplete="off"
						spellcheck="false"
						onfocus={() => (inputFocused = true)}
					/><button
						class="icon-button"
						type="button"
						aria-label="Close address bar"
						onclick={closePalette}><Icon name="close" size={16} /></button
					>
				</div>
				{#if paletteError}<p class="palette-error" role="alert">{paletteError}</p>{/if}
				<div class="palette-footer">
					<span>{ready ? 'Search the web or go to a page' : 'Starting browser…'}</span><button
						class="palette-go"
						type="submit"
						disabled={!query.trim() || paletteBusy}
						>{paletteBusy ? 'Opening…' : 'Go'}<Icon name="arrow" size={16} /></button
					>
				</div>
			</form>
		</Modal>
	{/if}

	{#if settingsOpen}
		<Modal label="Browser settings" onclose={closeSettings}>
			<div class="modal-heading">
				<h2>Browser settings</h2>
				<button class="icon-button" onclick={closeSettings} aria-label="Close settings"
					><Icon name="close" size={16} /></button
				>
			</div>
			<div class="settings-fields">
				<label
					>Proxy<select bind:value={letheEngine} disabled={!ready}
						><option value="sj2">SJ2</option><option value="sj">SJ</option><option value="uv"
							>UV</option
						></select
					></label
				>
				<label
					>Transport<select bind:value={car} disabled={!ready}
						><option value="libcurl">Lib</option><option value="epoxy">Epox</option></select
					></label
				>
				<label
					>Wisp server<input bind:value={customWisp} placeholder="Keep blank for default" /></label
				>
				<label
					>Search engine<select bind:value={searchEngine}
						><option value="ddg">DuckDuckGo</option><option value="brave">Brave</option><option
							value="google">Google</option
						></select
					></label
				>
			</div>
			<div class="modal-actions">
				<button
					onclick={() => {
						addTab();
						closeSettings();
					}}><Icon name="plus" size={16} />New tab</button
				>
				<button onclick={startBookmark} disabled={!activeFrame?.displayUrl}
					><Icon name="star" size={16} />Bookmark this page</button
				>
				<button onclick={openInNewWindow} disabled={!activeFrame?.url}
					><Icon name="arrow" size={16} />Open page in new window</button
				>
				<button onclick={toggleFullscreen}><Icon name="fullscreen" size={16} />Fullscreen</button>
				<button onclick={openInspector}><Icon name="globe" size={16} />Inspect element</button>
			</div>
			<div class="modal-links">
				<a href="/settings" target="_blank" rel="noopener">All settings ↗</a><a
					href="/apps"
					target="_blank"
					rel="noopener">Apps ↗</a
				><a href="/os" target="_blank" rel="noopener">Desktop ↗</a>
			</div>
		</Modal>
	{/if}

	{#if extensionsOpen}
		<Modal label="Extensions" onclose={() => (extensionsOpen = false)}>
			<div class="modal-heading">
				<h2>Extensions</h2>
				<button
					class="icon-button"
					onclick={() => (extensionsOpen = false)}
					aria-label="Close extensions"><Icon name="close" size={16} /></button
				>
			</div>
			<div class="extension-row">
				<div>
					<h3>Popup Interceptor</h3>
					<p>Open popup requests in Velora instead of the native browser.</p>
				</div>
				<button
					class="extension-toggle"
					class:on={popupInterceptor}
					role="switch"
					aria-checked={popupInterceptor}
					aria-label="Popup Interceptor"
					onclick={togglePopupInterceptor}><span></span></button
				>
			</div>
		</Modal>
	{/if}

	{#if bookmarkListOpen}
		<Modal label="Bookmarks" onclose={() => (bookmarkListOpen = false)}>
			<div class="modal-heading">
				<h2>Bookmarks</h2>
				<button
					class="icon-button"
					onclick={() => (bookmarkListOpen = false)}
					aria-label="Close bookmarks"><Icon name="close" size={16} /></button
				>
			</div>
			<div class="bookmark-list">
				{#each bookmarks as bm, i}
					<div class="bookmark-row">
						<button
							class="bookmark-open"
							disabled={!ready}
							onclick={async () => {
								if (!activeFrame) {
									addTab();
									await tick();
								}
								await bookmarkSearch(bm.url, bm.lethe);
								bookmarkListOpen = false;
							}}
							oncontextmenu={(event) => {
								event.preventDefault();
								removeBookmark(i);
							}}
							><Icon name="globe" size={16} /><span
								>{bm.title || bm.url}<small>{bm.url}</small></span
							></button
						><button
							class="icon-button"
							onclick={() => removeBookmark(i)}
							aria-label={`Remove ${bm.title || bm.url}`}><Icon name="close" size={14} /></button
						>
					</div>
				{:else}<p class="empty-note">Your saved pages will appear here.</p>{/each}
			</div>
			<button
				class="text-action"
				disabled={!activeFrame?.displayUrl}
				onclick={() => {
					bookmarkListOpen = false;
					startBookmark();
				}}><Icon name="plus" size={16} />Bookmark this page</button
			>
		</Modal>
	{/if}

	{#if bookmarkMenu}
		<Modal label="Add bookmark" onclose={toggleBookmarks}>
			<div class="modal-heading">
				<h2>Add bookmark</h2>
				<button class="icon-button" onclick={toggleBookmarks} aria-label="Close bookmark editor"
					><Icon name="close" size={16} /></button
				>
			</div>
			<form
				class="settings-fields"
				onsubmit={(event) => {
					event.preventDefault();
					addBookmark();
				}}
			>
				<label>Name<input bind:value={activeFrameTitle} /></label><label
					>URL<input bind:value={activeFrameURL} /></label
				><button class="save-button" type="submit">Done</button>
			</form>
		</Modal>
	{/if}
</div>
