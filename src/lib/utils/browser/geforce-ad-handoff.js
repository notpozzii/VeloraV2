// GeForce's pre-stream ad player listens for real layout changes. If an ad
// holds on its last frame, give that player a fresh viewport measurement.
const CHECK_INTERVAL = 500;
const HANDOFF_DELAY = 1750;
const RESIZE_DURATION = 250;

export function watchGeForceAdHandoff(frame, host = window) {
	const documentOf = Object.getOwnPropertyDescriptor(host.HTMLIFrameElement.prototype, 'contentDocument').get;
	const playback = new WeakMap();
	let restoreViewport;
	let resizeTimer;

	function nudgeViewport() {
		if (restoreViewport || frame.clientWidth <= 16) return false;
		const width = frame.style.getPropertyValue('width');
		const priority = frame.style.getPropertyPriority('width');
		restoreViewport = () => {
			if (width) frame.style.setProperty('width', width, priority);
			else frame.style.removeProperty('width');
			restoreViewport = undefined;
		};
		frame.style.setProperty('width', `${frame.clientWidth - 8}px`);
		resizeTimer = host.setTimeout(restoreViewport, RESIZE_DURATION);
		return true;
	}

	function adNeedsResize(video, now) {
		const { currentTime, duration, ended, error, seeking, loop } = video;
		const source = video.srcObject || video.currentSrc;
		if (!source || error || seeking || loop || !Number.isFinite(duration) || currentTime < 1) {
			playback.delete(video);
			return false;
		}
		let state = playback.get(video);
		if (!state || state.source !== source || currentTime < state.time - 0.25) {
			state = { source, time: currentTime, lastProgress: now, nudged: false };
			playback.set(video, state);
		} else if (Math.abs(currentTime - state.time) > 0.02) {
			state.time = currentTime;
			state.lastProgress = now;
		}
		const nearEnd = ended || (duration > 0 && duration - currentTime <= 0.4);
		return nearEnd && !state.nudged && now - state.lastProgress >= HANDOFF_DELAY;
	}

	function adVideos() {
		let doc;
		try { doc = documentOf.call(frame); } catch { return []; }
		const player = doc?.querySelector('#imaPreStreamContainer');
		if (!player?.getClientRects().length) return [];
		const videos = new Set(player.querySelectorAll('video'));
		const customVideo = doc.querySelector('video#imaPreStreamVideo');
		if (customVideo) videos.add(customVideo);
		function visit(roots, depth) {
			if (depth > 4) return;
			for (const embedded of roots) {
				let child;
				try { child = documentOf.call(embedded); } catch { continue; }
				if (!child) continue;
				for (const video of child.querySelectorAll('video')) videos.add(video);
				visit(child.querySelectorAll('iframe'), depth + 1);
			}
		}
		visit(player.querySelectorAll('iframe'), 0);
		return videos;
	}

	function scan() {
		if (host.document.hidden || restoreViewport) return;
		const now = host.performance.now();
		for (const video of adVideos()) {
			if (adNeedsResize(video, now) && nudgeViewport()) {
				playback.get(video).nudged = true;
				return;
			}
		}
	}

	const timer = host.setInterval(scan, CHECK_INTERVAL);
	return () => {
		host.clearInterval(timer);
		host.clearTimeout(resizeTimer);
		restoreViewport?.();
	};
}
