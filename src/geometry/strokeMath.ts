/**
 * Arc-length walking and tangent extraction for freehand stroke polylines.
 * All functions accept generic {x, y} points so they are not coupled to FreehandPoint.
 */
import { distanceBetween, normalizedVector, radiansToDegrees, clampNumber } from './primitives';
import type { Point } from './primitives';

/** Walk the polyline from the start until targetDistance is accumulated, then interpolate. */
export function pointAtDistanceFromStart(
  points: Point[],
  targetDistance: number,
): Point | null {
  let walked = 0;
  for (let i = 1; i < points.length; i += 1) {
    const seg = distanceBetween(points[i - 1], points[i]);
    if (seg === 0) continue;
    if (walked + seg >= targetDistance) {
      const t = (targetDistance - walked) / seg;
      return lerpPoint(points[i - 1], points[i], t);
    }
    walked += seg;
  }
  return null;
}

export function pointAtDistanceFromEnd(
  points: Point[],
  targetDistance: number,
): Point | null {
  let walked = 0;
  for (let i = points.length - 2; i >= 0; i -= 1) {
    const seg = distanceBetween(points[i], points[i + 1]);
    if (seg === 0) continue;
    if (walked + seg >= targetDistance) {
      const t = 1 - (targetDistance - walked) / seg;
      return lerpPoint(points[i], points[i + 1], t);
    }
    walked += seg;
  }
  return null;
}

/**
 * Estimate tangent directions at both ends of a closed stroke.
 * Samples 36 px inward from each tip to avoid noise at the tip itself.
 */
export function closedShapeTangents(
  points: Point[],
): { start: Point; end: Point } | null {
  if (points.length < 6) {
    return null;
  }
  const sample = 36;
  const s0 = pointAtDistanceFromStart(points, sample);
  const s1 = pointAtDistanceFromEnd(points, sample);
  if (!s0 || !s1) {
    return null;
  }
  const start = normalizedVector(points[0], s0);
  const end = normalizedVector(s1, points[points.length - 1]);
  if (!start || !end) {
    return null;
  }
  return { start, end };
}

export function closedShapeJoinAngleDegrees(points: Point[]): number | null {
  const tangents = closedShapeTangents(points);
  if (!tangents) {
    return null;
  }
  const dot =
    tangents.start.x * tangents.end.x + tangents.start.y * tangents.end.y;
  return radiansToDegrees(Math.acos(clampNumber(dot, -1, 1)));
}

function lerpPoint(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
