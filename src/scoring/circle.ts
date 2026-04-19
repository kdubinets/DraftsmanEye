/**
 * Scoring for freehand and target circle exercises.
 *
 * Weight rationale (all normalized to fit/target radius or circumference):
 *   W_MEAN   1200 → mean error at ~0.83% of radius costs ~10 pts
 *   W_MAX     180 → max error at ~5.6% of radius costs ~10 pts
 *   W_CLOSURE 420 → closure gap at ~2.4% of circumference costs ~10 pts
 *   W_JOIN    0.35 → each degree of join angle deviation costs 0.35 pts
 *   W_CENTER  180 → center miss at 5.6% of radius costs ~10 pts (target scoring only)
 *   W_RADIUS  160 → radius miss at 6.25% of radius costs ~10 pts (target scoring only)
 */
import { distanceBetween, clampNumber } from '../geometry/primitives';
import { fitCircle } from '../geometry/fitCircle';
import { closedShapeJoinAngleDegrees } from '../geometry/strokeMath';
import type { FreehandPoint } from '../exercises/freehand/types';
import type {
  FreehandCircleResult,
  FreehandTargetCircleResult,
  TargetCircle,
} from '../exercises/freehand/types';

const W_MEAN = 1200;
const W_MAX = 180;
const W_CLOSURE = 420;
const W_JOIN = 0.35;

export function scoreFreehandCircle(
  points: FreehandPoint[],
): FreehandCircleResult | null {
  if (points.length < 12) {
    return null;
  }

  let strokeLengthPixels = 0;
  for (let i = 1; i < points.length; i += 1) {
    strokeLengthPixels += distanceBetween(points[i - 1], points[i]);
  }
  if (strokeLengthPixels < 180) {
    return null;
  }

  const fit = fitCircle(points);
  if (!fit || fit.radius < 35 || fit.radius > 420) {
    return null;
  }

  let totalErr = 0,
    maxErr = 0;
  for (const p of points) {
    const err = Math.abs(distanceBetween(p, fit.center) - fit.radius);
    totalErr += err;
    maxErr = Math.max(maxErr, err);
  }

  const meanErrorPixels = totalErr / points.length;
  const closureGapPixels = distanceBetween(
    points[0],
    points[points.length - 1],
  );
  const joinAngleDegrees = closedShapeJoinAngleDegrees(points) ?? 180;
  const score = clampNumber(
    100 -
      (W_MEAN * (meanErrorPixels / fit.radius) +
        W_MAX * (maxErr / fit.radius) +
        W_CLOSURE * (closureGapPixels / (Math.PI * 2 * fit.radius)) +
        W_JOIN * joinAngleDegrees),
    0,
    100,
  );

  return {
    kind: 'circle',
    score,
    meanErrorPixels,
    maxErrorPixels: maxErr,
    strokeLengthPixels,
    pointCount: points.length,
    center: fit.center,
    radius: fit.radius,
    closureGapPixels,
    joinAngleDegrees,
  };
}

const W_CENTER = 180;
const W_RADIUS = 160;

// Target scoring measures radial error against the target circle, not the best-fit circle.
export function scoreTargetCircle(
  points: FreehandPoint[],
  target: TargetCircle,
): FreehandTargetCircleResult | null {
  const fit = fitCircle(points);
  if (!fit || points.length < 12) {
    return null;
  }

  let strokeLengthPixels = 0,
    totalErr = 0,
    maxErr = 0;
  for (let i = 0; i < points.length; i += 1) {
    if (i > 0) strokeLengthPixels += distanceBetween(points[i - 1], points[i]);
    const err = Math.abs(
      distanceBetween(points[i], target.center) - target.radius,
    );
    totalErr += err;
    maxErr = Math.max(maxErr, err);
  }
  if (strokeLengthPixels < 180) {
    return null;
  }

  const meanErrorPixels = totalErr / points.length;
  const closureGapPixels = distanceBetween(
    points[0],
    points[points.length - 1],
  );
  const joinAngleDegrees = closedShapeJoinAngleDegrees(points) ?? 180;
  const centerErrorPixels = distanceBetween(fit.center, target.center);
  const radiusErrorPixels = Math.abs(fit.radius - target.radius);
  const score = clampNumber(
    100 -
      (W_MEAN * (meanErrorPixels / target.radius) +
        W_MAX * (maxErr / target.radius) +
        W_CENTER * (centerErrorPixels / target.radius) +
        W_RADIUS * (radiusErrorPixels / target.radius) +
        W_CLOSURE * (closureGapPixels / (Math.PI * 2 * target.radius)) +
        W_JOIN * joinAngleDegrees),
    0,
    100,
  );

  return {
    kind: 'target-circle',
    score,
    meanErrorPixels,
    maxErrorPixels: maxErr,
    strokeLengthPixels,
    pointCount: points.length,
    center: fit.center,
    radius: fit.radius,
    closureGapPixels,
    joinAngleDegrees,
    target,
    centerErrorPixels,
    radiusErrorPixels,
  };
}
