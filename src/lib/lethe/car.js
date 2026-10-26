export function getWispUrl(custom) {
  return custom || 'wss://system.pilotrights.com/jsonn/';
}

export function createConnection() {
	return new window.BareMux.BareMuxConnection('/charon/worker.js');
}

export async function setCar(connection, car = 'libcurl', custom) {
	const wispUrl = getWispUrl(custom);

	switch (car) {
		case 'epoxy':
			await connection.setTransport('/reflux/index.mjs', [
				{ base: '/libbybutslightlyworse/index.mjs', wisp: wispUrl }
			]);
			break;
		case 'libcurl':
			await connection.setTransport('/reflux/index.mjs', [
				{ base: '/libby/index.mjs', wisp: wispUrl }
			]);
			break;
		case 'libcurlRaw':
			await connection.setTransport('/libby/index.mjs', [
				{ base: '/libby/index.mjs', wisp: wispUrl }
			]);
			break;
	}
}
