/** Length-ratio estimation buckets, trial generation, input parsing, and scoring. */
import type { ExerciseId } from "./catalog";
import type { ProgressStore } from "../storage/progress";
import { clampNumber } from "../geometry/primitives";

export const LENGTH_RATIO_MIN = 0.25;
export const LENGTH_RATIO_MAX = 4;
export const LENGTH_RATIO_BUCKETS = Array.from(
  { length: 17 },
  (_, index) => index,
);
export const LENGTH_RATIO_LOG_MIN = Math.log2(LENGTH_RATIO_MIN);
export const LENGTH_RATIO_LOG_MAX = Math.log2(LENGTH_RATIO_MAX);
export const LENGTH_RATIO_BUCKET_STEP =
  (LENGTH_RATIO_LOG_MAX - LENGTH_RATIO_LOG_MIN) /
  (LENGTH_RATIO_BUCKETS.length - 1);

export type LengthRatioSourceOrientation = "horizontal" | "vertical" | "random";
export type LengthRatioTargetRelation = "aligned" | "cross" | "random";

export type LengthRatioMetadata = {
  lengthRatio: number;
  lengthRatioBucket: number;
  sourceLengthPixels: number;
  targetLengthPixels: number;
};

export type LengthRatioSegment = {
  label: "Source" | "Target";
  start: { x: number; y: number };
  end: { x: number; y: number };
  length: number;
  radians: number;
};

export type LengthRatioTrial = {
  ratio: number;
  ratioBucket: number;
  source: LengthRatioSegment;
  target: LengthRatioSegment;
  metadata: LengthRatioMetadata;
};

export type LengthRatioResult = {
  score: number;
  estimatedRatio: number;
  targetRatio: number;
  signedLogRatioError: number;
  absoluteLogRatioError: number;
  sourceLengthPixels: number;
  targetLengthPixels: number;
  metadata: LengthRatioMetadata;
};

export function clampLengthRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return 1;
  return Math.min(LENGTH_RATIO_MAX, Math.max(LENGTH_RATIO_MIN, ratio));
}

export function parseLengthRatioInput(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const fraction = trimmed.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (fraction) {
    const numerator = Number(fraction[1]);
    const denominator = Number(fraction[2]);
    if (denominator <= 0) return null;
    const ratio = numerator / denominator;
    return Number.isFinite(ratio) && ratio > 0 ? clampLengthRatio(ratio) : null;
  }
  const ratio = Number(trimmed);
  return Number.isFinite(ratio) && ratio > 0 ? clampLengthRatio(ratio) : null;
}

export function bucketLengthRatio(ratio: number): number {
  const logRatio = Math.log2(clampLengthRatio(ratio));
  const bucket = Math.round(
    (logRatio - LENGTH_RATIO_LOG_MIN) / LENGTH_RATIO_BUCKET_STEP,
  );
  return Math.min(
    LENGTH_RATIO_BUCKETS.length - 1,
    Math.max(0, bucket),
  );
}

export function lengthRatioForBucket(bucket: number): number {
  const index = Math.min(
    LENGTH_RATIO_BUCKETS.length - 1,
    Math.max(0, Math.round(bucket)),
  );
  return 2 ** (LENGTH_RATIO_LOG_MIN + index * LENGTH_RATIO_BUCKET_STEP);
}

export function lengthRatioRangeForBucket(bucket: number): {
  min: number;
  max: number;
} {
  const index = Math.min(
    LENGTH_RATIO_BUCKETS.length - 1,
    Math.max(0, Math.round(bucket)),
  );
  const halfStep = LENGTH_RATIO_BUCKET_STEP / 2;
  const centerLog = LENGTH_RATIO_LOG_MIN + index * LENGTH_RATIO_BUCKET_STEP;
  const minLog = index === 0 ? LENGTH_RATIO_LOG_MIN : centerLog - halfStep;
  const maxLog =
    index === LENGTH_RATIO_BUCKETS.length - 1
      ? LENGTH_RATIO_LOG_MAX
      : centerLog + halfStep;
  return { min: 2 ** minLog, max: 2 ** maxLog };
}

