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
  /** Show the compact result headline after a completed trial. */
  showResultString: boolean;
  /** Show the detailed score box grid after a completed trial. */
  showScoreBoxes: boolean;
  /** Delay before a completed exercise resets; null means manual advance only. */
  autoRepeatDelayMs: AutoRepeatDelayMs;
  /** Rendering style for 3D solid references. */
  solidReferenceStyle: SolidReferenceStyle;
};

const STORAGE_KEY = "draftsman-eye.settings.v1";
export const AUTO_REPEAT_DELAYS = [null, 1500, 2500, 4000] as const;
export type AutoRepeatDelayMs = (typeof AUTO_REPEAT_DELAYS)[number];
export const SOLID_REFERENCE_STYLES = ["wireframe", "shaded"] as const;
export type SolidReferenceStyle = (typeof SOLID_REFERENCE_STYLES)[number];

const DEFAULTS: Settings = {
  allowTouchDrawing: false,
  visualizePressureWidth: true,
  visualizeSpeedColor: true,
  showResultString: true,
  showScoreBoxes: true,
  autoRepeatDelayMs: 2500,
  solidReferenceStyle: "wireframe",
};

let cache: Settings | null = null;

/** Clears the in-memory cache. Only for tests that reset localStorage between cases. */
export function _resetSettingsCache(): void {
  cache = null;
}

export function getSettings(): Settings {
  if (cache) return cache;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return (cache = { ...DEFAULTS });
  try {
    const parsed = JSON.parse(raw) as unknown;
    return (cache = mergeWithDefaults(parsed));
  } catch {
    console.error("Failed to parse stored settings; using defaults.");
    return (cache = { ...DEFAULTS });
  }
}

export function updateSetting<K extends keyof Settings>(
  key: K,
  value: Settings[K],
): void {
  const current = getSettings();
  const next: Settings = { ...current, [key]: value };
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.error("Failed to persist settings.", error);
  }
}

/** Fill missing or invalid keys from defaults rather than rejecting the whole payload. */
function mergeWithDefaults(raw: unknown): Settings {
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  return {
    allowTouchDrawing:
      typeof src["allowTouchDrawing"] === "boolean"
        ? src["allowTouchDrawing"]
        : DEFAULTS.allowTouchDrawing,
    visualizePressureWidth:
      typeof src["visualizePressureWidth"] === "boolean"
        ? src["visualizePressureWidth"]
        : DEFAULTS.visualizePressureWidth,
    visualizeSpeedColor:
      typeof src["visualizeSpeedColor"] === "boolean"
        ? src["visualizeSpeedColor"]
        : DEFAULTS.visualizeSpeedColor,
    showResultString:
      typeof src["showResultString"] === "boolean"
        ? src["showResultString"]
        : DEFAULTS.showResultString,
    showScoreBoxes:
      typeof src["showScoreBoxes"] === "boolean"
        ? src["showScoreBoxes"]
        : DEFAULTS.showScoreBoxes,
    autoRepeatDelayMs: parseAutoRepeatDelay(src["autoRepeatDelayMs"]),
    solidReferenceStyle: parseSolidReferenceStyle(src["solidReferenceStyle"]),
  };
}

function parseAutoRepeatDelay(raw: unknown): AutoRepeatDelayMs {
  return AUTO_REPEAT_DELAYS.includes(raw as AutoRepeatDelayMs)
    ? (raw as AutoRepeatDelayMs)
    : DEFAULTS.autoRepeatDelayMs;
}

function parseSolidReferenceStyle(raw: unknown): SolidReferenceStyle {
  return SOLID_REFERENCE_STYLES.includes(raw as SolidReferenceStyle)
    ? (raw as SolidReferenceStyle)
    : DEFAULTS.solidReferenceStyle;
}
