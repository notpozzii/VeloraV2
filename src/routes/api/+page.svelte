<!--
/api?url={}&type={}&transport={}&wisp={}&notif={}&autoSW={}

url:       required, https:// is added when missing, must contain a dot
type:      prism (SJv2, default), polygon (SJ), glass (UV)
transport: libcurl (default), libcurlRaw, epoxy
wisp:      wss://..., defaults to the server's own wisp
notif:     read by /os when it opens this page in a window, not by /api itself
autoSW:    legacy parameter; apps now load automatically
-->

<script>
	// @ts-nocheck

	import { page } from '$app/stores';
	import { onMount, onDestroy } from 'svelte';
	import { createProxyRuntime } from '$lib/lethe/runtime.js';
	import { prepareProxyFrame } from '$lib/lethe/prepare-frame.js';
	import { mediaPermissions } from '$lib/utils/browser/media-permissions.js';
	function normalizeUrl(raw) {
		const trimmed = (raw ?? '').trim();
		if (!trimmed) return null;
		const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
		try {
			const parsed = new URL(withProtocol);
			if (!parsed.hostname.includes('.')) return null;
			return parsed.href;
		} catch {
			return null;
		}
	}

	const api = '/api?url={}&type={}&transport={}&wisp={}&notif={}&autoSW={}';
	const params = [];
	let ready = $state(false);
	let loadError = $state('');
	let starting = $state(false);
	let iframeEl;
	const launchAbort = new AbortController();
	onDestroy(() => launchAbort.abort());
	const runtime = createProxyRuntime();
	let car = $state('libcurl');
	let prismController;
	let prismFrame;

	const apiUrl = $derived(normalizeUrl($page.url.searchParams.get('url')));
	const apiType = $derived($page.url.searchParams.get('type'));
	const apiTransport = $derived($page.url.searchParams.get('transport'));
	const apiWisp = $derived($page.url.searchParams.get('wisp') || undefined);
	const apiHost = $derived(apiUrl ? new URL(apiUrl).hostname : '');

	onMount(() => {
		if (apiUrl === null) return;
		void start();
	});

	async function start() {
		if (starting) return;
		starting = true;
		loadError = '';
		ready = false;
		try {
			await startProxy();
		} catch (error) {
			loadError = error instanceof Error ? error.message : 'Could not start the proxy.';
		} finally {
			starting = false;
		}
	}
	async function startProxy() {
		if (['libcurl', 'libcurlRaw', 'epoxy'].includes(apiTransport)) car = apiTransport;
		const session = await runtime.prepare(apiType, car, apiWisp);
		await prepareProxyFrame(iframeEl, { signal: launchAbort.signal });
		if (session.engine === 'uv') {
			iframeEl.src = window.__uv$config.prefix + window.__uv$config.encodeUrl(apiUrl);
		} else if (session.engine === 'sj') {
			iframeEl.src = session.polygon.encodeUrl(apiUrl);
		} else {
			prismController = session.controller;
			if (!prismFrame) prismFrame = prismController.createFrame(iframeEl);
			prismFrame.go(apiUrl);
		}
		ready = true;
	}

</script>

{#if loadError}
	<div role="alert" style="position:fixed;inset:16px 16px auto;z-index:10000;padding:16px;border-radius:8px;background:#242526;color:#eee;font:14px system-ui">
		{loadError}
	</div>
{/if}


<iframe
	allow={mediaPermissions}
	allowfullscreen
	bind:this={iframeEl}
	title=""
	style="opacity: {apiUrl ? '100%' : '0'};"
></iframe>

{#if loadError}
	<div class="start">
		<button onclick={start}>Try again</button>
	</div>
{/if}

<div class="guide">
	<p class="route">{api}</p>
	<dl>
		{#each params as [name, fallback, notes]}
			<dt>{name}</dt>
			<dd><span class="fallback">{fallback}</span> — {notes}</dd>
		{/each}
	</dl>
	<p class="example">/</p>
</div>

<style>
	:global(body) {
		height: 100vh;
		width: 100vw;
		margin: 0;
		border: none;
		display: flex;
		flex-direction: column;
	}
	iframe {
		width: 100%;
		flex-grow: 1;
		border: none;
		margin: 0;
		position: absolute;
		height: 100vh;
		background-color: white;
	}
	.guide {
		margin: 20px;
		font-family: monospace;
		line-height: 1.6;
		z-index: -50;
	}
	.route,
	.example {
		font-weight: bold;
	}
	.example {
		opacity: 0.6;
	}
	dl {
		margin: 12px 0;
	}
	dt {
		font-weight: bold;
	}
	dd {
		margin: 0 0 6px 20px;
	}
	.fallback {
		opacity: 0.6;
	}
	.start {
		position: fixed;
		inset: 0;
		z-index: 10;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: white;
	}
	.start button {
		font-family: monospace;
		font-size: 1rem;
		padding: 10px 18px;
		border: 1px solid black;
		background: none;
		cursor: pointer;
	}
</style>
