import { importOrigin, readManifest } from 'origin-snapshot';
import { unregisterSiteWorkers } from './reset-core.js';
import { restoreStorageKey, restoreIntentKey, restoreWaitKey, restoreChannelName, readRestoreMarker, restoreReturnPath, restorePageUrl, readRestoreIntent, readStagedSnapshot, validateRestoreManifest, applyStagedRestore } from './restore-core.js';

const host = window;
const params = new URLSearchParams(host.location.search);
let id = params.get('id');
let returnTo = restoreReturnPath(params.get('return'));
let channel;
let releasingWorker = false;
try { channel = new host.BroadcastChannel(restoreChannelName); } catch {}
const node = name => document.getElementById(name);
const send = type => channel?.postMessage({ type, id });
function view(name) {
	for (const key of ['progress', 'wait', 'error']) node(`${key}-view`).hidden = key !== name;
}
function leave() {
	host.sessionStorage.removeItem(restoreWaitKey);
	host.location.replace(new URL(returnTo, host.location.origin).href);
}
function waiting() {
	const marker = readRestoreMarker(host);
	if (!marker) return leave();
	id = marker.id; returnTo = marker.returnTo;
	if (params.get('phase') !== 'wait') { host.location.replace(restorePageUrl(host, id, returnTo, 'wait')); return; }
	view('wait');
	// The leader's reload message can arrive while this page is navigating.
	// Release a controller here too, so a missed message cannot keep its DB open.
	if (host.navigator.serviceWorker?.controller && !params.has('released') && !releasingWorker) {
		releasingWorker = true;
		void unregisterSiteWorkers(host).then(() => {
			if (readRestoreMarker(host)?.id === id) host.location.replace(restorePageUrl(host, id, returnTo, 'wait') + '&released=1');
		}).catch(showError);
	}
}
function showError(error) {
	node('restore-error').textContent = error?.message || 'The backup could not be restored. Please retry.';
	node('retry-restore').hidden = !readRestoreIntent(host, id);
	view('error');
}
async function run(intent) {
	id = intent.id; returnTo = intent.returnTo;
	view('progress');
	try {
		const action = async () => {
			const record = await readStagedSnapshot(host, id);
			if (!record?.file) throw new Error('The prepared backup is no longer available. Return to Settings and choose your backup again.');
			validateRestoreManifest(await readManifest(record.file));
			if (params.get('phase') !== 'apply') {
				host.localStorage.setItem(restoreStorageKey, JSON.stringify({ id, returnTo }));
				send('start');
				await unregisterSiteWorkers(host);
				// Both the desktop frames and the old worker's controlled clients
				// must unload before the import can replace their databases.
				send('reload');
				host.location.replace(restorePageUrl(host, id, returnTo, 'apply'));
				return;
			}
			node('progress-status').textContent = 'Restoring your settings, game saves, and browsing data…';
			await applyStagedRestore(host, record, importOrigin, name => {
				node('progress-status').textContent = `Waiting for the “${name}” database to be released…`;
				node('blocked-help').hidden = false;
			});
			send('complete');
			leave();
		};
		if (host.navigator.locks?.request) {
			await host.navigator.locks.request('velora-site-restore', { ifAvailable: true }, lock => lock ? action() : waiting());
		} else await action();
	} catch (error) { showError(error); }
}

node('retry-restore').onclick = () => {
	const intent = readRestoreIntent(host, id);
	if (intent) void run(intent);
};
node('leave-restore').onclick = () => {
	// Blocked requests stay on the progress screen. An error means the import
	// has settled, so returning cannot leave a live deletion behind it.
	if (readRestoreMarker(host)?.id === id) {
		host.localStorage.removeItem(restoreStorageKey);
		host.sessionStorage.removeItem(restoreIntentKey);
		send('complete');
	}
	leave();
};
node('resume-restore').onclick = () => {
	const marker = readRestoreMarker(host);
	if (!marker) return leave();
	host.sessionStorage.setItem(restoreIntentKey, JSON.stringify({ ...marker, time: Date.now() }));
	host.location.replace(restorePageUrl(host, marker.id, marker.returnTo));
};
if (channel) channel.onmessage = event => {
	if (params.get('phase') !== 'wait' || event.data?.id !== id) return;
	if (event.data.type === 'complete') leave();
	else if (event.data.type === 'reload') host.location.replace(restorePageUrl(host, id, returnTo, 'wait') + '&released=1');
};
host.addEventListener('storage', event => {
	if (params.get('phase') === 'wait' && (event.key === restoreStorageKey || event.key === null)) waiting();
});

if (params.get('phase') === 'wait') waiting();
else {
	const intent = readRestoreIntent(host, id);
	if (intent) void run(intent);
	else if (readRestoreMarker(host)) waiting();
	else showError(new Error('Open Settings → Data and choose a backup to restore.'));
}
