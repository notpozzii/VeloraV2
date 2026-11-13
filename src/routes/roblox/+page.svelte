<script>
	import { onMount, onDestroy, tick } from 'svelte';
	import { createPrismController } from '$lib/lethe/prism.js';
	import { loadSetting } from '$lib/utils/localspace.js';
	import { createRobloxNetwork, parsePlace } from '$lib/roblox/network.js';
	import { ROBLOX_BUILD } from '$lib/roblox/build.js';
	import mark from '$lib/assets/velora-mark.svg';
	import { createBrowsePlugin, browserMessage, VELORA_DISCORD_URL } from '$lib/roblox/browse.js';
	import { ROBLOX_THEME_KEY, robloxTheme } from '$lib/roblox/themes.js';
	import { ROBLOX_CUSTOM_THEME_KEY, parseCustomTheme } from '$lib/roblox/custom-theme.js';
	import { robloxPlaybackSupport } from '$lib/roblox/compatibility.js';
	import { prepareProxyFrame, resetProxyFrame } from '$lib/lethe/prepare-frame.js';

	let state = $state('preparing');
	let status = $state('Preparing your connection…');
	let error = $state('');
	let place = $state('1818');
	let user = $state(null);
	let playing = $state(false);
	let browsing = $state(false);
	let launching = false;
	let browserPaused = false;
	let siteElement, engineElement, controller, channel;
	let siteFrame = $state(null);
	let network = $state(null);
	let alive = true;
	let nonce = '';
	let browseNonce = '';
	let selectedTheme = 'velora';
	let savedCustomTheme = null;
	let connectionContext = { relay: 'unknown', transport: 'unknown' };
	const issues = $state([]);

	function issue(text) {
		issues.push({ time: new Date().toLocaleTimeString(), text });
		if (issues.length > 12) issues.shift();
	}

	async function refreshUser() {
		if (!network || !alive) return;
		try {
			const next = await network.user();
			if (!alive) return;
			user = next;
			return next;
		} catch (e) { if (alive) issue(e.message || 'The sign-in check failed.'); }
	}

	onMount(() => {
		try { savedCustomTheme = parseCustomTheme(JSON.parse(localStorage.getItem(ROBLOX_CUSTOM_THEME_KEY))); } catch {}
		try { selectedTheme = robloxTheme(localStorage.getItem(ROBLOX_THEME_KEY)); } catch {}
		if (selectedTheme === 'custom' && !savedCustomTheme) selectedTheme = 'velora';
		const receive = async event => {
			const message = browserMessage(event, siteElement, location.origin, browseNonce);
			if (message?.type === 'discord') { window.open(VELORA_DISCORD_URL, '_blank', 'noopener,noreferrer'); return; }
			if (message?.type === 'theme') {
				if (message.theme === 'custom' && !savedCustomTheme) return;
				selectedTheme = message.theme;
				try { localStorage.setItem(ROBLOX_THEME_KEY, selectedTheme); } catch { issue('Theme applied for this visit. This browser could not save the preference.'); }
				return;
			}
			if (message?.type === 'custom-theme') {
				savedCustomTheme = message.customTheme;
				selectedTheme = 'custom';
				try {
					localStorage.setItem(ROBLOX_CUSTOM_THEME_KEY, JSON.stringify(savedCustomTheme));
					localStorage.setItem(ROBLOX_THEME_KEY, selectedTheme);
				} catch { issue('Theme applied for this visit. This browser could not save the preference.'); }
				return;
			}
			if (message?.type === 'ready') {
				if (browserPaused) return;
				browsing = true;
				if (!playing) { state = 'ready'; status = 'Browse Roblox and press Play to launch in Velora.'; }
				void refreshUser();
				return;
			}
			if (message?.type === 'play') { place = message.placeId; void play(); return; }
			if (event.origin !== location.origin || event.source !== engineElement?.contentWindow || event.data?.nonce !== nonce) return;
			if (event.data.type === 'velora:roblox-cancel') { stop(); return; }
			if (event.data.type === 'velora:roblox-ready') {
				channel?.close();
				const connection = new MessageChannel();
				channel = connection.port1;
				const replyPort = channel;
				channel.onmessage = async ({ data }) => {
					if (data.type === 'request') {
						try {
							const result = await network.request(data.url, data.init);
							replyPort.postMessage({ type: 'response', id: data.id, result }, [result.body]);
						} catch (e) { replyPort.postMessage({ type: 'response', id: data.id, error: e.message || 'Roblox request failed.' }); }
					} else if (data.type === 'status') {
						if (data.phase === 'diagnostic') { issue(data.text); return; }
						status = data.text;
						if (data.phase === 'error') { issue(data.text); error = data.text; state = 'error'; }
						else if (data.phase === 'rendered') state = 'playing';
					} else if (data.type === 'exit') stop();
				};
				event.source.postMessage({ type: 'velora:roblox-connect', nonce, build: ROBLOX_BUILD, connection: { ...connectionContext, signedIn: !!user } }, location.origin, [connection.port2]);
			}
		};
		window.addEventListener('message', receive);
		(async () => {
			try {
				const [selectedCar, wisp] = await Promise.all([
					loadSetting('car', 'libcurl'), loadSetting('customWisp', '')
				]);
				controller = await createPrismController(selectedCar === 'epoxy' ? 'epoxy' : 'libcurl', wisp || undefined);
				if (!alive) return;
				connectionContext = { relay: wisp ? 'custom' : 'default', transport: selectedCar === 'epoxy' ? 'epoxy' : 'libcurl' };
				network = createRobloxNetwork(controller, result => {
					if (result.type === 'join-request') issue(`Join request: ${result.path}; fields: ${result.fields.join(', ') || 'none'}.`);
					if (result.type === 'join') issue(`Game join: HTTP ${result.status}, result ${result.result ?? 'unknown'}.`);
					if (result.type === 'http-error') issue(`HTTP ${result.status}: ${result.host}${result.path}`);
				});
				browseNonce = crypto.randomUUID();
				siteFrame = controller.createFrame(siteElement, { plugins: [createBrowsePlugin(window.$scramjetController.ManagedPlugin, browseNonce, () => selectedTheme, () => savedCustomTheme)] });
				// The website handles sign-in itself. Refresh the account after it
				// opens (the ready message), rather than delaying the first page.
				await prepareProxyFrame(siteElement, { frameUrl: '/roblox/auth.html' });
				siteFrame.go('https://www.roblox.com/home');
				status = 'Opening Roblox…';
			} catch (e) { if (alive) { state = 'error'; error = e.message || 'Could not start the connection.'; status = 'Connection unavailable'; } }
		})();
		return () => window.removeEventListener('message', receive);
	});

	function browserLoaded() {
		// Show the upstream error document too if a connection fails before the
		// Play bridge can run, instead of leaving the loading cover in place.
		if (siteFrame && siteElement?.src.startsWith(location.origin + siteFrame.prefix)) browsing = true;
	}

	async function play() {
		if (launching || playing) return;
		const id = parsePlace(place);
		if (!id) return;
		launching = true;
		try {
			const support = robloxPlaybackSupport(window);
			if (!support.supported) throw new Error(support.message);
			status = 'Checking your Roblox sign-in…';
			const signedIn = await refreshUser();
			if (!signedIn) { error = 'Log in on Roblox, then press Play again.'; status = 'Roblox sign-in required'; return; }
			error = '';
			state = 'loading';
			status = 'Loading the Roblox engine…';
			// The account session lives in the connection's cookie jar. Release
			// the heavy website document while the game needs the available RAM.
			browserPaused = true;
			browsing = false;
			resetProxyFrame(siteElement);
			siteElement.src = 'about:blank';
			playing = true;
			nonce = crypto.randomUUID();
			await tick();
			engineElement.src = `/roblox/play.html?placeId=${encodeURIComponent(id)}&nonce=${encodeURIComponent(nonce)}`;
		} catch (e) { error = e.message || 'Could not open this experience.'; }
		finally { launching = false; }
	}
	function stop() {
		channel?.close(); channel = undefined;
		engineElement?.setAttribute('src', 'about:blank');
		playing = false; error = ''; state = 'ready'; status = 'Browse Roblox and press Play to launch in Velora.';
		if (browserPaused) void restoreBrowser();
	}
	async function restoreBrowser() {
		try {
			await prepareProxyFrame(siteElement, { frameUrl: '/roblox/auth.html' });
			if (!alive || playing) return;
			browserPaused = false;
			siteFrame.go(`https://www.roblox.com/games/${place}`);
		} catch (e) {
			if (alive) { state = 'error'; error = e.message || 'Could not reopen Roblox.'; }
		}
	}
	onDestroy(() => {
		alive = false; channel?.close(); network?.dispose();
	});
