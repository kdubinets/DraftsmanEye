/** Directionless line-angle buckets and selection helpers for line drills. */
import type { Point } from "../geometry/primitives";
import type { ExerciseId } from "./catalog";
import type { ProgressStore } from "../storage/progress";

export const LINE_ANGLE_BUCKET_SIZE_DEGREES = 10;
export const LINE_ANGLE_BUCKETS = Array.from(
  { length: 180 / LINE_ANGLE_BUCKET_SIZE_DEGREES },
  (_, index) => index * LINE_ANGLE_BUCKET_SIZE_DEGREES,
);

export type LineAngleMetadata = {
  lineAngleDegrees: number;
  lineAngleBucket: number;
};

export function lineAngleMetadataFromPoints(
  start: Point,
  end: Point,
): LineAngleMetadata {
  const lineAngleDegrees = directionlessLineAngleDegrees(start, end);
  return {
    lineAngleDegrees,
    lineAngleBucket: bucketLineAngleDegrees(lineAngleDegrees),
  };
}

export function directionlessLineAngleDegrees(start: Point, end: Point): number {
  const degrees =
    (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI;
  return normalizeDirectionlessAngleDegrees(degrees);
}

export function normalizeDirectionlessAngleDegrees(degrees: number): number {
  const normalized = ((degrees % 180) + 180) % 180;
  return normalized === 180 ? 0 : normalized;
}

export function bucketLineAngleDegrees(degrees: number): number {
  const normalized = normalizeDirectionlessAngleDegrees(degrees);
  const bucket =
    Math.round(normalized / LINE_ANGLE_BUCKET_SIZE_DEGREES) *
    LINE_ANGLE_BUCKET_SIZE_DEGREES;
  return bucket === 180 ? 0 : bucket;
}

export function selectLineAngleBucket(
  progress: ProgressStore,
  exerciseId: ExerciseId,
  random: () => number = Math.random,
): number {
  const aggregates = progress.dimensions.lineAngleBuckets[exerciseId] ?? {};
  const now = Date.now();
  const RECENCY_HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000;

  const weighted = LINE_ANGLE_BUCKETS.map((bucket) => {
    const aggregate = aggregates[String(bucket)];
    const ema = aggregate?.ema ?? 55;
    const attempts = aggregate?.attempts ?? 0;
    const lastPracticedAt = aggregate?.lastPracticedAt ?? 0;
    const weakness = 100 - ema;
    const sparse = attempts === 0 ? 70 : 28 / Math.sqrt(attempts);
    const msSince = lastPracticedAt === 0 ? Infinity : now - lastPracticedAt;
    const recency =
      msSince === Infinity
        ? 20
        : 20 * (1 - Math.pow(0.5, msSince / RECENCY_HALF_LIFE_MS));
    return {
      bucket,
      weight: Math.max(1, weakness + sparse + recency),
    };
  });

  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = random() * total;
  for (const entry of weighted) {
    cursor -= entry.weight;
    if (cursor <= 0) return entry.bucket;
  }
  return weighted[weighted.length - 1].bucket;
}
