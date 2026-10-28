<script>
	import { onDestroy } from 'svelte';
	import { activeTab, reloadSignal, goBackSignal, goForwardSignal } from '$lib/stores/index.js';
	import { getOriginalUrl } from '$lib/lethe/decode';
	import { newTabEventName, newTabQueueName } from '$lib/lethe/popup-events.js';
	import { mediaPermissions } from './media-permissions.js';
	import { recordActivity } from '$lib/utils/developer/diagnostics.js';
	let { id, src = null, onnavigate, onnewtab, interceptEnabled = true } = $props();
	let frame;
	let innerFrame;
	let titleObserver;
	let removeNavigationListeners = () => {};
	function contentWindow() {
		const outer = frame?.contentWindow;
		try { return outer?.document.querySelector('iframe[data-proxy-content]')?.contentWindow || outer; }
		catch { return outer; }
	}
	function originalUrl(target, path) {
		return getOriginalUrl(path, target?.parent?.__uv$config);
	}
	onDestroy(() => {
		innerFrame?.removeEventListener('load', handleLoad);
		titleObserver?.disconnect();
		removeNavigationListeners();
	});

	function reportUrl() {
		try {
			const target = contentWindow();
			const loc = target.location;
			const stripped = loc.pathname + loc.search + loc.hash;
			const url = originalUrl(target, stripped);
			if (!url) return;
			const title = target.document.title || url;
			onnavigate?.({ url, title });
		} catch (e) {}
	}

	function frameBase(targetWindow) {
		try {
			const frameLocation = targetWindow.location;
			const strippedPath = frameLocation.pathname + frameLocation.search + frameLocation.hash;
			const decodedUrl = originalUrl(targetWindow, strippedPath);
			if (decodedUrl) {
				return decodedUrl;
			}
			return frameLocation.href;
		} catch (error) {
			return undefined;
		}
	}

	function toRealUrl(targetWindow, rawUrl) {
		if (!rawUrl) {
			return '';
		}
		try {
			const absoluteUrl = new URL(rawUrl, targetWindow.location.href);
			const strippedPath = absoluteUrl.pathname + absoluteUrl.search + absoluteUrl.hash;
			const decodedUrl = originalUrl(targetWindow, strippedPath);
			let looksLikeHttp = false;
			if (decodedUrl) {
				const lowerDecodedUrl = decodedUrl.toLowerCase();
				if (lowerDecodedUrl.indexOf('http://') === 0) {
					looksLikeHttp = true;
				}
				if (lowerDecodedUrl.indexOf('https://') === 0) {
					looksLikeHttp = true;
				}
			}
			if (looksLikeHttp) {
				return decodedUrl;
			}
		} catch (error) {}
		try {
			const baseUrl = frameBase(targetWindow);
			const resolvedUrl = new URL(rawUrl, baseUrl);
			return resolvedUrl.href;
		} catch (error) {
			return String(rawUrl);
		}
	}
	function installHostInterception(targetWindow) {
		try {
			if (!targetWindow) {
				return;
			}
			if (targetWindow.__galaxyHostHooked) {
				return;
			}
			targetWindow.__galaxyHostHooked = true;

			function openTabForUrl(rawUrl) {
				const realUrl = toRealUrl(targetWindow, rawUrl);
				if (realUrl) {
					if (onnewtab) {
						onnewtab(realUrl);
					}
				}
			}

			function dud() {}

			function dudWindow() {
				const fakeWindow = {
					closed: false,
					focus: dud,
					blur: dud,
					close() {
						this.closed = true;
					},
					postMessage: dud,
					moveTo: dud,
					resizeTo: dud,
					document: { write: dud, writeln: dud, close: dud, open: dud },
					location: { href: '', replace: dud, assign: dud }
				};
				return fakeWindow;
			}

			const nativeOpen = targetWindow.open;
			try {
				targetWindow.open = function (url, name) {
					if (!interceptEnabled || (typeof name === 'string' && name.toLowerCase() === '_self')) {
						return nativeOpen.apply(targetWindow, arguments);
					}
					openTabForUrl(url);
					return dudWindow();
				};
			} catch (error) {}

			try {
				let anchorPrototype = null;
				if (targetWindow.HTMLAnchorElement) {
					anchorPrototype = targetWindow.HTMLAnchorElement.prototype;
				}
				if (anchorPrototype && !anchorPrototype.__galaxyClickHooked) {
					anchorPrototype.__galaxyClickHooked = true;
					const originalAnchorClick = anchorPrototype.click;
					anchorPrototype.click = function () {
						try {
							if (interceptEnabled && this && this.target === '_blank' && this.href) {
								openTabForUrl(this.href);
								return;
							}
						} catch (error) {}
						return originalAnchorClick.apply(this, arguments);
					};
				}
			} catch (error) {}

			const frameDocument = targetWindow.document;
			function hrefFinder(node) {
				if (!node) {
					return null;
				}
				if (!node.closest) {
					return null;
				}
				return node.closest('a[href]');
			}

			frameDocument.addEventListener(
				'click',
				function (clickEvent) {
					if (!interceptEnabled) {
						return;
					}
					if (clickEvent.defaultPrevented) {
						return;
					}
					if (clickEvent.button !== 0) {
						return;
					}
					const link = hrefFinder(clickEvent.target);
					if (!link) {
						return;
					}
					let opensNewTab = false;
					if (link.target === '_blank') {
						opensNewTab = true;
					}
					if (clickEvent.ctrlKey) {
						opensNewTab = true;
					}
					if (clickEvent.metaKey) {
						opensNewTab = true;
					}
					if (!opensNewTab) {
						return;
					}
					clickEvent.preventDefault();
					clickEvent.stopPropagation();
					openTabForUrl(link.href);
				},
				true
			);

			frameDocument.addEventListener(
				'auxclick',
				function (auxClickEvent) {
					if (!interceptEnabled) {
						return;
					}
					if (auxClickEvent.button !== 1) {
						return;
					}
					const link = hrefFinder(auxClickEvent.target);
					if (!link) {
						return;
					}
					auxClickEvent.preventDefault();
					auxClickEvent.stopPropagation();
					openTabForUrl(link.href);
				},
				true
			);

			frameDocument.addEventListener(
				'mousedown',
				function (mouseDownEvent) {
					if (!interceptEnabled) {
						return;
					}
					if (mouseDownEvent.button !== 1) {
						return;
					}
					const link = hrefFinder(mouseDownEvent.target);
					if (!link) {
						return;
					}
					mouseDownEvent.preventDefault();
				},
				true
			);

			frameDocument.addEventListener(
				'submit',
				function (submitEvent) {
					if (!interceptEnabled) {
						return;
					}
					const form = submitEvent.target;
					if (!form) {
						return;
					}
					if (form.target !== '_blank') {
						return;
					}
					submitEvent.preventDefault();
					submitEvent.stopPropagation();
					let formAction = form.action;
					if (!formAction) {
						formAction = targetWindow.location.href;
					}
					openTabForUrl(formAction);
				},
				true
			);
		} catch (error) {}
	}

	function handleLoad() {
		recordActivity('navigation', { target: src });
		try {
			const nextInner = frame.contentWindow.document.querySelector('iframe[data-proxy-content]');
			if (nextInner !== innerFrame) {
				innerFrame?.removeEventListener('load', handleLoad);
				innerFrame = nextInner;
				innerFrame?.addEventListener('load', handleLoad);
			}
		} catch {}
		reportUrl();
		try {
			titleObserver?.disconnect();
			removeNavigationListeners();
			const win = contentWindow();
			win.__galaxyInterceptEnabled = interceptEnabled;
			installHostInterception(win);
			win.addEventListener('popstate', reportUrl);
			win.addEventListener('hashchange', reportUrl);
			removeNavigationListeners = () => {
				win.removeEventListener('popstate', reportUrl);
				win.removeEventListener('hashchange', reportUrl);
			};
			const titleEl = win.document.querySelector('title');
			if (titleEl) {
				titleObserver = new MutationObserver(reportUrl);
				titleObserver.observe(titleEl, { childList: true });
			}
			const pendingUrls = win[newTabQueueName];
			if (Array.isArray(pendingUrls)) {
				while (pendingUrls.length > 0) {
					const pendingUrl = pendingUrls.shift();
					if (onnewtab) {
						onnewtab(pendingUrl);
					}
				}
			}

			if (!win.__galaxyNewTabBound) {
				win.__galaxyNewTabBound = true;
				win.addEventListener(newTabEventName, function (messageEvent) {
					let newTabUrl = undefined;
					if (messageEvent && messageEvent.detail) {
						newTabUrl = messageEvent.detail.url;
					}
					if (onnewtab) {
						onnewtab(newTabUrl);
					}
				});
			}
		} catch (e) {}
	}

	$effect(() => {
		if ($goBackSignal === id) {
			try {
				contentWindow().history.back();
			} catch (e) {}
			$goBackSignal = null;
		}
		if ($goForwardSignal === id) {
			try {
				contentWindow().history.forward();
			} catch (e) {}
			$goForwardSignal = null;
		}
		if ($reloadSignal === id) {
			try {
				contentWindow().location.reload();
			} catch (e) {}
			$reloadSignal = null;
		}
	});
	$effect(() => {
		try {
			if (frame && frame.contentWindow) {
				contentWindow().__galaxyInterceptEnabled = interceptEnabled;
			}
		} catch (e) {}
	});
</script>

<iframe
	allow={mediaPermissions}
	allowfullscreen
	bind:this={frame}
	{src}
	onload={handleLoad}
	frameborder="0"
	style="display: {id === $activeTab ? 'block' : 'none'};"
></iframe>

<style>
	iframe {
		width: 100%;
		height: 100%;
		border: none;
	}
</style>
