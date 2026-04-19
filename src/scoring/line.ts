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
import { fitLine } from '../geometry/fitLine';
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

  const fit = fitLine(points);
  if (!fit) {
    return null;
  }

  const fittedLength = distanceBetween(fit.fitStart, fit.fitEnd);
  if (fittedLength < 80) {
    return null;
  }

  const score = clampNumber(
    100 -
      (W_MEAN * (fit.meanErrorPixels / fittedLength) +
        W_MAX * (fit.maxErrorPixels / fittedLength)),
    0,
    100,
  );

  return {
    kind: 'line',
    score,
    meanErrorPixels: fit.meanErrorPixels,
    maxErrorPixels: fit.maxErrorPixels,
    strokeLengthPixels,
    pointCount: points.length,
    fitStart: fit.fitStart,
    fitEnd: fit.fitEnd,
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
