import { CLASSIC_THEME_CSS } from './classic-theme.js';
import { ROBLOX_THEMES, ROBLOX_THEME_CSS, robloxTheme, installThemePicker } from './themes.js';
import { parseCustomTheme } from './custom-theme.js';

export const VELORA_DISCORD_URL = 'https://discord.gg/3vcMsqJMd';

export function placeId(value) {
	const text = String(value ?? '');
	return /^[1-9]\d*$/.test(text) && Number.isSafeInteger(Number(text)) ? text : null;
}

// Only launch links count as Play. A normal experience link remains navigation.
export function launchPlace(href, base) {
	try {
		if (/^roblox:\/\//i.test(href)) {
			return placeId(new URLSearchParams(href.slice('roblox://'.length).replace(/^\?/, '')).get('placeId'));
		}
		const url = new URL(href, base);
		if (url.username || url.password || url.port) return null;
		if (url.protocol !== 'https:' || !['www.roblox.com', 'roblox.com'].includes(url.hostname)) return null;
		if (url.pathname !== '/games/start') return null;
		return placeId(url.searchParams.get('placeId'));
	} catch { return null; }
}

export function clickedPlace(target, document, base) {
	if (!target?.closest) return null;
	const control = target.closest('.btn-common-play-game-lg, [data-testid="play-button"], a[href]');
	if (!control || control.closest('[disabled], [aria-disabled="true"], .disabled, .btn-common-play-game-action-needed-lg')) return null;
	if (control.matches('a[href]')) {
		const launch = launchPlace(control.getAttribute('href'), base);
		if (launch) return launch;
		if (!control.matches('.btn-common-play-game-lg, [data-testid="play-button"]')) return null;
	}
	return placeId(control.closest('[data-place-id]')?.getAttribute('data-place-id'))
		|| placeId(document.querySelector('#game-detail-meta-data[data-place-id]')?.getAttribute('data-place-id'));
}

