/**
 * Scoring for freehand and target line exercises.
 *
 * Weight rationale (both normalized to fitted length):
 *   W_MEAN 1600 → mean error at 6.25% of length costs ~10 pts
 *   W_MAX  250  → max error at 40% of length costs ~10 pts
 *   W_ENDPOINT 120 → (startErr + endErr) / targetLen at 8.3% costs ~10 pts
 *   W_ANGLE    0.65 → each degree of angle deviation costs 0.65 pts
 */
import { distanceBetween, clampNumber, lineAngleDifferenceDegrees } from '../geometry/primitives';
import type { FreehandPoint } from '../exercises/freehand/types';
import type {
  FreehandLineResult,
  FreehandTargetLineResult,
  TargetLine,
} from '../exercises/freehand/types';

const W_MEAN = 1600;
const W_MAX = 250;

export function scoreFreehandLine(
  points: FreehandPoint[],
): FreehandLineResult | null {
  if (points.length < 4) {
    return null;
  }

  let strokeLengthPixels = 0;
  for (let i = 1; i < points.length; i += 1) {
    strokeLengthPixels += distanceBetween(points[i - 1], points[i]);
  }
  if (strokeLengthPixels < 80) {
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

  // Principal-axis fit: handles any stroke angle without privileging x or y.
  const angle = 0.5 * Math.atan2(2 * xy, xx - yy);
  const dir = { x: Math.cos(angle), y: Math.sin(angle) };
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

  const fittedLength = maxProj - minProj;
  if (fittedLength < 80) {
    return null;
  }

  const meanErrorPixels = totalErr / points.length;
  const score = clampNumber(
    100 -
      (W_MEAN * (meanErrorPixels / fittedLength) +
        W_MAX * (maxErr / fittedLength)),
    0,
    100,
  );

  return {
    kind: 'line',
    score,
    meanErrorPixels,
    maxErrorPixels: maxErr,
    strokeLengthPixels,
    pointCount: points.length,
    fitStart: {
      x: centroid.x + dir.x * minProj,
      y: centroid.y + dir.y * minProj,
    },
    fitEnd: {
      x: centroid.x + dir.x * maxProj,
      y: centroid.y + dir.y * maxProj,
    },
  };
}

const W_ENDPOINT = 120;
const W_ANGLE = 0.65;

export function scoreTargetLine(
  points: FreehandPoint[],
  target: TargetLine,
): FreehandTargetLineResult | null {
  const base = scoreFreehandLine(points);
  if (!base) {
    return null;
  }

  const targetLength = distanceBetween(target.start, target.end);
  const fwdStart = distanceBetween(points[0], target.start);
  const fwdEnd = distanceBetween(points[points.length - 1], target.end);
  const revStart = distanceBetween(points[0], target.end);
  const revEnd = distanceBetween(points[points.length - 1], target.start);
  const useForward = fwdStart + fwdEnd <= revStart + revEnd;
  const startErrorPixels = useForward ? fwdStart : revEnd;
  const endErrorPixels = useForward ? fwdEnd : revStart;
  const angleErrorDegrees = lineAngleDifferenceDegrees(
    target.start,
    target.end,
    base.fitStart,
    base.fitEnd,
  );
  const score = clampNumber(
    base.score -
      ((startErrorPixels + endErrorPixels) / targetLength) * W_ENDPOINT -
      angleErrorDegrees * W_ANGLE,
    0,
    100,
  );

  return {
    ...base,
    kind: 'target-line',
    score,
    target,
    startErrorPixels,
    endErrorPixels,
    angleErrorDegrees,
  };
}
