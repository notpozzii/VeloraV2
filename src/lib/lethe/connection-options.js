export const defaultEngine = 'sj2';
export const defaultTransport = 'libcurl';

// The existing IDs still select the same builds.
export const engineChoices = [
	{ value: 'auto', label: 'Auto' },
	{ value: 'sj2', label: 'Velora SJ2' },
	{ value: 'sj2-original', label: 'SJ2' },
	{ value: 'sj', label: 'SJ1' },
	{ value: 'uv', label: 'Ultraviolet' }
];

export const transportChoices = [
	{ value: 'auto', label: 'Auto' },
	{ value: 'libcurl', label: 'Velora Libcurl' },
	{ value: 'libcurl-original', label: 'Libcurl' },
	{ value: 'epoxy', label: 'Epoxy' }
];

export function normalizeEngine(value) {
	switch (value) {
		case 'uv':
		case 'glass': return 'uv';
		case 'sj':
		case 'sj1':
		case 'polygon': return 'sj';
		case 'sj2-original': return 'sj2-original';
		default: return defaultEngine;
	}
}

export const isPrismEngine = engine => engine === 'sj2' || engine === 'sj2-original';
export const normalizeTransport = value =>
	['libcurl', 'libcurl-original', 'libcurlRaw', 'epoxy'].includes(value) ? value : defaultTransport;
