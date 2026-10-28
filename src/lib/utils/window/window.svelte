<script>
	// @ts-nocheck

	import '$lib/utils/window/window.css';
	import gsap from 'gsap';
	import Icon from '$lib/utils/browser/icon.svelte';
	import { mediaPermissions } from '$lib/utils/browser/media-permissions.js';
	import { snapTarget } from './snap.js';
	import { toggleElementFullscreen } from '$lib/utils/browser/fullscreen.js';
	import { installGameKeyboard } from '$lib/utils/browser/game-keyboard.js';
	import { requestBrowserSearch } from '$lib/utils/browser/desktop-search-request.js';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { loadSetting } from '$lib/utils/localspace.js';
	import { recordActivity } from '$lib/utils/developer/diagnostics.js';
	import {
		topZ,
		windowList,
		minimizedSig,
		activeSignal,
		focusWindowTop
	} from '$lib/stores/index.js';

	// window zindex
	let z = $state(1);
	let minimizedStat = $state(false);
	let rightSplit = $state(false);
	let taskbarHeight = $state(64);
	let windowElement;
	let appFrame;
	let fullscreenError = $state('');
	let viewportHeight = $state(800);
	let reducedMotion = $state(false);
	let mounted = false;
	let transitionTimer;
	let {
		url,
		name,
		height: initialHeight,
		width: initialWidth,
		top,
		left,
		id = Date.now(),
		sender
	} = $props();
	setTop();
	// svelte-ignore state_referenced_locally
	let x = $state(left);
	// svelte-ignore state_referenced_locally
	let y = $state(top);
	// svelte-ignore state_referenced_locally
	let height = $state(initialHeight);
	// svelte-ignore state_referenced_locally
	let width = $state(initialWidth);
	let offSetx = 0;
	let offSety = 0;
	let draggingState = $state(false);
	let transition = $state(false);
	const topBarrier = 84;
	const desktopGap = 8;
	const dockGap = 12;
	const duration = () => (reducedMotion ? 0 : 0.2);

	function animatePlacement() {
		transition = !reducedMotion;
		clearTimeout(transitionTimer);
		transitionTimer = setTimeout(() => {
			transition = false;
		}, 150);
	}

	function fitWorkspace(split = false) {
		const availableWidth = window.innerWidth - desktopGap * 2;
		width = `${split ? (availableWidth - desktopGap) / 2 : availableWidth}px`;
		height = `${Math.max(100, window.innerHeight - topBarrier - taskbarHeight - dockGap - desktopGap * 2)}px`;
		x = split === 'right' ? (window.innerWidth + desktopGap) / 2 : desktopGap;
		y = topBarrier + desktopGap;
	}

	function sizeInPixels(value, viewport, fallback) {
		const parsed = parseFloat(value);
		if (!Number.isFinite(parsed)) return fallback;
		return String(value).endsWith('%') ? (viewport * parsed) / 100 : parsed;
	}
	//
	//----- window drag logic -----
	//

	function setTop() {
		topZ.update((n) => n + 1);
		z = get(topZ);
	}
	function dragStart(e) {
		if (e.button !== 0 || e.target.closest('button') || window.innerWidth <= 640) return;
		e.preventDefault();
		activeSignal.set(sender);
		draggingState = true;
		offSetx = e.clientX - x;
		offSety = e.clientY - y;
		topZ.update((n) => n + 1);
		z = get(topZ);
		window.addEventListener('mousemove', dragging);
		window.addEventListener('mouseup', dragStop);
		if (maximizedStat) {
			maximizedStat = false;
			rightSplit = false;
			transition = false;
			height = tempHeight;
			width = tempWidth;
			offSetx = Math.min(offSetx, parseFloat(tempWidth) / 2);
			x = e.clientX - offSetx;
		}
	}
	function dragging(e) {
		if (rightSplit === null) {
			transition = false;
			height = tempHeight;
			width = tempWidth;
			offSetx = Math.min(offSetx, parseFloat(tempWidth) / 2);
			rightSplit = false;
		}
		y = e.clientY - offSety;
		x = e.clientX - offSetx;

		if (y < topBarrier) {
			y = topBarrier;
		}

		rightSplit = snapTarget(e.clientX, window.innerWidth, rightSplit);
	}
	function checkBoundaries() {
		if (!windowElement || minimizedStat) return;
		viewportHeight = window.innerHeight;
		if (maximizedStat || window.innerWidth <= 640) {
			fitWorkspace();
			return;
		}
		const availableWidth = Math.max(100, window.innerWidth - desktopGap * 2);
		const availableHeight = Math.max(
			100,
			viewportHeight - topBarrier - taskbarHeight - dockGap - desktopGap * 2
		);
		const currentWidth = Math.min(
			sizeInPixels(width, window.innerWidth, availableWidth),
			availableWidth
		);
		const currentHeight = Math.min(
			sizeInPixels(height, viewportHeight, availableHeight),
			availableHeight
		);
		width = `${currentWidth}px`;
		height = `${currentHeight}px`;
		x = Math.max(
			desktopGap,
			Math.min(Number(x) || desktopGap, window.innerWidth - currentWidth - desktopGap)
		);
		y = Math.max(
			topBarrier + desktopGap,
			Math.min(
				Number(y) || topBarrier,
				viewportHeight - taskbarHeight - dockGap - currentHeight - desktopGap
			)
		);
	}
	function dragStop() {
		if (rightSplit === true) {
			animatePlacement();
			tempHeight = height;
			tempWidth = width;
			fitWorkspace('right');
			rightSplit = null;
		} else if (rightSplit === 'left') {
			animatePlacement();
			tempHeight = height;
			tempWidth = width;
			fitWorkspace('left');
			rightSplit = null;
		} else {
			checkBoundaries();
		}
		draggingState = false;
		window.removeEventListener('mousemove', dragging);
		window.removeEventListener('mouseup', dragStop);
	}
	//
	//----- window nav control logic -----
	//
	let tempX = 0;
	let tempY = 0;
	let tempHeight = 0;
	let tempWidth = 0;
	let maximizedStat = $state(false);
	export async function updateTaskbarHeight(dockSize) {
		const size = dockSize ?? await loadSetting('navbarsize', 24);
		taskbarHeight = 56 + (Number(size) || 0);
		if (mounted) checkBoundaries();
	}
	export function openBrowserSearch(query) {
		if (new URL(url, window.location.href).pathname !== '/slate') return Promise.resolve(false);
		return requestBrowserSearch(appFrame?.contentWindow, query);
	}
	async function fullscreenWindow() {
		fullscreenError = '';
		keepGeForceMaximized();
		try {
			await toggleElementFullscreen(appFrame);
		} catch (error) {
			fullscreenError = error?.message || 'Could not enter full screen.';
		}
	}
	function maximizeWindow() {
		activeSignal.set(sender);
		if (maximizedStat === true) {
			y = tempY;
			x = tempX;
			height = tempHeight;
			width = tempWidth;
			animatePlacement();
			maximizedStat = false;
			requestAnimationFrame(checkBoundaries);
		} else {
			setTop();
			tempX = x;
			tempY = y;
			tempHeight = height;
			tempWidth = width;
			fitWorkspace();
			maximizedStat = true;
			animatePlacement();
		}
	}
	function keepGeForceMaximized() {
		if (name !== 'GeForce NOW' || minimizedStat) return;
		if (!maximizedStat) maximizeWindow();
		rightSplit = false;
		fitWorkspace();
	}
	onMount(() => {
		recordActivity('app-open', { target: url });
		mounted = true;
		const removeGameKeyboard =
			name === 'GeForce NOW' && window.top === window
				? installGameKeyboard({ document, navigator, desktop: appFrame })
				: () => {};
		const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
		const syncMotion = () => {
			reducedMotion = motion.matches;
		};
		syncMotion();
		checkBoundaries();
		updateTaskbarHeight();
		keepGeForceMaximized();
		let wasGeForceFullscreen = false;
		const syncGeForceFullscreen = () => {
			const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;
			const isGeForceFullscreen =
				name === 'GeForce NOW' &&
				(fullscreenElement === appFrame || fullscreenElement === windowElement);
			// Keep the desktop window large when Esc exits native fullscreen.
			// Do not capture Esc: games and the browser still receive it normally.
			if (isGeForceFullscreen || (wasGeForceFullscreen && !fullscreenElement)) {
				keepGeForceMaximized();
			}
			wasGeForceFullscreen = isGeForceFullscreen;
		};
		document.addEventListener('fullscreenchange', syncGeForceFullscreen);
		document.addEventListener('webkitfullscreenchange', syncGeForceFullscreen);
		window.addEventListener('resize', checkBoundaries);
		motion.addEventListener('change', syncMotion);
		gsap.fromTo(
			windowElement,
			{
				scale: reducedMotion ? 1 : 0.97,
				opacity: 0.5
			},
			{
				scale: 1,
				opacity: 1,
				duration: duration(),
				ease: 'power2.out'
			}
		);
		return () => {
			mounted = false;
			removeGameKeyboard();
			clearTimeout(transitionTimer);
			gsap.killTweensOf(windowElement);
			document.removeEventListener('fullscreenchange', syncGeForceFullscreen);
			document.removeEventListener('webkitfullscreenchange', syncGeForceFullscreen);
			window.removeEventListener('resize', checkBoundaries);
			window.removeEventListener('mousemove', dragging);
			window.removeEventListener('mouseup', dragStop);
			window.removeEventListener('mousemove', resizing);
			window.removeEventListener('mouseup', resizeStop);
			motion.removeEventListener('change', syncMotion);
		};
	});

	function setMinimizedFlag(value) {
		windowList.update((list) => {
			const updatedList = [];
			for (const win of list) {
				if (win.id === id) {
					const updatedWin = { ...win, minimized: value };
					updatedList.push(updatedWin);
				} else {
					updatedList.push(win);
				}
			}
			return updatedList;
		});
	}

	function restoreFromMinimized() {
		minimizedStat = false;
		setMinimizedFlag(false);
		windowElement.style.display = 'flex';
		checkBoundaries();
		setTop();
		activeSignal.set(sender);
		gsap.killTweensOf(windowElement);
		gsap.fromTo(
			windowElement,
			{ scale: reducedMotion ? 1 : 0.97, opacity: 0 },
			{
				scale: 1,
				opacity: 1,
				duration: duration(),
				ease: 'power2.out'
			}
		);
	}

	function closeWindow() {
		recordActivity('app-close', { target: url });
		transition = false;
		activeSignal.set(null);
		gsap.to(windowElement, {
			scale: reducedMotion ? 1 : 0.97,
			opacity: 0,
			duration: duration(),
			ease: 'power2.out',
			onComplete: function () {
				const list = get(windowList);
				const remaining = [];
				for (const win of list) {
					if (win.id !== id) {
						remaining.push(win);
					}
				}
				windowList.set(remaining);
			}
		});
	}

	function minimizeWindow() {
		minimizedStat = !minimizedStat;
		setMinimizedFlag(minimizedStat);
		if (minimizedStat) {
			activeSignal.set(null);
			gsap.killTweensOf(windowElement);
			gsap.to(windowElement, {
				scale: reducedMotion ? 1 : 0.97,
				opacity: 0,
				duration: duration(),
				onComplete: function () {
					windowElement.style.display = 'none';
				}
			});
		} else {
			restoreFromMinimized();
		}
		minimizedSig.set(null);
	}

	//
	//----- window resize logic -----
	//

	let startX, startY, resizeType, startWidth, startHeight, startTop, startLeft;
	function resizeStart(e, type) {
		if (e.button !== 0 || maximizedStat || window.innerWidth <= 640) return;
		e.preventDefault();
		e.stopPropagation();
		activeSignal.set(sender);
		setTop();
		draggingState = true;
		const rect = windowElement.getBoundingClientRect();
		startX = e.clientX;
		startY = e.clientY;
		resizeType = type;
		startWidth = rect.width;
		startHeight = rect.height;
		startTop = y;
		startLeft = x;
		window.addEventListener('mousemove', resizing);
		window.addEventListener('mouseup', resizeStop);
	}
	function resizing(e) {
		transition = false;
		const mouseXmove = e.clientX - startX;
		const mouseYmove = e.clientY - startY;
		const maxWidth = window.innerWidth - x - desktopGap;
		const maxHeightBottom = window.innerHeight - y - taskbarHeight - dockGap - desktopGap;
		const maxHeightTop = topBarrier + desktopGap;
		if (resizeType === 'right') {
			width = Math.min(maxWidth, Math.max(400, startWidth + mouseXmove)) + 'px';
		}

		if (resizeType === 'bottom') {
			height = Math.min(maxHeightBottom, Math.max(200, startHeight + mouseYmove)) + 'px';
		}

		if (resizeType === 'left') {
			const newWidth = Math.max(400, startWidth - mouseXmove);
			const newX = startLeft + (startWidth - newWidth);
			x = Math.max(0, newX);
			width = startLeft + startWidth - x + 'px';
		}

		if (resizeType === 'top') {
			const newHeight = Math.max(200, startHeight - mouseYmove);
			const newY = startTop + (startHeight - newHeight);
			y = Math.max(maxHeightTop, Math.max(0, newY));
			height = startTop + startHeight - y + 'px';
		}

		if (resizeType === 'bottomRight') {
			width = Math.min(maxWidth, Math.max(400, startWidth + mouseXmove)) + 'px';
			height = Math.min(maxHeightBottom, Math.max(200, startHeight + mouseYmove)) + 'px';
		}

		if (resizeType === 'bottomLeft') {
			const newWidth = Math.max(400, startWidth - mouseXmove);
			const newX = startLeft + (startWidth - newWidth);
			x = Math.max(0, newX);
			width = startLeft + startWidth - x + 'px';
			height = Math.min(maxHeightBottom, Math.max(200, startHeight + mouseYmove)) + 'px';
		}

		if (resizeType === 'topRight') {
			width = Math.min(maxWidth, Math.max(200, startWidth + mouseXmove)) + 'px';
			const newHeight = Math.max(150, startHeight - mouseYmove);
			const newY = startTop + (startHeight - newHeight);
			y = Math.max(maxHeightTop, Math.max(0, newY));
			height = startTop + startHeight - y + 'px';
		}

		if (resizeType === 'topLeft') {
			const newWidth = Math.max(200, startWidth - mouseXmove);
			const newHeight = Math.max(150, startHeight - mouseYmove);
			const newX = startLeft + (startWidth - newWidth);
			const newY = startTop + (startHeight - newHeight);
			x = Math.max(0, newX);
			y = Math.max(maxHeightTop, Math.max(0, newY));
			width = startLeft + startWidth - x + 'px';
			height = startTop + startHeight - y + 'px';
		}
	}
	function resizeStop() {
		checkBoundaries();
		draggingState = false;
		window.removeEventListener('mousemove', resizing);
		window.removeEventListener('mouseup', resizeStop);
	}
	$effect(() => {
		if ($focusWindowTop !== sender) return;
		if (minimizedStat) {
			restoreFromMinimized();
		} else {
			setTop();
			activeSignal.set(sender);
		}
		focusWindowTop.set(null);
	});
	$effect(() => {
		transition = false;
		if ($minimizedSig !== sender) return;
		if (z !== $topZ && minimizedStat == false) {
			setTop();
			activeSignal.set(sender);
		} else {
			minimizeWindow();
		}
		minimizedSig.set(null);
	});
