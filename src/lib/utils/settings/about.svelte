<script>
	import '$lib/style/settings.css';

	const version = 'v1.3';
	const info = [
		{ key: 'Version', value: version },
		{ key: 'Developer', value: 'pozzi' },
		{ key: 'Released', value: '2026' }
	];

	const credits = [
		{ label: 'Discord', url: 'https://discord.gg/3vcMsqJMd' }
	];

	let modal = $state(false);
	let link = $state('');
	let linkLabel = $state('');
	let copied = $state(false);

	function launchModal(item) {
		link = item.url;
		linkLabel = item.label;
		copied = false;
		modal = true;
	}

	function closeModal() {
		modal = false;
	}

	async function copyLink() {
		if (!link) return;
		try {
			await navigator.clipboard.writeText(link);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			copied = false;
		}
	}

	function continueToSite() {
		if (!link) return;
		window.open(link, '_blank', 'noopener');
		closeModal();
	}
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && closeModal()} />


<div class="group">
	<div class="subGroup">
		<p class="subHeading">Velora</p>

		<div class="infoRows">
			{#each info as row}
				<div class="infoRow">
					<span class="infoKey">{row.key}</span>
					<span class="infoVal">{row.value}</span>
				</div>
			{/each}
		</div>
	</div>

</div>

<div class="divider"></div>

<div class="group">
	<div class="subGroup">
		<p class="subHeading">Credits</p>
		<div class="content">
			{#each credits as item}
				<button class="actionBtn" onclick={() => launchModal(item)}
					><span>{item.label}</span></button
				>
			{/each}
		</div>
	</div>

	<div class="subGroup">
		<p class="subHeading">Original developer</p>
		<div class="content">
			<div class="infoRows">
				<div class="infoRow">
					<span class="infoKey">DC User</span>
					<span class="infoVal">notpozzii</span>
				</div>
				<div class="infoRow">
					<span class="infoKey">Email</span>
					<span class="infoVal">Unknown</span>
				</div>
			</div>
		</div>
	</div>
</div>

{#if modal}
	<div class="modal" role="dialog" aria-modal="true" aria-label="External link">
		<button class="modalBackdrop" aria-label="Close dialog" onclick={closeModal}></button>
		<div class="modalBox">
			<p class="modalTitle">Leaving Velora</p>
			{#if link}
				<p class="desc modalText">You're about to open <strong>{linkLabel}</strong>:</p>
				<p class="modalUrl">{link}</p>
			{:else}
				<p class="desc modalText">No link is set for <strong>{linkLabel}</strong> yet.</p>
			{/if}
			<div class="buttons">
				<button class="toggleBtn" onclick={closeModal}>Cancel</button>
				<button class="actionBtn" onclick={copyLink} disabled={!link}>
					{copied ? 'Copied!' : 'Copy link'}
				</button>
				<button class="actionBtn active" onclick={continueToSite} disabled={!link}>
					Continue to site
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.infoRows {
		margin: 16px 0 0 20px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.infoRow {
		display: flex;
		align-items: center;
		gap: 16px;
	}
	.infoKey {
		min-width: 110px;
		color: var(--color-text-muted);
		font-family: var(--font-family-heading);
		font-size: 15px;
	}
	.infoVal {
		color: var(--color-text);
		font-size: 15px;
	}

	.modal {
		position: fixed;
		inset: 0;
		z-index: 2000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
		box-sizing: border-box;
	}
	.modalBackdrop {
		position: absolute;
		inset: 0;
		border: none;
		background: rgba(0, 0, 0, 0.55);
		backdrop-filter: blur(4px);
		cursor: pointer;
	}
	.modalBox {
		position: relative;
		z-index: 1;
		width: min(460px, 100%);
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 26px;
		background: var(--color-surface-2);
		border: 1px solid var(--color-border);
		border-radius: 16px;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.55);
	}
	.modalTitle {
		margin: 0;
		font-family: var(--font-family-heading);
		font-size: 20px;
		color: var(--color-text);
	}
	.modalText {
		margin: 0;
	}
	.modalUrl {
		margin: 0;
		padding: 10px 14px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		color: var(--color-text-muted);
		font-family: var(--font-family-body);
		font-size: 13px;
		word-break: break-all;
	}
	.buttons {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}
	.actionBtn:disabled {
		opacity: 0.5;
		pointer-events: none;
	}
</style>
