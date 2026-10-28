import { browser } from '$app/environment';
import { saveSetting } from '$lib/utils/localspace.js';
import { resetInProgress } from './reset-core.js';

const settingsChannel = 'galaxy-settings';
let channel = null;
function getChannel() {
	if (!browser || typeof BroadcastChannel === 'undefined') return null;
	if (!channel) channel = new BroadcastChannel(settingsChannel);
	return channel;
}
export async function saveSettingShared(key, value) {
	if (resetInProgress()) return;
	await saveSetting(key, value);
	if (resetInProgress()) return;
	getChannel()?.postMessage({ key, value });
}
export function subscribeSettings(handler) {
	const ch = getChannel();
	if (!ch) return () => {};
	const onMessage = (event) => {
		const data = event.data;
		if (data && data.key) handler(data.key, data.value);
	};
	ch.addEventListener('message', onMessage);
	return () => ch.removeEventListener('message', onMessage);
}
