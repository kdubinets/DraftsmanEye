/**
 * User-facing settings store. Persisted to localStorage.
 * Missing or malformed values fall back to defaults — no migration needed.
 */

export type Settings = {
  /** Allow touch input for drawing (off by default; Apple Pencil / mouse recommended). */
  allowTouchDrawing: boolean;
  /** Vary stroke width by stylus pressure. */
  visualizePressureWidth: boolean;
  /** Vary stroke colour by drawing speed. */
  visualizeSpeedColor: boolean;
};

const STORAGE_KEY = 'draftsman-eye.settings.v1';

const DEFAULTS: Settings = {
  allowTouchDrawing: false,
  visualizePressureWidth: true,
  visualizeSpeedColor: true,
};

let cache: Settings | null = null;

export function getSettings(): Settings {
  if (cache) return cache;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return (cache = { ...DEFAULTS });
  try {
    const parsed = JSON.parse(raw) as unknown;
    return (cache = mergeWithDefaults(parsed));
  } catch {
    console.error('Failed to parse stored settings; using defaults.');
    return (cache = { ...DEFAULTS });
  }
}

export function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  const current = getSettings();
  const next: Settings = { ...current, [key]: value };
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.error('Failed to persist settings.', error);
  }
}

/** Fill missing or invalid keys from defaults rather than rejecting the whole payload. */
function mergeWithDefaults(raw: unknown): Settings {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
  return {
    allowTouchDrawing: typeof src['allowTouchDrawing'] === 'boolean'
      ? src['allowTouchDrawing']
      : DEFAULTS.allowTouchDrawing,
    visualizePressureWidth: typeof src['visualizePressureWidth'] === 'boolean'
      ? src['visualizePressureWidth']
      : DEFAULTS.visualizePressureWidth,
    visualizeSpeedColor: typeof src['visualizeSpeedColor'] === 'boolean'
      ? src['visualizeSpeedColor']
      : DEFAULTS.visualizeSpeedColor,
  };
}
