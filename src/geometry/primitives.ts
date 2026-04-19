/** Pure math utilities shared across geometry and scoring modules. */

export type Point = { x: number; y: number };

export function distanceBetween(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

export function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function pointOnCircle(center: Point, radius: number, angle: number): Point {
  return {
    x: center.x + Math.cos(angle) * radius,
    y: center.y + Math.sin(angle) * radius,
  };
}

// Returns the smallest unsigned angle between two lines (0–90°), orientation-independent.
export function lineAngleDifferenceDegrees(
  firstStart: Point,
  firstEnd: Point,
  secondStart: Point,
  secondEnd: Point,
): number {
  const a1 = Math.atan2(firstEnd.y - firstStart.y, firstEnd.x - firstStart.x);
  const a2 = Math.atan2(secondEnd.y - secondStart.y, secondEnd.x - secondStart.x);
  const raw = Math.abs(radiansToDegrees(a1 - a2)) % 180;
  return raw > 90 ? 180 - raw : raw;
}

// Same fold-to-90° treatment for ellipse rotation, since axes have 180° symmetry.
export function ellipseRotationDifferenceDegrees(
  firstRotationRadians: number,
  secondRotationRadians: number,
): number {
  const raw =
    Math.abs(radiansToDegrees(firstRotationRadians - secondRotationRadians)) % 180;
  return raw > 90 ? 180 - raw : raw;
}

export function normalizedVector(a: Point, b: Point): Point | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) {
    return null;
  }
  return { x: dx / length, y: dy / length };
}
