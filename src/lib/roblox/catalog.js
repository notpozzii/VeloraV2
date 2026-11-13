import experiences from './experiences.json';

const order = [994732206, 1686885941, 5203828273, 4777817887, 5750914919, 383310974, 2440500124, 65241, 111958650, 1008451066, 13058];
export const initialExperiences = [...experiences].sort((a, b) => order.indexOf(a.universeId) - order.indexOf(b.universeId));

export async function robloxJson(network, url) {
	const response = await network.request(url);
	if (response.status !== 200) throw new Error(`Roblox returned ${response.status}.`);
	return JSON.parse(new TextDecoder().decode(response.body));
}

export async function refreshExperiences(network) {
	const ids = initialExperiences.map(game => game.universeId).join(',');
	const [info, votes] = await Promise.allSettled([
		robloxJson(network, `https://games.roblox.com/v1/games?universeIds=${ids}`),
		robloxJson(network, `https://games.roblox.com/v1/games/votes?universeIds=${ids}`)
	]);
	if (info.status === 'rejected') throw info.reason;
	const games = new Map(info.value.data.map(game => [game.id, game]));
	const ratings = new Map(votes.status === 'fulfilled' ? votes.value.data.map(game => [game.id, game]) : []);
	return initialExperiences.map(game => {
		const details = games.get(game.universeId), rating = ratings.get(game.universeId);
		const total = (rating?.upVotes || 0) + (rating?.downVotes || 0);
		return { ...game, name: details?.name || game.name, creator: details?.creator?.name || game.creator,
			playing: details?.playing, visits: details?.visits,
			rating: total ? Math.round(rating.upVotes / total * 100) : null };
	});
}

export function safeImage(value) {
	try { const url = new URL(value); return url.protocol === 'https:' && url.hostname.endsWith('.rbxcdn.com') ? url.href : ''; } catch { return ''; }
}

export async function userHeadshot(network, id) {
	const result = await robloxJson(network, `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=150x150&format=Png&isCircular=false`);
	return safeImage(result.data?.[0]?.imageUrl);
}

export async function experienceDetails(network, id) {
	const place = await robloxJson(network, `https://apis.roblox.com/universes/v1/places/${id}/universe`);
	if (!place.universeId) throw new Error('This experience could not be found. Check the game link or place ID.');
	const [info, thumbnails] = await Promise.all([
		robloxJson(network, `https://games.roblox.com/v1/games?universeIds=${place.universeId}`),
		robloxJson(network, `https://thumbnails.roblox.com/v1/games/icons?universeIds=${place.universeId}&returnPolicy=PlaceHolder&size=420x420&format=Png&isCircular=false`).catch(() => null)
	]);
	const game = info.data?.[0];
	if (!game) throw new Error('This experience is unavailable.');
	return { placeId: Number(id), universeId: place.universeId, name: game.name, creator: game.creator?.name,
		genre: game.genre_l1 || game.genre, playing: game.playing, visits: game.visits,
		image: safeImage(thumbnails?.data?.[0]?.imageUrl) };
}

export const compactNumber = value => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
