/** Angle-estimation buckets, trial generation, and scoring helpers. */
import type { ExerciseId } from "./catalog";
import type { ProgressStore } from "../storage/progress";
import { clampNumber } from "../geometry/primitives";

export const ANGLE_ESTIMATE_MIN_DEGREES = 2;
export const ANGLE_ESTIMATE_MAX_DEGREES = 178;
export const ANGLE_ESTIMATE_BUCKET_SIZE_DEGREES = 5;
export const ANGLE_ESTIMATE_BUCKETS = Array.from(
  { length: 35 },
  (_, index) => 5 + index * ANGLE_ESTIMATE_BUCKET_SIZE_DEGREES,
);

export type AngleEstimateMetadata = {
  angleEstimateDegrees: number;
  angleEstimateBucket: number;
};

export type AngleEstimateTrial = {
  targetDegrees: number;
  targetBucket: number;
  baseRadians: number;
  sideSign: -1 | 1;
};

export type AngleEstimateResult = {
  score: number;
  estimatedDegrees: number;
  targetDegrees: number;
  signedErrorDegrees: number;
  absoluteErrorDegrees: number;
  metadata: AngleEstimateMetadata;
};

export function angleEstimateMetadata(
  targetDegrees: number,
): AngleEstimateMetadata {
  return {
    angleEstimateDegrees: clampAngleEstimateDegrees(targetDegrees),
    angleEstimateBucket: bucketAngleEstimateDegrees(targetDegrees),
  };
}

export function clampAngleEstimateDegrees(degrees: number): number {
  return Math.min(
    ANGLE_ESTIMATE_MAX_DEGREES,
    Math.max(ANGLE_ESTIMATE_MIN_DEGREES, Math.round(degrees)),
  );
}

export function bucketAngleEstimateDegrees(degrees: number): number {
  const clamped = clampAngleEstimateDegrees(degrees);
  if (clamped <= 7) return 5;
  if (clamped >= 173) return 175;
  const bucket =
    Math.round(clamped / ANGLE_ESTIMATE_BUCKET_SIZE_DEGREES) *
    ANGLE_ESTIMATE_BUCKET_SIZE_DEGREES;
  return Math.min(175, Math.max(5, bucket));
}

export function angleEstimateRangeForBucket(bucket: number): {
  min: number;
  max: number;
} {
  const normalized = bucketAngleEstimateDegrees(bucket);
  if (normalized === 5) {
    return { min: ANGLE_ESTIMATE_MIN_DEGREES, max: 7 };
  }
  if (normalized === 175) {
    return { min: 173, max: ANGLE_ESTIMATE_MAX_DEGREES };
  }
  return { min: normalized - 2, max: normalized + 2 };
}

export function createAngleEstimateTrial(
  exerciseId: ExerciseId,
  progress: ProgressStore,
  random: () => number = Math.random,
): AngleEstimateTrial {
  const bucket = selectAngleEstimateBucket(progress, exerciseId, random);
  const range = angleEstimateRangeForBucket(bucket);
  const targetDegrees =
    range.min + Math.floor(random() * (range.max - range.min + 1));
  return {
    targetDegrees,
    targetBucket: bucket,
    baseRadians: baseRadiansForAngleEstimateExercise(exerciseId, random),
    sideSign: random() < 0.5 ? -1 : 1,
  };
}

export function scoreAngleEstimate(
  targetDegrees: number,
  estimatedDegrees: number,
): AngleEstimateResult {
  const estimate = clampAngleEstimateDegrees(estimatedDegrees);
  const signedErrorDegrees = estimate - targetDegrees;
  const absoluteErrorDegrees = Math.abs(signedErrorDegrees);
  return {
    score: clampNumber(100 - 10 * absoluteErrorDegrees, 0, 100),
    estimatedDegrees: estimate,
    targetDegrees,
    signedErrorDegrees,
    absoluteErrorDegrees,
    metadata: angleEstimateMetadata(targetDegrees),
  };
}

export function selectAngleEstimateBucket(
  progress: ProgressStore,
  exerciseId: ExerciseId,
  random: () => number = Math.random,
): number {
  const aggregates =
    progress.dimensions.angleEstimateBuckets?.[exerciseId] ?? {};
  const now = Date.now();
  const RECENCY_HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000;

  const weighted = ANGLE_ESTIMATE_BUCKETS.map((bucket) => {
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
    return { bucket, weight: Math.max(1, weakness + sparse + recency) };
  });

  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = random() * total;
  for (const entry of weighted) {
    cursor -= entry.weight;
    if (cursor <= 0) return entry.bucket;
  }
  return weighted[weighted.length - 1].bucket;
}

function baseRadiansForAngleEstimateExercise(
  exerciseId: ExerciseId,
  random: () => number,
): number {
  if (exerciseId === "angle-estimate-horizontal") return 0;
  if (exerciseId === "angle-estimate-vertical") return -Math.PI / 2;
  return random() * Math.PI * 2;
}
