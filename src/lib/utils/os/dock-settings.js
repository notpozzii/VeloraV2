export const DEFAULT_DOCK_HOVER_STRENGTH = 10;
export const DOCK_HOVER_SETTING = 'dockHoverStrength';

export function normalizeDockHoverStrength(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return DEFAULT_DOCK_HOVER_STRENGTH;
  const strength = Number(value);
  return Number.isFinite(strength) ? Math.max(0, Math.min(100, Math.round(strength))) : DEFAULT_DOCK_HOVER_STRENGTH;
}
