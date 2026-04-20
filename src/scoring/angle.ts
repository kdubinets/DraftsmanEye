/**
 * Scoring for angle-copy exercises. The primary signal is copied angle error;
 * stroke straightness and start accuracy are secondary so this remains angle
 * practice rather than another freehand-line drill.
 */
import {
  clampNumber,
  distanceBetween,
  radiansToDegrees,
} from "../geometry/primitives";
import { fitLine } from "../geometry/fitLine";
import type { FreehandPoint } from "../exercises/freehand/types";
import type {
  FreehandTargetAngleResult,
  TargetAngle,
} from "../exercises/freehand/types";

const MIN_STROKE_LENGTH = 80;
const MAX_START_MISS = 70;
const W_ANGLE = 5;
const W_START = 40;
const W_STRAIGHTNESS = 120;

export function scoreTargetAngle(
  points: FreehandPoint[],
  target: TargetAngle,
): FreehandTargetAngleResult | null {
  if (points.length < 4) return null;

  let strokeLengthPixels = 0;
  for (let i = 1; i < points.length; i += 1) {
    strokeLengthPixels += distanceBetween(points[i - 1], points[i]);
  }
  if (strokeLengthPixels < MIN_STROKE_LENGTH) return null;

  const fit = fitLine(points);
  if (!fit) return null;

  const targetLength = distanceBetween(
    target.target.vertex,
    target.target.correctEnd,
  );
  const firstErrorPixels = distanceBetween(points[0], target.target.vertex);
  const lastErrorPixels = distanceBetween(
    points[points.length - 1],
    target.target.vertex,
  );
  const startErrorPixels = Math.min(firstErrorPixels, lastErrorPixels);
  if (startErrorPixels > MAX_START_MISS) return null;

  const userRay = orientedFitRay(
    fit.direction,
    points,
    target.target.vertex,
    targetLength,
  );
  if (!userRay) return null;

  const targetAngle = Math.atan2(
    target.target.correctEnd.y - target.target.vertex.y,
    target.target.correctEnd.x - target.target.vertex.x,
  );
  const userAngle = Math.atan2(
    userRay.end.y - userRay.start.y,
    userRay.end.x - userRay.start.x,
  );
  const signedAngleErrorRadians = signedAngleDifference(userAngle, targetAngle);
  const signedOpenErrorDegrees =
    radiansToDegrees(signedAngleErrorRadians) * target.openingSign;
  const angleErrorDegrees = Math.abs(signedOpenErrorDegrees);

  const score = clampNumber(
    100 -
      angleErrorDegrees * W_ANGLE -
      (startErrorPixels / targetLength) * W_START -
      (fit.meanErrorPixels / targetLength) * W_STRAIGHTNESS,
    0,
    100,
  );

  return {
    kind: "target-angle",
    score,
    meanErrorPixels: fit.meanErrorPixels,
    maxErrorPixels: fit.maxErrorPixels,
    strokeLengthPixels,
    pointCount: points.length,
    fitStart: fit.fitStart,
    fitEnd: fit.fitEnd,
    target,
    startErrorPixels,
    angleErrorDegrees,
    signedOpenErrorDegrees,
    userRayStart: userRay.start,
    userRayEnd: userRay.end,
  };
}

function orientedFitRay(
  fitDirection: { x: number; y: number },
  points: FreehandPoint[],
  vertex: { x: number; y: number },
  length: number,
): { start: { x: number; y: number }; end: { x: number; y: number } } | null {
  const first = points[0];
  const last = points[points.length - 1];
  const firstIsNearer =
    distanceBetween(first, vertex) <= distanceBetween(last, vertex);
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const strokeLength = Math.hypot(dx, dy);
  if (strokeLength === 0) return null;
  const awayDx = firstIsNearer ? dx : -dx;
  const awayDy = firstIsNearer ? dy : -dy;
  const direction =
    awayDx * fitDirection.x + awayDy * fitDirection.y >= 0
      ? fitDirection
      : { x: -fitDirection.x, y: -fitDirection.y };

  return {
    start: vertex,
    end: {
      x: vertex.x + direction.x * length,
      y: vertex.y + direction.y * length,
    },
  };
}

function signedAngleDifference(a: number, b: number): number {
  let diff = a - b;
  while (diff <= -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  return diff;
}