function installNavigationNote(host, discordUrl, classicCss = '', themeCss = '', themePicker) {
	const document = host.document;
	if (!document?.createElement) return;
	const style = document.createElement('style');
	style.textContent = '#nav-logo-link{display:inline-flex!important;align-items:center;justify-content:center;width:auto!important;min-width:112px}html:not([data-velblox-theme=roblox]) #nav-logo-link>.icon-logo,html:not([data-velblox-theme=roblox]) #nav-logo-link>.icon-logo-r{display:none!important}#nav-logo-link>.velblox-wordmark{display:inline-block;color:inherit;font:900 25px/1 "Arial Black",Arial,Helvetica,sans-serif;letter-spacing:-1px;white-space:nowrap}@media(max-width:991px){#right-navigation-header{left:150px!important;width:calc(100% - 150px)!important}}#right-navigation-header > #velora-navigation-note{display:flex;align-items:center;gap:4px;flex:1 1 auto;min-width:0;align-self:center;margin:0 14px;color:inherit;font:12px/1.4 Arial,Helvetica,sans-serif;white-space:nowrap}#velora-navigation-note>a{display:inline-flex;align-items:center;gap:3px;color:inherit;font-weight:600;text-decoration:none}#velora-navigation-note>a:hover{text-decoration:underline}#velora-navigation-note>a:focus-visible{outline:2px solid currentColor;outline-offset:3px;border-radius:3px}#velora-navigation-note .velora-community-mark{display:inline-flex;width:24px;height:24px;flex:none}#velora-navigation-note svg{display:block;width:100%;height:100%}';
	style.textContent += classicCss + themeCss;
	document.head.appendChild(style);
	const mount = () => {
		const signInHeading = document.getElementById('login-foundation-heading');
		const signInText = 'Sign in with your Roblox account.';
		if (signInHeading && signInHeading.textContent !== signInText) signInHeading.textContent = signInText;
		const classic = themePicker?.getTheme() === 'classic';
		const gamesHeading = document.querySelector('.games-list-header h1');
		const headingText = classic ? 'Games' : 'Charts';
		if (gamesHeading && ['Charts', 'Games'].includes(gamesHeading.textContent) && gamesHeading.textContent !== headingText) gamesHeading.textContent = headingText;
		for (const [id, oldName, newName] of [['nav-charts-md-link', 'Games', 'Charts'], ['nav-charts-sm-link', 'Games', 'Charts'], ['nav-marketplace-md-link', 'Catalog', 'Marketplace'], ['nav-marketplace-sm-link', 'Catalog', 'Marketplace'], ['header-develop-md-link', 'Develop', 'Create'], ['header-develop-sm-link', 'Develop', 'Create']]) {
			const item = document.getElementById(id);
			const text = classic ? oldName : newName;
			if (item && item.textContent.trim() !== text) item.textContent = text;
		}
		const logo = document.getElementById('nav-logo-link');
		if (logo) {
			if (!logo.querySelector('.velblox-wordmark')) {
				const wordmark = document.createElement('span');
				wordmark.className = 'velblox-wordmark';
				wordmark.textContent = 'VELBLOX';
				logo.appendChild(wordmark);
			}
			const brand = themePicker?.getTheme() === 'roblox' ? 'Roblox' : 'VELBLOX';
			logo.setAttribute('aria-label', `${brand} home`);
			logo.title = brand;
		}
		const navigation = document.getElementById('right-navigation-header');
		const search = navigation?.querySelector('.navbar-search');
		if (!search) return;
		let note = document.getElementById('velora-navigation-note');
		if (!note) {
			note = document.createElement('span');
			note.id = 'velora-navigation-note';
			note.appendChild(document.createTextNode('Made by '));
			const link = document.createElement('a');
			link.id = 'velora-community-link';
			link.href = discordUrl;
			link.target = '_blank';
			link.rel = 'noopener noreferrer';
			link.title = 'Join Velora on Discord';
			link.setAttribute('aria-label', 'Velora Discord');
			const mark = document.createElement('span');
			mark.className = 'velora-community-mark';
			mark.setAttribute('aria-hidden', 'true');
			mark.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="0 0 1024 1024" role="img" aria-label="Velora"><title>Velora</title><g fill="#d3e5b0" transform="matrix(0.4655093388 0 0 -0.4655093388 171.1726824797 740.7978400367)"><path d="M1209 766Q1209 625 1161.5 480.0Q1114 335 1028 223Q926 92 802.0 30.0Q678 -32 544 -32Q366 -32 261.0 51.0Q156 134 156 289Q156 337 172.0 392.0Q188 447 212 521Q232 584 249.5 645.5Q267 707 267 762Q267 816 243.0 839.0Q219 862 157 862Q125 862 91.5 852.0Q58 842 34 833L56 923Q137 956 211.0 979.5Q285 1003 351 1003Q470 1003 534.5 943.5Q599 884 599 796Q599 731 581.5 658.0Q564 585 545 527Q528 475 509.5 407.5Q491 340 491 300Q491 215 532.0 164.0Q573 113 664 113Q800 113 900.0 214.5Q1000 316 1000 488Q1000 505 998.0 525.0Q996 545 990 570Q979 593 947.0 619.0Q915 645 893 667Q864 696 842.0 735.5Q820 775 820 838Q820 891 840.5 924.0Q861 957 890 978Q914 995 947.5 1005.0Q981 1015 1010 1015Q1103 1015 1156.0 948.5Q1209 882 1209 766ZM1430.32 166Q1430.32 87 1371.82 29.0Q1313.32 -29 1233.32 -29Q1152.32 -29 1093.82 28.5Q1035.32 86 1035.32 166Q1035.32 246 1093.82 304.5Q1152.32 363 1233.32 363Q1313.32 363 1371.82 304.0Q1430.32 245 1430.32 166Z"/></g></svg>';
			link.appendChild(mark);
			link.appendChild(document.createTextNode('Velora'));
			note.appendChild(link);
		}
		if (search.nextElementSibling !== note) navigation.insertBefore(note, search.nextSibling);
		themePicker?.mount(navigation, note);
	};
	let scheduled = false;
	const observer = new host.MutationObserver(() => {
		if (scheduled) return;
		scheduled = true;
		host.requestAnimationFrame(() => { scheduled = false; mount(); });
	});
	observer.observe(document.documentElement, { childList: true, subtree: true });
	mount();
	return mount;
}

