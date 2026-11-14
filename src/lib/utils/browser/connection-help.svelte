<script>
	import { connectionResetSuggestion, connectionSettingsUrl, isConnectionError } from '$lib/utils/connection-help.js';
	let { error } = $props();
</script>

{#if isConnectionError(error)}
	<div class="connection-help">
		<p>{connectionResetSuggestion}</p>
		<a href={connectionSettingsUrl} target="_top">Open connection settings</a>
	</div>
{/if}

<style>
	.connection-help { margin: 10px 0; font: 12px/1.6 system-ui, sans-serif; color: inherit; }
	p { margin: 0 0 8px; opacity: .85; }
	a { display: inline-block; border: 1px solid currentColor; border-radius: 7px; padding: 7px 11px; color: inherit; font: inherit; text-decoration: none; }
	a:hover { background: #ffffff10; }
	a:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
</style>
