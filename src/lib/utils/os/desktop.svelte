<script>
	// @ts-nocheck
	import Window from '$lib/utils/window/window.svelte';
	import Notifications from '$lib/utils/notifications.svelte';
	import {
		windowList,
		minimizedSig,
		activeSignal,
		focusWindowTop,
		notif
	} from '$lib/stores/index.js';
	import '$lib/style/os.css';
	import { onMount } from 'svelte';
	import mainBG from '$lib/img/bg/highlands.jpg';
	import AppIcon from '$lib/utils/os/app-icon.svelte';
	import Wallpaper from '$lib/utils/os/wallpaper.svelte';
	import DesktopWidgets from '$lib/utils/os/desktop-widgets.svelte';
	import Icon from '$lib/utils/browser/icon.svelte';
	import { getGeForceLauncherUrl } from '$lib/utils/browser/geforce.js';
	import browser from '$lib/img/icons/earthWhite.png';
	import g from '$lib/img/icons/controller.png';
	import a from '$lib/img/icons/apps.png';
	import s from '$lib/img/icons/settings.png';
	import sp from '$lib/img/icons/nvidia.png';
	import { get } from 'svelte/store';
	import { applyStartupSettings } from '$lib/utils/cloak.js';
	import gsap from 'gsap';
	import { loadSetting, saveSetting, onSettingChange } from '$lib/utils/localspace.js';
	import faviconFetch from 'favicon-fetch';

	let activeButton = $state(null);
	let menuOpen = $state(false);
	let openMenuX = $state(0);
	let menuX = $state(0);
	let menuY = $state(0);
	let menuSender = $state(null);
	let previewOpen = $state(false);
	let previewApp = $state(null);
	let hoverTimeout = null;
	let timeString = $state('');
	let dateString = $state('');
	let clockFace = $state('');
	let clockPeriod = $state('');
	let shortcutModifier = $state('⌘');
	const appDetails = {
		1: 'Web browser',
		6: 'Cloud gaming',
		2: 'Game library',
		4: 'App library',
		7: 'Watch short videos',
		5: 'Settings'
	};
	const filteredApps = $derived(
		apps.filter((app) => app.name.toLowerCase().includes(launcherSearch.trim().toLowerCase()))
	);
	let bgURL = $state(mainBG);
	let bgFit = $state('cover');
	let wallpaperOpen = $state(false);
	let controlsOpen = $state(false);
	let widgetsVisible = $state(true);
	let wallpaperDim = $state(false);
	let desktopAccent = $state('sage');
	const accentOptions = [
		{ id: 'sage', label: 'Sage', color: '#d3e5b0' },
		{ id: 'ice', label: 'Ice', color: '#b1ddea' },
		{ id: 'iris', label: 'Iris', color: '#d0bdf3' }
	];
	let launcherOpen = $state(false);
	let launcherSearch = $state('');
	let launcherBusy = $state(false);
	let launcherError = $state('');
	const launcherQuery = $derived(launcherSearch.trim());
	const launcherIsUrl = $derived(
		/^(https?:\/\/|[a-z0-9.-]+\.[a-z]{2,}(?:[/:?#]|$))/i.test(launcherQuery) &&
			!/\s/.test(launcherQuery)
	);
	let customWisp = $state('');
	let fullscreen = $state(false);
	let hydrated = $state(false);
	let navSizeMulti = $state(24);
	let temp = 0;
	let accumY = 0;
	let dragging = $state(false);
	let windowComps = [];
	function startNavResize(e) {
		dragging = true;
		temp = navSizeMulti;
		accumY = 0;
		e.currentTarget.requestPointerLock();
		addEventListener('mousemove', dragStart);
		addEventListener('mouseup', dragStop);
		document.addEventListener('pointerlockchange', onPointerLockChange);
	}
	function dragStart(e) {
		accumY += e.movementY;
		navSizeMulti = Math.max(Math.min(temp - accumY * 0.2, 39), 8);
	}
	function dragStop(e) {
		removeEventListener('mousemove', dragStart);
		removeEventListener('mouseup', dragStop);
		document.removeEventListener('pointerlockchange', onPointerLockChange);
		if (document.pointerLockElement) document.exitPointerLock();
		dragging = false;
		callTaskbarHeight();
	}
	function onPointerLockChange() {
		if (!document.pointerLockElement) dragStop();
	}
	const baseApps = $derived([
		{
			id: 1,
			url: '/slate',
			name: 'Browser',
			icon: browser,
			height: '76%',
			width: '80%',
			center: true,
			top: 100,
			left: 60
		},
		{
			id: 6,
			url: getGeForceLauncherUrl(customWisp),
			name: 'GeForce NOW',
			icon: sp,
			height: '76%',
			width: '80%',
			center: true,
			top: 50,
			left: 210
		},
		{
			id: 2,
			url: '/books',
			name: 'Games',
			icon: g,
			height: '76%',
			width: '80%',
			center: true,
			top: 120,
			left: 110
		},
		{
			id: 4,
			url: '/apps',
			name: 'Apps',
			icon: a,
			height: '76%',
			width: '80%',
			center: true,
			top: 90,
			left: 160
		},
		{
			id: 7,
			url: `/api?${new URLSearchParams({
				url: 'https://www.tiktok.com/',
				type: 'prism',
				transport: 'libcurlRaw',
				...(customWisp ? { wisp: customWisp } : {})
			})}`,
			name: 'TikTok',
			icon: '/img/tiktok-dock.svg',
			height: '80%',
			width: '80%',
			top: 0,
			left: 0,
			center: true
		},
		{
			id: 5,
			url: '/settings',
			name: 'Settings',
			icon: s,
			height: '80%',
			width: '80%',
			top: 0,
			left: 0,
			center: true
		}
	]);
	let customApps = $state([]);
	const apps = $derived([...baseApps, ...customApps]);
	function conertToPixies(size, viewportLength) {
		const sizeAsText = String(size);
		const isPercentage = sizeAsText.endsWith('%');

		if (isPercentage) {
			const percent = parseFloat(sizeAsText);
			const fraction = percent / 100;
			return fraction * viewportLength;
		} else {
			return parseFloat(sizeAsText);
		}
	}

	function getCenteredPosition(width, height) {
		const windowWidthInPixels = conertToPixies(width, window.innerWidth);
		const windowHeightInPixels = conertToPixies(height, window.innerHeight);

		const leftoverWidth = window.innerWidth - windowWidthInPixels;
		const leftoverHeight = window.innerHeight - windowHeightInPixels;

		const centeredLeft = leftoverWidth / 2;
		const centeredTop = leftoverHeight / 2;

		return {
			left: centeredLeft,
			top: centeredTop
		};
	}

	function getAppConfig(appId) {
		for (const app of apps) {
			if (app.id === appId) {
				return app;
			}
		}
		return null;
	}

	$effect(() => {
		activeButton = $activeSignal;
		if (!hydrated) return;
		saveSetting('navbarsize', navSizeMulti);
	});
	onMount(() => {
		applyStartupSettings();
		shortcutModifier = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';
		const syncFullscreen = () => {
			fullscreen = !!document.fullscreenElement;
		};
		document.addEventListener('fullscreenchange', syncFullscreen);
		return () => {
			document.removeEventListener('fullscreenchange', syncFullscreen);
			clearTimeout(hoverTimeout);
			clearTimeout(closeTimeout);
			dragStop();
		};
	});

	function getAppWindows(appId) {
		const list = get(windowList);
		const matching = [];
		for (const win of list) {
			if (win.sender === appId || win.parentApp === appId) {
				matching.push(win);
			}
		}
		return matching;
	}

	function isAppActive(appId) {
		if (activeButton === appId) return true;
		const list = get(windowList);
		for (const win of list) {
			if (win.parentApp === appId && win.sender === activeButton) {
				return true;
			}
		}
		return false;
	}

	function getPreviewWindows() {
		const matching = [];
		for (const win of $windowList) {
			if (win.sender === previewApp || win.parentApp === previewApp) {
				matching.push(win);
			}
		}
		return matching;
	}

	function hasMinimizedWindow(appId) {
		for (const win of $windowList) {
			const belongsToApp = win.sender === appId || win.parentApp === appId;
			if (belongsToApp && win.minimized) {
				return true;
			}
		}
		return false;
	}
	function openWindow(url, name, height, width, top, left, appId) {
		if (localStorage.getItem('firstVisit') == 'false') {
		} else {
			localStorage.setItem('firstVisit', 'false');
			$notif = 'Right click an app to open new window!';
		}
		let appWindows = getAppWindows(appId);
		if (appWindows.length > 1) {
			previewApp = appId;
			previewOpen = true;
			return;
		}
		if (appWindows.length === 1) {
			minimizedSig.set(appWindows[0].sender);
			previewOpen = false;
			return;
		}

		activeSignal.set(appId);

		const appConfig = getAppConfig(appId);
		if (appConfig && appConfig.center) {
			const centeredPosition = getCenteredPosition(width, height);
			top = centeredPosition.top;
			left = centeredPosition.left;
		}

		const queryString = url.split('?')[1];
		if (queryString) {
			const params = new URLSearchParams(queryString);
			const notifMsg = params.get('notif');
			if (notifMsg) {
				$notif = notifMsg;
			}
		}
		windowList.update((list) => [
			...list,

			{
				url,
				name,
				height,
				width,
				top,
				left,
				id: `win-${Date.now()}`,
				sender: appId,
				parentApp: appId
			}
		]);
	}

	function openNewWindow(url, name, height, width, top, left, appId) {
		let uniqueSender = `${appId}-${Date.now()}`;
		let newName = String(name) + ' (' + getAppWindows(appId).length + ')';
		name = newName;
		activeSignal.set(uniqueSender);

		const appConfig = getAppConfig(appId);
		if (appConfig && appConfig.center) {
			const centeredPosition = getCenteredPosition(width, height);
			top = centeredPosition.top;
			left = centeredPosition.left;
		}

		windowList.update((list) => [
			...list,
			{
				url,
				name,
				height,
				width,
				top,
				left,
				id: `win-${Date.now()}`,
				sender: uniqueSender,
				parentApp: appId
			}
		]);
		closeMenu();
	}

	function focusWindow(sender) {
		focusWindowTop.set(sender);
		previewOpen = false;
	}
	let menuType = $state(null);
	function openMenu(e, type, appId, url, name, height, width, top, left) {
		e.preventDefault();
		e.stopPropagation();
		menuX = Math.min(e.clientX, window.innerWidth - 248);
		menuY = Math.min(e.clientY, window.innerHeight - 160);
		openMenuX = menuX;
		if (type == 'navBar') {
			menuType = 'nav';
			menuOpen = true;
		} else if (type == 'apps') {
			menuSender = { appId, url, name, height, width, top, left };
			menuType = 'app';
			hoverEnd();
			menuOpen = true;
		}
	}

	function closeMenu() {
		menuOpen = false;
		menuSender = null;
	}

	const proxies = [
		{ value: 'auto', label: 'Auto' },
		{ value: 'prism', label: 'SJ2' },
		{ value: 'polygon', label: 'SJ' },
		{ value: 'glass', label: 'UV' }
	];
	const transports = [
		{ value: 'auto', label: 'Auto' },
		{ value: 'libcurl', label: 'Libcurl' },
		{ value: 'epoxy', label: 'Epoxy' }
	];

	let addOpen = $state(false);
	let advancedOpen = $state(false);
	let addError = $state(null);
	let newName = $state('');
	let newUrl = $state('');
	let newIcon = $state('');
	let newProxy = $state('prism');
	let newTransport = $state('libcurl');
	let newWisp = $state('');
	let newNotif = $state('');

	function openAddApp() {
		closeMenu();
		addError = null;
		advancedOpen = false;
		newName = '';
		newUrl = '';
		newIcon = '';
		newProxy = 'prism';
		newTransport = 'libcurl';
		newWisp = '';
		newNotif = '';
		addOpen = true;
	}

	function closeAddApp() {
		addOpen = false;
	}

	function hostnameOf(url) {
		try {
			return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname;
		} catch {
			return null;
		}
	}
	function nextWindowPosition() {
		const step = customApps.length % 6;
		return { top: 60 + step * 24, left: 90 + step * 40 };
	}

	function addApp() {
		const url = newUrl.trim();
		const name = newName.trim();
		if (!url || !name) {
			addError = 'Name and URL are required';
			return;
		}

		const params = new URLSearchParams({ url, type: newProxy, transport: newTransport });
		if (newNotif.trim()) params.set('notif', newNotif.trim());
		if (newWisp.trim()) params.set('wisp', newWisp.trim());

		const host = hostnameOf(url);
		const { top, left } = nextWindowPosition();
		customApps.push({
			id: `custom-${Date.now()}`,
			url: `/api?${params.toString()}`,
			name,
			icon: newIcon.trim() || (host ? faviconFetch({ hostname: host }) : browser),
			height: '76%',
			width: '80%',
			center: true,
			top,
			left
		});
		saveSetting('customApps', $state.snapshot(customApps));
		addOpen = false;
	}

	function removeApp(appId) {
		customApps = customApps.filter((app) => app.id !== appId);
		saveSetting('customApps', $state.snapshot(customApps));
		closeMenu();
	}

	function isCustomApp(appId) {
		for (const app of customApps) {
			if (app.id === appId) return true;
		}
		return false;
	}

	function hoverStart(e, appId) {
		previewOpen = false;
		previewApp = null;
		e.preventDefault();
		e.stopPropagation();
		menuX = Math.max(12, Math.min(e.clientX - 80, window.innerWidth - 260));
		clearTimeout(hoverTimeout);
		clearTimeout(closeTimeout);
		hoverTimeout = setTimeout(() => {
			let appWindows = getAppWindows(appId);
			if (appWindows.length > 0) {
				previewApp = appId;
				previewOpen = true;
			}
		}, 400);
	}
	let closeTimeout = null;
	function hoverEnd() {
		clearTimeout(hoverTimeout);
		closeTimeout = setTimeout(() => {
			previewOpen = false;
			previewApp = null;
		}, 200);
	}
	function updateTime() {
		const now = new Date();
		timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		dateString = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
		clockFace = now
			.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
			.replace(/\s*[AP]M$/i, '');
		clockPeriod = now.getHours() >= 12 ? 'PM' : 'AM';
	}

	onMount(() => {
		let disposed = false;
		Promise.all([
			loadSetting('bg', mainBG),
			loadSetting('bgFit', 'cover'),
			loadSetting('navbarsize', 24),
			loadSetting('customApps', []),
			loadSetting('customWisp', ''),
			loadSetting('desktopWidgets', true),
			loadSetting('desktopDim', false),
			loadSetting('desktopAccent', 'sage')
		]).then(([background, fit, size, savedApps, wisp, widgets, dim, accent]) => {
			if (disposed) return;
			bgURL = background || mainBG;
			bgFit = fit === 'contain' ? 'contain' : 'cover';
			navSizeMulti = Math.max(8, Math.min(Number(size) || 24, 39));
			customApps = Array.isArray(savedApps) ? savedApps : [];
			customWisp = wisp || '';
			widgetsVisible = widgets !== false;
			wallpaperDim = dim === true;
			desktopAccent = accentOptions.some((option) => option.id === accent) ? accent : 'sage';
			hydrated = true;
		});
		updateTime();
		const interval = setInterval(updateTime, 1000);
		const subscriptions = [
			onSettingChange('bg', (value) => {
				bgURL = value || mainBG;
			}),
			onSettingChange('bgFit', (value) => {
				bgFit = value === 'contain' ? 'contain' : 'cover';
			}),
			onSettingChange('customApps', (value) => {
				customApps = value ?? [];
			}),
			onSettingChange('customWisp', (value) => {
				customWisp = value || '';
			})
		];
		return () => {
			disposed = true;
			clearInterval(interval);
			subscriptions.forEach((unsubscribe) => unsubscribe());
		};
	});

	function launchApp(app) {
		launcherOpen = false;
		controlsOpen = false;
		openWindow(app.url, app.name, app.height, app.width, app.top, app.left, app.id);
	}
	function toggleLauncher(event) {
		event?.stopPropagation();
		launcherSearch = '';
		launcherError = '';
		launcherOpen = !launcherOpen;
	}
	async function browseFromLauncher() {
		const value = launcherQuery;
		if (!value || !hydrated || launcherBusy) return;
		launcherBusy = true;
		launcherError = '';
		try {
			const browserApp = getAppConfig(1);
			const existing = getAppWindows(1).at(-1);
			let accepted = false;
			if (existing) {
				const index = $windowList.findIndex((entry) => entry.id === existing.id);
				accepted = (await windowComps[index]?.openBrowserSearch(value)) || false;
				if (accepted) focusWindow(existing.sender);
			}
			if (!accepted) {
				const url = `/slate?${new URLSearchParams({ q: value })}`;
				const open = existing ? openNewWindow : openWindow;
				open(
					url,
					browserApp.name,
					browserApp.height,
					browserApp.width,
					browserApp.top,
					browserApp.left,
					browserApp.id
				);
			}
			launcherOpen = false;
		} catch (error) {
			launcherError =
				error instanceof Error ? error.message : 'The browser could not open. Please try again.';
		} finally {
			launcherBusy = false;
		}
	}
	function submitLauncher(event) {
		if (event.key !== 'Enter' || event.isComposing) return;
		event.preventDefault();
		if (!launcherQuery || !hydrated || launcherBusy) return;
		if (filteredApps[0] && !event.metaKey && !event.ctrlKey) launchApp(filteredApps[0]);
		else void browseFromLauncher();
	}
	function runningCount(appId) {
		return $windowList.filter((win) => win.sender === appId || win.parentApp === appId).length;
	}
	async function toggleFullscreen() {
		try {
			if (document.fullscreenElement) await document.exitFullscreen();
			else await document.documentElement.requestFullscreen();
		} catch {
			$notif = 'Full screen is not available in this browser.';
		}
	}
	function personalize() {
		launcherOpen = false;
		controlsOpen = false;
		closeMenu();
		wallpaperOpen = true;
	}
	function toggleControls(event) {
		event.stopPropagation();
		controlsOpen = !controlsOpen;
		launcherOpen = false;
	}
	function chooseAccent(value) {
		desktopAccent = value;
		saveSetting('desktopAccent', value);
	}

	function callTaskbarHeight() {
		for (const comp of windowComps) {
			comp?.updateTaskbarHeight(navSizeMulti);
		}
	}
	function openChangelogs() {
		const existing = getAppWindows('about-velora')[0];
		if (existing) {
			focusWindow(existing.sender);
			return;
		}
		openWindow('/changelog', 'About Velora', '65%', '600px', 70, 80, 'about-velora');
	}
</script>

<svelte:head><title>Velora — Desktop</title></svelte:head>
<svelte:window
	onclick={() => {
		closeMenu();
		launcherOpen = false;
	}}
	onkeydown={(e) => {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			toggleLauncher(e);
		}
		if (e.key === 'Escape') {
			controlsOpen = false;
			closeAddApp();
			closeMenu();
			launcherOpen = false;
		}
	}}
/>

<div class="velora-desktop" class:fullscreen class:wallpaper-dim={wallpaperDim}
	style:--dock-height={`${56 + navSizeMulti}px`}
	style:--os-accent={accentOptions.find((option) => option.id === desktopAccent)?.color}>
	<div
		class="desktop-wallpaper"
		style:background-image={`url(${JSON.stringify(bgURL)})`}
		style:background-size={bgFit}
	></div>
	<div class="desktop-shade"></div>
	<header class="desktop-menubar">
		<div class="desktop-identity">
			<button class="brand-button" onclick={openChangelogs} aria-label="About Velora"
				><span class="velora-mark">v.</span><span>velora</span></button
			>
			<span class="header-divider"></span>
			<span class="desktop-label"><span class="workspace-light"></span>Desktop <span class="workspace-number">01</span></span>
			<a href="/download" class="desktop-download">Download <Icon name="arrow" size={12} /></a>
		</div>
		<div class="desktop-status">
			<a href="/slate" class="browser-mode" title="Open browser without desktop windows"
				><Icon name="globe" size={14} /><span>Browser mode</span></a
			>
			<button class="control-center-toggle" onclick={toggleControls}
				aria-label="Open control center" aria-expanded={controlsOpen} aria-controls="desktop-controls"
				title="Control center"><Icon name="settings" size={17} /></button>
			<button
				class="menubar-icon"
				onclick={toggleFullscreen}
				aria-label={fullscreen ? 'Exit full screen' : 'Enter full screen'}
				><Icon name="fullscreen" size={14} /></button
			>
			<time>{timeString}</time>
		</div>
	</header>
	<Notifications />
	<main
		class="desktop-workspace"
		aria-label="Velora desktop"
		oncontextmenu={(e) => openMenu(e, 'navBar')}
	>
		<div class="desktop-home">
			<section class="desktop-clock" aria-label="Clock">
				<p class="desktop-date"><span></span>{dateString}</p>
				<div class="clock-digits">{clockFace}<span>{clockPeriod}</span></div>
			</section>
			<section class="desktop-search" aria-label="App and web search">
				<button class="desktop-command" onclick={toggleLauncher} aria-label="Search apps or the web">
					<span class="command-symbol"><Icon name="search" size={21} /></span><span>Search apps or the web</span><kbd>{shortcutModifier} K</kbd>
				</button>
			</section>
			<div class="desktop-quick-access" aria-label="Quick access">
				{#each [baseApps[0], baseApps[2], baseApps[3]] as app (app.id)}
					<button onclick={() => launchApp(app)} disabled={!hydrated}>
						<AppIcon {app} size={38} /><span>{app.name}</span><Icon name="arrow" size={14} />
					</button>
				{/each}
			</div>
		</div>
		<aside class="desktop-widgets" class:widgets-hidden={!widgetsVisible} aria-label="Desktop widgets" inert={!widgetsVisible}>
			<DesktopWidgets {apps} windows={$windowList} {hydrated} onlaunch={launchApp} onfocus={focusWindow} />
		</aside>
	</main>
	<div class="desktop-footnote"><span class="workspace-light"></span>Workspace 01 <span class="footnote-divider">/</span><button onclick={openChangelogs}>Velora 1.3</button></div>
	{#if controlsOpen}
		<dialog id="desktop-controls" class="control-center" aria-label="Control center" onclose={() => (controlsOpen = false)}
			{@attach (node) => {
				const previous = document.activeElement;
				node.showModal();
				return () => { node.close(); previous?.focus?.(); };
			}}
			onclick={(event) => {
				if (event.target !== event.currentTarget) return;
				const rect = event.currentTarget.getBoundingClientRect();
				if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) controlsOpen = false;
			}}>
			<div class="control-heading"><h2>Control center</h2><button class="menubar-icon" aria-label="Close control center" onclick={() => (controlsOpen = false)}><Icon name="close" size={18} /></button></div>
			<div class="control-tiles">
				<button class:enabled={widgetsVisible} aria-pressed={widgetsVisible} onclick={() => { widgetsVisible = !widgetsVisible; saveSetting('desktopWidgets', widgetsVisible); }}><Icon name="apps" size={22} /><strong>Widgets</strong><small>{widgetsVisible ? 'Visible' : 'Hidden'}</small></button>
				<button class:enabled={wallpaperDim} aria-pressed={wallpaperDim} onclick={() => { wallpaperDim = !wallpaperDim; saveSetting('desktopDim', wallpaperDim); }}><Icon name="moon" size={22} /><strong>Dim wallpaper</strong><small>{wallpaperDim ? 'On' : 'Off'}</small></button>
			</div>
			<div class="accent-control"><span>Accent</span><div>{#each accentOptions as option}<button aria-label={`${option.label} accent`} aria-pressed={desktopAccent === option.id} class:selected={desktopAccent === option.id} style:--swatch={option.color} onclick={() => chooseAccent(option.id)}></button>{/each}</div></div>
			<label class="dock-size-control">Dock size <input type="range" min="8" max="39" bind:value={navSizeMulti} oninput={(event) => { navSizeMulti = Number(event.currentTarget.value); callTaskbarHeight(); }} /></label>
			<button class="control-wallpaper" onclick={personalize}><Icon name="desktop" size={19} />Change wallpaper<Icon name="arrow" size={16} /></button>
		</dialog>
	{/if}

	{#if launcherOpen}
		<dialog
			class="app-launcher"
			aria-modal="true"
			aria-label="App launcher"
			onclose={() => (launcherOpen = false)}
			onclick={(e) => {
				e.stopPropagation();
				if (e.target !== e.currentTarget) return;
				const bounds = e.currentTarget.getBoundingClientRect();
				if (
					e.clientX < bounds.left ||
					e.clientX > bounds.right ||
					e.clientY < bounds.top ||
					e.clientY > bounds.bottom
				)
					launcherOpen = false;
			}}
			{@attach (node) => {
				const previous = document.activeElement;
				node.showModal();
				node.querySelector('input')?.focus();
				return () => {
					node.close();
					if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
				};
			}}
		>
			<div class="launcher-heading">
				<div>
					<h2>Apps and search</h2>
				</div>
				<button
					class="menubar-icon"
					onclick={() => (launcherOpen = false)}
					aria-label="Close app launcher"><Icon name="close" size={18} /></button
				>
			</div>
			<label class="launcher-search"
				><Icon name="search" size={19} /><input
					placeholder="Search apps or enter a URL"
					aria-label="Search apps or the web"
					bind:value={launcherSearch}
					onkeydown={submitLauncher}
					disabled={launcherBusy}
					oninput={() => (launcherError = '')}
					{@attach (node) => {
						node.focus();
					}}
				/><kbd>ESC</kbd></label
			>
			{#if filteredApps.length}
				<div class="launcher-grid" aria-label="Matching apps">
					{#each filteredApps as app (app.id)}
						<button onclick={() => launchApp(app)} disabled={!hydrated || launcherBusy}>
							<AppIcon {app} size={46} /><span class="launcher-app-copy"
								><strong>{app.name}</strong><small
									>{appDetails[app.id] || 'Your own corner of the web'}</small
								></span
							><Icon name="arrow" size={16} />
						</button>
					{/each}
				</div>
			{/if}
			{#if launcherQuery}
				<button
					class="launcher-web-result"
					onclick={browseFromLauncher}
					disabled={!hydrated || launcherBusy}
					aria-busy={launcherBusy}
				>
					<span class="web-result-icon"
						><Icon name={launcherIsUrl ? 'globe' : 'search'} size={21} /></span
					>
					<span class="web-result-copy"
						><strong
							>{launcherBusy
								? 'Opening…'
								: launcherIsUrl
									? `Go to ${launcherQuery}`
									: `Search the web for “${launcherQuery}”`}</strong
						><small>Open in Velora Browser</small></span
					>
					<kbd>{filteredApps.length ? `${shortcutModifier} ↵` : '↵'}</kbd>
				</button>
			{/if}
			{#if launcherError}<p class="launcher-error" role="alert">{launcherError}</p>{/if}
			<div class="launcher-footer">
				<button
					onclick={() => {
						launcherOpen = false;
						openAddApp();
					}}><Icon name="plus" size={15} />Add your own app</button
				><button onclick={personalize}><Icon name="settings" size={15} />Personalize</button>
			</div>
		</dialog>
	{/if}
	{#if wallpaperOpen}
		<Wallpaper
			onclose={() => {
				wallpaperOpen = false;
			}}
			onapply={(background, fit) => {
				bgURL = background;
				bgFit = fit;
			}}
		/>
	{/if}

	{#if menuOpen}
		<div
			class="contextMenu"
			style="left: {openMenuX}px; top: {menuY}px;"
			onclick={(e) => e.stopPropagation()}
		>
			{#if menuType == 'app'}
				<button
					class="menuOption"
					onclick={() =>
						openNewWindow(
							menuSender.url,
							menuSender.name,
							menuSender.height,
							menuSender.width,
							menuSender.top,
							menuSender.left,
							menuSender.appId
						)}
				>
					Open New Window
				</button>
				{#if isCustomApp(menuSender.appId)}
					<button class="menuOption danger" onclick={() => removeApp(menuSender.appId)}>
						Remove App
					</button>
				{/if}
			{:else if menuType == 'nav'}
				<button class="menuOption" onclick={openAddApp}>Add app</button>
				<button class="menuOption" onclick={personalize}>Change wallpaper</button>
			{/if}
		</div>
	{/if}
	{#if addOpen}
		<dialog
			class="modalOverlay"
			aria-label="Add app"
			onclose={closeAddApp}
			onclick={(e) => {
				if (e.target === e.currentTarget) closeAddApp();
			}}
			{@attach (node) => {
				const previous = document.activeElement;
				node.showModal();
				return () => {
					node.close();
					previous?.focus?.();
				};
			}}
		>
			<div
				class="modal"
				onclick={(e) => e.stopPropagation()}
				{@attach (node) => {
					gsap.fromTo(
						node,
						{ y: 12, opacity: 0, scale: 0.97 },
						{ y: 0, opacity: 1, scale: 1, duration: 0.25, ease: 'power2.out' }
					);
				}}
			>
				<p class="modalTitle">Add App</p>

				<p class="modalLabel">URL</p>
				<input
					class="modalInput"
					type="text"
					placeholder="example.com"
					bind:value={newUrl}
					oninput={() => (addError = null)}
					onkeydown={(e) => e.key === 'Enter' && addApp()}
				/>

				<p class="modalLabel">Name</p>
				<input
					class="modalInput"
					type="text"
					placeholder="Example"
					bind:value={newName}
					oninput={() => (addError = null)}
					onkeydown={(e) => e.key === 'Enter' && addApp()}
				/>

				<p class="modalLabel">Icon</p>
				<input
					class="modalInput"
					type="text"
					placeholder="leave blank to auto generate"
					bind:value={newIcon}
					onkeydown={(e) => e.key === 'Enter' && addApp()}
				/>

				<button class="advancedToggle" onclick={() => (advancedOpen = !advancedOpen)}>
					<span class="advancedArrow" class:open={advancedOpen}></span> Advanced
				</button>

				{#if advancedOpen}
					<div
						class="advancedPanel"
						{@attach (node) => {
							gsap.fromTo(node, { opacity: 0, y: -6 }, { opacity: 1, y: 0, duration: 0.2 });
						}}
					>
						<p class="modalLabel">Proxy</p>
						<div class="modalOptions">
							{#each proxies as proxy}
								<button
									class="modalOption"
									class:active={newProxy === proxy.value}
									onclick={() => { newProxy = proxy.value; if (proxy.value === 'auto') newTransport = 'auto'; }}>{proxy.label}</button
								>
							{/each}
						</div>

						<p class="modalLabel">Transport</p>
						<div class="modalOptions">
							{#each transports as transport}
								<button
									class="modalOption"
									class:active={newTransport === transport.value}
									onclick={() => (newTransport = transport.value)}>{transport.label}</button
								>
							{/each}
						</div>

						<p class="modalLabel">Wisp</p>
						<input
							class="modalInput"
							type="text"
							placeholder="keep blank for default"
							bind:value={newWisp}
						/>

						<p class="modalLabel">Open Notification</p>
						<input
							class="modalInput"
							type="text"
							placeholder="shown when the app opens"
							bind:value={newNotif}
						/>
					</div>
				{/if}

				{#if addError}
					<p class="modalError">{addError}</p>
				{/if}

				<div class="modalActions">
					<button class="modalBtn" onclick={closeAddApp}>Cancel</button>
					<button class="modalBtn primary" onclick={addApp}>Add</button>
				</div>
			</div>
		</dialog>
	{/if}
	{#if previewOpen}
		<div
			style="left:{menuX}px"
			id="previewPanel"
			class="previewPanel"
			onclick={(e) => e.stopPropagation()}
			{@attach (node) => {
				gsap.fromTo(
					node,
					{ y: 20, opacity: 0 },
					{
						y: 0,
						opacity: 1,
						duration: 0.3,
						ease: 'power2.out'
					}
				);
			}}
			onmouseenter={() => clearTimeout(closeTimeout)}
			onmouseleave={() => {
				previewOpen = false;
				previewApp = null;
			}}
		>
			{#each getPreviewWindows() as win}
				<button class="previewCard" onclick={() => focusWindow(win.sender)}>
					<p>{win.name}</p>
				</button>
			{/each}
		</div>
	{/if}
	<nav class="desktop-dock" aria-label="App dock">
		<div
			class="navResize"
			onmousedown={startNavResize}
			title="Drag to resize dock"
			role="presentation"
		></div>
		<button
			class="dock-launcher"
			class:active={launcherOpen}
			aria-label="Open app launcher"
			aria-expanded={launcherOpen}
			onclick={(e) => {
				e.stopPropagation();
				launcherSearch = '';
				launcherOpen = !launcherOpen;
			}}><Icon name="apps" size={21} /><span class="dock-tooltip">All apps</span></button
		>
		<span class="dock-divider"></span>
		<div class="dock-apps" class:many-apps={apps.length > 8} oncontextmenu={(e) => openMenu(e, 'navBar')}>
			{#each apps as app (app.id)}
				<button
					class="dock-app"
					class:active={isAppActive(app.id)}
					class:running={runningCount(app.id) > 0}
					aria-label={`Open ${app.name}`}
					title={app.name}
					disabled={!hydrated}
					onclick={() => launchApp(app)}
					oncontextmenu={(e) =>
						openMenu(
							e,
							'apps',
							app.id,
							app.url,
							app.name,
							app.height,
							app.width,
							app.top,
							app.left
						)}
					onmouseenter={(e) => hoverStart(e, app.id)}
					onmouseleave={hoverEnd}
				>
					<AppIcon {app} size={Math.round(25 + navSizeMulti * 0.55)} /><span class="dock-tooltip"
						>{app.name}</span
					><span class="dock-indicator"></span>
				</button>
			{/each}
		</div>
		<span class="dock-divider"></span>
		<button
			class="dock-personalize"
			onclick={personalize}
			aria-label="Change wallpaper"
			title="Change wallpaper"
			><Icon name="desktop" size={21} /><span class="dock-tooltip">Wallpaper</span></button
		>
	</nav>

	{#each $windowList as window, i (window.id)}
		<Window
			bind:this={windowComps[i]}
			url={window.url}
			name={window.name}
			height={window.height}
			width={window.width}
			top={window.top}
			left={window.left}
			id={window.id}
			sender={window.sender}
		/>
	{/each}
</div>
