export const connectionSettingsUrl = '/settings#connection';
export const connectionResetSuggestion = 'Try resetting your connection settings to defaults, then reload.';

export function isConnectionError(error) {
	const message = error instanceof Error ? error.message : String(error ?? '');
	return /\b(?:connect(?:ion|ing|ed)?|network|relay|wisp|transport|proxy|websocket|messageport)\b|timed?\s*out|timeout|failed to fetch|fetch failed|failed to load (?:\/|https?:)|could not load (?:a )?Roblox engine file|\bERR_(?:CONNECTION|NETWORK|INTERNET|TIMED_OUT)|\b(?:277|279)\b|\bHTTP\s+5\d\d\b/i.test(message);
}
