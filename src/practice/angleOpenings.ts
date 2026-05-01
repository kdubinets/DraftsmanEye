/** Opening-angle buckets and selection helpers for angle-copy drills. */
import type { ExerciseId } from "./catalog";
import type { ProgressStore } from "../storage/progress";

export const ANGLE_OPENING_BUCKET_SIZE_DEGREES = 10;
export const ANGLE_OPENING_MIN_BUCKET_DEGREES = 10;
export const ANGLE_OPENING_MAX_BUCKET_DEGREES = 170;
export const ANGLE_OPENING_MIN_DEGREES =
  ANGLE_OPENING_MIN_BUCKET_DEGREES -
  ANGLE_OPENING_BUCKET_SIZE_DEGREES / 2;
export const ANGLE_OPENING_MAX_DEGREES =
  ANGLE_OPENING_MAX_BUCKET_DEGREES +
  ANGLE_OPENING_BUCKET_SIZE_DEGREES / 2;
export const ANGLE_OPENING_BUCKETS = Array.from(
  {
    length:
      (ANGLE_OPENING_MAX_BUCKET_DEGREES - ANGLE_OPENING_MIN_BUCKET_DEGREES) /
        ANGLE_OPENING_BUCKET_SIZE_DEGREES +
      1,
  },
  (_, index) =>
    ANGLE_OPENING_MIN_BUCKET_DEGREES +
    index * ANGLE_OPENING_BUCKET_SIZE_DEGREES,
);

export type AngleOpeningMetadata = {
  angleOpeningDegrees: number;
  angleOpeningBucket: number;
};

export function angleOpeningMetadataFromRadians(
  openingRadians: number,
): AngleOpeningMetadata {
  const angleOpeningDegrees = (Math.abs(openingRadians) * 180) / Math.PI;
  return {
    angleOpeningDegrees,
    angleOpeningBucket: bucketAngleOpeningDegrees(angleOpeningDegrees),
  };
}

export function clampAngleOpeningDegrees(degrees: number): number {
  return Math.min(
    ANGLE_OPENING_MAX_DEGREES,
    Math.max(ANGLE_OPENING_MIN_DEGREES, degrees),
  );
}

export function bucketAngleOpeningDegrees(degrees: number): number {
  const clamped = clampAngleOpeningDegrees(degrees);
  const bucket =
    Math.round(clamped / ANGLE_OPENING_BUCKET_SIZE_DEGREES) *
    ANGLE_OPENING_BUCKET_SIZE_DEGREES;
  return Math.min(
    ANGLE_OPENING_MAX_BUCKET_DEGREES,
    Math.max(ANGLE_OPENING_MIN_BUCKET_DEGREES, bucket),
  );
}

export function selectAngleOpeningBucket(
  progress: ProgressStore,
  exerciseId: ExerciseId,
  random: () => number = Math.random,
): number {
  const aggregates = progress.dimensions.angleOpeningBuckets[exerciseId] ?? {};
  const now = Date.now();
  const RECENCY_HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000;

  const weighted = ANGLE_OPENING_BUCKETS.map((bucket) => {
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
