<script>
	import '$lib/style/settings.css';
	import { loadSetting, saveSetting } from '$lib/utils/localspace.js';
	import { openAboutBlank, openBlob, saveTabPreset, setAntiClose } from '$lib/utils/cloak.js';
	import { onMount } from 'svelte';
	let localAutoAB = $state(false);
	let localAutoBlob = $state(false);
	let localAntiClose = $state(false);
	let hydrated = $state(false);
	let name = $state();
	let icon = $state();
	onMount(async () => {
		const [autoAB, autoBlob, antiClose, tabNameIcon] = await Promise.all([
			loadSetting('autoAB', false),
			loadSetting('autoBlob', false),
			loadSetting('antiClose', false),
			loadSetting('tabPreset', null)
		]);
		localAutoAB = autoAB;
		localAutoBlob = autoBlob;
		localAntiClose = antiClose;
		// @ts-ignore
		name = tabNameIcon?.name;
		// @ts-ignore
		icon = tabNameIcon?.icon;
		hydrated = true;
	});
	$effect(() => {
		if (!hydrated) return;
		saveSetting('autoAB', localAutoAB);
		saveSetting('autoBlob', localAutoBlob);
		saveSetting('antiClose', localAntiClose);
		saveTabPreset(name, icon);
		setAntiClose(localAntiClose);
	});
	function toggleAB() {
		localAutoAB = !localAutoAB;
		if (localAutoAB) localAutoBlob = false;
	}

	function toggleBlob() {
		localAutoBlob = !localAutoBlob;
		if (localAutoBlob) localAutoAB = false;
	}

	function toggleAntiClose() {
		localAntiClose = !localAntiClose;
	}

	const tabPresets = [
		{
			label: 'Canva',
			name: 'Home - Canva',
			icon: 'https://static.canva.com/domain-assets/canva/static/images/favicon-1.ico'
		},
		{
			label: 'Classroom',
			name: 'Home - Classroom',
			icon: 'https://ssl.gstatic.com/classroom/favicon.png'
		},
		{ label: 'Classlink', name: 'My Apps', icon: 'https://myapps.classlink.com/favicon.ico' },
		{
			label: 'Clever',
			name: 'Clever | Log in with Clever',
			icon: 'https://assets.clever.com/oauth/5dd5251fd7cf103e27c52d1b51f20683994400de/favicon.ico?1'
		},
		{
			label: 'Drive',
			name: 'Home - Google Drive',
			icon: 'https://ssl.gstatic.com/docs/doclist/images/drive_favicon_2026_32dp.png'
		},
		{
			label: 'Google',
			name: 'Google',
			icon: 'https://www.gstatic.com/images/branding/searchlogo/ico/favicon.ico'
		},
		{
			label: 'Gmail',
			name: 'Inbox',
			icon: 'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico'
		}
	];
</script>

<div class="settings-card">
	<div class="setting-row">
		<div class="setting-copy"><h2>About:blank tab</h2><p>Open Velora inside an about:blank tab.</p></div>
		<button class="actionBtn" onclick={openAboutBlank}>Open</button>
	</div>
	<div class="setting-row">
		<div class="setting-copy"><h2>Open about:blank automatically</h2></div>
		<button class="setting-switch" type="button" role="switch" aria-checked={localAutoAB} aria-label="Open about:blank automatically" disabled={!hydrated} onclick={toggleAB}><span></span></button>
	</div>
</div>
<div class="settings-card">
	<div class="setting-row">
		<div class="setting-copy"><h2>Blob tab</h2><p>Open Velora using a temporary blob URL.</p></div>
		<button class="actionBtn" onclick={openBlob}>Open</button>
	</div>
	<div class="setting-row">
		<div class="setting-copy"><h2>Open blob automatically</h2></div>
		<button class="setting-switch" type="button" role="switch" aria-checked={localAutoBlob} aria-label="Open blob automatically" disabled={!hydrated} onclick={toggleBlob}><span></span></button>
	</div>
</div>
<div class="settings-card">
	<div class="setting-row">
		<div class="setting-copy"><h2>Confirm before closing</h2><p>Show a confirmation when you leave this tab.</p></div>
		<button class="setting-switch" type="button" role="switch" aria-checked={localAntiClose} aria-label="Confirm before closing" disabled={!hydrated} onclick={toggleAntiClose}><span></span></button>
	</div>
</div>
<div class="subGroup">
	<h2 class="subHeading">Tab appearance</h2>
	<p class="desc">Choose a title and icon preset, or enter your own.</p>
	<div class="content">
		{#each tabPresets as preset}
			<button class="actionBtn" disabled={!hydrated} onclick={() => saveTabPreset(preset.name, preset.icon)}><img class="icons" src={preset.icon} alt="" />{preset.label}</button>
		{/each}
	</div>
	<div class="settings-fields">
		<label>Tab title<input class="textInput" type="text" placeholder="Tab title" bind:value={name} disabled={!hydrated} /></label>
		<label>Icon URL<input class="textInput" type="url" placeholder="https://…" bind:value={icon} disabled={!hydrated} /></label>
	</div>
</div>
