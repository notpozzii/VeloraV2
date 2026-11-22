import { defaultTransport } from './connection-options.js';
import { getRelayUrl } from './relay-fallback.js';
import { resolveRelays } from './relay-config.js';

export function getWispUrl(custom, backupWisp) {
  return getRelayUrl(custom, backupWisp);
}

export function createConnection() {
	return new window.BareMux.BareMuxConnection('/charon/worker.js');
}

export async function setCar(connection, car = defaultTransport, custom, backupWisp) {
	const { main: wispUrl, backup } = resolveRelays(custom, backupWisp);
	const selectedWisp = getWispUrl(wispUrl, backup);

	switch (car) {
		case 'epoxy':
			await connection.setTransport('/relay-transport.mjs', [
				{ module: '/reflux/index.mjs', base: '/libbybutslightlyworse/index.mjs', wisp: wispUrl, backupWisp: backup, selectedWisp }
			]);
			break;
		case 'libcurl':
		case 'libcurl-original':
			await connection.setTransport('/relay-transport.mjs', [
				{ module: '/reflux/index.mjs', base: car === 'libcurl' ? '/libby/index.velora.mjs' : '/libby/index.mjs', wisp: wispUrl, backupWisp: backup, selectedWisp }
			]);
			break;
		case 'libcurlRaw':
			await connection.setTransport('/relay-transport.mjs', [
				{ module: '/libby/index.mjs', base: '/libby/index.mjs', wisp: wispUrl, backupWisp: backup, selectedWisp }
			]);
			break;
	}
}
