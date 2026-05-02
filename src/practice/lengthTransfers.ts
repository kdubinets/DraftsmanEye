/** Length Transfer sub-skill buckets, target selection, and tracker models. */
import type { ExerciseAggregate, ProgressStore } from "../storage/progress";
import type { ExerciseId, TrialLine } from "./catalog";

export type TransferLengthMode = "copy" | "double";
export type TransferLengthBucket = 0 | 1 | 2 | 3 | 4;
export type TransferLengthRange = { min: number; max: number };
export type TransferLengthMetadata = {
  transferLengthPixels: number;
  transferLengthBucket: TransferLengthBucket;
};
export type TransferAngleMetadata = {
  transferAngleDegrees: number;
  transferAngleBucket: number;
};

export type TransferTrackerTone =
  | "empty"
  | "low-confidence"
  | "weak"
  | "developing"
  | "good"
  | "strong";

export type TransferTrackerBucket = {
  bucket: string;
  label: string;
  aggregate?: ExerciseAggregate;
  todayAttempts: number;
  tone: TransferTrackerTone;
  cellFill: string;
  todayOpacity: number;
  todayHeightPercent: number;
};

export type TransferTrackerModel = {
  buckets: TransferTrackerBucket[];
  todayTotal: number;
  todayProgress: number;
};

export const TRANSFER_LENGTH_BUCKETS: TransferLengthBucket[] = [
  0, 1, 2, 3, 4,
];
export const TRANSFER_ANGLE_BUCKET_SIZE_DEGREES = 30;
export const TRANSFER_ANGLE_BUCKETS = Array.from(
  { length: 180 / TRANSFER_ANGLE_BUCKET_SIZE_DEGREES },
  (_, index) => index * TRANSFER_ANGLE_BUCKET_SIZE_DEGREES,
);
export const TRANSFER_TODAY_TARGET = 50;
export const TRANSFER_MIN_CONFIDENT_ATTEMPTS = 3;

const TRANSFER_LENGTH_RANGES: Record<TransferLengthMode, TransferLengthRange> =
  {
    copy: { min: 130, max: 230 },
    double: { min: 190, max: 310 },
  };

const CELL_FILLS: Record<TransferTrackerTone, string> = {
  empty: "rgba(103, 103, 103, 0.16)",
  "low-confidence": "rgba(47, 85, 125, 0.24)",
  weak: "hsl(4 55% 42%)",
  developing: "hsl(38 58% 44%)",
  good: "hsl(86 48% 40%)",
  strong: "hsl(135 46% 36%)",
};

export function transferLengthRange(
  mode: TransferLengthMode,
): TransferLengthRange {
  return TRANSFER_LENGTH_RANGES[mode];
}

export function bucketTransferLength(
  targetDistance: number,
  range: TransferLengthRange,
): TransferLengthBucket {
  const span = range.max - range.min;
  if (span <= 0) return 0;
  const ratio = Math.min(1, Math.max(0, (targetDistance - range.min) / span));
  return Math.min(4, Math.floor(ratio * 5)) as TransferLengthBucket;
}

export function transferTargetDistanceForBucket(
  bucket: TransferLengthBucket,
  range: TransferLengthRange,
  random: () => number = Math.random,
): number {
  const span = range.max - range.min;
  const low = range.min + (span * bucket) / 5;
  const high = bucket === 4 ? range.max : range.min + (span * (bucket + 1)) / 5;
  return Math.round(low + random() * (high - low));
}

export function transferLengthMetadata(
  targetDistance: number,
  range: TransferLengthRange,
): TransferLengthMetadata {
  return {
    transferLengthPixels: targetDistance,
    transferLengthBucket: bucketTransferLength(targetDistance, range),
  };
}

export function transferAngleMetadata(
  referenceLine: TrialLine,
  guideLine: TrialLine,
): TransferAngleMetadata {
  const transferAngleDegrees = transferAngleBetweenLines(
    referenceLine,
    guideLine,
  );
  return {
    transferAngleDegrees,
    transferAngleBucket: bucketTransferAngleDegrees(transferAngleDegrees),
  };
}

export function transferAngleBetweenLines(
  referenceLine: TrialLine,
  guideLine: TrialLine,
): number {
  return normalizeHalfTurn(
    lineAngleDegrees(guideLine) - lineAngleDegrees(referenceLine),
  );
}

export function bucketTransferAngleDegrees(degrees: number): number {
  const normalized = normalizeHalfTurn(degrees);
  const bucket =
    Math.round(normalized / TRANSFER_ANGLE_BUCKET_SIZE_DEGREES) *
    TRANSFER_ANGLE_BUCKET_SIZE_DEGREES;
  return bucket === 180 ? 0 : bucket;
}

export function selectTransferLengthBucket(
  progress: ProgressStore,
  exerciseId: ExerciseId,
  random: () => number = Math.random,
): TransferLengthBucket {
  return selectWeightedBucket(
    TRANSFER_LENGTH_BUCKETS,
    progress.dimensions.transferLengthBuckets[exerciseId] ?? {},
    random,
  ) as TransferLengthBucket;
}

