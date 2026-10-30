import { activityOwner, getActivityHub, recordActivity } from './diagnostics.js';
import { resetInProgress } from '../reset-core.js';

export const speedTargets = Object.freeze([
	{ path: '/', label: 'Desktop' },
	{ path: '/slate', label: 'Browser' },
	{ path: '/apps', label: 'Apps' },
	{ path: '/books', label: 'Games' },
	{ path: '/settings', label: 'Settings' }
]);
const rounded = value => Number.isFinite(value) && value >= 0 ? Math.round(value * 10) / 10 : null;
const median = values => {
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length ? rounded(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2) : null;
};

export function summarizeRuns(runs) {
	const success = runs.filter(run => run.ok && Number.isFinite(run.responseMs) && Number.isFinite(run.totalMs));
	const responses = success.map(run => run.responseMs);
	return {
		succeeded: success.length,
		failed: runs.length - success.length,
		median: median(responses),
		fastest: responses.length ? Math.min(...responses) : null,
		slowest: responses.length ? Math.max(...responses) : null,
		htmlMedian: median(success.map(run => run.totalMs))
	};
}

// Read the actual outer document, even when Settings is open in an app window.
// Zero end times mean the browser has not reached that milestone yet.
export function readPageTimings(performance) {
	try {
		const nav = performance?.getEntriesByType('navigation')?.[0];
		const paints = performance?.getEntriesByType('paint') || [];
		const resources = performance?.getEntriesByType('resource') || [];
		const end = value => nav && value > 0 ? rounded(value - (nav.startTime || 0)) : null;
		return {
			firstByte: end(nav?.responseStart),
			htmlComplete: end(nav?.responseEnd),
			contentPaint: rounded(paints.find(entry => entry.name === 'first-contentful-paint')?.startTime),
			domReady: end(nav?.domContentLoadedEventEnd),
			pageLoad: end(nav?.loadEventEnd),
			resources: resources.length,
			transferBytes: resources.reduce((sum, entry) => sum + (Number.isFinite(entry.transferSize) && entry.transferSize > 0 ? entry.transferSize : 0), 0)
		};
	} catch { return {}; }
}

const initial = () => ({ running: false, target: '/', runs: [], startedAt: null, finishedAt: null, cancelled: false });

export function createSpeedLab({ fetch: fetchPage, now = () => performance.now(), clock = Date.now, enabled = () => true, record = () => {}, setTimer = setTimeout, clearTimer = clearTimeout, timeoutMs = 10000 } = {}) {
	let state = initial(), generation = 0, controller;
	const listeners = new Set();
	const snapshot = () => ({ ...state, runs: state.runs.map(run => ({ ...run })), summary: summarizeRuns(state.runs) });
	const emit = () => { for (const listener of listeners) listener(snapshot()); };
	function cancel() {
		generation += 1;
		controller?.abort(); controller = undefined;
		if (state.running) { state = { ...state, running: false, cancelled: true, finishedAt: clock() }; emit(); }
	}
	const lab = {
		snapshot,
		subscribe(listener) { listeners.add(listener); listener(snapshot()); return () => listeners.delete(listener); },
		cancel,
		clear() { cancel(); state = initial(); emit(); },
		async run(target = '/') {
			if (state.running || !enabled()) return;
			if (!speedTargets.some(item => item.path === target)) throw new Error('Choose a Velora page.');
			const current = ++generation;
			state = { ...initial(), target, running: true, startedAt: clock() }; emit();
			for (let index = 1; index <= 5; index++) {
				if (current !== generation || !enabled()) break;
				controller = new AbortController();
				let timedOut = false, status = null, responseMs = null;
				const active = controller;
				const timer = setTimer(() => { timedOut = true; active.abort(); }, timeoutMs);
				const start = now();
				let run;
				try {
					const response = await fetchPage(target, { method: 'GET', cache: 'no-store', credentials: 'same-origin', redirect: 'error', signal: active.signal });
					responseMs = rounded(now() - start); status = response.status;
					const body = await response.arrayBuffer();
					run = { index, ok: response.ok, status, responseMs, totalMs: rounded(now() - start), bytes: body.byteLength, error: response.ok ? null : 'HTTP error' };
				} catch {
					run = { index, ok: false, status, responseMs, totalMs: rounded(now() - start), bytes: null, error: timedOut ? 'Timed out' : 'Request failed' };
				} finally { clearTimer(timer); }
				if (current !== generation || !enabled()) return;
				state = { ...state, runs: [...state.runs, run] }; emit();
			}
			if (current !== generation) return;
			controller = undefined;
			state = { ...state, running: false, finishedAt: clock() }; emit();
			if (enabled()) record(state.target, summarizeRuns(state.runs));
			return snapshot();
		}
	};
	return lab;
}

const key = '__veloraSpeedLabV1';
export function getSpeedLab(host = globalThis.window) {
	if (!host) return null;
	const owner = activityOwner(host);
	if (!owner[key]) {
		const hub = getActivityHub(owner);
		const lab = createSpeedLab({
			fetch: (...args) => owner.fetch(...args), now: () => owner.performance.now(),
			enabled: () => hub.snapshot().enabled && !resetInProgress(owner),
			record: (target, summary) => recordActivity('speed-test', { target, duration: summary.median, total: summary.succeeded }, owner)
		});
		owner[key] = lab;
		hub.subscribe(state => { if (!state.enabled) lab.clear(); });
		owner.addEventListener('pagehide', () => lab.cancel());
	}
	return owner[key];
}

export function speedReport(state, page) {
	return JSON.stringify({
		measurement: 'Five sequential GET requests; cache bypass requested. Response time ends at response headers; HTML time includes the body. Neither measures when an app is usable.',
		page: speedTargets.find(target => target.path === state.target)?.label || 'Desktop',
		startedAt: state.startedAt, finishedAt: state.finishedAt, cancelled: state.cancelled,
		runs: state.runs, summary: state.summary,
		browserNavigation: page
	}, null, 2);
}
