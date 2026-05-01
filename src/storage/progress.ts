/**
 * Stores and reads per-drill progress from browser local storage.
 *
 * Schema v5: capped raw attempts, per-exercise aggregates, and compact long-lived
 * sub-exercise aggregates for dimensions such as directional line proficiency.
 * Line direction is retained at 1-degree granularity so future views can
 * re-bucket it without depending on capped raw attempt history.
 * v1 data (key draftsman-eye.progress.v1) is silently abandoned on first load.
 */
import type { ExerciseId } from '../practice/catalog';

export type ProgressAttemptMetadata = {
  lineAngleDegrees?: number;
  lineAngleBucket?: number;
  angleOpeningDegrees?: number;
  angleOpeningBucket?: number;
};

export type AttemptRecord = {
  exerciseId: ExerciseId;
  score: number;       // 0..100
  signedError: number; // signed pixel error; 0 for exercise families with no directional concept
  timestamp: number;   // Date.now()
  metadata?: ProgressAttemptMetadata;
};

export type ExerciseAggregate = {
  ema: number;
  attempts: number;
  lastPracticedAt: number;
};

export type ProgressDimensions = {
  lineAngleBuckets: Partial<
    Record<ExerciseId, Partial<Record<string, ExerciseAggregate>>>
  >;
  lineAngleDegreeBuckets?: Partial<
    Record<ExerciseId, Partial<Record<string, ExerciseAggregate>>>
  >;
  angleOpeningBuckets: Partial<
    Record<ExerciseId, Partial<Record<string, ExerciseAggregate>>>
  >;
};

export type ProgressStore = {
  version: 5;
  attempts: AttemptRecord[];
  aggregates: Partial<Record<ExerciseId, ExerciseAggregate>>;
  dimensions: ProgressDimensions;
};

const STORAGE_KEY = 'draftsman-eye.progress.v5';
const LEGACY_V4_STORAGE_KEY = 'draftsman-eye.progress.v4';
const LEGACY_V3_STORAGE_KEY = 'draftsman-eye.progress.v3';
const LEGACY_V2_STORAGE_KEY = 'draftsman-eye.progress.v2';
const MAX_ATTEMPTS = 500;
const EMA_ALPHA = 0.35;
const FINE_LINE_ANGLE_BUCKET_SIZE_DEGREES = 1;
export const LINE_ANGLE_PROFICIENCY_MIN_SCORE = 20;

let cache: ProgressStore | null = null;

/** Clears the in-memory cache. Only for use in tests that reset localStorage between cases. */
export function _resetProgressCache(): void { cache = null; }

/** Wipes all stored progress from localStorage and resets the in-memory cache. */
export function resetStoredProgress(): void {
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_V4_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_V3_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_V2_STORAGE_KEY);
  cache = null;
}

export function getStoredProgress(): ProgressStore {
  if (cache) return cache;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const migratedV4 = migrateLegacyV4Progress();
    if (migratedV4) return (cache = migratedV4);
    const migratedV3 = migrateLegacyV3Progress();
    if (migratedV3) return (cache = migratedV3);
    const migrated = migrateLegacyV2Progress();
    if (migrated) return (cache = migrated);
    return (cache = emptyStore());
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isProgressStore(parsed)) {
      console.error('Ignoring malformed progress payload from localStorage.');
      return (cache = emptyStore());
    }
    return (cache = parsed);
  } catch (error) {
    console.error('Failed to parse stored progress.', error);
    return (cache = emptyStore());
  }
}

export function updateStoredProgress(
  exerciseId: ExerciseId,
  score: number,
  signedError: number,
  metadata?: ProgressAttemptMetadata,
): ProgressStore {
  const store = getStoredProgress();

  const record: AttemptRecord = {
    exerciseId,
    score,
    signedError,
    timestamp: Date.now(),
    ...(metadata ? { metadata } : {}),
  };
  const attempts = [...store.attempts, record];
  if (attempts.length > MAX_ATTEMPTS) attempts.splice(0, attempts.length - MAX_ATTEMPTS);

  const nextAggregate = updateAggregate(
    store.aggregates[exerciseId],
    score,
    record.timestamp,
  );
  const dimensions = updateDimensions(
    store.dimensions,
    exerciseId,
    score,
    record.timestamp,
    metadata,
  );

  const next: ProgressStore = {
    version: 5,
    attempts,
    aggregates: { ...store.aggregates, [exerciseId]: nextAggregate },
    dimensions,
  };

  cache = next;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.error('Failed to persist progress.', error);
  }

  return next;
}

/**
 * Drops aggregate entries whose keys are not in knownIds.
 * Call this after loading to evict stale entries for removed drills.
 */
