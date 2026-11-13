import { parseCustomTheme } from './custom-theme.js';

export const ROBLOX_THEME_KEY = 'velora:roblox-theme:v1';

export const ROBLOX_THEMES = [
	{ id: 'roblox', name: 'Roblox', description: 'The original Roblox website appearance.', colors: { page: '#121318', surface: '#202227', raised: '#2c2f36', text: '#f3f4f7', muted: '#b2b8c3', header: '#202227', nav: '#f3f4f7', border: '#3c414b', accent: '#6685ff', onAccent: '#10182e', play: '#5271ff', onPlay: '#ffffff' } },
	{ id: 'classic', name: 'Classic 2017', description: 'Blue navigation, gray pages, and squared panels.', colors: { page: '#e3e3e3', surface: '#ffffff', raised: '#f2f2f2', text: '#343434', muted: '#666666', header: '#0074bd', nav: '#ffffff', border: '#cccccc', accent: '#0074bd', onAccent: '#ffffff', play: '#008f3c', onPlay: '#ffffff' } },
	{ id: 'light', name: 'Light', description: 'Bright pages with clean white panels.', colors: { page: '#f2f4f5', surface: '#ffffff', raised: '#e9ecef', text: '#202227', muted: '#606773', header: '#ffffff', nav: '#202227', border: '#d8dce2', accent: '#335fff', onAccent: '#ffffff', play: '#335fff', onPlay: '#ffffff' } },
	{ id: 'dark', name: 'Dark', description: 'Charcoal panels and a softer dark background.', colors: { page: '#121318', surface: '#202227', raised: '#2c2f36', text: '#f3f4f7', muted: '#b2b8c3', header: '#202227', nav: '#f3f4f7', border: '#3c414b', accent: '#6685ff', onAccent: '#10182e', play: '#5271ff', onPlay: '#ffffff' } },
	{ id: 'velora', name: 'Velora', description: 'Forest green with Velora’s soft sage accents.', colors: { page: '#18201b', surface: '#252f27', raised: '#334036', text: '#eff4e8', muted: '#bdc8b6', header: '#252f27', nav: '#eff4e8', border: '#475346', accent: '#d3e5b0', onAccent: '#20281b', play: '#d3e5b0', onPlay: '#20281b' } }
];

export function robloxTheme(value) {
	return value === 'custom' || ROBLOX_THEMES.some(theme => theme.id === value) ? value : 'velora';
}

