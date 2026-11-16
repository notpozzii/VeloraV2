export const PRIMARY_WISP = 'wss://galxy.it.com/jsonn/';
export const BACKUP_WISP = 'wss://relay.velora.uno/wisp/';

// Used by settings, launch URLs, and both page/worker transports.
export function normalizeRelayUrl(value) {
 if (typeof value !== 'string' || !value.trim() || /\s/.test(value.trim())) return null;
 try {
  const url = new URL(value.trim());
  if (!['wss:', 'ws:'].includes(url.protocol) || !url.hostname || url.username || url.password || url.hash) return null;
  return url.href;
 } catch { return null; }
}
export function resolveRelays(main, backup) {
 return { main: normalizeRelayUrl(main) || PRIMARY_WISP, backup: normalizeRelayUrl(backup) || BACKUP_WISP };
}

// The built-in relay identities stay fixed; settings choose which one to use.
export function relaySelection(value) {
 const selected = normalizeRelayUrl(value) || PRIMARY_WISP;
 return {
  customWisp: selected === PRIMARY_WISP ? '' : selected,
  backupWisp: selected === BACKUP_WISP ? PRIMARY_WISP : ''
 };
}
