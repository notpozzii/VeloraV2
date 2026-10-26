<script>
	let hostname = $state('');
	let loading = $state(false);
	/** @type {{ hostname: string } | null} */
	let result = $state(null);
	let error = $state('');

	async function addDomain() {
		if (import.meta.env.VITE_VELORA_S3 === '1') {
			error =
				'Domain registration needs the Cloudflare-hosted version of Velora. This S3 package cannot register domains.';
			return;
		}
		loading = true;
		error = '';
		result = null;

		try {
			const response = await fetch('/api/byod', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ hostname })
			});

			const data = await response.json();

			if (!response.ok || !data.success) {
				error = data.error || 'Could not add domain';
				return;
			}

			result = data;
		} catch {
			error = 'Something went wrong';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Bring Your Own Domain — Velora</title>
</svelte:head>

<div class="byod-page">
	<div class="byod-shell">
		<a class="brand" href="/" aria-label="Velora home"
			><span class="brand-mark" aria-hidden="true">V</span> Velora
			<span class="brand-divider">/</span> Domains</a
		>
		<section class="domain-card" aria-labelledby="page-title">
			<header>
				<div class="domain-icon" aria-hidden="true">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
						><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path
							d="M3 12h18"
						/></svg
					>
				</div>
				<h1 id="page-title">Connect a domain</h1>
				<p class="intro">Add your domain, then configure its DNS record.</p>
			</header>

			<form
				onsubmit={(event) => {
					event.preventDefault();
					if (!loading && hostname) addDomain();
				}}
				aria-busy={loading}
			>
				<div class="step-heading">
					<span class="step-number">1</span>
					<h2>Add your domain</h2>
				</div>
				<label for="hostname">Domain name</label>
				<div class="input-row">
					<input
						id="hostname"
						bind:value={hostname}
						placeholder="www.example.com"
						autocomplete="off"
						autocapitalize="none"
						spellcheck={false}
						aria-describedby="domain-hint"
						disabled={loading}
					/>
					<button type="submit" disabled={loading || !hostname}>
						{#if loading}<span class="spinner" aria-hidden="true"></span>{/if}
						{loading ? 'Adding…' : 'Add Domain'}
						{#if !loading}<span aria-hidden="true">↗</span>{/if}
					</button>
				</div>
				<p id="domain-hint" class="hint">Enter the full hostname, like www.example.com.</p>
				<p class="loading-status" role="status">{loading ? 'Adding your domain to Velora…' : ''}</p>
				{#if error}
					<div class="error-panel" role="alert">
						<strong>Couldn’t add your domain</strong>
						<p>{error}</p>
					</div>
				{/if}
			</form>

			{#if result}
				<section class="dns-panel" aria-labelledby="dns-title" role="status">
					<div class="success-heading">
						<span class="check" aria-hidden="true">✓</span>
						<div>
							<p class="eyebrow">DOMAIN ADDED</p>
							<h2 id="dns-title">Configure DNS</h2>
						</div>
					</div>
					<p class="registered-domain">{result.hostname}</p>
					<p class="dns-intro">
						Open your domain’s DNS settings and add this record to finish connecting to Velora.
					</p>
					<dl class="dns-record">
						<div>
							<dt>Type</dt>
							<dd><code class="record-type">CNAME</code></dd>
						</div>
						<div>
							<dt>Name</dt>
							<dd><code>{result.hostname.split('.')[0]}</code></dd>
						</div>
						<div>
							<dt>Target</dt>
							<dd><code>customers.formative.icu</code></dd>
						</div>
						<div>
							<dt>TTL</dt>
							<dd>Auto / Default</dd>
						</div>
					</dl>
					<p class="dns-note">
						DNS changes can take time to update. Your domain will be ready once the record is
						verified.
					</p>
				</section>
			{:else}
				<div class="next-step">
					<span class="step-number">2</span>
					<div>
						<h2>Connect your DNS</h2>
						<p>We’ll show you the CNAME record to add after you submit your domain.</p>
					</div>
				</div>
			{/if}
		</section>
	</div>
</div>

<style>
	.byod-page {
		min-height: 100svh;
		display: grid;
		place-items: center;
		padding: 48px 20px;
		box-sizing: border-box;
		background:
			radial-gradient(ellipse at 50% 0%, var(--color-surface-3), transparent 65%), var(--color-bg);
		color: var(--color-text);
		font-family: var(--font-family-body);
	}
	.byod-shell {
		width: 100%;
		max-width: 620px;
		min-width: 0;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 12px;
		width: fit-content;
		margin: 0 0 24px;
		color: var(--color-text-muted);
		text-decoration: none;
		font-size: 14px;
	}
	.brand-mark {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border: 1px solid var(--color-border-strong);
		border-radius: 9px;
		color: var(--color-text);
		font-weight: 700;
	}
	.brand-divider {
		color: var(--color-text-muted);
		opacity: 0.5;
	}
	.domain-card {
		border: 1px solid var(--color-border);
		border-radius: 24px;
		padding: 36px;
		background: var(--color-surface);
		box-shadow: 0 24px 64px var(--color-scrim);
	}
	header {
		margin-bottom: 32px;
	}
	.domain-icon {
		display: grid;
		place-items: center;
		width: 52px;
		height: 52px;
		margin-bottom: 24px;
		border-radius: 16px;
		color: var(--color-pin);
		background: color-mix(in srgb, var(--color-pin) 10%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-pin) 22%, transparent);
	}
	svg {
		width: 28px;
		height: 28px;
	}
	p,
	h1,
	h2 {
		margin: 0;
	}
	.eyebrow {
		color: var(--color-text-muted);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.16em;
		line-height: 1.6;
	}
	h1 {
		margin-top: 8px;
		font-family: var(--font-family-heading);
		font-size: clamp(27px, 5vw, 36px);
		font-weight: 700;
		line-height: 1.2;
		letter-spacing: -0.035em;
	}
	.intro {
		margin-top: 14px;
		color: var(--color-text-muted);
		line-height: 1.65;
		font-size: 14px;
		max-width: 430px;
	}
	h2 {
		font-size: 15px;
		font-weight: 600;
		line-height: 1.5;
	}
	.step-heading {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 20px;
	}
	.step-number {
		display: grid;
		place-items: center;
		width: 25px;
		height: 25px;
		flex-shrink: 0;
		border: 1px solid var(--color-border-strong);
		border-radius: 50%;
		color: var(--color-text-muted);
		font-size: 12px;
	}
	label {
		display: block;
		margin-bottom: 9px;
		font-size: 13px;
	}
	.input-row {
		display: flex;
		gap: 10px;
	}
	input,
	button {
		font: inherit;
		font-size: 14px;
		border-radius: 10px;
		min-height: 48px;
		box-sizing: border-box;
	}
	input {
		flex: 1;
		min-width: 0;
		width: 100%;
		padding: 12px 14px;
		border: 1px solid var(--color-border-strong);
		background: var(--color-bg);
		color: var(--color-text);
	}
	input::placeholder {
		color: var(--color-text-muted);
	}
	button {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 10px;
		padding: 12px 18px;
		border: 1px solid transparent;
		background: var(--color-text);
		color: var(--color-bg);
		cursor: pointer;
		font-weight: 600;
		white-space: nowrap;
		transition: opacity 0.15s;
	}
	button:hover:not(:disabled) {
		opacity: 0.85;
	}
	button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	input:disabled {
		opacity: 0.65;
	}
	input:focus-visible,
	button:focus-visible,
	.brand:focus-visible {
		outline: 2px solid var(--color-pin);
		outline-offset: 4px;
	}
	.hint,
	.loading-status,
	.dns-note {
		color: var(--color-text-muted);
		font-size: 12px;
		line-height: 1.6;
	}
	.hint {
		margin-top: 10px;
	}
	.loading-status:empty {
		display: none;
	}
	.loading-status {
		margin-top: 12px;
	}
	.error-panel {
		margin-top: 18px;
		padding: 14px 16px;
		border: 1px solid color-mix(in srgb, var(--color-danger) 45%, transparent);
		border-radius: 12px;
		background: color-mix(in srgb, var(--color-danger) 8%, transparent);
		font-size: 13px;
		line-height: 1.6;
		overflow-wrap: anywhere;
	}
	.error-panel strong {
		color: var(--color-text);
	}
	.error-panel p {
		margin-top: 4px;
	}
	.next-step {
		display: flex;
		gap: 10px;
		margin-top: 28px;
		padding-top: 24px;
		border-top: 1px solid var(--color-border);
	}
	.next-step p {
		margin-top: 5px;
		color: var(--color-text-muted);
		font-size: 13px;
		line-height: 1.6;
	}
	.dns-panel {
		margin-top: 28px;
		padding: 22px;
		border: 1px solid color-mix(in srgb, var(--color-pin) 30%, transparent);
		border-radius: 16px;
		background: color-mix(in srgb, var(--color-pin) 5%, var(--color-bg));
	}
	.success-heading {
		display: flex;
		gap: 12px;
		align-items: center;
	}
	.check {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		color: var(--color-pin);
		background: color-mix(in srgb, var(--color-pin) 14%, transparent);
	}
	.success-heading .eyebrow {
		color: var(--color-pin);
	}
	.success-heading h2 {
		margin-top: 2px;
		font-size: 20px;
		font-family: var(--font-family-heading);
	}
	.registered-domain {
		margin-top: 18px;
		overflow-wrap: anywhere;
		font-size: 14px;
		font-weight: 600;
	}
	.dns-intro {
		margin-top: 8px;
		color: var(--color-text-muted);
		font-size: 13px;
		line-height: 1.65;
	}
	.dns-record {
		margin: 18px 0 14px;
		border: 1px solid var(--color-border);
		border-radius: 10px;
		overflow: hidden;
		background: var(--color-surface);
	}
	.dns-record > div {
		display: grid;
		grid-template-columns: 65px minmax(0, 1fr);
		gap: 16px;
		padding: 12px 14px;
		align-items: baseline;
	}
	.dns-record > div + div {
		border-top: 1px solid var(--color-border);
	}
	dt {
		color: var(--color-text-muted);
		font-size: 12px;
	}
	dd {
		margin: 0;
		font-size: 13px;
		overflow-wrap: anywhere;
	}
	code {
		font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
		font-size: 12px;
	}
	.record-type {
		color: var(--color-pin);
		font-weight: 600;
		letter-spacing: 0.04em;
	}
	.spinner {
		width: 12px;
		height: 12px;
		border: 2px solid currentColor;
		border-right-color: transparent;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.spinner {
			animation: none;
		}
		button {
			transition: none;
		}
	}
	@media (max-width: 520px) {
		.byod-page {
			padding: 28px 16px;
		}
		.domain-card {
			padding: 24px 20px;
			border-radius: 20px;
		}
		.input-row {
			flex-direction: column;
		}
		button {
			width: 100%;
		}
		.dns-panel {
			padding: 16px;
		}
		.dns-record > div {
			grid-template-columns: 48px minmax(0, 1fr);
			gap: 10px;
			padding: 12px;
		}
	}
</style>