export function createLengthRatioTrial(
  exerciseId: ExerciseId,
  progress: ProgressStore,
  random: () => number = Math.random,
): LengthRatioTrial {
  const bucket = selectLengthRatioBucket(progress, exerciseId, random);
  const range = lengthRatioRangeForBucket(bucket);
  const minLog = Math.log2(range.min);
  const maxLog = Math.log2(range.max);
  const ratio = clampLengthRatio(2 ** (minLog + random() * (maxLog - minLog)));
  const sourceLength = sourceLengthForRatio(ratio, random);
  const targetLength = sourceLength * ratio;
  const sourceRadians = sourceRadiansForExercise(exerciseId, random);
  const targetRadians = targetRadiansForExercise(
    exerciseId,
    sourceRadians,
    random,
  );
  const source = segmentFromCenter(
    "Source",
    { x: 290, y: 255 },
    sourceLength,
    sourceRadians,
  );
  const target = segmentFromCenter(
    "Target",
    { x: 710, y: 365 },
    targetLength,
    targetRadians,
  );
  const metadata = lengthRatioMetadata(ratio, sourceLength, targetLength);
  return { ratio, ratioBucket: bucket, source, target, metadata };
}

export function scoreLengthRatioEstimate(
  targetRatio: number,
  estimatedRatio: number,
  sourceLengthPixels: number,
  targetLengthPixels: number,
): LengthRatioResult {
  const target = clampLengthRatio(targetRatio);
  const estimate = clampLengthRatio(estimatedRatio);
  const signedLogRatioError = Math.log2(estimate / target);
  const absoluteLogRatioError = Math.abs(signedLogRatioError);
  return {
    score: clampNumber(100 - absoluteLogRatioError * 100, 0, 100),
    estimatedRatio: estimate,
    targetRatio: target,
    signedLogRatioError,
    absoluteLogRatioError,
    sourceLengthPixels,
    targetLengthPixels,
    metadata: lengthRatioMetadata(target, sourceLengthPixels, targetLengthPixels),
  };
}

export function lengthRatioMetadata(
  ratio: number,
  sourceLengthPixels: number,
  targetLengthPixels: number,
): LengthRatioMetadata {
  const clamped = clampLengthRatio(ratio);
  return {
    lengthRatio: clamped,
    lengthRatioBucket: bucketLengthRatio(clamped),
    sourceLengthPixels,
    targetLengthPixels,
  };
}

export function selectLengthRatioBucket(
  progress: ProgressStore,
  exerciseId: ExerciseId,
  random: () => number = Math.random,
): number {
  const aggregates = progress.dimensions.lengthRatioBuckets?.[exerciseId] ?? {};
  const now = Date.now();
  const RECENCY_HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000;
  const weighted = LENGTH_RATIO_BUCKETS.map((bucket) => {
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

export function lengthRatioExerciseParts(exerciseId: ExerciseId): {
  sourceOrientation: LengthRatioSourceOrientation;
  targetRelation: LengthRatioTargetRelation;
} | null {
  const match = /^length-ratio-estimate-(horizontal|vertical|random)-(aligned|cross|random)$/.exec(
    exerciseId,
  );
  if (!match) return null;
  return {
    sourceOrientation: match[1] as LengthRatioSourceOrientation,
    targetRelation: match[2] as LengthRatioTargetRelation,
  };
}

function sourceLengthForRatio(ratio: number, random: () => number): number {
  const min = Math.max(90, 70 / ratio);
  const max = Math.min(260, 360 / ratio);
  return Math.round(min + random() * (max - min));
}

function sourceRadiansForExercise(
  exerciseId: ExerciseId,
  random: () => number,
): number {
  const parts = lengthRatioExerciseParts(exerciseId);
  if (parts?.sourceOrientation === "horizontal") return 0;
  if (parts?.sourceOrientation === "vertical") return Math.PI / 2;
  return random() * Math.PI * 2;
}

function targetRadiansForExercise(
  exerciseId: ExerciseId,
  sourceRadians: number,
  random: () => number,
): number {
  const parts = lengthRatioExerciseParts(exerciseId);
  if (parts?.targetRelation === "aligned") return sourceRadians;
  if (parts?.targetRelation === "cross") return sourceRadians + Math.PI / 2;
  const baseDelta =
    random() < 0.5
      ? radiansBetween(25, 65, random)
      : radiansBetween(115, 155, random);
  return sourceRadians + (random() < 0.5 ? -baseDelta : baseDelta);
}

function radiansBetween(
  minDegrees: number,
  maxDegrees: number,
  random: () => number,
): number {
  return ((minDegrees + random() * (maxDegrees - minDegrees)) * Math.PI) / 180;
}

function segmentFromCenter(
  label: "Source" | "Target",
  center: { x: number; y: number },
  length: number,
  radians: number,
): LengthRatioSegment {
  const half = length / 2;
  const dx = Math.cos(radians) * half;
  const dy = Math.sin(radians) * half;
  return {
    label,
    start: { x: center.x - dx, y: center.y - dy },
    end: { x: center.x + dx, y: center.y + dy },
    length,
    radians,
  };
}
