import { preferencesDefaults, localPreferenceDefaults, preferencesResetKey, preferencesResetVersion } from './preferences-defaults.js';

// Never clear a store, database, cookie, cache, or storage namespace. Only
// named preferences change, once, before the desktop or app reads its settings.
export function createPreferencesReset({ store, legacyStorage, sessionStorage, notify = () => {}, lock, resetting = () => false }) {
 let pending;
 async function migrate() {
  if (!store || resetting()) return false;
  const changed = await store.runTransaction('readwrite', async transaction => {
   if (await transaction.get(preferencesResetKey) === preferencesResetVersion) return false;
   if (resetting()) throw new Error('Site restore/reset in progress');
   for (const [key, value] of Object.entries(preferencesDefaults)) await transaction.set(key, value);
   if (resetting()) throw new Error('Site restore/reset in progress');
   await transaction.set(preferencesResetKey, preferencesResetVersion);
   return true;
  });
  if (resetting()) return false;
  if (changed) {
   try {
    const legacy = legacyStorage?.();
    for (const key of Object.keys(preferencesDefaults)) legacy?.removeItem(key);
    for (const [key, value] of Object.entries(localPreferenceDefaults)) legacy?.setItem(key, value);
   } catch {}
   // Connection-choice caches contain no account credentials or user content.
   try {
    const session = sessionStorage?.();
    session?.removeItem('velora:auto-connections:v1');
    session?.removeItem('velora:relay-fallback:v3');
   } catch {}
   for (const [key, value] of Object.entries(preferencesDefaults)) {
    try { notify(key, value); } catch {}
   }
  }
  return true;
 }
 return {
  ensure() {
   return pending ??= (async () => {
    try { return await (lock ? lock(migrate) : migrate()); }
    catch { return false; } // Retry on the next visit if browser storage is unavailable.
   })();
  }
 };
}