</script>

<svelte:head><title>Home — Velora</title><link rel="icon" href={mark} /><meta name="robots" content="noindex" /></svelte:head>

<div class="roblox-client">
	{#if error && !playing}<p class="session-error" role="alert">{error}{#if state === 'error'}<button class="secondary" onclick={() => location.reload()}>Try again</button>{/if}</p>{/if}
	<div class="browser" class:hidden={playing}>
		{#if !browsing}<div class="loading" role="status"><span class="spinner"></span><strong>Opening Roblox</strong><p>The real Roblox website. Play here in Velora.</p></div>{/if}
		<iframe bind:this={siteElement} onload={browserLoaded} title="Roblox website" allow="clipboard-write; fullscreen" allowfullscreen></iframe>
	</div>
	<iframe class="engine" class:active={playing} bind:this={engineElement} title="Roblox experience" allow="autoplay; fullscreen; gamepad; clipboard-write; cross-origin-isolated" allowfullscreen></iframe>
</div>

<style>
	:global(body){margin:0;background:#191a1f}.roblox-client{height:100dvh;display:flex;flex-direction:column;background:#191a1f;color:#edf0f7;font-family:Arial,Helvetica,system-ui,sans-serif}button{font:inherit;cursor:pointer;border:0}.secondary{background:#ffffff0c;border:1px solid #ffffff1f;color:#e1e7f5;border-radius:7px;padding:9px 14px;font-size:12px;white-space:nowrap}.secondary:hover{background:#ffffff17}.session-error{display:flex;align-items:center;gap:14px;color:#f1b6aa;font-size:12px;line-height:1.6;padding:0 14px}.browser{flex:1;min-height:0;position:relative}.browser.hidden{display:none}.browser iframe,.engine{border:0;width:100%;height:100%;background:#191a1f}.engine{display:none;flex:1;min-height:0}.engine.active{display:block}.loading{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#191a1f;pointer-events:none;gap:14px;z-index:1}.loading strong{font-size:18px}.loading p{color:#a8b0bd;font-size:13px;margin:0}.spinner{width:24px;height:24px;border:2px solid #ffffff20;border-top-color:#cce4a0;border-radius:50%;animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
</style>
