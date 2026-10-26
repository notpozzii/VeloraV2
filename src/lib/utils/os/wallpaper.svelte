<script>
	import { onMount } from 'svelte';
	import { loadSetting, saveSetting, onSettingChange } from '$lib/utils/localspace.js';
	import Icon from '$lib/utils/browser/icon.svelte';
	import curatedWallpapers from './curated-wallpapers.json';
	import defaultBackground from '$lib/img/bg/highlands.jpg';
	import mountains from '$lib/img/bg/dark-mountains.webp';
	import atrium from '$lib/img/bg/dark-green-room.webp';
	import sea from '$lib/img/bg/calmSea.webp';
	import sunset from '$lib/img/bg/pink-sunset.webp';
	import cottage from '$lib/img/bg/cozyCottageNight.webp';
	import city from '$lib/img/bg/londonNight.webp';
	import defaultThumbnail from '$lib/img/bg-downsized/highlands.jpg';
	import mountainsThumbnail from '$lib/img/bg-downsized/dark-mountains.webp';
	import atriumThumbnail from '$lib/img/bg-downsized/dark-green-room.webp';
	import seaThumbnail from '$lib/img/bg-downsized/calmSea.webp';
	import sunsetThumbnail from '$lib/img/bg-downsized/pink-sunset.webp';
	import cottageThumbnail from '$lib/img/bg-downsized/cozyCottageNight.webp';
	import cityThumbnail from '$lib/img/bg-downsized/londonNight.webp';

	/** @type {{ onclose?: () => void, onapply?: (background: string, fit: 'cover' | 'contain') => void }} */
	let { onclose = () => {}, onapply = () => {} } = $props();
	let background = $state(defaultBackground);
	let collection = $state('All');
	const collections = ['All', 'Nature', 'City'];
	/** @type {'cover' | 'contain'} */
	let fit = $state('cover');
	/** @type {string[]} */
	let recents = $state([]);
	let loaded = $state(false);
	let busy = $state(false);
	let error = $state('');
	let notice = $state('');
	/** @type {HTMLInputElement | undefined} */
	let uploadInput;
	let alive = true;
	const maxSize = 8 * 1024 * 1024;
	const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
	const wallpapers = [
		{
			title: 'Highlands',
			category: 'Nature',

			src: defaultBackground,
			thumbnail: defaultThumbnail
		},
		{
			title: 'Mountains',
			category: 'Nature',

			src: mountains,
			thumbnail: mountainsThumbnail
		},
		{
			title: 'Atrium',
			category: 'Spaces',

			src: atrium,
			thumbnail: atriumThumbnail
		},
		{
			title: 'Still water',
			category: 'Nature',

			src: sea,
			thumbnail: seaThumbnail
		},
		{
			title: 'Afterglow',
			category: 'Nature',

			src: sunset,
			thumbnail: sunsetThumbnail
		},
		{
			title: 'Hideaway',
			category: 'Nature',

			src: cottage,
			thumbnail: cottageThumbnail
		},
		{
			title: 'Nightfall',
			category: 'City',

			src: city,
			thumbnail: cityThumbnail
		},
		...curatedWallpapers
	];
	let visibleWallpapers = $derived(
		wallpapers.filter((wallpaper) => collection === 'All' || wallpaper.category === collection)
	);

	onMount(() => {
		alive = true;
		Promise.all([
			loadSetting('bg', defaultBackground),
			loadSetting('bgFit', 'cover'),
			loadSetting('bgRecents', [], JSON.parse)
		])
			.then(([savedBackground, savedFit, savedRecents]) => {
				if (!alive) return;
				background =
					typeof savedBackground === 'string' && savedBackground
						? savedBackground
						: defaultBackground;
				fit = savedFit === 'contain' ? 'contain' : 'cover';
				recents = Array.isArray(savedRecents)
					? savedRecents.filter((value) => typeof value === 'string').slice(0, 3)
					: [];
			})
			.catch(() => {
				if (alive)
					error =
						'Your saved backgrounds could not be read. You can still choose one for this session.';
			})
			.finally(() => {
				if (alive) loaded = true;
			});
		const stopBackground = onSettingChange('bg', (value) => {
			if (typeof value === 'string' && value) background = value;
		});
		const stopFit = onSettingChange('bgFit', (value) => {
			fit = value === 'contain' ? 'contain' : 'cover';
		});
		return () => {
			alive = false;
			stopBackground();
			stopFit();
		};
	});

	/** @param {HTMLDialogElement} node */
	function mountDialog(node) {
		const previouslyFocused = document.activeElement;
		node.showModal();
		node.querySelector('button')?.focus();
		return {
			destroy() {
				node.close();
				if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected)
					previouslyFocused.focus();
			}
		};
	}

	/** @param {KeyboardEvent & { currentTarget: EventTarget & HTMLDialogElement }} event */
	function trapFocus(event) {
		if (event.key !== 'Tab') return;
		const controls = Array.from(
			event.currentTarget.querySelectorAll(
				'button:not(:disabled), input:not(:disabled):not([hidden]), select:not(:disabled), a[href]'
			)
		).filter((element) => element instanceof HTMLElement && element.getClientRects().length > 0);
		const first = controls[0];
		const last = controls[controls.length - 1];
		if (event.shiftKey && document.activeElement === first && last instanceof HTMLElement) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last && first instanceof HTMLElement) {
			event.preventDefault();
			first.focus();
		}
	}

	async function apply(nextBackground, nextFit = fit, nextRecents = recents) {
		background = nextBackground;
		fit = nextFit;
		recents = nextRecents;
		error = '';
		notice = '';
		onapply(background, fit);
		await saveSetting('bg', background);
		await saveSetting('bgFit', fit);
		await saveSetting('bgRecents', $state.snapshot(recents));
		try {
			const persisted = await loadSetting('bg', '');
			const persistedFit = await loadSetting('bgFit', '');
			if (alive)
				notice =
					persisted === background && persistedFit === fit
						? 'Background applied.'
						: 'Applied for now. Browser storage is unavailable, so this may reset when you reload.';
		} catch {
			if (alive) notice = 'Applied for now. Your browser could not confirm that it was saved.';
		}
	}

	async function choose(nextBackground, nextFit = fit) {
		if (busy || !loaded) return;
		busy = true;
		try {
			await decodeImage(nextBackground);
			if (alive) await apply(nextBackground, nextFit);
		} catch (reason) {
			if (alive)
				error =
					reason instanceof Error
						? reason.message
						: 'The background could not be loaded. Please try again.';
		} finally {
			if (alive) busy = false;
		}
	}

	/** @param {File} file @returns {Promise<string>} */
	function readImage(file) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onerror = () =>
				reject(new Error('The image could not be read. Please choose it again.'));
			reader.onload = () =>
				typeof reader.result === 'string'
					? resolve(reader.result)
					: reject(new Error('The image could not be read.'));
			reader.readAsDataURL(file);
		});
	}

	/** @param {string} source @returns {Promise<void>} */
	function decodeImage(source) {
		return new Promise((resolve, reject) => {
			const image = new Image();
			image.onload = () =>
				image.naturalWidth && image.naturalHeight
					? resolve()
					: reject(new Error('This image has no usable dimensions.'));
			image.onerror = () =>
				reject(
					new Error('This image could not be opened. Try a PNG, JPG, WebP, GIF, or AVIF file.')
				);
			image.src = source;
		});
	}

	/** @param {Event & { currentTarget: EventTarget & HTMLInputElement }} event */
	async function handleUpload(event) {
		const file = event.currentTarget.files?.[0];
		event.currentTarget.value = '';
		if (!file || busy || !loaded) return;
		error = '';
		notice = '';
		if (!acceptedTypes.includes(file.type)) {
			error = 'Choose a PNG, JPG, WebP, GIF, or AVIF image.';
			return;
		}
		if (file.size > maxSize) {
			error = 'That image is too large. Choose one smaller than 8 MB.';
			return;
		}
		busy = true;
		try {
			const source = await readImage(file);
			await decodeImage(source);
			if (!alive) return;
			await apply(source, fit, [source, ...recents.filter((item) => item !== source)].slice(0, 3));
		} catch (reason) {
			if (alive)
				error =
					reason instanceof Error
						? reason.message
						: 'The image could not be opened. Please try another file.';
		} finally {
			if (alive) busy = false;
		}
	}
