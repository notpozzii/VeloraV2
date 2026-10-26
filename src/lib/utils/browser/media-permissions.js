// Streaming sites can create cross-origin ad/player frames after navigation.
// Delegate playback through every Velora frame in that chain, including those
// whose src starts at the local readiness document before moving to the player.
export const mediaPermissions =
	'fullscreen; autoplay *; encrypted-media *; picture-in-picture; gamepad';
