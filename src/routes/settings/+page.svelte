<script>
	import '$lib/style/settings.css';
	import Pref from '$lib/utils/settings/pref.svelte';
	import Themes from '$lib/utils/settings/themes.svelte';
	import Pro from '$lib/utils/settings/pro.svelte';
	import Data from '$lib/utils/settings/data.svelte';
	import About from '$lib/utils/settings/about.svelte';
	import Developer from '$lib/utils/settings/developer.svelte';
	import Icon from '$lib/utils/browser/icon.svelte';
	let activeSection = $state('pref');
	const sections = [
		{ name: 'General', id: 'pref', icon: 'settings' },
		{ name: 'Connection', id: 'pro', icon: 'globe' },
		{ name: 'Appearance', id: 'themes', icon: 'apps' },
		{ name: 'Data', id: 'data', icon: 'bookmark' },
		{ name: 'Developer', id: 'developer', icon: 'activity' },
		{ name: 'About', id: 'about', icon: 'star' }
	];
</script>

<svelte:head><title>Velora — Settings</title></svelte:head>

<div class="settings-shell">
	<aside class="settings-nav" aria-label="Settings categories">
		<div class="settings-brand"><Icon name="settings" size={20} /> Settings</div>
		<nav aria-label="Settings navigation">
			{#each sections as section}
				<button type="button" class="navBtn" class:active={activeSection === section.id}
					aria-current={activeSection === section.id ? 'page' : undefined}
					aria-controls={section.id}
					onclick={() => { activeSection = section.id; window.scrollTo({ top: 0 }); }}
				><Icon name={section.icon} size={17} /><span>{section.name}</span></button>
			{/each}
		</nav>
		<a class="settings-desktop" href="/os" target="_top"><Icon name="back" size={16} /> Back to desktop</a>
	</aside>
	<main class="settings-main">
		<header class="settings-heading"><h1>{sections.find((section) => section.id === activeSection)?.name}</h1></header>
		<section class="block" id="pref" hidden={activeSection !== 'pref'} aria-label="General"><Pref /></section>
		<section class="block" id="pro" hidden={activeSection !== 'pro'} aria-label="Connection"><Pro /></section>
		<section class="block" id="themes" hidden={activeSection !== 'themes'} aria-label="Appearance"><Themes /></section>
		<section class="block" id="data" hidden={activeSection !== 'data'} aria-label="Data"><Data /></section>
		<section class="block" id="developer" hidden={activeSection !== 'developer'} aria-label="Developer"><Developer /></section>
		<section class="block" id="about" hidden={activeSection !== 'about'} aria-label="About"><About /></section>
	</main>
</div>
