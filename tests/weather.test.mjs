import test from 'node:test';
import assert from 'node:assert/strict';
import { loadWeatherPreferences, normalizeWeatherMode, normalizeWeatherSpeed, normalizeWeatherIntensity } from '../src/lib/utils/os/weather.js';
import { migrateLegacyWallpaper } from '../src/lib/utils/os/wallpaper-migration.js';

function settings(initial = {}) {
	const data = new Map(Object.entries(initial));
	const writes = [];
	return { data, writes, read: async (key, fallback) => data.get(key) ?? fallback,
		write: async (key, value) => { data.set(key, value); writes.push(key); } };
}
test('new users start with weather off without changing their wallpaper', async () => {
	const store = settings({ bg: '/personal.jpg', bgFit: 'contain' });
	assert.deepEqual(await loadWeatherPreferences(store), { mode: 'off', speed: 1, intensity: 60 });
	assert.equal(store.data.get('bg'), '/personal.jpg');
	assert.equal(store.data.get('bgFit'), 'contain');
});
test('old snow becomes independent weather and the seasonal toggle is retired', async () => {
	const store = settings({ christmasMode: true, christmasSnowSpeed: 2.5, bg: '/my-photo.jpg' });
	assert.deepEqual(await loadWeatherPreferences(store), { mode: 'snow', speed: 2.5, intensity: 60 });
	assert.equal(store.data.get('christmasMode'), false);
	assert.equal(store.data.get('bg'), '/my-photo.jpg');
	store.writes.length = 0;
	await loadWeatherPreferences(store);
	assert.deepEqual(store.writes, []);
});
test('explicit weather choices win over old seasonal settings, including Off', async () => {
	for (const mode of ['off', 'rain', 'storm', 'fog', 'sunshine']) {
		const store = settings({ weatherMode: mode, christmasMode: 'true', weatherSpeed: .5, weatherIntensity: 80 });
		assert.deepEqual(await loadWeatherPreferences(store), { mode, speed: .5, intensity: 80 });
	}
});
test('invalid modes and malformed numeric preferences stay within safe bounds', () => {
	assert.equal(normalizeWeatherMode('unknown'), 'off');
	assert.equal(normalizeWeatherMode(null), 'off');
	for (const value of [0, -1, NaN, Infinity, 'bad']) assert.equal(normalizeWeatherSpeed(value), 1);
	assert.equal(normalizeWeatherSpeed(999), 3);
	assert.equal(normalizeWeatherSpeed(.01), .25);
	assert.equal(normalizeWeatherIntensity(null), 60);
	assert.equal(normalizeWeatherIntensity('bad'), 60);
	assert.equal(normalizeWeatherIntensity(999), 100);
	assert.equal(normalizeWeatherIntensity(-50), 25);
});
test('legacy false strings do not accidentally turn snow on', async () => {
	assert.equal((await loadWeatherPreferences(settings({ christmasMode: 'false' }))).mode, 'off');
});
test('retired photos upgrade without replacing personal images or their saved fit', async () => {
	const store = settings({ bg: '/_app/immutable/assets/christmas-village.Cgi3Lf69.jpg', christmasPreviousBackground: { src: '/personal.jpg', fit: 'contain' } });
	await migrateLegacyWallpaper(store, '/winter.jpg');
	assert.equal(store.data.get('bg'), '/winter.jpg');
	assert.deepEqual(store.data.get('christmasPreviousBackground'), { src: '/personal.jpg', fit: 'contain' });
	const personal = settings({ bg: '/personal.jpg' });
	await migrateLegacyWallpaper(personal, '/winter.jpg');
	assert.equal(personal.data.get('bg'), '/personal.jpg');
});
