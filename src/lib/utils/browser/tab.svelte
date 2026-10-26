<script>
	import {
		deleteTab,
		activeTab,
		slotsDragged,
		draggedOverLeft,
		draggedOverRight,
		isTabDragging as draggingStore
	} from '$lib/stores/index.js';
	/** @type {import('svelte/store').Writable<boolean | null>} */
	const isTabDragging = draggingStore;
	import faviconFetch from 'favicon-fetch';
	import defaultIcon from '$lib/assets/velora.svg';
	import Icon from './icon.svelte';
	import gsap from 'gsap';
	import { onDestroy } from 'svelte';
	let { id, displayUrl = '', title = 'New Tab', onDrop } = $props();
	let tabEl;
	let closing = $state(false);
	let dragging = $state(false);
	let offset = $state(0);
	let pointerStart = 0;
	let pointerId = null;
	let startIndex = 0;
	let tabLength = 184;
	let faviconUrl = $derived.by(() => {
		try {
			return displayUrl ? faviconFetch({ hostname: new URL(displayUrl).hostname }) : defaultIcon;
		} catch {
			return defaultIcon;
		}
	});

	function closeTab(event) {
		event.stopPropagation();
		if (closing) return;
		closing = true;
		const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
		gsap.to(tabEl, {
			width: 0,
			minWidth: 0,
			flexBasis: 0,
			opacity: 0,
			marginRight: -4,
			paddingLeft: 0,
			paddingRight: 0,
			duration: reduced ? 0 : 0.18,
			ease: 'power2.out',
			onComplete: () => {
				$deleteTab = id;
			}
		});
	}

	// Keep the existing drag stores and onDrop callback; measure the horizontal axis.
	function callDrag(event) {
		if (event.button !== 0 || closing) return;
		$activeTab = id;
		tabEl.focus();
		pointerId = event.pointerId;
		pointerStart = event.clientX;
		startIndex = Array.from(tabEl.parentElement.children).indexOf(tabEl);
		tabLength = tabEl.getBoundingClientRect().width + 4;
		tabEl.setPointerCapture(pointerId);
	}
	function startDrag(event) {
		if (pointerId !== event.pointerId) return;
		const delta = event.clientX - pointerStart;
		if (!dragging && Math.abs(delta) < 5) return;
		dragging = true;
		$isTabDragging = true;
		const maxIndex = tabEl.parentElement.children.length - 1;
		offset = Math.max(
			-startIndex * tabLength,
			Math.min((maxIndex - startIndex) * tabLength, delta)
		);
		// Stores are shared with the existing browser's reorder function.
		// @ts-ignore — legacy store initializes to null but holds a numeric offset.
		$slotsDragged = Math.round(offset / tabLength);
	}
	function stopDrag(event) {
		if (pointerId !== event.pointerId) return;
		if (tabEl.hasPointerCapture(pointerId)) tabEl.releasePointerCapture(pointerId);
		pointerId = null;
		offset = 0;
		if (dragging) {
			dragging = false;
			$isTabDragging = false;
			onDrop?.(id);
		}
	}
	function keydown(event) {
		if (event.target !== tabEl) return;
		if (event.key === 'Delete') {
			event.preventDefault();
			closeTab(event);
			return;
		}
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			$activeTab = id;
		}
		const rows = Array.from(tabEl.parentElement.querySelectorAll('[role="tab"]'));
		const index = rows.indexOf(tabEl);
		let next;
		if (event.key === 'ArrowRight') next = rows[(index + 1) % rows.length];
		if (event.key === 'ArrowLeft') next = rows[(index - 1 + rows.length) % rows.length];
		if (event.key === 'Home') next = rows[0];
		if (event.key === 'End') next = rows[rows.length - 1];
		if (next) {
			event.preventDefault();
			next.focus();
		}
	}
	onDestroy(() => {
		gsap.killTweensOf(tabEl);
		if (dragging) {
			$isTabDragging = false;
			$slotsDragged = null;
			$draggedOverLeft = null;
			$draggedOverRight = null;
		}
	});
</script>

