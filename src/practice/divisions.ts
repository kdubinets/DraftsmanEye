/** Division sub-skill buckets, target selection, and tracker models. */
import type { ExerciseAggregate, ProgressStore } from "../storage/progress";
import type { ExerciseId, LineAxis, TrialLine } from "./catalog";

export type DivisionLengthBucket = 0 | 1 | 2 | 3 | 4;
export type DivisionLengthRange = { min: number; max: number };
export type DivisionLengthMetadata = {
  divisionLengthPixels: number;
  divisionLengthBucket: DivisionLengthBucket;
};
export type DivisionDirectionMetadata = {
  divisionDirectionDegrees: number;
  divisionDirectionBucket: number;
};

export type DivisionMetadata = DivisionLengthMetadata &
  Partial<DivisionDirectionMetadata>;

export type DivisionTrackerTone =
  | "empty"
  | "low-confidence"
  | "weak"
  | "developing"
  | "good"
  | "strong";

export type DivisionLinearTrackerBucket = {
  bucket: string;
  label: string;
  aggregate?: ExerciseAggregate;
  todayAttempts: number;
  tone: DivisionTrackerTone;
  cellFill: string;
  todayOpacity: number;
  todayHeightPercent: number;
};

export type DivisionTrackerModel = {
  buckets: DivisionLinearTrackerBucket[];
  todayTotal: number;
  todayProgress: number;
};

export const DIVISION_LENGTH_BUCKETS: DivisionLengthBucket[] = [
  0, 1, 2, 3, 4,
];
export const DIVISION_DIRECTION_BUCKET_SIZE_DEGREES = 30;
export const DIVISION_DIRECTION_BUCKETS = Array.from(
  { length: 360 / DIVISION_DIRECTION_BUCKET_SIZE_DEGREES },
  (_, index) => index * DIVISION_DIRECTION_BUCKET_SIZE_DEGREES,
);
export const DIVISION_TODAY_TARGET = 50;
export const DIVISION_MIN_CONFIDENT_ATTEMPTS = 3;

const DIVISION_LENGTH_RANGES: Record<LineAxis, DivisionLengthRange> = {
  horizontal: { min: 280, max: 520 },
  vertical: { min: 360, max: 520 },
  free: { min: 330, max: 500 },
};

const CELL_FILLS: Record<DivisionTrackerTone, string> = {
  empty: "rgba(103, 103, 103, 0.16)",
  "low-confidence": "rgba(47, 85, 125, 0.24)",
  weak: "hsl(4 55% 42%)",
  developing: "hsl(38 58% 44%)",
  good: "hsl(86 48% 40%)",
  strong: "hsl(135 46% 36%)",
};

export function divisionLengthRange(axis: LineAxis): DivisionLengthRange {
  return DIVISION_LENGTH_RANGES[axis];
}

export function bucketDivisionLength(
  length: number,
  range: DivisionLengthRange,
): DivisionLengthBucket {
  const span = range.max - range.min;
  if (span <= 0) return 0;
  const ratio = Math.min(1, Math.max(0, (length - range.min) / span));
  return Math.min(4, Math.floor(ratio * 5)) as DivisionLengthBucket;
}

export function divisionLengthForBucket(
  bucket: DivisionLengthBucket,
  range: DivisionLengthRange,
  random: () => number = Math.random,
): number {
  const span = range.max - range.min;
  const low = range.min + (span * bucket) / 5;
  const high = bucket === 4 ? range.max : range.min + (span * (bucket + 1)) / 5;
  return Math.round(low + random() * (high - low));
}

export function divisionDirectionMetadata(
  line: TrialLine,
  anchorDirectionSign: -1 | 1,
): DivisionDirectionMetadata {
  const lineDegrees = lineAngleDegrees(line);
  const divisionDirectionDegrees = normalizeDegrees(
    lineDegrees + (anchorDirectionSign < 0 ? 180 : 0),
  );
  return {
    divisionDirectionDegrees,
    divisionDirectionBucket: bucketDivisionDirectionDegrees(
      divisionDirectionDegrees,
    ),
  };
}

export function bucketDivisionDirectionDegrees(degrees: number): number {
  const normalized = normalizeDegrees(degrees);
  const bucket =
    Math.round(normalized / DIVISION_DIRECTION_BUCKET_SIZE_DEGREES) *
    DIVISION_DIRECTION_BUCKET_SIZE_DEGREES;
  return bucket === 360 ? 0 : bucket;
}

export function directionRadiansForBucket(
  bucket: number,
  random: () => number = Math.random,
): number {
  const degrees =
    bucket + (random() - 0.5) * DIVISION_DIRECTION_BUCKET_SIZE_DEGREES;
  return (normalizeDegrees(degrees) * Math.PI) / 180;
}

export function selectDivisionLengthBucket(
  progress: ProgressStore,
  exerciseId: ExerciseId,
  random: () => number = Math.random,
): DivisionLengthBucket {
  return selectWeightedBucket(
    DIVISION_LENGTH_BUCKETS,
    progress.dimensions.divisionLengthBuckets[exerciseId] ?? {},
    random,
  ) as DivisionLengthBucket;
}

