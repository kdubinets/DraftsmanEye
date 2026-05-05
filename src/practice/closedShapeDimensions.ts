/** Normalized size, ratio, and orientation dimensions for closed-shape drills. */
import type { ExerciseAggregate, ProgressStore } from "../storage/progress";
import type { ExerciseId } from "./catalog";

export const CIRCLE_RADIUS_BUCKETS = [0, 1, 2, 3, 4] as const;
export const ELLIPSE_SIZE_BUCKETS = [0, 1, 2, 3, 4] as const;
export const ELLIPSE_RATIO_BUCKETS = [0, 1, 2, 3, 4] as const;
export const ELLIPSE_ANGLE_BUCKET_SIZE_DEGREES = 15;
export const ELLIPSE_ANGLE_BUCKETS = Array.from(
  { length: 180 / ELLIPSE_ANGLE_BUCKET_SIZE_DEGREES },
  (_, index) => index * ELLIPSE_ANGLE_BUCKET_SIZE_DEGREES,
);

export const CLOSED_SHAPE_MIN_CONFIDENT_ATTEMPTS = 3;
export const CLOSED_SHAPE_TODAY_TARGET = 50;

const ELLIPSE_MIN_RATIO = 0.25;
const ELLIPSE_MAX_RATIO = 0.9;

export type ClosedShapeCanvasMetrics = {
  width: number;
  height: number;
  shortSide: number;
};

export type CircleRadiusMetadata = {
  circleRadiusRatio: number;
  circleRadiusBucket: number;
};

export type EllipseAngleMetadata = {
  ellipseAngleDegrees: number;
  ellipseAngleBucket: number;
};

export type EllipseSizeMetadata = {
  ellipseMajorRadiusRatio: number;
  ellipseMajorRadiusBucket: number;
};

export type EllipseRatioMetadata = {
  ellipseAxisRatio: number;
  ellipseAxisRatioBucket: number;
};

export type ClosedShapeProficiencyTone =
  | "empty"
  | "low-confidence"
  | "weak"
  | "developing"
  | "good"
  | "strong";

export type ClosedShapeTrackerBucket = {
  bucket: number;
  aggregate?: ExerciseAggregate;
  todayAttempts: number;
  tone: ClosedShapeProficiencyTone;
  cellFill: string;
  todayOpacity: number;
  todayHeightPercent: number;
};

export type ClosedShapeTrackerModel = {
  buckets: ClosedShapeTrackerBucket[];
  todayTotal: number;
  todayProgress: number;
};

const CELL_FILLS: Record<ClosedShapeProficiencyTone, string> = {
  empty: "rgba(103, 103, 103, 0.16)",
  "low-confidence": "rgba(47, 85, 125, 0.24)",
  weak: "hsl(4 55% 42%)",
  developing: "hsl(38 58% 44%)",
  good: "hsl(86 48% 40%)",
  strong: "hsl(135 46% 36%)",
};

export function circleRadiusMetadata(
  radius: number,
  canvas: ClosedShapeCanvasMetrics,
): CircleRadiusMetadata | undefined {
  if (!Number.isFinite(radius) || radius <= 0) return undefined;
  const ratio = sizeRatio(radius, canvas);
  if (ratio === null) return undefined;
  return {
    circleRadiusRatio: ratio,
    circleRadiusBucket: bucketNormalizedSizeRatio(ratio),
  };
}

export function ellipseAngleMetadata(
  rotationRadians: number,
): EllipseAngleMetadata | undefined {
  if (!Number.isFinite(rotationRadians)) return undefined;
  const degrees = normalizeUndirectedDegrees((rotationRadians * 180) / Math.PI);
  return {
    ellipseAngleDegrees: degrees,
    ellipseAngleBucket: bucketEllipseAngle(degrees),
  };
}

export function ellipseSizeMetadata(
  majorRadius: number,
  canvas: ClosedShapeCanvasMetrics,
): EllipseSizeMetadata | undefined {
  if (!Number.isFinite(majorRadius) || majorRadius <= 0) return undefined;
  const ratio = sizeRatio(majorRadius, canvas);
  if (ratio === null) return undefined;
  return {
    ellipseMajorRadiusRatio: ratio,
    ellipseMajorRadiusBucket: bucketNormalizedSizeRatio(ratio),
  };
}

export function ellipseRatioMetadata(
  majorRadius: number,
  minorRadius: number,
): EllipseRatioMetadata | undefined {
  if (
    !Number.isFinite(majorRadius) ||
    !Number.isFinite(minorRadius) ||
    majorRadius <= 0 ||
    minorRadius <= 0
  ) {
    return undefined;
  }
  const ratio =
    Math.min(majorRadius, minorRadius) / Math.max(majorRadius, minorRadius);
  return {
    ellipseAxisRatio: ratio,
    ellipseAxisRatioBucket: bucketEllipseAxisRatio(ratio),
  };
}

export function bucketNormalizedSizeRatio(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0.2) return 0;
  if (ratio < 0.3) return 1;
  if (ratio < 0.4) return 2;
  if (ratio < 0.5) return 3;
  return 4;
}

export function bucketEllipseAxisRatio(ratio: number): number {
  const normalized =
    (Math.max(ELLIPSE_MIN_RATIO, Math.min(ELLIPSE_MAX_RATIO, ratio)) -
      ELLIPSE_MIN_RATIO) /
    (ELLIPSE_MAX_RATIO - ELLIPSE_MIN_RATIO);
  return Math.max(0, Math.min(4, Math.floor(normalized * 5)));
}

