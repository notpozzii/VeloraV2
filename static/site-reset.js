import { resetStorageKey, resetIntentKey, resetWaitKey, resetChannelName, resetReturnPath, resetPageUrl, readResetMarker, readResetIntent, beginSiteReset, unregisterSiteWorkers, clearSiteData } from './reset-core.js';

const host = window;
const params = new URLSearchParams(host.location.search);
let id = params.get('id');
let returnTo = resetReturnPath(params.get('return'));
let channel;
let joinedReset = false;
try { joinedReset = !!id && JSON.parse(host.sessionStorage.getItem(resetWaitKey) || 'null')?.id === id; } catch {}
try { channel = new BroadcastChannel(resetChannelName); } catch {}
const node = name => document.getElementById(name);
const send = type => channel?.postMessage({ type, id, returnTo });
function view(name) {
	for (const key of ['confirm', 'progress', 'wait', 'error']) node(`${key}-view`).hidden = key !== name;
}
function progress(stage) {
	const labels = { data: 'Clearing saved data and proxy sessions…', cache: 'Clearing cached and offline files…', preferences: 'Restoring all defaults…', done: 'Reset complete. Opening a fresh desktop…', blocked: 'Waiting for open apps to release their saved data…' };
	node('progress-status').textContent = labels[stage] || 'Closing open Velora apps…';
	node('blocked-help').hidden = stage !== 'blocked';
}
function leave() {
	host.location.replace(new URL(returnTo, host.location.origin).href);
}
function finishWaiting() {
	if (joinedReset) { try { host.sessionStorage.clear(); } catch {} }
	leave();
}
function waiting() {
	const marker = readResetMarker(host);
	if (!marker) return finishWaiting();
	id = marker.id; returnTo = marker.returnTo;
	joinedReset = true;
	try { host.sessionStorage.setItem(resetWaitKey, JSON.stringify({ id })); } catch {}
	if (params.get('phase') !== 'wait') { host.location.replace(resetPageUrl(host, id, returnTo, 'wait')); return; }
	view('wait');
}
function showError(error) {
	node('reset-error').textContent = error?.message || 'The browser could not clear all saved data. Please retry.';
	view('error');
}
async function locked(action) {
	if (!host.navigator.locks?.request) return action();
	return host.navigator.locks.request('velora-site-reset', { ifAvailable: true }, lock => lock ? action() : waiting());
}
async function run(intent) {
	id = intent.id; returnTo = intent.returnTo;
	view('progress');
	try {
		await locked(async () => {
			if (params.get('phase') !== 'clear') {
				host.localStorage.setItem(resetStorageKey, JSON.stringify({ id, returnTo }));
				send('start');
				await unregisterSiteWorkers(host);
				// Reload every waiting page and this page after unregistering. The
				// previous worker must lose its controlled clients and DB handles.
				send('reload');
				host.location.replace(resetPageUrl(host, id, returnTo, 'clear'));
				return;
			}
			if (readResetMarker(host)?.id !== id) throw new Error('This reset was interrupted. Start it again to finish.');
			await unregisterSiteWorkers(host);
			await clearSiteData(host, {
				onprogress: progress,
				beforeFinish() { if (readResetMarker(host)?.id !== id) throw new Error('This reset was interrupted. Please retry.'); }
			});
			send('complete');
			leave();
		});
	} catch (error) { showError(error); }
}

node('confirm-reset').onclick = () => { try { beginSiteReset(host, returnTo); } catch (error) { showError(error); } };
node('cancel-reset').onclick = leave;
node('resume-reset').onclick = () => { view('confirm'); node('cancel-reset').focus(); };
node('retry-reset').onclick = () => { try { beginSiteReset(host, returnTo); } catch (error) { showError(error); } };
node('leave-reset').onclick = () => {
	try {
		if (readResetMarker(host)?.id === id) host.localStorage.removeItem(resetStorageKey);
		host.sessionStorage.removeItem(resetIntentKey);
		host.sessionStorage.removeItem(resetWaitKey);
	} catch {}
	send('complete'); leave();
};

if (channel) channel.onmessage = event => {
	if (params.get('phase') !== 'wait') return;
	if (event.data?.type === 'start' && event.data.id === readResetMarker(host)?.id) waiting();
	if (event.data?.id !== id) return;
	if (event.data.type === 'complete') finishWaiting();
	else if (event.data.type === 'reload') {
		const url = new URL(resetPageUrl(host, id, returnTo, 'wait'));
		url.searchParams.set('released', '1');
		host.location.replace(url.href);
	}
};
host.addEventListener('storage', event => {
	if (params.get('phase') === 'wait' && (event.key === resetStorageKey || event.key === null)) waiting();
});

if (params.get('phase') === 'wait') waiting();
else {
	const intent = readResetIntent(host, id);
	if (intent) void run(intent);
	else { view('confirm'); node('cancel-reset').focus(); }
}
