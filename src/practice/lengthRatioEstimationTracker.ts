/** Builds display state for length-ratio estimation proficiency buckets. */
import type { ExerciseAggregate, ProgressStore } from "../storage/progress";
import type { ExerciseId } from "./catalog";
import {
  LENGTH_RATIO_BUCKETS,
  bucketLengthRatio,
  lengthRatioForBucket,
} from "./lengthRatioEstimation";

export const LENGTH_RATIO_MIN_CONFIDENT_ATTEMPTS = 3;
export const LENGTH_RATIO_TODAY_TARGET = 50;

export type LengthRatioProficiencyTone =
  | "empty"
  | "low-confidence"
  | "weak"
  | "developing"
  | "good"
  | "strong";

export type LengthRatioTrackerBucket = {
  bucket: number;
  label: string;
  aggregate?: ExerciseAggregate;
  todayAttempts: number;
  tone: LengthRatioProficiencyTone;
  cellFill: string;
  todayOpacity: number;
  todayHeightPercent: number;
};

export type LengthRatioTrackerModel = {
  buckets: LengthRatioTrackerBucket[];
  todayTotal: number;
  todayProgress: number;
};

const CELL_FILLS: Record<LengthRatioProficiencyTone, string> = {
  empty: "rgba(103, 103, 103, 0.16)",
  "low-confidence": "rgba(47, 85, 125, 0.24)",
  weak: "hsl(4 55% 42%)",
  developing: "hsl(38 58% 44%)",
  good: "hsl(86 48% 40%)",
  strong: "hsl(135 46% 36%)",
};

export function lengthRatioTrackerModel(
  progress: ProgressStore,
  exerciseId: ExerciseId,
  now: number = Date.now(),
): LengthRatioTrackerModel {
  const aggregates = progress.dimensions.lengthRatioBuckets?.[exerciseId] ?? {};
  const todayCounts = lengthRatioTodayCounts(progress, exerciseId, now);
  const confidentBuckets = LENGTH_RATIO_BUCKETS.map((bucket) => ({
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

  return {
    buckets: LENGTH_RATIO_BUCKETS.map((bucket) => {
      const aggregate = aggregates[String(bucket)];
      const todayAttempts = todayCounts.byBucket.get(bucket) ?? 0;
      const tone = lengthRatioTone(aggregate, toneByBucket.get(bucket));
      return {
        bucket,
        label: formatRatio(lengthRatioForBucket(bucket)),
        aggregate,
        todayAttempts,
        tone,
        cellFill: CELL_FILLS[tone],
        todayOpacity: todayAttemptOpacity(todayAttempts),
        todayHeightPercent: todayAttemptHeightPercent(todayAttempts),
      };
    }),
    todayTotal: todayCounts.total,
    todayProgress: Math.min(1, todayCounts.total / LENGTH_RATIO_TODAY_TARGET),
  };
}

export function formatRatio(ratio: number): string {
  if (ratio >= 1) return ratio >= 2 ? ratio.toFixed(1) : ratio.toFixed(2);
  return ratio <= 0.5 ? ratio.toFixed(2) : ratio.toFixed(2);
}

function lengthRatioTone(
  aggregate: ExerciseAggregate | undefined,
  confidentTone: LengthRatioProficiencyTone | undefined,
): LengthRatioProficiencyTone {
  if (aggregate === undefined) return "empty";
  if (aggregate.attempts < LENGTH_RATIO_MIN_CONFIDENT_ATTEMPTS) {
    return "low-confidence";
  }
  return confidentTone ?? "low-confidence";
}

function hasConfidentAggregate(
  aggregate: ExerciseAggregate | undefined,
): aggregate is ExerciseAggregate {
  return (
    aggregate !== undefined &&
    aggregate.attempts >= LENGTH_RATIO_MIN_CONFIDENT_ATTEMPTS
  );
}

function percentileTones(
  sortedBucketsAscending: number[],
): Map<number, LengthRatioProficiencyTone> {
  const tones = new Map<number, LengthRatioProficiencyTone>();
  const count = sortedBucketsAscending.length;
  if (count === 0) return tones;

  sortedBucketsAscending.forEach((bucket, index) => {
    const rank = index / count;
    const tone: LengthRatioProficiencyTone =
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

function lengthRatioTodayCounts(
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
    const bucket = attempt.metadata?.lengthRatioBucket;
    if (bucket === undefined) continue;
    const normalizedBucket = bucketLengthRatio(
      attempt.metadata?.lengthRatio ?? lengthRatioForBucket(bucket),
    );
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
