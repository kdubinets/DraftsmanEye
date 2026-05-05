/** Builds display state for angle-estimation proficiency buckets. */
import type { ExerciseId } from "./catalog";
import {
  ANGLE_ESTIMATE_BUCKETS,
  bucketAngleEstimateDegrees,
} from "./angleEstimation";
import type { ExerciseAggregate, ProgressStore } from "../storage/progress";

export const ANGLE_ESTIMATE_MIN_CONFIDENT_ATTEMPTS = 3;
export const ANGLE_ESTIMATE_TODAY_TARGET = 50;

export type AngleEstimateProficiencyTone =
  | "empty"
  | "low-confidence"
  | "weak"
  | "developing"
  | "good"
  | "strong";

export type AngleEstimateTrackerBucket = {
  bucket: number;
  aggregate?: ExerciseAggregate;
  todayAttempts: number;
  tone: AngleEstimateProficiencyTone;
  cellFill: string;
  todayOpacity: number;
  todayHeightPercent: number;
};

export type AngleEstimateTrackerModel = {
  buckets: AngleEstimateTrackerBucket[];
  todayTotal: number;
  todayProgress: number;
};

const CELL_FILLS: Record<AngleEstimateProficiencyTone, string> = {
  empty: "rgba(103, 103, 103, 0.16)",
  "low-confidence": "rgba(47, 85, 125, 0.24)",
  weak: "hsl(4 55% 42%)",
  developing: "hsl(38 58% 44%)",
  good: "hsl(86 48% 40%)",
  strong: "hsl(135 46% 36%)",
};

export function angleEstimateTrackerModel(
  progress: ProgressStore,
  exerciseId: ExerciseId,
  now: number = Date.now(),
): AngleEstimateTrackerModel {
  const aggregates =
    progress.dimensions.angleEstimateBuckets?.[exerciseId] ?? {};
  const todayCounts = angleEstimateTodayCounts(progress, exerciseId, now);
  const confidentBuckets = ANGLE_ESTIMATE_BUCKETS.map((bucket) => ({
    bucket,
    aggregate: aggregates[String(bucket)],
  }))
    .filter((entry) => hasConfidentAggregate(entry.aggregate))
    .sort((a, b) => {
      const scoreDelta = a.aggregate!.ema - b.aggregate!.ema;
      return scoreDelta === 0 ? a.bucket - b.bucket : scoreDelta;
    });

  const toneByBucket = percentileTones(
    confidentBuckets.map((entry) => entry.bucket),
  );
  const buckets = ANGLE_ESTIMATE_BUCKETS.map((bucket) => {
    const aggregate = aggregates[String(bucket)];
    const tone = angleEstimateTone(aggregate, toneByBucket.get(bucket));
    const todayAttempts = todayCounts.byBucket.get(bucket) ?? 0;
    return {
      bucket,
      aggregate,
      todayAttempts,
      tone,
      cellFill: CELL_FILLS[tone],
      todayOpacity: todayAttemptOpacity(todayAttempts),
      todayHeightPercent: todayAttemptHeightPercent(todayAttempts),
    };
  });

  return {
    buckets,
    todayTotal: todayCounts.total,
    todayProgress: Math.min(1, todayCounts.total / ANGLE_ESTIMATE_TODAY_TARGET),
  };
}

function angleEstimateTone(
  aggregate: ExerciseAggregate | undefined,
  confidentTone: AngleEstimateProficiencyTone | undefined,
): AngleEstimateProficiencyTone {
  if (aggregate === undefined) return "empty";
  if (aggregate.attempts < ANGLE_ESTIMATE_MIN_CONFIDENT_ATTEMPTS) {
    return "low-confidence";
  }
  return confidentTone ?? "low-confidence";
}

function hasConfidentAggregate(
  aggregate: ExerciseAggregate | undefined,
): aggregate is ExerciseAggregate {
  return (
    aggregate !== undefined &&
    aggregate.attempts >= ANGLE_ESTIMATE_MIN_CONFIDENT_ATTEMPTS
  );
}

function percentileTones(
  sortedBucketsAscending: number[],
): Map<number, AngleEstimateProficiencyTone> {
  const tones = new Map<number, AngleEstimateProficiencyTone>();
  const count = sortedBucketsAscending.length;
  if (count === 0) return tones;

  sortedBucketsAscending.forEach((bucket, index) => {
    const rank = index / count;
    const tone: AngleEstimateProficiencyTone =
      rank < 0.25
        ? "weak"
        : rank < 0.5
          ? "developing"
          : rank < 0.75
            ? "good"
            : "strong";
    tones.set(bucket, tone);
  });
  return tones;
}

function angleEstimateTodayCounts(
  progress: ProgressStore,
  exerciseId: ExerciseId,
  now: number,
): { byBucket: Map<number, number>; total: number } {
  const start = startOfLocalDay(now);
  const byBucket = new Map<number, number>();
  let total = 0;

  for (const attempt of progress.attempts) {
    if (attempt.exerciseId !== exerciseId) continue;
    if (attempt.timestamp < start || attempt.timestamp > now) continue;
    const bucket = attempt.metadata?.angleEstimateBucket;
    if (bucket === undefined) continue;
    const normalizedBucket = bucketAngleEstimateDegrees(bucket);
    byBucket.set(normalizedBucket, (byBucket.get(normalizedBucket) ?? 0) + 1);
    total += 1;
  }

  return { byBucket, total };
}

function startOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

function todayAttemptOpacity(attempts: number): number {
  if (attempts <= 0) return 0;
  if (attempts === 1) return 0.3;
  if (attempts === 2) return 0.58;
  return 0.9;
}

function todayAttemptHeightPercent(attempts: number): number {
  if (attempts <= 0) return 0;
  if (attempts === 1) return 34;
  if (attempts === 2) return 64;
  return 100;
}