export function selectDivisionDirectionBucket(
  progress: ProgressStore,
  exerciseId: ExerciseId,
  allowedBuckets: readonly number[],
  random: () => number = Math.random,
): number {
  return selectWeightedBucket(
    allowedBuckets,
    progress.dimensions.divisionDirectionBuckets[exerciseId] ?? {},
    random,
  );
}

export function divisionDirectionBucketsForAxis(
  axis: LineAxis,
): readonly number[] {
  if (axis === "horizontal") return [0, 180];
  if (axis === "vertical") return [90, 270];
  return DIVISION_DIRECTION_BUCKETS;
}

export function divisionLengthTrackerModel(
  progress: ProgressStore,
  exerciseId: ExerciseId,
  now: number = Date.now(),
): DivisionTrackerModel {
  const aggregates = progress.dimensions.divisionLengthBuckets[exerciseId] ?? {};
  const todayCounts = divisionTodayCounts(
    progress,
    exerciseId,
    now,
    "divisionLengthBucket",
    (bucket) => String(bucket),
  );
  return linearTrackerModel(
    DIVISION_LENGTH_BUCKETS.map((bucket) => ({
      key: String(bucket),
      label: lengthBucketLabel(bucket),
    })),
    aggregates,
    todayCounts,
  );
}

export function divisionDirectionTrackerModel(
  progress: ProgressStore,
  exerciseId: ExerciseId,
  allowedBuckets: readonly number[],
  now: number = Date.now(),
): DivisionTrackerModel {
  const aggregates =
    progress.dimensions.divisionDirectionBuckets[exerciseId] ?? {};
  const todayCounts = divisionTodayCounts(
    progress,
    exerciseId,
    now,
    "divisionDirectionBucket",
    (bucket) => String(bucketDivisionDirectionDegrees(bucket)),
  );
  return linearTrackerModel(
    allowedBuckets.map((bucket) => ({
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
): DivisionTrackerModel {
  const confidentBuckets = buckets
    .map((bucket) => ({
      ...bucket,
      aggregate: aggregates[bucket.key],
    }))
    .filter((entry) => hasConfidentAggregate(entry.aggregate))
    .sort((a, b) => {
      const scoreDelta = a.aggregate!.ema - b.aggregate!.ema;
      return scoreDelta === 0
        ? a.key.localeCompare(b.key)
        : scoreDelta;
    });
  const toneByBucket = percentileTones(
    confidentBuckets.map((entry) => entry.key),
  );
  return {
    buckets: buckets.map((bucket) => {
      const aggregate = aggregates[bucket.key];
      const tone = divisionTone(aggregate, toneByBucket.get(bucket.key));
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
    todayProgress: Math.min(1, todayCounts.total / DIVISION_TODAY_TARGET),
  };
}

function divisionTodayCounts(
  progress: ProgressStore,
  exerciseId: ExerciseId,
  now: number,
  metadataKey: "divisionLengthBucket" | "divisionDirectionBucket",
  bucketKey: (bucket: number) => string,
): { byBucket: Map<string, number>; total: number } {
  const start = startOfLocalDay(now);
  const byBucket = new Map<string, number>();
  let total = 0;
  for (const attempt of progress.attempts) {
    if (attempt.exerciseId !== exerciseId) continue;
    if (attempt.timestamp < start || attempt.timestamp > now) continue;
    const rawBucket = attempt.metadata?.[metadataKey];
    if (rawBucket === undefined) continue;
    const key = bucketKey(rawBucket);
    byBucket.set(key, (byBucket.get(key) ?? 0) + 1);
    total += 1;
  }
  return { byBucket, total };
}

function divisionTone(
  aggregate: ExerciseAggregate | undefined,
  confidentTone: DivisionTrackerTone | undefined,
): DivisionTrackerTone {
  if (aggregate === undefined) return "empty";
  if (aggregate.attempts < DIVISION_MIN_CONFIDENT_ATTEMPTS) {
    return "low-confidence";
  }
  return confidentTone ?? "low-confidence";
}

function hasConfidentAggregate(
  aggregate: ExerciseAggregate | undefined,
): aggregate is ExerciseAggregate {
  return (
    aggregate !== undefined &&
    aggregate.attempts >= DIVISION_MIN_CONFIDENT_ATTEMPTS
  );
}

function percentileTones(sortedKeysAscending: string[]): Map<string, DivisionTrackerTone> {
  const tones = new Map<string, DivisionTrackerTone>();
  const count = sortedKeysAscending.length;
  if (count === 0) return tones;
  sortedKeysAscending.forEach((key, index) => {
    const rank = index / count;
    const tone: DivisionTrackerTone =
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

function lengthBucketLabel(bucket: DivisionLengthBucket): string {
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

function lineAngleDegrees(line: TrialLine): number {
  if (line.axis === "horizontal") return 0;
  if (line.axis === "vertical") return 90;
  const start = line.startPoint!;
  const end = line.endPoint!;
  return (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI;
}

function normalizeDegrees(degrees: number): number {
  const normalized = ((degrees % 360) + 360) % 360;
  return normalized === 360 ? 0 : normalized;
}

function startOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}
