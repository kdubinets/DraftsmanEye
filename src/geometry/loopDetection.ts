/**
 * Detects individual loops within a continuous freehand stroke by finding
 * self-intersections. Each crossing pair defines a loop sub-stroke, which is
 * then fit to a circle to measure its center, radius, and circularity.
 */
import { fitCircle } from './fitCircle';
import { distanceBetween, clampNumber } from './primitives';

export type DetectedLoop = {
  points: { x: number; y: number }[];
  center: { x: number; y: number };
  radius: number;
  circularity: number; // 0–1, 1 = perfect circle
};

type Point = { x: number; y: number };

/** Downsample points to at most maxCount, evenly by arc length. */
function downsample(points: Point[], maxCount: number): Point[] {
  if (points.length <= maxCount) return points;
  const totalLen = points.reduce(
    (acc, p, i) => (i === 0 ? 0 : acc + distanceBetween(points[i - 1], p)),
    0,
  );
  const step = totalLen / (maxCount - 1);
  const result: Point[] = [points[0]];
  let accumulated = 0;
  let threshold = step;
  for (let i = 1; i < points.length; i += 1) {
    accumulated += distanceBetween(points[i - 1], points[i]);
    if (accumulated >= threshold) {
      result.push(points[i]);
      threshold += step;
      if (result.length >= maxCount - 1) break;
    }
  }
  result.push(points[points.length - 1]);
  return result;
}

/** 2D cross product of vectors (b-a) and (c-a). */
function cross(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/**
 * Returns the intersection point of segments AB and CD, or null if they don't cross.
 * Uses parametric form: intersection at A + t*(B-A) where t ∈ (0,1).
 */
function segmentIntersection(
  a: Point,
  b: Point,
  c: Point,
  d: Point,
): Point | null {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);

  if (d1 * d2 >= 0 || d3 * d4 >= 0) return null;

  const denom = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
  if (Math.abs(denom) < 1e-10) return null;

  const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / denom;
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
}

function arcLength(points: Point[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i += 1) {
    len += distanceBetween(points[i - 1], points[i]);
  }
  return len;
}

export function detectLoops(points: Point[]): DetectedLoop[] {
  if (points.length < 8) return [];

  const pts = downsample(points, 400);
  const loops: DetectedLoop[] = [];

  // Track which index we've already consumed into a loop to avoid overlapping detections.
  let minNextI = 0;

  for (let i = minNextI; i < pts.length - 4; i += 1) {
    for (let j = i + 4; j < pts.length - 1; j += 1) {
      const ix = segmentIntersection(pts[i], pts[i + 1], pts[j], pts[j + 1]);
      if (!ix) continue;

      // Extract sub-stroke forming the loop (from intersection on seg i to intersection on seg j).
      const sub: Point[] = [ix, ...pts.slice(i + 1, j + 1), ix];
      const len = arcLength(sub);
      if (len < 80 || len > 600) {
        // Too small or too large — skip and keep scanning.
        continue;
      }

      const fit = fitCircle(sub);
      if (!fit || fit.radius < 15) continue;

      let totalErr = 0;
      for (const p of sub) {
        totalErr += Math.abs(distanceBetween(p, fit.center) - fit.radius);
      }
      const meanErr = totalErr / sub.length;
      const circularity = clampNumber(1 - meanErr / fit.radius, 0, 1);

      loops.push({
        points: sub,
        center: fit.center,
        radius: fit.radius,
        circularity,
      });

      // Skip past this loop so we don't detect overlapping sub-loops inside it.
      minNextI = j + 1;
      i = j; // outer loop will i++ → i = j+1
      break;
    }
  }

  return loops;
}
