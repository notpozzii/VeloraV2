import { loadSetting, onSettingChange } from '$lib/utils/localspace.js';
import { installPanicController } from './panic-key-core.js';

export function installPanicKey(host) {
	return installPanicController({ host, read: loadSetting, subscribe: onSettingChange });
}