export const ROBLOX_THEME_CSS = `
html[data-velblox-theme=roblox] #nav-logo-link > .velblox-wordmark { display: none !important; }
html.velblox-modern body {
  --color-surface-0: var(--vb-page) !important;
  --color-surface-100: var(--vb-surface) !important;
  --color-surface-200: var(--vb-surface) !important;
  --color-surface-300: var(--vb-raised) !important;
  --color-content-default: var(--vb-text) !important;
  --color-content-emphasis: var(--vb-text) !important;
  --color-content-muted: var(--vb-muted) !important;
  --color-content-link: var(--vb-accent) !important;
  --color-action-emphasis-background: var(--vb-accent) !important;
  --color-action-emphasis-foreground: var(--vb-onAccent) !important;
  --color-action-standard-background: var(--vb-raised) !important;
  --color-action-standard-foreground: var(--vb-text) !important;
  --color-action-sub-emphasis-background: var(--vb-surface) !important;
  --color-action-sub-emphasis-foreground: var(--vb-text) !important;
  --color-action-link-foreground: var(--vb-accent) !important;
  --color-stroke-default: var(--vb-border) !important;
  --color-stroke-emphasis: var(--vb-border) !important;
  --color-stroke-contrast-alpha: var(--vb-border) !important;
  background: var(--vb-page) !important;
  color: var(--vb-text) !important;
  color-scheme: dark !important;
}
html.velblox-modern[data-velblox-scheme=light] body { color-scheme: light !important; }
html.velblox-modern #header.rbx-header {
  background: var(--vb-header) !important;
  color: var(--vb-nav) !important;
  border-bottom: 1px solid var(--vb-border) !important;
}
html.velblox-modern #header :is(.rbx-navbar a,.navbar-brand,#velora-navigation-note) { color: var(--vb-nav) !important; }
html.velblox-modern #header .navbar-search,
html.velblox-modern #header .navbar-search input,
html.velblox-modern #header .navbar-search .input-group-btn { background: var(--vb-raised) !important; color: var(--vb-text) !important; }
html.velblox-modern #header .navbar-search input::placeholder { color: var(--vb-muted) !important; }
html.velblox-modern .rbx-left-col { background: var(--vb-surface) !important; color: var(--vb-text) !important; border-right: 1px solid var(--vb-border) !important; }
html.velblox-modern .rbx-left-col a { color: var(--vb-text) !important; }
html.velblox-modern #container-main { background: transparent !important; color: var(--vb-text) !important; }
html.velblox-modern #container-main :is(h1,h2,h3,h4,.game-card-name,.text-name,.text-lead) { color: var(--vb-text) !important; }
html.velblox-modern #container-main :is(.text-secondary,.text-description,.game-card-info) { color: var(--vb-muted) !important; }
html.velblox-modern #container-main .game-card-info .info-label,
html.velblox-modern #container-main .see-all-link-icon { color: var(--vb-muted) !important; }
html.velblox-modern[data-velblox-scheme=dark] .game-card-info :is(.icon-votes-gray,.icon-playing-counts-gray) { filter: brightness(0) invert(1); opacity: .7; }
html[data-velblox-scheme=light] #velora-navigation-note .velora-community-mark g { fill: #5d7540; }
html[data-velblox-theme=custom] #velora-navigation-note .velora-community-mark g { fill: var(--vb-nav); }
html.velblox-modern #container-main a:not([class*=btn]):not([role=button]) { color: var(--vb-accent); }
html.velblox-modern :is(.section-content,.section,.rbx-tabs-horizontal,.nav-tabs,.footer-container) { background: var(--vb-surface) !important; color: var(--vb-text) !important; border-color: var(--vb-border) !important; }
html.velblox-modern :is(.rbx-tab a,.nav-tabs a,.footer-container a) { color: var(--vb-text) !important; }
html.velblox-modern :is(.btn-control-md,.btn-control-sm,.btn-secondary-md,.btn-secondary-sm,.filter-select) { background: var(--vb-raised) !important; color: var(--vb-text) !important; border-color: var(--vb-border) !important; }
html.velblox-modern #sign-up-button { background: var(--vb-accent) !important; color: var(--vb-onAccent) !important; border-color: var(--vb-accent) !important; }
html.velblox-modern :is(.btn-common-play-game-lg,[data-testid=play-button]) { background: var(--vb-play) !important; color: var(--vb-onPlay) !important; }
html.velblox-modern :is(.login-content-wrapper,.login-base-container) { background: transparent !important; }
html.velblox-modern #background-image { background: var(--vb-page) !important; }
html.velblox-modern .login-foundation-card { background: var(--vb-surface) !important; color: var(--vb-text) !important; border: 1px solid var(--vb-border) !important; }
html.velblox-modern .login-foundation-card .foundation-web-input { background: var(--vb-raised) !important; border-color: var(--vb-border) !important; }
html.velblox-modern .login-foundation-card input { color: var(--vb-text) !important; }
html.velblox-modern .login-foundation-card .foundation-web-button { background: var(--vb-raised) !important; color: var(--vb-text) !important; border: 1px solid var(--vb-border) !important; }
html.velblox-modern .login-foundation-card button[type=submit] { background: var(--vb-accent) !important; color: var(--vb-onAccent) !important; }
html.velblox-modern .login-foundation-wordmark { display: block !important; background: none !important; width: auto !important; height: auto !important; text-align: center !important; }
html.velblox-modern .login-foundation-wordmark::before { content: 'VELBLOX'; color: var(--vb-text); font: 900 42px/1.1 'Arial Black',Arial,sans-serif; letter-spacing: -2px; }
html.velblox-modern[data-velblox-scheme=light] :is(.rbx-left-col,#header .navbar-search) [class*=icon] { filter: brightness(.35); }
#velblox-settings-trigger {
  display: inline-flex !important; align-items: center; justify-content: center;
  width: 32px; height: 32px; flex: 0 0 32px; padding: 6px; margin: 0 8px 0 0;
  border: 0; border-radius: 5px; background: transparent; color: var(--vb-nav); cursor: pointer;
}
#velblox-settings-trigger:hover { background: #8883; }
#velblox-settings-trigger:focus-visible { outline: 2px solid var(--vb-nav); outline-offset: 1px; }
#velblox-settings-trigger svg { display: block; width: 20px; height: 20px; }
#velblox-settings {
  box-sizing: border-box; position: fixed; inset: 0; margin: auto;
  width: min(560px,calc(100vw - 32px)); max-height: calc(100dvh - 32px); overflow: auto;
  padding: 24px; border: 1px solid var(--vb-border); border-radius: 12px;
  background: var(--vb-surface); color: var(--vb-text); box-shadow: 0 20px 80px #0007;
  font: 14px/1.5 Arial,Helvetica,sans-serif; color-scheme: dark;
}
#velblox-settings:not([open]) { display: none !important; }
html.velblox-classic #velblox-settings,
html[data-velblox-scheme=light] #velblox-settings { color-scheme: light; }
#velblox-settings::backdrop { background: #080d16aa; }
#velblox-settings * { box-sizing: border-box; font-family: Arial,Helvetica,sans-serif !important; }
#velblox-settings .vb-settings-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin: 0 0 24px; }
#velblox-settings h2 { color: var(--vb-text) !important; font-size: 22px !important; margin: 0; }
#velblox-settings .vb-settings-close { display: grid; place-items: center; width: 32px; height: 32px; padding: 0; border: 1px solid var(--vb-border); border-radius: 5px; background: var(--vb-raised); color: var(--vb-text); cursor: pointer; font-size: 24px; line-height: 1; }
#velblox-settings fieldset { min-width: 0; margin: 0; padding: 0; border: 0; }
#velblox-settings legend { margin: 0 0 4px; padding: 0; color: var(--vb-text); font-size: 18px; font-weight: 700; }
#velblox-settings p { color: var(--vb-muted) !important; margin: 0 0 18px; font-size: 13px; }
#velblox-settings .vb-theme-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
#velblox-settings .vb-theme-option { position: relative; display: flex; flex-direction: column; gap: 10px; padding: 12px; border: 2px solid var(--vb-border); border-radius: 8px; color: var(--vb-text); cursor: pointer; background: var(--vb-surface); }
#velblox-settings .vb-theme-option:has(input:checked) { border-color: var(--vb-accent); background: var(--vb-raised); }
#velblox-settings .vb-theme-option:is([data-theme=roblox],[data-theme=custom]) { grid-column: 1 / -1; display: grid; grid-template-columns: 100px 1fr; grid-template-rows: 1fr 1fr; column-gap: 16px; row-gap: 0; }
#velblox-settings .vb-theme-option:is([data-theme=roblox],[data-theme=custom]) .vb-theme-preview { grid-row: 1 / 3; }
#velblox-settings .vb-theme-option:is([data-theme=roblox],[data-theme=custom]) .vb-theme-name { align-self: end; padding-bottom: 4px; }
#velblox-settings .vb-theme-option:has(input:focus-visible) { outline: 2px solid var(--vb-accent); outline-offset: 3px; }
#velblox-settings .vb-theme-preview { height: 68px; border: 1px solid #8886; border-radius: 4px; overflow: hidden; background: var(--preview-page); }
#velblox-settings .vb-theme-preview::before { content: ''; display: block; height: 14px; background: var(--preview-header); }
#velblox-settings .vb-theme-preview::after { content: ''; display: block; width: 70%; height: 31px; margin: 10px auto; background: var(--preview-surface); border: 1px solid #8884; border-left: 20px solid var(--preview-accent); }
#velblox-settings .vb-theme-name { display: flex; align-items: center; gap: 8px; font-weight: 700; }
#velblox-settings input[type=radio] { appearance: auto; -webkit-appearance: auto; position: static; opacity: 1; margin: 0; width: 16px; height: 16px; accent-color: var(--vb-accent); }
#velblox-settings .vb-theme-description { color: var(--vb-muted); font-size: 12px; font-weight: 400; }
#velblox-settings .vb-theme-build { width: 100%; margin: 0 0 16px; }
#velblox-settings .vb-builder-button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 40px; padding: 9px 14px; border: 1px solid var(--vb-border); border-radius: 6px; background: var(--vb-raised); color: var(--vb-text); cursor: pointer; font-size: 13px; font-weight: 700; }
#velblox-settings .vb-builder-button:hover { filter: brightness(1.12); }
#velblox-settings .vb-builder-button:focus-visible { outline: 2px solid var(--vb-accent); outline-offset: 3px; }
#velblox-settings .vb-builder-primary { background: var(--vb-accent); color: var(--vb-onAccent); border-color: var(--vb-accent); }
#velblox-settings .vb-theme-edit { width: 100%; margin-top: 12px; }
#velblox-settings .vb-builder-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 18px; }
#velblox-settings .vb-builder-field { display: flex; flex-direction: column; gap: 6px; color: var(--vb-text); font-size: 12px; font-weight: 700; min-width: 0; }
#velblox-settings :is(.vb-builder-text,.vb-builder-select) { display: block; width: 100%; min-width: 0; height: 40px; padding: 8px 10px; border: 1px solid var(--vb-border); border-radius: 6px; background: var(--vb-page); color: var(--vb-text); font-size: 13px; }
#velblox-settings .vb-builder-color-row { display: flex; align-items: center; gap: 8px; padding: 6px; border: 1px solid var(--vb-border); border-radius: 6px; background: var(--vb-page); }
#velblox-settings .vb-builder-color-row input[type=color] { appearance: auto; -webkit-appearance: auto; display: block; flex: 0 0 32px; width: 32px; height: 30px; margin: 0; padding: 0; border: 0; background: transparent; opacity: 1; cursor: pointer; }
#velblox-settings .vb-builder-color-row .vb-builder-text { height: 30px; border: 0; padding: 4px; background: transparent; font: 13px/1 monospace !important; }
#velblox-settings .vb-builder-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
#velblox-settings .vb-builder-preview { overflow: hidden; margin: 0 0 20px; border: 1px solid var(--draft-border); border-radius: 9px; background: var(--draft-page); color: var(--draft-text); }
#velblox-settings .vb-builder-preview-nav { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; background: var(--draft-header); color: var(--draft-nav); border-bottom: 1px solid var(--draft-border); font-size: 11px; }
#velblox-settings .vb-builder-preview-nav strong { font-weight: 900; letter-spacing: -0.6px; font-size: 15px; }
#velblox-settings .vb-builder-preview-body { display: flex; align-items: center; gap: 14px; padding: 20px 16px; }
#velblox-settings .vb-builder-preview-art { display: grid; place-items: center; flex: 0 0 70px; height: 70px; border-radius: 8px; background: var(--draft-surface); border: 1px solid var(--draft-border); color: var(--draft-accent); font-size: 32px; }
#velblox-settings .vb-builder-preview-copy { min-width: 0; flex: 1; }
#velblox-settings .vb-builder-preview h3 { color: var(--draft-text) !important; margin: 0 0 4px; font-size: 16px; overflow-wrap: anywhere; }
#velblox-settings .vb-builder-preview p { color: var(--draft-muted) !important; margin: 0 0 12px; font-size: 12px; }
#velblox-settings .vb-builder-preview-play { display: inline-block; min-width: 100px; padding: 6px 16px; background: var(--draft-accent); color: var(--draft-onAccent); border-radius: 5px; text-align: center; font-size: 12px; font-weight: 700; }
#velblox-settings .vb-theme-status { min-height: 20px; margin: 16px 0 0; font-size: 12px; }
@media(max-width:480px) {
  #velblox-settings { padding: 18px; }
  #velblox-settings .vb-theme-grid { gap: 8px; }
  #right-navigation-header > #velora-navigation-note { margin-left: 8px; margin-right: 6px; }
}
`;

