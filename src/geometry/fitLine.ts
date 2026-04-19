/**
 * Principal-axis (orthogonal regression) line fit.
 * Returns the centroid, direction unit vector, and the fitted endpoints
 * spanning the projection extent of the input points.
 * Handles any stroke angle without privileging x or y.
 */
import type { Point } from './primitives';

export type LineFit = {
  centroid: Point;
  /** Unit vector along the principal axis. */
  direction: Point;
  fitStart: Point;
  fitEnd: Point;
  /** Mean perpendicular distance from each point to the fitted line. */
  meanErrorPixels: number;
  /** Maximum perpendicular distance from any point to the fitted line. */
  maxErrorPixels: number;
};

export function fitLine(points: Point[]): LineFit | null {
  if (points.length < 2) {
    return null;
  }

  const centroid = points.reduce(
    (sum, p) => ({ x: sum.x + p.x, y: sum.y + p.y }),
    { x: 0, y: 0 },
  );
  centroid.x /= points.length;
  centroid.y /= points.length;

  let xx = 0,
    xy = 0,
    yy = 0;
  for (const p of points) {
    const dx = p.x - centroid.x;
    const dy = p.y - centroid.y;
    xx += dx * dx;
    xy += dx * dy;
    yy += dy * dy;
  }

  const angle = 0.5 * Math.atan2(2 * xy, xx - yy);
  const dir: Point = { x: Math.cos(angle), y: Math.sin(angle) };

  let minProj = Infinity,
    maxProj = -Infinity,
    totalErr = 0,
    maxErr = 0;

  for (const p of points) {
    const dx = p.x - centroid.x;
    const dy = p.y - centroid.y;
    const proj = dx * dir.x + dy * dir.y;
    minProj = Math.min(minProj, proj);
    maxProj = Math.max(maxProj, proj);
    const perp = Math.abs(dx * dir.y - dy * dir.x);
    totalErr += perp;
    maxErr = Math.max(maxErr, perp);
  }

  return {
    centroid,
    direction: dir,
    fitStart: {
      x: centroid.x + dir.x * minProj,
      y: centroid.y + dir.y * minProj,
    },
    fitEnd: {
      x: centroid.x + dir.x * maxProj,
      y: centroid.y + dir.y * maxProj,
    },
    meanErrorPixels: totalErr / points.length,
    maxErrorPixels: maxErr,
  };
}
