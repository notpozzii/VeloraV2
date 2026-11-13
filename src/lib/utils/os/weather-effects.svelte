<script>
	import { onMount } from 'svelte';
	import { normalizeWeatherMode, normalizeWeatherSpeed, normalizeWeatherIntensity } from './weather.js';
	let { mode = 'off', speed = 1, intensity = 60 } = $props();
	let visible = $state(true);
	let reducedMotion = $state(true);
	const effect = $derived(normalizeWeatherMode(mode));
	const rate = $derived(normalizeWeatherSpeed(speed));
	const strength = $derived(normalizeWeatherIntensity(intensity));
	const isRain = $derived(effect === 'rain' || effect === 'storm');
	const snow = Array.from({ length: 52 }, (_, i) => ({
		left: ((i * 37 + 11) % 103) - 1, size: 2 + i % 4,
		duration: 12 + (i * 7) % 15, delay: -((i * 13) % 29),
		drift: ((i * 19) % 120) - 60, opacity: .25 + (i % 5) * .12
	}));
	const rain = Array.from({ length: 100 }, (_, i) => ({
		left: ((i * 43 + 7) % 111) - 7, size: 13 + i % 15,
		duration: .55 + ((i * 7) % 11) / 16,
		phase: ((i * 17) % 100) / 100, opacity: .28 + (i % 5) * .11
	}));
	const particles = $derived(effect === 'snow'
		? snow.slice(0, Math.round(16 + strength * .36))
		: rain.slice(0, Math.min(100, Math.round(24 + strength * (effect === 'storm' ? .76 : .64)))));

	onMount(() => {
		const preference = matchMedia('(prefers-reduced-motion: reduce)');
		const motion = () => { reducedMotion = preference.matches; };
		const visibility = () => { visible = !document.hidden; };
		motion(); visibility();
		preference.addEventListener('change', motion);
		document.addEventListener('visibilitychange', visibility);
		return () => {
			preference.removeEventListener('change', motion);
			document.removeEventListener('visibilitychange', visibility);
		};
	});
</script>

{#if effect !== 'off'}
	<div class="weather-effect" class:paused={!visible} class:reduced={reducedMotion}
		class:storm={effect === 'storm'} class:rainy={isRain} aria-hidden="true"
		data-weather-effect={effect} style:--weather-strength={strength / 100}>
		{#if isRain}<div class="weather-atmosphere"></div>{/if}
		{#if !reducedMotion && (effect === 'snow' || isRain)}
			<div class="weather-particles" class:snow={effect === 'snow'} class:rain={isRain}>
				{#each particles as particle}
					<span style:left={`${particle.left}%`}
						style:--size={`${particle.size * (effect === 'storm' ? 1.5 : 1)}px`}
						style:--duration={`${particle.duration / rate}s`}
						style:--delay={`${effect === 'snow' ? particle.delay / rate : -particle.phase * particle.duration / rate}s`}
						style:--drift={`${effect === 'snow' ? particle.drift : effect === 'storm' ? 240 : 150}px`}
						style:opacity={particle.opacity * (.45 + strength / 200)}></span>
				{/each}
			</div>
		{/if}
		{#if effect === 'storm' && !reducedMotion}
			<div class="storm-lightning"><svg viewBox="0 0 160 600" fill="none"><path d="m90-10-46 165 54-18-64 196 51-26-43 150" stroke="#e7f0ff" stroke-width="3" stroke-linejoin="round" /></svg></div>
		{/if}
		{#if effect === 'fog'}<div class="fog-bank" style:animation-duration={`${42 / rate}s`}></div><div class="fog-bank second" style:animation-duration={`${57 / rate}s`}></div>{/if}
		{#if effect === 'sunshine'}<div class="sun-glow" style:--sun-duration={`${36 / rate}s`}></div>{/if}
	</div>
{/if}

<style>
	.weather-effect { position:absolute; inset:0; z-index:0; overflow:hidden; pointer-events:none; contain:strict; }
	.weather-atmosphere { position:absolute; inset:0; background:linear-gradient(#1e334855,#22334418); opacity:var(--weather-strength); }
	.storm .weather-atmosphere { background:linear-gradient(#0b182baf,#18233422 75%); }
	.weather-particles { position:absolute; inset:0; }
	.weather-particles span { position:absolute; top:-44px; }
	.snow span { width:var(--size); height:var(--size); border-radius:50%; background:#fff; animation:snow-fall var(--duration) var(--delay) linear infinite; }
	.rain span { width:1px; height:var(--size); border-radius:2px; background:linear-gradient(transparent,#d2e4f6); animation:rain-fall var(--duration) var(--delay) linear infinite; }
	.storm .rain span { width:1.4px; }
	.storm-lightning { position:absolute; inset:0; background:linear-gradient(120deg,#dce9ff88,#b2c9f318 65%); opacity:0; animation:lightning 16s -12.4s linear infinite; }
	.storm-lightning svg { position:absolute; left:72%; top:0; height:65%; width:auto; }
	.fog-bank { position:absolute; inset:-10% -25%; background:radial-gradient(ellipse at 22% 70%,#dce4e5b3,transparent 55%),radial-gradient(ellipse at 78% 40%,#d0dddd88,transparent 52%); opacity:calc(var(--weather-strength) * .5); animation:fog-drift 42s ease-in-out infinite alternate; }
	.fog-bank.second { background:radial-gradient(ellipse at 60% 80%,#e0e9e8ad,transparent 60%); animation-duration:57s; animation-direction:alternate-reverse; }
	.sun-glow { position:absolute; inset:-10%; background:radial-gradient(ellipse at 88% 0%,#ffedb0b3,transparent 48%),conic-gradient(from 185deg at 88% 0%,transparent 0deg,#fff4cb33 10deg,transparent 20deg,#fff1b833 32deg,transparent 48deg); opacity:calc(var(--weather-strength) * .35); animation:sun-drift var(--sun-duration) ease-in-out infinite alternate; }
	.paused *, .paused *::before, .paused *::after { animation-play-state:paused !important; }
	.reduced .fog-bank, .reduced .sun-glow { animation:none; }
	@keyframes snow-fall { from { transform:translate3d(0,-2vh,0); } to { transform:translate3d(var(--drift),110vh,0); } }
	@keyframes rain-fall { from { transform:translate3d(0,-5vh,0) rotate(-12deg); } to { transform:translate3d(var(--drift),115vh,0) rotate(-12deg); } }
	@keyframes lightning { 0%,86%,94%,100% { opacity:0; } 89% { opacity:calc(var(--weather-strength) * .16); } }
	@keyframes fog-drift { from { transform:translate3d(-5%,2%,0); } to { transform:translate3d(6%,-2%,0); } }
	@keyframes sun-drift { from { transform:translate3d(-1%,0,0); } to { transform:translate3d(2%,2%,0); } }
	@media(prefers-reduced-motion:reduce) { .weather-effect * { animation:none !important; } .weather-particles,.storm-lightning { display:none; } }
</style>