export function bucketEllipseAngle(degrees: number): number {
  const normalized = normalizeUndirectedDegrees(degrees);
  const bucket =
    Math.round(normalized / ELLIPSE_ANGLE_BUCKET_SIZE_DEGREES) *
    ELLIPSE_ANGLE_BUCKET_SIZE_DEGREES;
  return bucket === 180 ? 0 : bucket;
}

export function closedShapeCanvasMetrics(
  width: number,
  height: number,
): ClosedShapeCanvasMetrics | null {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  if (width <= 0 || height <= 0) return null;
  return { width, height, shortSide: Math.min(width, height) };
}

export function circleRadiusTrackerModel(
  progress: ProgressStore,
  exerciseId: ExerciseId,
  now: number = Date.now(),
): ClosedShapeTrackerModel {
  return trackerModel(
    CIRCLE_RADIUS_BUCKETS,
    progress.dimensions.circleRadiusBuckets?.[exerciseId] ?? {},
    closedShapeTodayCounts(
      progress,
      exerciseId,
      "circleRadiusBucket",
      normalizeCircleRadiusBucket,
      now,
    ),
  );
}

export function ellipseAngleTrackerModel(
  progress: ProgressStore,
  exerciseId: ExerciseId,
  now: number = Date.now(),
): ClosedShapeTrackerModel {
  return trackerModel(
    ELLIPSE_ANGLE_BUCKETS,
    progress.dimensions.ellipseAngleBuckets?.[exerciseId] ?? {},
    closedShapeTodayCounts(
      progress,
      exerciseId,
      "ellipseAngleBucket",
      normalizeEllipseAngleBucket,
      now,
    ),
  );
}

function trackerModel(
  bucketsSource: readonly number[],
  aggregates: Partial<Record<string, ExerciseAggregate>>,
  todayCounts: { byBucket: Map<number, number>; total: number },
): ClosedShapeTrackerModel {
  const confidentBuckets = bucketsSource
    .map((bucket) => ({ bucket, aggregate: aggregates[String(bucket)] }))
    .filter((entry) => hasConfidentAggregate(entry.aggregate))
    .sort((a, b) => {
      const scoreDelta = a.aggregate!.ema - b.aggregate!.ema;
      return scoreDelta === 0 ? a.bucket - b.bucket : scoreDelta;
    });
  const toneByBucket = percentileTones(
    confidentBuckets.map((entry) => entry.bucket),
  );

  return {
    buckets: bucketsSource.map((bucket) => {
      const aggregate = aggregates[String(bucket)];
      const todayAttempts = todayCounts.byBucket.get(bucket) ?? 0;
      const tone = closedShapeTone(aggregate, toneByBucket.get(bucket));
      return {
        bucket,
        aggregate,
        todayAttempts,
        tone,
        cellFill: CELL_FILLS[tone],
        todayOpacity: todayAttemptOpacity(todayAttempts),
        todayHeightPercent: todayAttemptHeightPercent(todayAttempts),
      };
    }),
    todayTotal: todayCounts.total,
    todayProgress: Math.min(1, todayCounts.total / CLOSED_SHAPE_TODAY_TARGET),
  };
}

function closedShapeTodayCounts(
  progress: ProgressStore,
  exerciseId: ExerciseId,
  metadataKey: "circleRadiusBucket" | "ellipseAngleBucket",
  normalizeBucket: (bucket: number) => number,
  now: number,
): { byBucket: Map<number, number>; total: number } {
  const start = startOfLocalDay(now);
  const byBucket = new Map<number, number>();
  let total = 0;

  for (const attempt of progress.attempts) {
    if (attempt.exerciseId !== exerciseId) continue;
    if (attempt.timestamp < start || attempt.timestamp > now) continue;
    const rawBucket = attempt.metadata?.[metadataKey];
    if (rawBucket === undefined) continue;
    const bucket = normalizeBucket(rawBucket);
    byBucket.set(bucket, (byBucket.get(bucket) ?? 0) + 1);
    total += 1;
  }

  return { byBucket, total };
}

function normalizeCircleRadiusBucket(bucket: number): number {
  return Math.max(0, Math.min(4, Math.round(bucket)));
}

function normalizeEllipseAngleBucket(bucket: number): number {
  return bucketEllipseAngle(bucket);
}

function sizeRatio(
  length: number,
  canvas: ClosedShapeCanvasMetrics,
): number | null {
  if (!Number.isFinite(canvas.shortSide) || canvas.shortSide <= 0) return null;
  return length / canvas.shortSide;
}

function normalizeUndirectedDegrees(degrees: number): number {
  const normalized = ((degrees % 180) + 180) % 180;
  return normalized === 180 ? 0 : normalized;
}

function closedShapeTone(
  aggregate: ExerciseAggregate | undefined,
  confidentTone: ClosedShapeProficiencyTone | undefined,
): ClosedShapeProficiencyTone {
  if (aggregate === undefined) return "empty";
  if (aggregate.attempts < CLOSED_SHAPE_MIN_CONFIDENT_ATTEMPTS) {
    return "low-confidence";
  }
  return confidentTone ?? "low-confidence";
}

function hasConfidentAggregate(
  aggregate: ExerciseAggregate | undefined,
): aggregate is ExerciseAggregate {
  return (
    aggregate !== undefined &&
    aggregate.attempts >= CLOSED_SHAPE_MIN_CONFIDENT_ATTEMPTS
  );
}

function percentileTones(
  sortedBucketsAscending: number[],
): Map<number, ClosedShapeProficiencyTone> {
  const tones = new Map<number, ClosedShapeProficiencyTone>();
  const count = sortedBucketsAscending.length;
  if (count === 0) return tones;

  sortedBucketsAscending.forEach((bucket, index) => {
    const rank = index / count;
    const tone: ClosedShapeProficiencyTone =
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