</script>

<dialog
	class="wallpaper-panel"
	aria-labelledby="wallpaper-heading"
	aria-describedby="wallpaper-description"
	use:mountDialog
	onkeydown={trapFocus}
	oncancel={(event) => {
		event.preventDefault();
		onclose();
	}}
>
	<header>
		<div>
			<h2 id="wallpaper-heading">Wallpaper</h2>
			<p id="wallpaper-description">Choose a desktop background.</p>
		</div>
		<button
			class="close-button"
			type="button"
			aria-label="Close wallpaper settings"
			onclick={onclose}><Icon name="close" size={18} /></button
		>
	</header>

	<div class="panel-body">
		<div class="section-label">
			<h3>Curated backgrounds</h3>
			<span>{String(visibleWallpapers.length).padStart(2, '0')} views</span>
		</div>
		<div class="collection-filters" role="group" aria-label="Background collection">
			{#each collections as name}
				<button type="button" aria-pressed={collection === name} onclick={() => (collection = name)}
					>{name}</button
				>
			{/each}
		</div>
		<div class="wallpaper-grid" aria-busy={!loaded || busy}>
			{#each visibleWallpapers as wallpaper (wallpaper.src)}
				<button
					class="wallpaper-choice"
					class:selected={background === wallpaper.src}
					type="button"
					aria-pressed={background === wallpaper.src}
					disabled={!loaded || busy}
					onclick={() => choose(wallpaper.src)}
				>
					<div class="thumbnail">
						<img
							src={wallpaper.thumbnail}
							alt=""
							loading="lazy"
							decoding="async"
						/>{#if background === wallpaper.src}<span class="selected-mark" aria-hidden="true"
								>✓</span
							>{/if}
					</div>
					<span class="wallpaper-name">{wallpaper.title}</span>
				</button>
			{/each}
		</div>

		<div class="upload-row">
			<div>
				<h3>Your own image</h3>
				<p>PNG, JPG, WebP, GIF or AVIF · Up to 8 MB</p>
			</div>
			<input
				bind:this={uploadInput}
				type="file"
				accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
				hidden
				onchange={handleUpload}
			/>
			<button
				class="upload-button"
				type="button"
				disabled={!loaded || busy}
				onclick={() => uploadInput?.click()}><Icon name="plus" size={16} />Upload image</button
			>
		</div>
		{#if recents.length}
			<div class="recent-row">
				<h3>Recent uploads</h3>
				<div class="recent-grid">
					{#each recents as source, i}
						<button
							class="recent-choice"
							class:selected={background === source}
							type="button"
							aria-label={`Use recent image ${i + 1}`}
							aria-pressed={background === source}
							disabled={!loaded || busy}
							onclick={() => choose(source)}
							><img src={source} alt="" decoding="async" />{#if background === source}<span
									class="selected-mark"
									aria-hidden="true">✓</span
								>{/if}</button
						>
					{/each}
				</div>
			</div>
		{/if}
		<div class="fit-row">
			<div>
				<h3>Image fit</h3>
				<p>
					{fit === 'cover'
						? 'Fill your desktop from edge to edge.'
						: 'Keep the entire image in view.'}
				</p>
			</div>
			<div class="fit-control" role="group" aria-label="Image fit">
				<button
					type="button"
					aria-pressed={fit === 'cover'}
					disabled={!loaded || busy}
					onclick={() => choose(background, 'cover')}>Fill</button
				>
				<button
					type="button"
					aria-pressed={fit === 'contain'}
					disabled={!loaded || busy}
					onclick={() => choose(background, 'contain')}>Fit</button
				>
			</div>
		</div>
		{#if error}<p class="upload-error" role="alert">{error}</p>{/if}
		<p class="status" role="status">
			{busy ? 'Applying background…' : notice || 'Uploaded images stay in this browser.'}
		</p>
	</div>
	<footer>
		<button
			type="button"
			class="reset-button"
			disabled={!loaded || busy}
			onclick={() => choose(defaultBackground, 'cover')}>Reset to default</button
		><button class="done-button" type="button" onclick={onclose}>Done</button>
	</footer>
</dialog>

<style>
	.wallpaper-panel {
		width: min(690px, calc(100vw - 32px));
		max-height: min(850px, calc(100dvh - 40px));
		margin: auto;
		padding: 0;
		overflow: auto;
		color: #edece4;
		background: rgba(32, 35, 30, 0.98);
		border: 1px solid rgba(237, 236, 228, 0.18);
		border-radius: 16px;
		box-shadow:
			0 40px 120px -24px #080c07b3,
			0 6px 24px #080c0733;
		backdrop-filter: blur(30px);
		font-family: var(--zen-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
		animation: panel-enter 200ms cubic-bezier(0.16, 1, 0.3, 1);
	}
	.wallpaper-panel::backdrop {
		background: #10160f75;
		backdrop-filter: blur(12px);
	}
	.wallpaper-panel,
	.wallpaper-panel * {
		box-sizing: border-box;
	}
	button {
		font: inherit;
		cursor: pointer;
		color: inherit;
	}
	button:focus-visible {
		outline: 1px solid #d3e5b0;
		outline-offset: 4px;
	}
	button {
		transition:
			background 180ms ease-out,
			color 180ms ease-out,
			border-color 180ms ease-out;
	}
	button:disabled {
		cursor: wait;
		opacity: 0.6;
	}
	header {
		position: sticky;
		top: 0;
		z-index: 2;
		background: #20231e;
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		padding: 32px 32px 28px;
		border-bottom: 1px solid #ffffff0d;
	}
	h2 {
		margin: 0;
		font: 400 35px/1.15 var(--velora-editorial, Georgia, serif);
		letter-spacing: -0.9px;
	}
	header p:last-child {
		margin: 10px 0 0;
		color: #a6ad9f;
		font-size: 12px;
	}
	.close-button {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 32px;
		height: 32px;
		margin: -6px -6px 0 12px;
		border: 0;
		border-radius: 8px;
		background: #edece407;
		color: #a6ad9f;
		transition: background 180ms ease-out;
	}
	.close-button:hover {
		background: #ffffff12;
		color: #f4f3eb;
	}
	.panel-body {
		padding: 24px 32px 12px;
	}
	h3 {
		margin: 0;
		font-size: 12px;
		font-weight: 500;
		letter-spacing: 0.1px;
	}
	.section-label {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 14px;
	}
	.section-label > span {
		font-size: 10px;
		color: #8c9485;
	}
	.collection-filters {
		display: flex;
		gap: 6px;
		margin-bottom: 20px;
	}
	.collection-filters button {
		padding: 7px 15px;
		border: 1px solid #edece414;
		border-radius: 20px;
		background: transparent;
		color: #a6ad9f;
		font-size: 12px;
	}
	.collection-filters button[aria-pressed='true'] {
		background: #d3e5b01c;
		border-color: #d3e5b055;
		color: #d3e5b0;
	}
	.collection-filters button:hover {
		border-color: #d3e5b088;
	}
	.wallpaper-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 20px 14px;
	}
	.wallpaper-choice {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		min-width: 0;
		padding: 0;
		border: 0;
		background: transparent;
		border-radius: 8px;
		text-align: left;
	}
	.thumbnail {
		position: relative;
		width: 100%;
		aspect-ratio: 1.55;
		border-radius: 8px;
		overflow: hidden;
		border: 1px solid #edece412;
		box-shadow: inset 0 0 0 1px #ffffff12;
		transition:
			border-color 180ms ease-out,
			transform 180ms ease-out;
	}
	.thumbnail img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: transform 200ms ease-out;
	}
	.wallpaper-choice:hover .thumbnail img {
		transform: scale(1.035);
	}
	.selected .thumbnail,
	.recent-choice.selected {
		border-color: #d3e5b0;
		box-shadow:
			0 0 0 2px #20221f,
			0 0 0 3px #d3e5b099;
	}
	.selected-mark {
		position: absolute;
		right: 6px;
		bottom: 6px;
		display: grid;
		place-items: center;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: #d3e5b0;
		color: #27331e;
		font-size: 12px;
		font-weight: 600;
		box-shadow: 0 1px 6px #0005;
	}
	.wallpaper-name {
		margin: 9px 0 3px;
		font-size: 12px;
		color: #edece4;
	}
	.upload-row,
	.fit-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
		padding: 20px 0;
		border-top: 1px solid #ffffff0d;
	}
	.upload-row {
		margin-top: 25px;
	}
	.upload-row p,
	.fit-row p {
		margin: 6px 0 0;
		color: #a0aa96;
		font-size: 10px;
	}
	.upload-button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 7px;
		flex-shrink: 0;
		padding: 9px 11px;
		border-radius: 7px;
		border: 1px solid #edece41f;
		background: #edece409;
		font-size: 11px;
		transition: background 180ms ease-out;
	}
	.upload-button:hover {
		background: #ffffff14;
	}
	.recent-row {
		margin: 0 0 20px;
	}
	.recent-grid {
		display: flex;
		gap: 8px;
		margin-top: 10px;
	}
	.recent-choice {
		position: relative;
		display: block;
		width: 94px;
		height: 56px;
		padding: 0;
		border: 1px solid #edece412;
		border-radius: 7px;
		overflow: hidden;
		background: #ffffff09;
	}
	.recent-choice img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.fit-control {
		display: flex;
		padding: 3px;
		border: 1px solid #ffffff0d;
		border-radius: 7px;
		background: #12170f60;
	}
	.fit-control button {
		padding: 6px 14px;
		border: 0;
		border-radius: 4px;
		background: transparent;
		color: #a0aa96;
		font-size: 11px;
	}
	.fit-control button[aria-pressed='true'] {
		background: #d3e5b01c;
		color: #d3e5b0;
		box-shadow: 0 1px 4px #0003;
	}
	.status {
		min-height: 14px;
		margin: 0 0 8px;
		color: #a0aa96;
		font-size: 10px;
		line-height: 1.5;
	}
	.upload-error {
		margin: 0 0 12px;
		padding: 10px 12px;
		border: 1px solid #d68c7833;
		border-radius: 6px;
		background: #d68c7808;
		color: #e6ad9a;
		font-size: 12px;
		line-height: 1.5;
	}
	footer {
		position: sticky;
		bottom: 0;
		z-index: 2;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 19px 32px;
		border-top: 1px solid #ffffff0d;
		background: #1e211c;
	}
	.reset-button {
		padding: 7px 0;
		border: 0;
		background: transparent;
		color: #a0aa96;
		font-size: 11px;
	}
	.reset-button:hover {
		color: #f4f3eb;
	}
	.done-button {
		padding: 10px 25px;
		border: 1px solid #d3e5b0;
		border-radius: 7px;
		background: #d3e5b0;
		color: #25301d;
		font-weight: 600;
		font-size: 11px;
	}
	.done-button:hover {
		background: #e1edc8;
	}
	@keyframes panel-enter {
		from {
			opacity: 0;
			transform: translateY(10px) scale(0.985);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}
	@media (max-width: 520px) {
		.wallpaper-panel {
			max-height: calc(100dvh - 24px);
		}
		header {
			padding: 22px 20px;
		}
		.panel-body {
			padding: 20px 20px 8px;
		}
		h2 {
			font-size: 29px;
		}
		.wallpaper-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.upload-row {
			align-items: flex-start;
			flex-direction: column;
			gap: 12px;
		}
		footer {
			padding: 14px 20px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.wallpaper-panel {
			animation: none;
		}
		.wallpaper-panel * {
			transition: none;
		}
	}
</style>