<div
	class="zen-tab"
	class:active={id === $activeTab}
	class:dragging
	class:closing
	class:drop-before={id === $draggedOverRight}
	class:drop-after={id === $draggedOverLeft}
	bind:this={tabEl}
	{id}
	role="tab"
	aria-selected={id === $activeTab}
	aria-label={title}
	title={title}
	tabindex={id === $activeTab ? 0 : -1}
	onfocus={() => {
		$activeTab = id;
	}}
	onkeydown={keydown}
	onpointerdown={callDrag}
	onpointermove={startDrag}
	onpointerup={stopDrag}
	onpointercancel={stopDrag}
	onauxclick={(event) => {
		if (event.button === 1) {
			event.preventDefault();
			closeTab(event);
		}
	}}
	style:transform={dragging ? `translateX(${offset}px)` : undefined}
>
	<img
		class="tab-favicon"
		src={faviconUrl}
		alt=""
		onerror={(event) => {
			if (event.currentTarget.getAttribute('src') !== defaultIcon)
				event.currentTarget.setAttribute('src', defaultIcon);
		}}
	/>
	<span class="tab-title">{title}</span>
	<button
		class="tab-close"
		type="button"
		tabindex={id === $activeTab ? 0 : -1}
		aria-label={`Close ${title}`}
		onpointerdown={(event) => event.stopPropagation()}
		onclick={closeTab}><Icon name="close" size={13} /></button
	>
</div>

<style>
	.zen-tab {
		position: relative;
		display: flex;
		align-items: center;
		gap: 9px;
		height: 37px;
		flex: 0 1 210px;
		width: 210px;
		min-width: 112px;
		border-radius: 9px 9px 0 0;
		padding: 0 12px;
		color: var(--zen-muted);
		background: transparent;
		cursor: default;
		touch-action: none;
		user-select: none;
		animation: tab-enter 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
		transition:
			background 180ms ease-out,
			color 180ms ease-out;
	}
	.zen-tab:hover {
		color: var(--zen-text);
		background: var(--zen-hover);
	}
	.zen-tab.active {
		background: #242920;
		color: var(--zen-text);
		box-shadow: inset 0 0 0 1px #d3e5b00a;
	}
	.zen-tab:focus-visible {
		outline: 1px solid var(--zen-accent);
		outline-offset: -1px;
	}
	.tab-favicon {
		width: 16px;
		height: 16px;
		object-fit: contain;
		flex: none;
		opacity: 0.85;
		pointer-events: none;
	}
	.tab-title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font: 400 12px var(--zen-font);
		flex: 1;
		transition: opacity 160ms ease-out;
	}
	.tab-close {
		background: transparent;
		border: 0;
		color: var(--zen-muted);
		display: grid;
		place-items: center;
		width: 24px;
		height: 24px;
		flex: none;
		border-radius: 4px;
		padding: 0;
		opacity: 0;
		cursor: pointer;
		transition:
			background 160ms ease-out,
			opacity 160ms ease-out;
	}
	.zen-tab:hover .tab-close,
	.zen-tab:focus-within .tab-close,
	.zen-tab.active .tab-close {
		opacity: 1;
	}
	.tab-close:hover {
		background: var(--zen-hover);
		color: var(--zen-text);
	}
	.tab-close:focus-visible {
		outline: 1px solid var(--zen-accent);
	}
	.dragging {
		z-index: 5;
		background: var(--zen-selected);
		box-shadow: 0 4px 12px #0002;
	}
	.drop-before {
		box-shadow: inset 2px 0 0 var(--zen-accent);
	}
	.drop-after {
		box-shadow: inset -2px 0 0 var(--zen-accent);
	}
	.closing {
		overflow: hidden;
		pointer-events: none;
	}
	@keyframes tab-enter {
		from {
			opacity: 0;
			translate: 0 -4px;
		}
		to {
			opacity: 1;
			translate: 0 0;
		}
	}
	@media (max-width: 640px) { .zen-tab { width: 160px; flex-basis: 160px; min-width: 104px; padding-inline: 9px; gap: 7px; } }
	@media (prefers-reduced-motion: reduce) {
		.zen-tab,
		.tab-title,
		.tab-close {
			transition: none;
			animation: none;
		}
	}
</style>