export function installPlayBridge({ nonce, url, discordUrl, classicCss, themeCss, themes, theme }, host = window) {
	// Runs after Prism's bootstrap, in the actual Roblox document. No account
	// cookies or launch tickets are read here; the only handoff is a place ID.
	let refreshTheme;
	const picker = installThemePicker({ themes, theme, onChange: id => {
		refreshTheme?.();
		host.parent.postMessage({ type: 'velora:roblox-theme', nonce, theme: id }, '*');
	}, onSaveCustom: customTheme => {
		refreshTheme?.();
		host.parent.postMessage({ type: 'velora:roblox-custom-theme', nonce, customTheme }, '*');
	} }, host);
	refreshTheme = installNavigationNote(host, discordUrl, classicCss, themeCss, picker);
	host.addEventListener('click', event => {
		if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
		if (event.target?.closest?.('#velora-community-link')) {
			event.preventDefault();
			event.stopImmediatePropagation();
			host.parent.postMessage({ type: 'velora:roblox-discord', nonce }, '*');
			return;
		}
		const id = clickedPlace(event.target, host.document, url);
		if (!id) return;
		event.preventDefault();
		event.stopImmediatePropagation();
		host.parent.postMessage({ type: 'velora:roblox-play', nonce, placeId: id }, '*');
	}, true);
	host.parent.postMessage({ type: 'velora:roblox-browse-ready', nonce }, '*');
}

export function browserMessage(event, frame, origin, nonce) {
	if (event.origin !== origin || event.source !== frame?.contentWindow || event.data?.nonce !== nonce) return null;
	if (event.data.type === 'velora:roblox-browse-ready') return { type: 'ready' };
	if (event.data.type === 'velora:roblox-discord') return { type: 'discord' };
	if (event.data.type === 'velora:roblox-theme' && robloxTheme(event.data.theme) === event.data.theme) return { type: 'theme', theme: event.data.theme };
	if (event.data.type === 'velora:roblox-custom-theme') {
		const customTheme = parseCustomTheme(event.data.customTheme);
		if (customTheme) return { type: 'custom-theme', customTheme };
	}
	if (event.data.type === 'velora:roblox-play') {
		const id = placeId(event.data.placeId);
		if (id) return { type: 'play', placeId: id };
	}
	return null;
}

export function createBrowsePlugin(ManagedPlugin, nonce, getTheme = () => 'velora', getCustomTheme = () => null) {
	return new class extends ManagedPlugin {
		constructor() { super('velora-roblox-play', []); }
		install(frame) {
			super.install(frame);
			this.tap(frame.hooks.fetch.response, ({ parsed, request }, result) => {
				const { response } = result;
				if (!['www.roblox.com', 'roblox.com'].includes(parsed.url.hostname)
					|| !['document', 'iframe'].includes(request.rawDestination)
					|| response.status !== 200 || !response.headers.get('content-type')?.includes('text/html') || !response.body) return;
				const customTheme = parseCustomTheme(getCustomTheme());
				const themes = customTheme ? [...ROBLOX_THEMES, customTheme] : ROBLOX_THEMES;
				const selected = robloxTheme(getTheme());
				const config = JSON.stringify({ nonce, url: parsed.url.origin + parsed.url.pathname, discordUrl: VELORA_DISCORD_URL, classicCss: CLASSIC_THEME_CSS, themeCss: ROBLOX_THEME_CSS, themes, theme: selected === 'custom' && !customTheme ? 'velora' : selected }).replaceAll('<', '\\u003c');
				response.headers.set('Document-Isolation-Policy', 'isolate-and-require-corp');
				const script = `<script data-velora-play-bridge>(function(){${placeId.toString()}\n${launchPlace.toString()}\n${clickedPlace.toString()}\n${parseCustomTheme.toString()}\n${installThemePicker.toString()}\n${installNavigationNote.toString()}\n(${installPlayBridge.toString()})(${config});})();</script>`;
				const bytes = new TextEncoder().encode(script);
				const body = response.body instanceof ReadableStream ? response.body : new Response(response.body).body;
				response.body = body.pipeThrough(new TransformStream({ transform(chunk, output) { output.enqueue(chunk); }, flush(output) { output.enqueue(bytes); } }));
				response.headers.delete('content-length');
			});
		}
	}();
}
