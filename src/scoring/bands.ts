/**
 * Single source of truth for feedback quality bands.
 * Each band defines a maxError threshold (relative error % or 100 - score for freehand),
 * the HSL hue used for the result accent color, the CSS class, and the label.
 * Add or shift thresholds here; the three derived functions follow automatically.
 */

const BANDS = [
  { maxError: 1, hue: 135, cls: 'excellent', label: 'Excellent' },
  { maxError: 3, hue: 102, cls: 'good', label: 'Good' },
  { maxError: 5, hue: 48, cls: 'ok', label: 'OK' },
  { maxError: Infinity, hue: 4, cls: 'bad', label: 'Off target' },
] as const;

function bandFor(relativeErrorPercent: number) {
  return (
    BANDS.find((b) => relativeErrorPercent <= b.maxError) ?? BANDS[BANDS.length - 1]
  );
}

export function feedbackHueForError(relativeErrorPercent: number): number {
  return bandFor(relativeErrorPercent).hue;
}

export function feedbackBandClass(relativeErrorPercent: number): string {
  return bandFor(relativeErrorPercent).cls;
}

export function feedbackLabel(relativeErrorPercent: number): string {
  return bandFor(relativeErrorPercent).label;
}