export function filterStaleAggregates(
  store: ProgressStore,
  knownIds: ReadonlySet<string>,
): ProgressStore {
  const filtered: ProgressStore['aggregates'] = {};
  for (const [id, agg] of Object.entries(store.aggregates)) {
    if (knownIds.has(id) && agg !== undefined) {
      filtered[id as keyof typeof store.aggregates] = agg;
    }
  }
  const lineAngleBuckets: ProgressDimensions['lineAngleBuckets'] = {};
  const lineAngleDegreeBuckets: ProgressDimensions['lineAngleDegreeBuckets'] = {};
  const angleOpeningBuckets: ProgressDimensions['angleOpeningBuckets'] = {};
  for (const [id, buckets] of Object.entries(
    store.dimensions.lineAngleBuckets,
  )) {
    if (knownIds.has(id) && buckets !== undefined) {
      lineAngleBuckets[id as ExerciseId] = buckets;
    }
  }
  for (const [id, buckets] of Object.entries(
    store.dimensions.lineAngleDegreeBuckets ?? {},
  )) {
    if (knownIds.has(id) && buckets !== undefined) {
      lineAngleDegreeBuckets[id as ExerciseId] = buckets;
    }
  }
  for (const [id, buckets] of Object.entries(
    store.dimensions.angleOpeningBuckets,
  )) {
    if (knownIds.has(id) && buckets !== undefined) {
      angleOpeningBuckets[id as ExerciseId] = buckets;
    }
  }
  return {
    ...store,
    aggregates: filtered,
    dimensions: {
      ...store.dimensions,
      lineAngleBuckets,
      lineAngleDegreeBuckets,
      angleOpeningBuckets,
    },
  };
}

function isProgressStore(value: unknown): value is ProgressStore {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (v['version'] !== 5) return false;
  if (!Array.isArray(v['attempts'])) return false;
  if (!v['aggregates'] || typeof v['aggregates'] !== 'object' || Array.isArray(v['aggregates'])) return false;
  if (!v['dimensions'] || typeof v['dimensions'] !== 'object' || Array.isArray(v['dimensions'])) return false;
  const dimensions = v['dimensions'] as Record<string, unknown>;
  if (!dimensions['lineAngleBuckets'] || typeof dimensions['lineAngleBuckets'] !== 'object' || Array.isArray(dimensions['lineAngleBuckets'])) return false;
  if (!dimensions['angleOpeningBuckets'] || typeof dimensions['angleOpeningBuckets'] !== 'object' || Array.isArray(dimensions['angleOpeningBuckets'])) return false;
  return true;
}

function emptyStore(): ProgressStore {
  return {
    version: 5,
    attempts: [],
    aggregates: {},
    dimensions: {
      lineAngleBuckets: {},
      lineAngleDegreeBuckets: {},
      angleOpeningBuckets: {},
    },
  };
}

function updateAggregate(
  previous: ExerciseAggregate | undefined,
  score: number,
  timestamp: number,
): ExerciseAggregate {
  return {
    ema:
      previous === undefined
        ? score
        : previous.ema + EMA_ALPHA * (score - previous.ema),
    attempts: (previous?.attempts ?? 0) + 1,
    lastPracticedAt: timestamp,
  };
}

function updateDimensions(
  previous: ProgressDimensions,
  exerciseId: ExerciseId,
  score: number,
  timestamp: number,
  metadata: ProgressAttemptMetadata | undefined,
): ProgressDimensions {
  if (metadata === undefined) {
    return previous;
  }
  if (score < LINE_ANGLE_PROFICIENCY_MIN_SCORE) return previous;
  const hasLineAngle =
    metadata.lineAngleBucket !== undefined ||
    metadata.lineAngleDegrees !== undefined;
  const hasAngleOpening = metadata.angleOpeningBucket !== undefined;
  if (!hasLineAngle && !hasAngleOpening) return previous;

  const coarseBucketKey =
    metadata.lineAngleBucket === undefined
      ? undefined
      : String(metadata.lineAngleBucket);
  const fineBucketKey =
    metadata.lineAngleDegrees === undefined
      ? undefined
      : String(fineLineAngleBucket(metadata.lineAngleDegrees));
  const exerciseBuckets = previous.lineAngleBuckets[exerciseId] ?? {};
  const exerciseFineBuckets =
    previous.lineAngleDegreeBuckets?.[exerciseId] ?? {};
  const exerciseAngleOpeningBuckets =
    previous.angleOpeningBuckets[exerciseId] ?? {};
  const lineAngleBuckets =
    coarseBucketKey === undefined
      ? previous.lineAngleBuckets
      : {
          ...previous.lineAngleBuckets,
          [exerciseId]: {
            ...exerciseBuckets,
            [coarseBucketKey]: updateAggregate(
              exerciseBuckets[coarseBucketKey],
              score,
              timestamp,
            ),
          },
        };
  const lineAngleDegreeBuckets =
    fineBucketKey === undefined
      ? previous.lineAngleDegreeBuckets
      : {
          ...(previous.lineAngleDegreeBuckets ?? {}),
          [exerciseId]: {
            ...exerciseFineBuckets,
            [fineBucketKey]: updateAggregate(
              exerciseFineBuckets[fineBucketKey],
              score,
              timestamp,
            ),
          },
        };
  const angleOpeningBuckets =
    metadata.angleOpeningBucket === undefined
      ? previous.angleOpeningBuckets
      : {
          ...previous.angleOpeningBuckets,
          [exerciseId]: {
            ...exerciseAngleOpeningBuckets,
            [String(metadata.angleOpeningBucket)]: updateAggregate(
              exerciseAngleOpeningBuckets[String(metadata.angleOpeningBucket)],
              score,
              timestamp,
            ),
          },
        };
  return {
    ...previous,
    lineAngleBuckets,
    lineAngleDegreeBuckets,
    angleOpeningBuckets,
  };
}

