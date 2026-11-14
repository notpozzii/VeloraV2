<script>
	import '$lib/style/settings.css';
	import { loadSetting, resetConnectionSettings } from '$lib/utils/localspace.js';
	import { saveSettingShared } from '$lib/utils/settingsSync.js';
	import { onMount } from 'svelte';
	import { connectionDefaults } from '$lib/utils/connection-reset.js';

	let lethe = $state('sj2');
	let searchEngine = $state('google');
	let car = $state('libcurl');
	let customWisp = $state('');
	let ready = $state(false);
	let resetting = $state(false);
	let resetMessage = $state('');

	onMount(async () => {
		const [savedLethe, savedSearch, savedCar, savedWisp] = await Promise.all([
			loadSetting('lethe', 'sj2'),
			loadSetting('searchEngine', 'google'),
			loadSetting('car', 'libcurl'),
			loadSetting('customWisp', '')
		]);
		lethe = savedLethe;
		searchEngine = savedSearch;
		car = savedCar;
		customWisp = savedWisp;
		ready = true;
	});

	async function resetConnection() {
		if (!ready || resetting) return;
		resetting = true;
		resetMessage = '';
		try {
			await resetConnectionSettings();
			({ lethe, car, customWisp } = connectionDefaults);
			resetMessage = 'Connection settings reset. Reload the app and try again.';
		} catch {
			resetMessage = 'Could not reset connection settings. Please try again.';
		} finally { resetting = false; }
	}

	function selectProxy(value) {
		lethe = value;
		saveSettingShared('lethe', value);
		if (value === 'auto') selectTransport('auto');
	}
	function selectSearch(value) {
		searchEngine = value;
		saveSettingShared('searchEngine', value);
	}
	function selectTransport(value) {
		car = value;
		saveSettingShared('car', value);
	}
	function updateWisp(value) {
		customWisp = value;
		saveSettingShared('customWisp', value);
	}

	const proxies = [
		{ value: 'auto', label: 'Auto (EXPERIMENTAL)' },
		{ value: 'sj2', label: 'SJ2' },
		{ value: 'sj', label: 'SJ' },
		{ value: 'uv', label: 'Ultraviolet' }
	];
	const searchEngines = [
		{ value: 'google', label: 'Google' },
		{ value: 'ddg', label: 'DuckDuckGo' },
		{ value: 'brave', label: 'Brave' }
	];
	const transports = [
		{ value: 'auto', label: 'Auto (EXPERIMENTAL)' },
		{ value: 'libcurl', label: 'Libcurl' },
		{ value: 'epoxy', label: 'Epoxy' }
	];
</script>

<div class="settings-card">
	<div class="setting-row">
		<div class="setting-copy"><label for="settings-search">Search engine</label><p>Used for searches in the browser.</p></div>
		<select id="settings-search" value={searchEngine} onchange={(e) => selectSearch(e.currentTarget.value)}>
			{#each searchEngines as engine}<option value={engine.value}>{engine.label}</option>{/each}
		</select>
	</div>
	<div class="setting-row">
		<div class="setting-copy"><label for="settings-proxy">Browser engine</label><p>Auto chooses an engine and tries alternatives if the page cannot start.</p></div>
		<select id="settings-proxy" value={lethe} onchange={(e) => selectProxy(e.currentTarget.value)}>
			{#each proxies as proxy}<option value={proxy.value}>{proxy.label}</option>{/each}
		</select>
	</div>
	<div class="setting-row">
		<div class="setting-copy"><label for="settings-transport">Transport</label></div>
		<select id="settings-transport" value={car} onchange={(e) => selectTransport(e.currentTarget.value)}>
			{#each transports as transport}<option value={transport.value}>{transport.label}</option>{/each}
		</select>
	</div>
</div>
<div class="subGroup">
	<p class="subHeading">Reset connection settings</p>
	<p class="desc">Restore the default browser engine, transport, and relay.</p>
	<button class="actionBtn" type="button" onclick={resetConnection} disabled={!ready || resetting}>
		{resetting ? 'Resetting…' : 'Reset connection settings to defaults'}
	</button>
	{#if resetMessage}<p class="desc" role="status">{resetMessage}</p>{/if}
</div>
<div class="subGroup">
	<label class="subHeading" for="settings-wisp">Custom relay</label>
	<p class="desc">Leave blank to use the default Wisp server.</p>
	<input id="settings-wisp" class="textInput" type="text" placeholder="wss://…" bind:value={customWisp} oninput={(e) => updateWisp(e.currentTarget.value)} />
</div>