// Serialized into the Roblox document. Keep all runtime dependencies inside
// this function or in the explicit configuration, including after minifying.
export function installThemePicker({ themes, theme, onChange, onSaveCustom }, host) {
	const document = host.document;
	if (!document?.createElement) return null;
	const root = document.documentElement;
	const presets = themes.filter(item => item.id !== 'custom');
	let custom = parseCustomTheme(themes.find(item => item.id === 'custom'));
	const choices = () => custom ? [...presets, custom] : presets;
	let current = choices().find(item => item.id === theme) || presets.find(item => item.id === 'velora') || presets[0];
	const apply = item => {
		current = item;
		root.classList.toggle('velblox-classic', item.id === 'classic');
		root.classList.toggle('velblox-modern', item.id !== 'classic' && item.id !== 'roblox');
		root.setAttribute('data-velblox-theme', item.id);
		root.setAttribute('data-velblox-scheme', item.scheme || (['classic', 'light'].includes(item.id) ? 'light' : 'dark'));
		for (const [name, color] of Object.entries(item.colors)) root.style.setProperty(`--vb-${name}`, color);
	};
	apply(current);
	const element = (tag, className, text) => {
		const node = document.createElement(tag);
		if (className) node.className = className;
		if (text !== undefined) node.textContent = text;
		return node;
	};
	const button = (text, className, callback) => {
		const node = element('button', `vb-builder-button ${className || ''}`, text);
		node.type = 'button';
		if (callback) node.addEventListener('click', callback);
		return node;
	};
	let trigger, dialog, content, title;
	const closeDialog = () => {
		dialog.close();
		trigger?.setAttribute('aria-expanded', 'false');
		trigger?.focus();
	};
	const renderBuilder = (editing = false) => {
		title.textContent = 'Theme builder';
		const base = editing && custom ? custom : current;
		let draft = { name: editing && custom ? custom.name : 'My theme', colors: { ...base.colors } };
		const form = element('form');
		const description = element('p', '', 'Make it yours. Preview your colors, then save and apply.');
		const preview = element('div', 'vb-builder-preview');
		preview.setAttribute('aria-label', 'Live theme preview');
		const previewNav = element('div', 'vb-builder-preview-nav');
		previewNav.append(element('strong', '', 'VELBLOX'), element('span', '', 'Home · Discover'));
		const previewBody = element('div', 'vb-builder-preview-body');
		const previewArt = element('div', 'vb-builder-preview-art', '✦');
		previewArt.setAttribute('aria-hidden', 'true');
		const previewCopy = element('div', 'vb-builder-preview-copy');
		const previewName = element('h3');
		previewCopy.append(previewName, element('p', '', 'Your next favorite experience.'), element('span', 'vb-builder-preview-play', '▶ Play'));
		previewBody.append(previewArt, previewCopy);
		preview.append(previewNav, previewBody);
		const updatePreview = () => {
			const parsed = parseCustomTheme(draft);
			if (!parsed) return;
			for (const [key, color] of Object.entries(parsed.colors)) preview.style.setProperty(`--draft-${key}`, color);
			previewName.textContent = parsed.name;
		};
		const fields = element('div', 'vb-builder-fields');
		const nameLabel = element('label', 'vb-builder-field', 'Theme name');
		const name = element('input', 'vb-builder-text');
		name.type = 'text'; name.maxLength = 32; name.value = draft.name; name.required = true;
		name.addEventListener('input', () => { draft.name = name.value; updatePreview(); });
		nameLabel.appendChild(name);
		const startLabel = element('label', 'vb-builder-field', 'Start from');
		const start = element('select', 'vb-builder-select');
		for (const item of choices()) {
			const option = element('option', '', item.id === 'custom' ? 'Saved custom colors' : item.name);
			option.value = item.id; start.appendChild(option);
		}
		start.value = base.id;
		startLabel.appendChild(start);
		fields.append(nameLabel, startLabel);
		const colorFields = element('div', 'vb-builder-fields');
		const controls = [];
		for (const [key, label] of [['page', 'Background'], ['surface', 'Panels'], ['header', 'Header'], ['text', 'Text'], ['accent', 'Accent'], ['border', 'Borders']]) {
			const group = element('div', 'vb-builder-field');
			const labelNode = element('label', '', label);
			const row = element('div', 'vb-builder-color-row');
			const swatch = element('input'); swatch.type = 'color'; swatch.value = draft.colors[key];
			swatch.setAttribute('aria-label', `${label} color`);
			const hex = element('input', 'vb-builder-text'); hex.id = `vb-color-${key}`; hex.type = 'text'; hex.value = draft.colors[key];
			hex.required = true; hex.pattern = '#[0-9a-fA-F]{6}'; hex.maxLength = 7; hex.spellcheck = false;
			hex.setAttribute('aria-label', `${label} hex`);
			labelNode.htmlFor = hex.id;
			hex.addEventListener('input', () => {
				const valid = /^#[0-9a-f]{6}$/i.test(hex.value);
				hex.setCustomValidity(valid ? '' : 'Use a six-digit hex color, like #18201b.');
				if (!valid) return;
				draft.colors[key] = hex.value; swatch.value = hex.value; updatePreview();
			});
			swatch.addEventListener('input', () => {
				draft.colors[key] = swatch.value; hex.value = swatch.value; hex.setCustomValidity(''); updatePreview();
			});
			row.append(swatch, hex); group.append(labelNode, row); colorFields.appendChild(group);
			controls.push({ key, swatch, hex });
		}
		start.addEventListener('change', () => {
			const selected = choices().find(item => item.id === start.value);
			if (!selected) return;
			draft.colors = { ...selected.colors };
			for (const { key, swatch, hex } of controls) { swatch.value = hex.value = draft.colors[key]; hex.setCustomValidity(''); }
			updatePreview();
		});
		const note = element('p', 'vb-theme-status', 'Saved on this browser. Header and button text adjust automatically.');
		const actions = element('div', 'vb-builder-actions');
		const save = button('Save and apply', 'vb-builder-primary'); save.type = 'submit';
		actions.append(button('Cancel', '', () => { renderThemes(); content.querySelector('.vb-theme-build')?.focus(); }), save);
		form.append(description, preview, fields, colorFields, note, actions);
		form.addEventListener('submit', event => {
			event.preventDefault();
			if (!form.reportValidity()) return;
			const parsed = parseCustomTheme(draft);
			if (!parsed) return;
			custom = parsed;
			apply(custom);
			onSaveCustom(custom);
			renderThemes(`${custom.name} saved and applied.`);
			content.querySelector('input[value=custom]')?.focus();
		});
		content.replaceChildren(form);
		updatePreview();
		name.focus();
	};
	const renderThemes = (message = 'Changes apply immediately.') => {
		title.textContent = 'Velblox settings';
		const fieldset = element('fieldset');
		const legend = element('legend', '', 'Themes');
		const description = element('p', '', 'Choose the look of Velblox, or create your own.');
		const grid = element('div', 'vb-theme-grid');
		const status = element('p', 'vb-theme-status', message); status.setAttribute('role', 'status');
		for (const item of choices()) {
			const label = element('label', 'vb-theme-option'); label.setAttribute('data-theme', item.id);
			const preview = element('span', 'vb-theme-preview'); preview.setAttribute('aria-hidden', 'true');
			for (const part of ['page', 'header', 'surface', 'accent']) preview.style.setProperty(`--preview-${part}`, item.colors[part]);
			const name = element('span', 'vb-theme-name');
			const input = element('input'); input.type = 'radio'; input.name = 'velblox-theme'; input.value = item.id; input.checked = item.id === current.id;
			input.setAttribute('aria-label', item.name);
			const detail = element('span', 'vb-theme-description', item.description);
			input.addEventListener('change', () => {
				if (!input.checked) return;
				apply(item); onChange(item.id);
				status.textContent = `${item.name} selected.`;
			});
			name.append(input, document.createTextNode(item.name)); label.append(preview, name, detail); grid.appendChild(label);
		}
		fieldset.append(legend, description, button('＋ Build a theme', 'vb-theme-build vb-builder-primary', () => renderBuilder()), grid);
		if (custom) fieldset.appendChild(button('Edit custom theme', 'vb-theme-edit', () => renderBuilder(true)));
		content.replaceChildren(fieldset, status);
	};
	const open = () => {
		if (!dialog) {
			dialog = element('dialog'); dialog.id = 'velblox-settings'; dialog.setAttribute('aria-labelledby', 'velblox-settings-heading');
			const heading = element('div', 'vb-settings-heading');
			title = element('h2'); title.id = 'velblox-settings-heading';
			const close = element('button', 'vb-settings-close', '×'); close.type = 'button'; close.addEventListener('click', closeDialog); close.setAttribute('aria-label', 'Close settings');
			heading.append(title, close);
			content = element('div'); dialog.append(heading, content);
			dialog.addEventListener('click', event => { if (event.target === dialog) { const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeDialog(); } });
			dialog.addEventListener('cancel', () => { trigger?.setAttribute('aria-expanded', 'false'); });
			dialog.addEventListener('close', () => { trigger?.setAttribute('aria-expanded', 'false'); trigger?.focus(); });
			document.body.appendChild(dialog);
		}
		renderThemes();
		if (!dialog.open) dialog.showModal();
		trigger?.setAttribute('aria-expanded', 'true');
	};
	return {
		getTheme: () => current.id,
		mount(navigation, note) {
			if (!trigger) {
				trigger = document.createElement('button'); trigger.id = 'velblox-settings-trigger'; trigger.type = 'button';
				trigger.title = 'Velblox settings'; trigger.setAttribute('aria-label', 'Velblox settings');
				trigger.setAttribute('aria-haspopup', 'dialog'); trigger.setAttribute('aria-expanded', 'false');
				trigger.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m9 3-.5 2-1.7 1-2-.6-2 3.4 1.5 1.4v2.1L2.8 14l2 3.4 2-.6 1.7 1 .5 2h4l.5-2 1.7-1 2 .6 2-3.4-1.5-1.4v-2.1l1.5-1.4-2-3.4-2 .6-1.7-1L13 3Z" transform="translate(1 1)"/><circle cx="12" cy="12" r="3"/></svg>';
				trigger.addEventListener('click', open);
			}
			if (note.nextElementSibling !== trigger) navigation.insertBefore(trigger, note.nextSibling);
		}
	};
}
