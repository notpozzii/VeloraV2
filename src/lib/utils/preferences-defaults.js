import { connectionDefaults } from './connection-reset.js';
import { PANIC_SETTING, defaultPanicPreferences } from './panic-preferences.js';
import { DOCK_HOVER_SETTING, DEFAULT_DOCK_HOVER_STRENGTH } from './os/dock-settings.js';

export const preferencesResetKey = 'velora:preferences-reset';
export const preferencesResetVersion = '2026-11-15.1';

// Deliberate allowlist: wallpaper/weather, bookmarks, custom apps, uploaded
// images, theme designs, notes, account sessions, and game saves are data we keep.
export const preferencesDefaults = Object.freeze({
 ...connectionDefaults,
 searchEngine: 'google',
 autoAB: false,
 autoBlob: false,
 antiClose: false,
 tabPreset: null,
 [PANIC_SETTING]: defaultPanicPreferences,
 theme: '',
 compactDock: false,
 [DOCK_HOVER_SETTING]: DEFAULT_DOCK_HOVER_STRENGTH,
 desktopGlassStrength: 60,
 navbarsize: 24,
 popupInterceptor: true,
 LastPopupIntState: true
});
export const isPreference = key => Object.hasOwn(preferencesDefaults, key);

// Reset only the chosen Roblox appearance; keep custom theme designs and login.
export const localPreferenceDefaults = Object.freeze({ 'velora:roblox-theme:v1': 'velora' });
