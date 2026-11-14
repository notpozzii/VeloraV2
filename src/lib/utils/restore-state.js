export const restoreStorageKey = 'velora:restore-in-progress';
export const restoreIntentKey = 'velora:restore-intent';
export const restoreWaitKey = 'velora:restore-wait';
export const restoreChannelName = 'velora-site-restore';
export const restoreStagingDatabase = 'velora-restore-staging';
export const validRestoreId = value => typeof value === 'string' && /^[a-z0-9-]{20,80}$/i.test(value);
export const restoreReturnPath = value => ['/os', '/settings', '/index.html'].includes(value) ? value : '/';

export function readRestoreMarker(host) {
	try {
		const marker = JSON.parse(host.localStorage.getItem(restoreStorageKey) || 'null');
		return validRestoreId(marker?.id) ? { id: marker.id, returnTo: restoreReturnPath(marker.returnTo) } : null;
	} catch { return null; }
}

export function restoreInProgress(host) {
	return !!host && (host.__veloraRestoring === true || !!readRestoreMarker(host));
}
