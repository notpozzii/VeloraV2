import { codec } from './codec';

export function getOriginalUrl(url, uvConfig = typeof __uv$config !== 'undefined' ? __uv$config : undefined) {
	if (!url) return '';
	let path = url.split('#')[0];
	path = path.split('?')[0];
	if (path.includes('/prism/')) {
		const afterPrefix = path.split('/prism/')[1];
		const pieces = afterPrefix.split('/');
		const encoded = pieces[2];
		if (!encoded) return '';
		const real = codec.decode(encoded);
		if (real.startsWith('http')) return real;
		return '';
	}
	if (path.includes('/polygon/')) {
		const encoded = path.split('/polygon/')[1];
		const real = codec.decode(encoded);
		if (real.startsWith('http')) return real;
		return '';
	}

	if (uvConfig && path.includes(uvConfig.prefix)) {
		return uvConfig.decodeUrl(path.split(uvConfig.prefix)[1]);
	}

	return '';
}
