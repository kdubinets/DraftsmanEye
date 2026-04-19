/**
 * Algebraic least-squares circle fit via normal equations.
 * Fits x² + y² + Dx + Ey + F = 0 to the point cloud, then converts to (center, radius).
 */
import { solveThreeByThree } from './linearAlgebra';
import type { Point } from './primitives';

export type CircleFit = { center: Point; radius: number };

export function fitCircle(points: Point[]): CircleFit | null {
  let sumX = 0,
    sumY = 0,
    sumXX = 0,
    sumYY = 0,
    sumXY = 0,
    sumXr = 0,
    sumYr = 0,
    sumR = 0;

  for (const p of points) {
    const xx = p.x * p.x;
    const yy = p.y * p.y;
    const r = xx + yy;
    sumX += p.x;
    sumY += p.y;
    sumXX += xx;
    sumYY += yy;
    sumXY += p.x * p.y;
    sumXr += p.x * r;
    sumYr += p.y * r;
    sumR += r;
  }

  const solution = solveThreeByThree(
    [
      [sumXX, sumXY, sumX],
      [sumXY, sumYY, sumY],
      [sumX, sumY, points.length],
    ],
    [-sumXr, -sumYr, -sumR],
  );
  if (!solution) {
    return null;
  }

  const [d, e, f] = solution;
  const center = { x: -d / 2, y: -e / 2 };
  const r2 = center.x * center.x + center.y * center.y - f;

  if (!Number.isFinite(r2) || r2 <= 0) {
    return null;
  }

  return { center, radius: Math.sqrt(r2) };
}