export function transferLengthTrackerModel(
  progress: ProgressStore,
  exerciseId: ExerciseId,
  now: number = Date.now(),
): TransferTrackerModel {
  const aggregates =
    progress.dimensions.transferLengthBuckets[exerciseId] ?? {};
  const todayCounts = transferTodayCounts(
    progress,
    exerciseId,
    now,
    "transferLengthBucket",
  );
  return linearTrackerModel(
    TRANSFER_LENGTH_BUCKETS.map((bucket) => ({
      key: String(bucket),
      label: lengthBucketLabel(bucket),
    })),
    aggregates,
    todayCounts,
  );
}

export function transferAngleTrackerModel(
  progress: ProgressStore,
  exerciseId: ExerciseId,
  now: number = Date.now(),
): TransferTrackerModel {
  const aggregates = progress.dimensions.transferAngleBuckets[exerciseId] ?? {};
  const todayCounts = transferTodayCounts(
    progress,
    exerciseId,
    now,
    "transferAngleBucket",
  );
  return linearTrackerModel(
    TRANSFER_ANGLE_BUCKETS.map((bucket) => ({
      key: String(bucket),
      label: `${bucket}deg`,
    })),
    aggregates,
    todayCounts,
  );
}

function selectWeightedBucket(
  buckets: readonly number[],
  aggregates: Partial<Record<string, ExerciseAggregate>>,
  random: () => number,
): number {
  const now = Date.now();
  const RECENCY_HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000;
  const weighted = buckets.map((bucket) => {
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

function linearTrackerModel(
  buckets: { key: string; label: string }[],
  aggregates: Partial<Record<string, ExerciseAggregate>>,
  todayCounts: { byBucket: Map<string, number>; total: number },
): TransferTrackerModel {
  const confidentBuckets = buckets
    .map((bucket) => ({
      ...bucket,
      aggregate: aggregates[bucket.key],
    }))
    .filter((entry) => hasConfidentAggregate(entry.aggregate))
    .sort((a, b) => {
      const scoreDelta = a.aggregate!.ema - b.aggregate!.ema;
      return scoreDelta === 0 ? a.key.localeCompare(b.key) : scoreDelta;
    });
  const toneByBucket = percentileTones(
    confidentBuckets.map((entry) => entry.key),
  );
  return {
    buckets: buckets.map((bucket) => {
      const aggregate = aggregates[bucket.key];
      const tone = transferTone(aggregate, toneByBucket.get(bucket.key));
      const todayAttempts = todayCounts.byBucket.get(bucket.key) ?? 0;
      return {
        bucket: bucket.key,
        label: bucket.label,
        aggregate,
        todayAttempts,
        tone,
        cellFill: CELL_FILLS[tone],
        todayOpacity: todayAttemptOpacity(todayAttempts),
        todayHeightPercent: todayAttemptHeightPercent(todayAttempts),
      };
    }),
    todayTotal: todayCounts.total,
    todayProgress: Math.min(1, todayCounts.total / TRANSFER_TODAY_TARGET),
  };
}

function transferTodayCounts(
  progress: ProgressStore,
  exerciseId: ExerciseId,
  now: number,
  metadataKey: "transferLengthBucket" | "transferAngleBucket",
): { byBucket: Map<string, number>; total: number } {
  const start = startOfLocalDay(now);
  const byBucket = new Map<string, number>();
  let total = 0;
  for (const attempt of progress.attempts) {
    if (attempt.exerciseId !== exerciseId) continue;
    if (attempt.timestamp < start || attempt.timestamp > now) continue;
    const rawBucket = attempt.metadata?.[metadataKey];
    if (rawBucket === undefined) continue;
    const key = String(rawBucket);
    byBucket.set(key, (byBucket.get(key) ?? 0) + 1);
    total += 1;
  }
  return { byBucket, total };
}

function transferTone(
  aggregate: ExerciseAggregate | undefined,
  confidentTone: TransferTrackerTone | undefined,
): TransferTrackerTone {
  if (aggregate === undefined) return "empty";
  if (aggregate.attempts < TRANSFER_MIN_CONFIDENT_ATTEMPTS) {
    return "low-confidence";
  }
  return confidentTone ?? "low-confidence";
}

function hasConfidentAggregate(
  aggregate: ExerciseAggregate | undefined,
): aggregate is ExerciseAggregate {
  return (
    aggregate !== undefined &&
    aggregate.attempts >= TRANSFER_MIN_CONFIDENT_ATTEMPTS
  );
}

function percentileTones(sortedKeysAscending: string[]): Map<string, TransferTrackerTone> {
  const tones = new Map<string, TransferTrackerTone>();
  const count = sortedKeysAscending.length;
  if (count === 0) return tones;
  sortedKeysAscending.forEach((key, index) => {
    const rank = index / count;
    const tone: TransferTrackerTone =
      rank < 0.25
        ? "weak"
        : rank < 0.5
          ? "developing"
          : rank < 0.75
            ? "good"
            : "strong";
    tones.set(key, tone);
  });
  return tones;
}

function lengthBucketLabel(bucket: TransferLengthBucket): string {
  return ["shortest", "short", "medium", "long", "longest"][bucket];
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

function startOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

function lineAngleDegrees(line: TrialLine): number {
  if (line.axis === "horizontal") return 0;
  if (line.axis === "vertical") return 90;
  const start = line.startPoint!;
  const end = line.endPoint!;
  return (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI;
}

function normalizeHalfTurn(degrees: number): number {
  const normalized = ((degrees % 180) + 180) % 180;
  return normalized === 180 ? 0 : normalized;
}