</script>

<div
	bind:this={windowElement}
	role="dialog"
	aria-labelledby={`${id}-title`}
	class="window noSelect"
	class:active={z == $topZ}
	{id}
	style="
    height:{height};
    width: {width};
    top:{y}px;
    left:{x}px;
    z-index: {z};
    --window-dock-space: {taskbarHeight + dockGap}px;
    transition-duration: {transition && !reducedMotion ? '0.15s' : '0s'};

  "
>
	<div
		role="presentation"
		aria-hidden="true"
		onmousedown={(e) => resizeStart(e, 'top')}
		class="r-top side resizer"
		class:active={maximizedStat === true}
	></div>
	<div
		role="presentation"
		aria-hidden="true"
		onmousedown={(e) => resizeStart(e, 'right')}
		class="r-right side resizer"
		class:active={maximizedStat === true}
	></div>
	<div
		role="presentation"
		aria-hidden="true"
		onmousedown={(e) => resizeStart(e, 'bottom')}
		class="r-bottom side resizer"
		class:active={maximizedStat === true}
	></div>
	<div
		role="presentation"
		aria-hidden="true"
		onmousedown={(e) => resizeStart(e, 'left')}
		class="r-left side resizer"
		class:active={maximizedStat === true}
	></div>
	<div
		role="presentation"
		aria-hidden="true"
		onmousedown={(e) => resizeStart(e, 'topRight')}
		class="r-top-right corner resizer"
		class:active={maximizedStat === true}
	></div>
	<div
		role="presentation"
		aria-hidden="true"
		onmousedown={(e) => resizeStart(e, 'topLeft')}
		class="r-top-left corner resizer"
		class:active={maximizedStat === true}
	></div>
	<div
		role="presentation"
		aria-hidden="true"
		onmousedown={(e) => resizeStart(e, 'bottomRight')}
		class="r-bottom-right corner resizer"
		class:active={maximizedStat === true}
	></div>
	<div
		role="presentation"
		aria-hidden="true"
		onmousedown={(e) => resizeStart(e, 'bottomLeft')}
		class="r-bottom-left corner resizer"
		class:active={maximizedStat === true}
	></div>

	<div
		class="windowCover"
		class:active={z == $topZ}
		role="button"
		tabindex={z == $topZ ? -1 : 0}
		aria-label={`Focus ${name}`}
		onkeydown={(event) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				setTop();
				activeSignal.set(sender);
			}
		}}
		onclick={() => {
			setTop();
			activeSignal.set(sender);
		}}
		style="
    width: 100%;
    z-index: {z};
  "
	></div>
	<div
		class="bar noSelect"
		role="toolbar"
		tabindex="-1"
		aria-label={`${name} window controls`}
		onmousedown={dragStart}
		ondblclick={(event) => {
			if (!event.target.closest('button')) maximizeWindow();
		}}
	>
		<div class="bar-left">
			<span class="window-status-dot" aria-hidden="true"></span>
			<p class="window-title" id={`${id}-title`}>{name}</p>
		</div>
		<div class="bar-middle"></div>
		<div class="bar-right">
			<button
				class="navControl fullscreen-control"
				onclick={fullscreenWindow}
				type="button"
				aria-label={`Full screen ${name}`}
				title="Full screen"><Icon name="fullscreen" size={14} /></button
			>
			<button
				class="navControl"
				onclick={minimizeWindow}
				type="button"
				aria-label={`Minimize ${name}`}
				title="Minimize"
			>
				<svg
					width="13"
					height="13"
					viewBox="0 0 16 16"
					fill="none"
					stroke="currentColor"
					stroke-linecap="round"
					aria-hidden="true"><path d="M4 8h8" /></svg
				>
			</button>
			<button
				class="navControl"
				onclick={maximizeWindow}
				type="button"
				aria-label={`${maximizedStat ? 'Restore' : 'Maximize'} ${name}`}
				title={maximizedStat ? 'Restore' : 'Maximize'}
			>
				<svg
					width="13"
					height="13"
					viewBox="0 0 16 16"
					fill="none"
					stroke="currentColor"
					stroke-linejoin="round"
					aria-hidden="true"
					>{#if maximizedStat}<path d="M6 4V2.5h7.5V10H12M2.5 6H10v7.5H2.5z" />{:else}<rect
							x="3.5"
							y="3.5"
							width="9"
							height="9"
							rx="1.5"
						/>{/if}</svg
				>
			</button>
			<button
				class="navControl closeDiv"
				onclick={closeWindow}
				type="button"
				aria-label={`Close ${name}`}
				title="Close"
			>
				<Icon name="close" size={14} />
			</button>
		</div>
	</div>
	{#if fullscreenError}<p class="window-fullscreen-error" role="alert">
			{fullscreenError}<button
				onclick={() => {
					fullscreenError = '';
				}}
				aria-label="Dismiss fullscreen message">×</button
			>
		</p>{/if}
	<iframe
		bind:this={appFrame}
		onload={() => recordActivity('app-load', { target: url })}
		onerror={() => recordActivity('app-error', { target: url })}
		allow={mediaPermissions}
		allowfullscreen
		class="noSelect"
		src={url}
		title={name}
		style:pointer-events={draggingState ? 'none' : 'auto'}
	></iframe>
</div>

<div
	class="snapPreview"
	class:visible={draggingState && rightSplit === true}
	aria-hidden="true"
	style="z-index: {$topZ - 1}; left: calc(50% + 4px); height: {Math.max(
		100,
		viewportHeight - topBarrier - taskbarHeight - dockGap - desktopGap * 2
	)}px"
></div>
<div
	class="snapPreview"
	class:visible={draggingState && rightSplit === 'left'}
	aria-hidden="true"
	style="z-index: {$topZ - 1}; left: 8px; height: {Math.max(
		100,
		viewportHeight - topBarrier - taskbarHeight - dockGap - desktopGap * 2
	)}px"
></div>
