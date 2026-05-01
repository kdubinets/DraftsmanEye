/** Builds display state for the line-angle proficiency tracker. */
import type { ExerciseId } from "./catalog";
import {
  LINE_ANGLE_BUCKETS,
  LINE_ANGLE_BUCKET_SIZE_DEGREES,
} from "./lineAngles";
import type { ExerciseAggregate, ProgressStore } from "../storage/progress";

export const LINE_ANGLE_MIN_CONFIDENT_ATTEMPTS = 3;
export const LINE_ANGLE_TODAY_CENTER_TARGET = 50;

export type LineAngleProficiencyTone =
  | "empty"
  | "low-confidence"
  | "weak"
  | "developing"
  | "good"
  | "strong";

export type LineAngleTrackerBucket = {
  bucket: number;
  aggregate?: ExerciseAggregate;
  todayAttempts: number;
  tone: LineAngleProficiencyTone;
  sectorFill: string;
  todayOpacity: number;
};

export type LineAngleTrackerModel = {
  buckets: LineAngleTrackerBucket[];
  todayTotal: number;
  centerFill: string;
};

const SECTOR_FILLS: Record<LineAngleProficiencyTone, string> = {
  empty: "rgba(103, 103, 103, 0.16)",
  "low-confidence": "rgba(47, 85, 125, 0.24)",
  weak: "hsl(4 55% 42%)",
  developing: "hsl(38 58% 44%)",
  good: "hsl(86 48% 40%)",
  strong: "hsl(135 46% 36%)",
};

export function lineAngleTrackerModel(
  progress: ProgressStore,
  exerciseId: ExerciseId,
  now: number = Date.now(),
): LineAngleTrackerModel {
  const aggregates = progress.dimensions.lineAngleBuckets[exerciseId] ?? {};
  const todayCounts = lineAngleTodayCounts(progress, exerciseId, now);
  const confidentBuckets = LINE_ANGLE_BUCKETS.map((bucket) => ({
    bucket,
    aggregate: aggregates[String(bucket)],
  }))
    .filter((entry) => hasConfidentAggregate(entry.aggregate))
    .sort((a, b) => {
      const scoreDelta = a.aggregate!.ema - b.aggregate!.ema;
      return scoreDelta === 0 ? a.bucket - b.bucket : scoreDelta;
    });

  const toneByBucket = percentileTones(confidentBuckets.map((entry) => entry.bucket));
  const buckets = LINE_ANGLE_BUCKETS.map((bucket) => {
    const aggregate = aggregates[String(bucket)];
    const tone = lineAngleTone(aggregate, toneByBucket.get(bucket));
    const todayAttempts = todayCounts.byBucket.get(bucket) ?? 0;
    return {
      bucket,
      aggregate,
      todayAttempts,
      tone,
      sectorFill: SECTOR_FILLS[tone],
      todayOpacity: todayAttemptOpacity(todayAttempts),
    };
  });

  return {
    buckets,
    todayTotal: todayCounts.total,
    centerFill: todayCenterFill(todayCounts.total),
  };
}

function lineAngleTone(
  aggregate: ExerciseAggregate | undefined,
  confidentTone: LineAngleProficiencyTone | undefined,
): LineAngleProficiencyTone {
  if (aggregate === undefined) return "empty";
  if (aggregate.attempts < LINE_ANGLE_MIN_CONFIDENT_ATTEMPTS) {
    return "low-confidence";
  }
  return confidentTone ?? "low-confidence";
}

function hasConfidentAggregate(
  aggregate: ExerciseAggregate | undefined,
): aggregate is ExerciseAggregate {
  return (
    aggregate !== undefined &&
    aggregate.attempts >= LINE_ANGLE_MIN_CONFIDENT_ATTEMPTS
  );
}

function percentileTones(
  sortedBucketsAscending: number[],
): Map<number, LineAngleProficiencyTone> {
  const tones = new Map<number, LineAngleProficiencyTone>();
  const count = sortedBucketsAscending.length;
  if (count === 0) return tones;

  sortedBucketsAscending.forEach((bucket, index) => {
    const rank = index / count;
    const tone: LineAngleProficiencyTone =
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

function lineAngleTodayCounts(
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
    const bucket = attempt.metadata?.lineAngleBucket;
    if (bucket === undefined) continue;
    const normalizedBucket = normalizeVisibleBucket(bucket);
    byBucket.set(normalizedBucket, (byBucket.get(normalizedBucket) ?? 0) + 1);
    total += 1;
  }

  return { byBucket, total };
}

function normalizeVisibleBucket(bucket: number): number {
  const normalized = ((bucket % 360) + 360) % 360;
  const rounded =
    Math.round(normalized / LINE_ANGLE_BUCKET_SIZE_DEGREES) *
    LINE_ANGLE_BUCKET_SIZE_DEGREES;
  return rounded === 360 ? 0 : rounded;
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
  if (attempts === 1) return 0.28;
  if (attempts === 2) return 0.55;
  return 0.9;
}

function todayCenterFill(todayTotal: number): string {
  if (todayTotal <= 0) return "rgba(255, 252, 246, 0.94)";
  const opacity = 0.1 + Math.min(1, todayTotal / LINE_ANGLE_TODAY_CENTER_TARGET) * 0.68;
  return `rgba(47, 85, 125, ${opacity.toFixed(3)})`;
}