function fineLineAngleBucket(degrees: number): number {
  const normalized = ((degrees % 360) + 360) % 360;
  const bucket =
    Math.round(normalized / FINE_LINE_ANGLE_BUCKET_SIZE_DEGREES) *
    FINE_LINE_ANGLE_BUCKET_SIZE_DEGREES;
  return bucket === 360 ? 0 : bucket;
}

function migrateLegacyV4Progress(): ProgressStore | null {
  const raw = window.localStorage.getItem(LEGACY_V4_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isLegacyV4ProgressStore(parsed)) {
      console.error('Ignoring malformed v4 progress payload from localStorage.');
      return null;
    }
    const migrated: ProgressStore = {
      version: 5,
      attempts: parsed.attempts,
      aggregates: parsed.aggregates,
      dimensions: {
        lineAngleBuckets: parsed.dimensions.lineAngleBuckets,
        lineAngleDegreeBuckets: parsed.dimensions.lineAngleDegreeBuckets ?? {},
        angleOpeningBuckets: {},
      },
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    } catch (error) {
      console.error('Failed to persist migrated progress.', error);
    }
    return migrated;
  } catch (error) {
    console.error('Failed to parse stored v4 progress.', error);
    return null;
  }
}

function migrateLegacyV3Progress(): ProgressStore | null {
  const raw = window.localStorage.getItem(LEGACY_V3_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isLegacyV3ProgressStore(parsed)) {
      console.error('Ignoring malformed v3 progress payload from localStorage.');
      return null;
    }
    const migrated: ProgressStore = {
      version: 5,
      attempts: parsed.attempts,
      aggregates: parsed.aggregates,
      dimensions: {
        lineAngleBuckets: {},
        lineAngleDegreeBuckets: {},
        angleOpeningBuckets: {},
      },
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    } catch (error) {
      console.error('Failed to persist migrated progress.', error);
    }
    return migrated;
  } catch (error) {
    console.error('Failed to parse stored v3 progress.', error);
    return null;
  }
}

function migrateLegacyV2Progress(): ProgressStore | null {
  const raw = window.localStorage.getItem(LEGACY_V2_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isLegacyV2ProgressStore(parsed)) {
      console.error('Ignoring malformed v2 progress payload from localStorage.');
      return null;
    }
    const migrated: ProgressStore = {
      version: 5,
      attempts: parsed.attempts,
      aggregates: parsed.aggregates,
      dimensions: {
        lineAngleBuckets: {},
        lineAngleDegreeBuckets: {},
        angleOpeningBuckets: {},
      },
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    } catch (error) {
      console.error('Failed to persist migrated progress.', error);
    }
    return migrated;
  } catch (error) {
    console.error('Failed to parse stored v2 progress.', error);
    return null;
  }
}

function isLegacyV4ProgressStore(
  value: unknown,
): value is Omit<ProgressStore, 'version' | 'dimensions'> & {
  version: 4;
  dimensions: Omit<ProgressDimensions, 'angleOpeningBuckets'>;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (v['version'] !== 4) return false;
  if (!Array.isArray(v['attempts'])) return false;
  if (!v['aggregates'] || typeof v['aggregates'] !== 'object' || Array.isArray(v['aggregates'])) return false;
  if (!v['dimensions'] || typeof v['dimensions'] !== 'object' || Array.isArray(v['dimensions'])) return false;
  const dimensions = v['dimensions'] as Record<string, unknown>;
  if (!dimensions['lineAngleBuckets'] || typeof dimensions['lineAngleBuckets'] !== 'object' || Array.isArray(dimensions['lineAngleBuckets'])) return false;
  return true;
}

function isLegacyV3ProgressStore(
  value: unknown,
): value is Omit<ProgressStore, 'version'> & { version: 3 } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (v['version'] !== 3) return false;
  if (!Array.isArray(v['attempts'])) return false;
  if (!v['aggregates'] || typeof v['aggregates'] !== 'object' || Array.isArray(v['aggregates'])) return false;
  if (!v['dimensions'] || typeof v['dimensions'] !== 'object' || Array.isArray(v['dimensions'])) return false;
  return true;
}

function isLegacyV2ProgressStore(
  value: unknown,
): value is Omit<ProgressStore, 'version' | 'dimensions'> & { version: 2 } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (v['version'] !== 2) return false;
  if (!Array.isArray(v['attempts'])) return false;
  if (!v['aggregates'] || typeof v['aggregates'] !== 'object' || Array.isArray(v['aggregates'])) return false;
  return true;
}
