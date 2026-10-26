<script>
	let { label = 'Loading…', fullscreen = false, inset = '0', layer = 5 } = $props();
</script>

<div
	class="rocket-loader"
	class:fullscreen
	style:inset
	style:z-index={layer}
	role="status"
	aria-live="polite"
	aria-label={label}
>
	<div class="flight" aria-hidden="true">
		<span class="streak one"></span><span class="streak two"></span><span class="streak three"
		></span>
		<svg class="rocket" width="88" height="88" viewBox="0 0 100 100" fill="none">
			<g transform="rotate(38 50 50)">
				<path class="flame" d="M42 70Q36 83 50 95Q64 83 58 70" fill="currentColor" opacity=".3" />
				<path class="flame core" d="M46 71Q43 80 50 86Q57 80 54 71" fill="currentColor" />
				<path
					d="M39 48L28 59V76L42 68M61 48L72 59V76L58 68"
					fill="#35452e"
					stroke="currentColor"
					stroke-width="2"
					stroke-linejoin="round"
				/>
				<path
					d="M50 9C34 22 34 48 40 68H60C66 48 66 22 50 9Z"
					fill="#d3e5b0"
					stroke="currentColor"
					stroke-width="2"
				/>
				<path d="M41 23Q50 18 59 23M41 64H59" stroke="#576a46" stroke-width="2" />
				<circle cx="50" cy="39" r="8" fill="#20251f" stroke="#849b6c" stroke-width="3" />
				<path d="M47 36L50 34" stroke="#d3e5b0" stroke-width="2" stroke-linecap="round" />
			</g>
		</svg>
		<span class="spark a">+</span><span class="spark b">·</span><span class="spark c">+</span>
	</div>
	<span class="label">{label}</span>
</div>

<style>
	.rocket-loader {
		position: absolute;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		background: #20251f;
		color: #d3e5b0;
		border-radius: inherit;
		pointer-events: none;
		animation: appear 180ms ease-out both;
	}
	.fullscreen {
		position: fixed;
	}
	.flight {
		position: relative;
		width: 160px;
		height: 128px;
	}
	.rocket {
		position: absolute;
		top: 16px;
		left: 36px;
		animation: fly 1.6s ease-in-out infinite alternate;
	}
	.flame {
		transform-origin: 50px 70px;
		animation: flicker 280ms ease-in-out infinite alternate;
	}
	.core {
		animation-delay: -140ms;
	}
	.streak {
		position: absolute;
		height: 1px;
		width: 32px;
		background: currentColor;
		opacity: 0;
		transform: rotate(-52deg);
		animation: drift 1.1s linear infinite;
	}
	.one {
		top: 25px;
		left: 29px;
	}
	.two {
		top: 60px;
		right: 0;
		animation-delay: -0.4s;
		width: 22px;
	}
	.three {
		bottom: 15px;
		left: 55px;
		animation-delay: -0.8s;
		width: 18px;
	}
	.spark {
		position: absolute;
		color: #91a87b;
		font:
			16px system-ui,
			sans-serif;
		animation: twinkle 1.6s ease-in-out infinite alternate;
	}
	.a {
		top: 10px;
		right: 21px;
	}
	.b {
		bottom: 22px;
		right: 16px;
		font-size: 24px;
		animation-delay: -0.6s;
	}
	.c {
		top: 53px;
		left: 12px;
		font-size: 11px;
		animation-delay: -0.9s;
	}
	.label {
		color: #b1bba8;
		font:
			400 12px/1.5 system-ui,
			sans-serif;
	}
	@keyframes fly {
		from {
			transform: translate(-3px, 3px);
		}
		to {
			transform: translate(4px, -4px);
		}
	}
	@keyframes flicker {
		from {
			transform: scaleY(0.7);
			opacity: 0.45;
		}
		to {
			transform: scaleY(1);
			opacity: 0.9;
		}
	}
	@keyframes drift {
		from {
			transform: translate(15px, -20px) rotate(-52deg);
			opacity: 0;
		}
		30% {
			opacity: 0.35;
		}
		to {
			transform: translate(-25px, 32px) rotate(-52deg);
			opacity: 0;
		}
	}
	@keyframes twinkle {
		from {
			opacity: 0.25;
		}
		to {
			opacity: 0.8;
		}
	}
	@keyframes appear {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.rocket-loader,
		.rocket,
		.flame,
		.streak,
		.spark {
			animation: none;
		}
		.streak {
			opacity: 0.2;
		}
	}
</style>
