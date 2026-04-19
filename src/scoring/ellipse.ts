/**
 * Scoring for freehand and target ellipse exercises.
 *
 * Reference radius = √(majorRadius × minorRadius), the geometric mean of the semi-axes.
 * Using the geometric mean keeps the denominator stable regardless of aspect ratio.
 *
 * Weight rationale (normalised to reference radius or circumference):
 *   W_MEAN    1250 → mean error at 0.8% of ref costs ~10 pts
 *   W_MAX      180 → max error at 5.6% of ref costs ~10 pts
 *   W_CLOSURE  420 → closure gap at 2.4% of circumference costs ~10 pts
 *   W_JOIN    0.35 → per degree of join angle costs 0.35 pts
 *   W_CENTER   160 → center miss at 6.25% of ref costs ~10 pts (target only)
 *   W_RADII     95 → (majorMiss + minorMiss) / ref at 10.5% costs ~10 pts (target only)
 *   W_ROTATION 0.3 → per degree of rotation error costs 0.3 pts (target only)
 */
import {
  distanceBetween,
  clampNumber,
  ellipseRotationDifferenceDegrees,
} from '../geometry/primitives';
import {
  fitEllipse,
  ellipseRadialErrorPixels,
  ellipseCircumferenceApproximation,
} from '../geometry/fitEllipse';
import { closedShapeJoinAngleDegrees } from '../geometry/strokeMath';
import type { FreehandPoint } from '../exercises/freehand/types';
import type {
  FreehandEllipseResult,
  FreehandTargetEllipseResult,
  TargetEllipse,
} from '../exercises/freehand/types';

const W_MEAN = 1250;
const W_MAX = 180;
const W_CLOSURE = 420;
const W_JOIN = 0.35;

export function scoreFreehandEllipse(
  points: FreehandPoint[],
): FreehandEllipseResult | null {
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

  const fit = fitEllipse(points);
  if (
    !fit ||
    fit.majorRadius < 45 ||
    fit.majorRadius > 480 ||
    fit.minorRadius < 24 ||
    fit.minorRadius > 420 ||
    fit.majorRadius / fit.minorRadius > 8
  ) {
    return null;
  }

  let totalErr = 0,
    maxErr = 0;
  for (const p of points) {
    const err = ellipseRadialErrorPixels(p, fit);
    totalErr += err;
    maxErr = Math.max(maxErr, err);
  }

  const meanErrorPixels = totalErr / points.length;
  const closureGapPixels = distanceBetween(
    points[0],
    points[points.length - 1],
  );
  const joinAngleDegrees = closedShapeJoinAngleDegrees(points) ?? 180;
  const ref = Math.sqrt(fit.majorRadius * fit.minorRadius);
  const score = clampNumber(
    100 -
      (W_MEAN * (meanErrorPixels / ref) +
        W_MAX * (maxErr / ref) +
        W_CLOSURE *
          (closureGapPixels / ellipseCircumferenceApproximation(fit)) +
        W_JOIN * joinAngleDegrees),
    0,
    100,
  );

  return {
    kind: 'ellipse',
    score,
    meanErrorPixels,
    maxErrorPixels: maxErr,
    strokeLengthPixels,
    pointCount: points.length,
    center: fit.center,
    majorRadius: fit.majorRadius,
    minorRadius: fit.minorRadius,
    rotationRadians: fit.rotationRadians,
    closureGapPixels,
    joinAngleDegrees,
  };
}

const W_CENTER = 160;
const W_RADII = 95;
const W_ROTATION = 0.3;

// Target scoring measures against the target ellipse, not the best-fit ellipse.
export function scoreTargetEllipse(
  points: FreehandPoint[],
  target: TargetEllipse,
): FreehandTargetEllipseResult | null {
  const fit = fitEllipse(points);
  if (!fit || points.length < 12) {
    return null;
  }

  let strokeLengthPixels = 0,
    totalErr = 0,
    maxErr = 0;
  for (let i = 0; i < points.length; i += 1) {
    if (i > 0) strokeLengthPixels += distanceBetween(points[i - 1], points[i]);
    const err = ellipseRadialErrorPixels(points[i], target);
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
  const ref = Math.sqrt(target.majorRadius * target.minorRadius);
  const centerErrorPixels = distanceBetween(fit.center, target.center);
  const majorRadiusErrorPixels = Math.abs(fit.majorRadius - target.majorRadius);
  const minorRadiusErrorPixels = Math.abs(fit.minorRadius - target.minorRadius);
  const rotationErrorDegrees = ellipseRotationDifferenceDegrees(
    fit.rotationRadians,
    target.rotationRadians,
  );
  const score = clampNumber(
    100 -
      (W_MEAN * (meanErrorPixels / ref) +
        W_MAX * (maxErr / ref) +
        W_CENTER * (centerErrorPixels / ref) +
        W_RADII * ((majorRadiusErrorPixels + minorRadiusErrorPixels) / ref) +
        W_CLOSURE *
          (closureGapPixels / ellipseCircumferenceApproximation(target)) +
        W_ROTATION * rotationErrorDegrees +
        W_JOIN * joinAngleDegrees),
    0,
    100,
  );

  return {
    kind: 'target-ellipse',
    score,
    meanErrorPixels,
    maxErrorPixels: maxErr,
    strokeLengthPixels,
    pointCount: points.length,
    center: fit.center,
    majorRadius: fit.majorRadius,
    minorRadius: fit.minorRadius,
    rotationRadians: fit.rotationRadians,
    closureGapPixels,
    joinAngleDegrees,
    target,
    centerErrorPixels,
    majorRadiusErrorPixels,
    minorRadiusErrorPixels,
    rotationErrorDegrees,
  };
}
