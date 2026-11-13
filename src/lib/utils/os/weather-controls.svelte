<script>
	import { onMount } from 'svelte';
	import { loadSetting, onSettingChange } from '$lib/utils/localspace.js';
	import { saveSettingShared } from '$lib/utils/settingsSync.js';
	import Icon from '$lib/utils/browser/icon.svelte';
	import { weatherOptions, loadWeatherPreferences, normalizeWeatherMode, normalizeWeatherSpeed, normalizeWeatherIntensity } from './weather.js';
	let mode = $state('off');
	let speed = $state(1);
	let intensity = $state(60);
	let ready = $state(false);
	let error = $state('');
	let pending = Promise.resolve();
	onMount(() => {
		let alive = true;
		loadWeatherPreferences({ read: loadSetting, write: saveSettingShared }).then(value => {
			if (alive) { mode = value.mode; speed = value.speed; intensity = value.intensity; }
		}).catch(() => { if (alive) error = 'Your saved weather could not be loaded.'; })
			.finally(() => { if (alive) ready = true; });
		const stops = [
			onSettingChange('weatherMode', value => { mode = normalizeWeatherMode(value); }),
			onSettingChange('weatherSpeed', value => { speed = normalizeWeatherSpeed(value); }),
			onSettingChange('weatherIntensity', value => { intensity = normalizeWeatherIntensity(value); })
		];
		return () => { alive = false; stops.forEach(stop => stop()); };
	});
	function persist(key, value) {
		error = '';
		pending = pending.then(() => saveSettingShared(key, value))
			.catch(() => { error = 'Weather could not be saved. Try again.'; });
	}
</script>

<section class="weather-card" aria-labelledby="weather-heading">
	<div class="weather-heading"><h3 id="weather-heading">Weather</h3><p>Add an effect to any wallpaper.</p></div>
	<div class="weather-options" role="group" aria-label="Weather effect">
		{#each weatherOptions as option}
			<button type="button" aria-pressed={mode === option.id} disabled={!ready}
				onclick={() => { mode = option.id; persist('weatherMode', mode); }}>
				<Icon name={option.icon} size={21} /><span>{option.label}</span>
			</button>
		{/each}
	</div>
	{#if mode !== 'off'}
		<div class="weather-sliders">
			<label><span>Speed</span><output>{speed.toFixed(2).replace(/0$/, '').replace(/\.0$/, '')}×</output>
				<input type="range" aria-label="Weather speed" min="0.25" max="3" step="0.25" value={speed} disabled={!ready}
					oninput={(event) => { speed = normalizeWeatherSpeed(event.currentTarget.value); persist('weatherSpeed', speed); }} />
			</label>
			<label><span>Intensity</span><output>{intensity}%</output>
				<input type="range" aria-label="Weather intensity" min="25" max="100" step="5" value={intensity} disabled={!ready}
					oninput={(event) => { intensity = normalizeWeatherIntensity(event.currentTarget.value); persist('weatherIntensity', intensity); }} />
			</label>
		</div>
		<p class="motion-note">Motion is reduced to match your device settings.</p>
	{/if}
	{#if error}<p class="weather-error" role="alert">{error}</p>{/if}
</section>

<style>
	.weather-card { margin:0 0 26px; padding:17px; border:1px solid #d3e5b02e; border-radius:13px; background:#d3e5b008; color:inherit; }
	.weather-heading { display:flex; align-items:baseline; gap:14px; margin-bottom:15px; }
	h3 { margin:0; font-size:14px; font-weight:550; }
	.weather-heading p { margin:0; color:#aeb8a4; font-size:12px; line-height:1.5; }
	.weather-options { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:7px; }
	.weather-options button { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; min-width:0; min-height:65px; padding:9px 3px; border:1px solid #d3e5b01c; border-radius:9px; background:#ffffff04; color:#bcc6b2; font:inherit; font-size:10px; cursor:pointer; }
	.weather-options button:hover { background:#d3e5b012; border-color:#d3e5b040; }
	.weather-options button[aria-pressed='true'] { border-color:#d3e5b086; background:#d3e5b021; color:#e4efcd; }
	.weather-options button:disabled { opacity:.5; cursor:wait; }
	.weather-options span { white-space:nowrap; }
	.weather-sliders { display:grid; grid-template-columns:1fr 1fr; gap:25px; margin-top:18px; padding-top:15px; border-top:1px solid #d3e5b020; }
	label { display:grid; grid-template-columns:1fr auto; gap:11px; font-size:12px; }
	output { color:#d3e5b0; font-variant-numeric:tabular-nums; }
	input { grid-column:1/-1; width:100%; margin:0; accent-color:#d3e5b0; cursor:pointer; }
	input:focus-visible,button:focus-visible { outline:2px solid #d3e5b0; outline-offset:3px; }
	.weather-error { margin:14px 0 0; font-size:12px; color:#ffb4ab; }
	.motion-note { display:none; color:#aeb8a4; font-size:11px; line-height:1.5; margin:14px 0 0; }
	@media(max-width:600px) { .weather-options { grid-template-columns:repeat(3,minmax(0,1fr)); } }
	@media(max-width:480px) { .weather-card { padding:13px; } .weather-heading { align-items:flex-start; flex-direction:column; gap:5px; } .weather-sliders { gap:16px; } }
	@media(prefers-reduced-motion:reduce) { .motion-note { display:block; } }
</style>
