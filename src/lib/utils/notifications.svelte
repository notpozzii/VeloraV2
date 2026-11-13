<script>
	import { notif } from '$lib/stores/index';
</script>

{#if $notif}{#key $notif}<div class="notification" role="status"><p>{$notif}</p></div>{/key}{/if}

<style>
	.notification {
		position: absolute;
		min-width: 135px;
		max-width: 220px;
		padding: 12px 16px;
		border-radius: 12px;
		right: -280px;
		margin: 35px 10px;
		background-color: var(--color-bg);
		border: 1px solid rgba(255, 255, 255, 0.08);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 13px;
		opacity: 0;
		z-index: 10000;
		animation: notify 2750ms ease-in-out both;
	}
	@keyframes notify {
		0%, 100% { transform: translateX(0) scale(.95); opacity: 0; }
		16%, 89% { transform: translateX(-280px) scale(1); opacity: 1; }
	}
	@media (prefers-reduced-motion: reduce) {
		.notification { animation-name: notify-still; }
		@keyframes notify-still { 0%, 89% { transform: translateX(-280px); opacity: 1; } 100% { transform: translateX(-280px); opacity: 0; } }
	}

	.notification p {
		margin: 0;
		line-height: 1.4;
	}
</style>
