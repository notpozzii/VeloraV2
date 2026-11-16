import { getRelayUrl, rememberRelayFailure } from '../../lethe/relay-fallback.js';
import { resolveRelays } from '../../lethe/relay-config.js';
import { watchMediaFailures } from './media-failure.js';

export function playbackHost(url) {
	try {
		const host = new URL(url).hostname;
		return host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'geforcenow.com' || host.endsWith('.geforcenow.com');
	} catch { return false; }
}

export function retryablePlaybackText(text) {
	return /video unavailable|this content isn.t available|unable to play media|playback error|error occurred.*try again/i.test(text) &&
		!/private video|removed|deleted|age.restrict|copyright|not available in your country|uploader|members.only/i.test(text);
}

// Only recover an already-failed playback page. Preserve its current video URL,
// and never click Play, skip an ad, or replay a form/game WebSocket session.
export function watchPlaybackRelayFallback(frame, { relay, backup = () => '', url, prepare, report = () => {}, host = window }) {
	let disposed = false;
	let switching = false;
	let clear;
	function delegated() {
		try { return !!frame.contentDocument?.querySelector('iframe[data-proxy-content]'); }
		catch { return false; }
	}
	async function recover() {
		if (disposed || switching || delegated() || !playbackHost(url()) || getRelayUrl(relay(), backup()) === resolveRelays(relay(), backup()).backup) return;
		switching = true;
		if (!rememberRelayFailure(relay(), backup())) { switching = false; return; }
		report('Switching to the backup relay…');
		try {
			await prepare(resolveRelays(relay(), backup()).backup);
			if (disposed) return;
			frame.contentWindow.location.reload();
			report('Switched to the backup relay.');
		} catch { report('The backup relay could not connect. Try again shortly.'); }
		finally {
			switching = false;
			clear = host.setTimeout(() => { if (!disposed) report(''); }, 6000);
		}
	}
	const stopMedia = watchMediaFailures(frame, failure => {
		if ([2, 4].includes(failure.code)) void recover();
	}, host);
	function inspect() {
		if (disposed || !playbackHost(url()) || getRelayUrl(relay(), backup()) === resolveRelays(relay(), backup()).backup) return;
		try {
			const doc = frame.contentDocument;
			// An /api launcher watches its own inner content; don't reload the wrapper.
			if (!doc || doc.querySelector('iframe[data-proxy-content]')) return;
			const error = doc.querySelector('.ytp-error-content-wrap, .yt-playability-error-supported-renderers');
			if (error?.getClientRects().length && retryablePlaybackText(error.textContent || '')) void recover();
		} catch {}
	}
	const timer = host.setInterval(inspect, 1000);
	frame.addEventListener('load', inspect);
	return () => {
		disposed = true;
		stopMedia();
		host.clearInterval(timer);
		host.clearTimeout(clear);
		frame.removeEventListener('load', inspect);
	};
}
