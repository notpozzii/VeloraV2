export const weatherOptions = [
	{ id: 'off', label: 'Off', icon: 'weather-off' },
	{ id: 'rain', label: 'Rain', icon: 'rain' },
	{ id: 'snow', label: 'Snow', icon: 'snow' },
	{ id: 'storm', label: 'Thunderstorm', icon: 'storm' },
	{ id: 'fog', label: 'Fog', icon: 'fog' },
	{ id: 'sunshine', label: 'Sunshine', icon: 'sun' }
];

export function normalizeWeatherMode(value) {
	return weatherOptions.some(option => option.id === value) ? value : 'off';
}
export function normalizeWeatherSpeed(value) {
	const number = Number(value);
	return Number.isFinite(number) && number > 0 ? Math.min(3, Math.max(0.25, number)) : 1;
}
export function normalizeWeatherIntensity(value) {
	if (value === null || value === undefined || value === '') return 60;
	const number = Number(value);
	return Number.isFinite(number) ? Math.min(100, Math.max(25, Math.round(number))) : 60;
}

// Keep existing snow preferences, but weather never selects or replaces a photo.
export async function loadWeatherPreferences({ read, write }) {
	const [mode, speed, intensity, oldMode, oldSpeed] = await Promise.all([
		read('weatherMode', null), read('weatherSpeed', null), read('weatherIntensity', null),
		read('christmasMode', false), read('christmasSnowSpeed', 1)
	]);
	const legacyEnabled = oldMode === true || oldMode === 'true';
	const next = {
		mode: normalizeWeatherMode(mode ?? (legacyEnabled ? 'snow' : 'off')),
		speed: normalizeWeatherSpeed(speed ?? oldSpeed),
		intensity: normalizeWeatherIntensity(intensity)
	};
	if (mode !== next.mode) await write('weatherMode', next.mode);
	if (speed !== next.speed) await write('weatherSpeed', next.speed);
	if (intensity !== next.intensity) await write('weatherIntensity', next.intensity);
	if (legacyEnabled) await write('christmasMode', false);
	return next;
}
