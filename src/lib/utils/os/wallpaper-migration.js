// Preserve saved photo URLs from older releases. This does not enable a mode.
function isRetiredWallpaper(value) {
	if (typeof value !== 'string') return false;
	try {
		const { pathname } = new URL(value, 'https://velora.invalid');
		return [
			'/_app/immutable/assets/christmas-village.Cgi3Lf69.jpg',
			'/_app/immutable/assets/christmas-village.DlW-HNrF.jpg',
			'/src/lib/img/bg/christmas-village.jpg',
			'/_app/immutable/assets/christmas-photo.I3exsRGr.jpg',
			'/_app/immutable/assets/christmas-photo.kmohHBdG.jpg'
		].includes(pathname);
	} catch { return false; }
}
export async function migrateLegacyWallpaper({ read, write }, wallpaper) {
	const background = await read('bg', '');
	if (isRetiredWallpaper(background)) await write('bg', wallpaper);
	const previous = await read('christmasPreviousBackground', null);
	if (previous && isRetiredWallpaper(previous.src)) {
		await write('christmasPreviousBackground', { ...previous, src: wallpaper });
	}
}
