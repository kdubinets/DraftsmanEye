/**
 * Scoring for S-curve trace exercises.
 * Measures mean and 95th-percentile distance from each stroke point to the
 * nearest sample on the target curve, normalized by the curve's reference span.
 */
import { clampNumber, distanceBetween } from "../geometry/primitives";
import { sCurveSamplePoints } from "../geometry/sCurve";
import type {
  FreehandPoint,
  FreehandSCurveResult,
  TargetSCurve,
} from "../exercises/freehand/types";

const W_MEAN = 1400;
const W_P95 = 200;
const SAMPLE_STEPS = 800;
const MIN_STROKE_LENGTH = 160;
const MIN_POINTS = 12;

export function scoreTraceSCurve(
  points: FreehandPoint[],
  target: TargetSCurve,
): FreehandSCurveResult | null {
  if (points.length < MIN_POINTS) return null;

  let strokeLengthPixels = 0;
  for (let i = 1; i < points.length; i++) {
    strokeLengthPixels += distanceBetween(points[i - 1], points[i]);
  }
  if (strokeLengthPixels < MIN_STROKE_LENGTH) return null;

  const samples = sCurveSamplePoints(target, SAMPLE_STEPS);
  const pointErrors: number[] = [];
  for (const p of points) {
    let minDist = Infinity;
    for (const sample of samples) {
      const d = distanceBetween(p, sample);
      if (d < minDist) minDist = d;
    }
    pointErrors.push(minDist);
  }

  const meanErrorPixels =
    pointErrors.reduce((sum, error) => sum + error, 0) / pointErrors.length;
  const maxErrorPixels = Math.max(...pointErrors);

  pointErrors.sort((a, b) => a - b);
  const p95Index = Math.floor(pointErrors.length * 0.95);
  const p95Error = pointErrors[Math.min(p95Index, pointErrors.length - 1)];

  const score = clampNumber(
    100 -
      (W_MEAN * (meanErrorPixels / target.referenceLength) +
        W_P95 * (p95Error / target.referenceLength)),
    0,
    100,
  );

  return {
    kind: "trace-s-curve",
    score,
    meanErrorPixels,
    maxErrorPixels,
    strokeLengthPixels,
    pointCount: points.length,
    target,
  };
}
