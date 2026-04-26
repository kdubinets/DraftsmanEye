/**
 * Scoring for spiral trace exercises.
 * Measures mean and max distance from each stroke point to the nearest sample
 * on the target spiral path.
 *
 * Weight rationale (normalized to reference radius):
 *   W_MEAN 1400 → mean error at 0.71% of ref costs ~10 pts
 *   W_MAX   200 → max error at 5% of ref costs ~10 pts
 */
import { distanceBetween, clampNumber } from "../geometry/primitives";
import { spiralSamplePoints } from "../geometry/spiral";
import type { FreehandPoint, FreehandSpiralResult, TargetSpiral } from "../exercises/freehand/types";

const W_MEAN = 1400;
const W_MAX = 200;
const SAMPLE_STEPS = 1200;
const MIN_STROKE_LENGTH = 180;
const MIN_POINTS = 12;

export function scoreTraceSpiral(
  points: FreehandPoint[],
  target: TargetSpiral,
): FreehandSpiralResult | null {
  if (points.length < MIN_POINTS) return null;

  let strokeLengthPixels = 0;
  for (let i = 1; i < points.length; i++) {
    strokeLengthPixels += distanceBetween(points[i - 1], points[i]);
  }
  if (strokeLengthPixels < MIN_STROKE_LENGTH) return null;

  const { center, innerRadius, outerRadius, turns, spiralKind, direction } = target;
  const ySign = direction === "right" ? 1 : -1;
  const samples = spiralSamplePoints(
    center.x, center.y, innerRadius, outerRadius, turns, spiralKind, ySign, SAMPLE_STEPS,
  );

  let totalErr = 0;
  let maxErr = 0;
  for (const p of points) {
    let minDist = Infinity;
    for (const sample of samples) {
      const d = distanceBetween(p, sample);
      if (d < minDist) minDist = d;
    }
    totalErr += minDist;
    if (minDist > maxErr) maxErr = minDist;
  }

  const meanErrorPixels = totalErr / points.length;
  const refRadius =
    spiralKind === "archimedean"
      ? (innerRadius + outerRadius) / 2
      : Math.sqrt(innerRadius * outerRadius);

  const score = clampNumber(
    100 - (W_MEAN * (meanErrorPixels / refRadius) + W_MAX * (maxErr / refRadius)),
    0,
    100,
  );

  return {
    kind: "trace-spiral",
    score,
    meanErrorPixels,
    maxErrorPixels: maxErr,
    strokeLengthPixels,
    pointCount: points.length,
    target,
  };
}
