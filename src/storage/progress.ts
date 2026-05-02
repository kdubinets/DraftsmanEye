/**
 * Stores and reads per-drill progress from browser local storage.
 *
 * Schema v8: capped raw attempts, per-exercise aggregates, and compact long-lived
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
  divisionLengthPixels?: number;
  divisionLengthBucket?: number;
  divisionDirectionDegrees?: number;
  divisionDirectionBucket?: number;
  transferLengthPixels?: number;
  transferLengthBucket?: number;
  transferAngleDegrees?: number;
  transferAngleBucket?: number;
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
  divisionLengthBuckets: Partial<
    Record<ExerciseId, Partial<Record<string, ExerciseAggregate>>>
  >;
  divisionDirectionBuckets: Partial<
    Record<ExerciseId, Partial<Record<string, ExerciseAggregate>>>
  >;
  transferLengthBuckets: Partial<
    Record<ExerciseId, Partial<Record<string, ExerciseAggregate>>>
  >;
  transferAngleBuckets: Partial<
    Record<ExerciseId, Partial<Record<string, ExerciseAggregate>>>
  >;
};

export type ProgressStore = {
  version: 8;
  attempts: AttemptRecord[];
  aggregates: Partial<Record<ExerciseId, ExerciseAggregate>>;
  dimensions: ProgressDimensions;
};

const STORAGE_KEY = 'draftsman-eye.progress.v8';
const LEGACY_V7_STORAGE_KEY = 'draftsman-eye.progress.v7';
const LEGACY_V6_STORAGE_KEY = 'draftsman-eye.progress.v6';
const LEGACY_V5_STORAGE_KEY = 'draftsman-eye.progress.v5';
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
  window.localStorage.removeItem(LEGACY_V7_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_V6_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_V5_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_V4_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_V3_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_V2_STORAGE_KEY);
  cache = null;
}

export function getStoredProgress(): ProgressStore {
  if (cache) return cache;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const migratedV7 = migrateLegacyV7Progress();
    if (migratedV7) return (cache = migratedV7);
    const migratedV6 = migrateLegacyV6Progress();
    if (migratedV6) return (cache = migratedV6);
    const migratedV5 = migrateLegacyV5Progress();
    if (migratedV5) return (cache = migratedV5);
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
    version: 8,
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
  const divisionLengthBuckets: ProgressDimensions['divisionLengthBuckets'] = {};
  const divisionDirectionBuckets: ProgressDimensions['divisionDirectionBuckets'] = {};
  const transferLengthBuckets: ProgressDimensions['transferLengthBuckets'] = {};
  const transferAngleBuckets: ProgressDimensions['transferAngleBuckets'] = {};
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
  for (const [id, buckets] of Object.entries(
    store.dimensions.divisionLengthBuckets,
  )) {
    if (knownIds.has(id) && buckets !== undefined) {
      divisionLengthBuckets[id as ExerciseId] = buckets;
    }
  }
  for (const [id, buckets] of Object.entries(
    store.dimensions.divisionDirectionBuckets,
  )) {
    if (knownIds.has(id) && buckets !== undefined) {
      divisionDirectionBuckets[id as ExerciseId] = buckets;
    }
  }
  for (const [id, buckets] of Object.entries(
    store.dimensions.transferLengthBuckets,
  )) {
    if (knownIds.has(id) && buckets !== undefined) {
      transferLengthBuckets[id as ExerciseId] = buckets;
    }
  }
  for (const [id, buckets] of Object.entries(
    store.dimensions.transferAngleBuckets,
  )) {
    if (knownIds.has(id) && buckets !== undefined) {
      transferAngleBuckets[id as ExerciseId] = buckets;
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
      divisionLengthBuckets,
      divisionDirectionBuckets,
      transferLengthBuckets,
      transferAngleBuckets,
    },
  };
}

function isProgressStore(value: unknown): value is ProgressStore {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (v['version'] !== 8) return false;
  if (!Array.isArray(v['attempts'])) return false;
  if (!v['aggregates'] || typeof v['aggregates'] !== 'object' || Array.isArray(v['aggregates'])) return false;
  if (!v['dimensions'] || typeof v['dimensions'] !== 'object' || Array.isArray(v['dimensions'])) return false;
  const dimensions = v['dimensions'] as Record<string, unknown>;
  if (!dimensions['lineAngleBuckets'] || typeof dimensions['lineAngleBuckets'] !== 'object' || Array.isArray(dimensions['lineAngleBuckets'])) return false;
  if (!dimensions['angleOpeningBuckets'] || typeof dimensions['angleOpeningBuckets'] !== 'object' || Array.isArray(dimensions['angleOpeningBuckets'])) return false;
  if (!dimensions['divisionLengthBuckets'] || typeof dimensions['divisionLengthBuckets'] !== 'object' || Array.isArray(dimensions['divisionLengthBuckets'])) return false;
  if (!dimensions['divisionDirectionBuckets'] || typeof dimensions['divisionDirectionBuckets'] !== 'object' || Array.isArray(dimensions['divisionDirectionBuckets'])) return false;
  if (!dimensions['transferLengthBuckets'] || typeof dimensions['transferLengthBuckets'] !== 'object' || Array.isArray(dimensions['transferLengthBuckets'])) return false;
  if (!dimensions['transferAngleBuckets'] || typeof dimensions['transferAngleBuckets'] !== 'object' || Array.isArray(dimensions['transferAngleBuckets'])) return false;
  return true;
}

function emptyStore(): ProgressStore {
  return {
    version: 8,
    attempts: [],
    aggregates: {},
    dimensions: {
      lineAngleBuckets: {},
      lineAngleDegreeBuckets: {},
      angleOpeningBuckets: {},
      divisionLengthBuckets: {},
      divisionDirectionBuckets: {},
      transferLengthBuckets: {},
      transferAngleBuckets: {},
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
  const hasDivisionLength = metadata.divisionLengthBucket !== undefined;
  const hasDivisionDirection = metadata.divisionDirectionBucket !== undefined;
  const hasTransferLength = metadata.transferLengthBucket !== undefined;
  const hasTransferAngle = metadata.transferAngleBucket !== undefined;
  if (
    !hasLineAngle &&
    !hasAngleOpening &&
    !hasDivisionLength &&
    !hasDivisionDirection &&
    !hasTransferLength &&
    !hasTransferAngle
  ) {
    return previous;
  }

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
  const exerciseDivisionLengthBuckets =
    previous.divisionLengthBuckets[exerciseId] ?? {};
  const exerciseDivisionDirectionBuckets =
    previous.divisionDirectionBuckets[exerciseId] ?? {};
  const exerciseTransferLengthBuckets =
    previous.transferLengthBuckets[exerciseId] ?? {};
  const exerciseTransferAngleBuckets =
    previous.transferAngleBuckets[exerciseId] ?? {};
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
  const divisionLengthBuckets =
    metadata.divisionLengthBucket === undefined
      ? previous.divisionLengthBuckets
      : {
          ...previous.divisionLengthBuckets,
          [exerciseId]: {
            ...exerciseDivisionLengthBuckets,
            [String(metadata.divisionLengthBucket)]: updateAggregate(
              exerciseDivisionLengthBuckets[
                String(metadata.divisionLengthBucket)
              ],
              score,
              timestamp,
            ),
          },
        };
  const divisionDirectionBuckets =
    metadata.divisionDirectionBucket === undefined
      ? previous.divisionDirectionBuckets
      : {
          ...previous.divisionDirectionBuckets,
          [exerciseId]: {
            ...exerciseDivisionDirectionBuckets,
            [String(metadata.divisionDirectionBucket)]: updateAggregate(
              exerciseDivisionDirectionBuckets[
                String(metadata.divisionDirectionBucket)
              ],
              score,
              timestamp,
            ),
          },
        };
  const transferLengthBuckets =
    metadata.transferLengthBucket === undefined
      ? previous.transferLengthBuckets
      : {
          ...previous.transferLengthBuckets,
          [exerciseId]: {
            ...exerciseTransferLengthBuckets,
            [String(metadata.transferLengthBucket)]: updateAggregate(
              exerciseTransferLengthBuckets[
                String(metadata.transferLengthBucket)
              ],
              score,
              timestamp,
            ),
          },
        };
  const transferAngleBuckets =
    metadata.transferAngleBucket === undefined
      ? previous.transferAngleBuckets
      : {
          ...previous.transferAngleBuckets,
          [exerciseId]: {
            ...exerciseTransferAngleBuckets,
            [String(metadata.transferAngleBucket)]: updateAggregate(
              exerciseTransferAngleBuckets[String(metadata.transferAngleBucket)],
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
    divisionLengthBuckets,
    divisionDirectionBuckets,
    transferLengthBuckets,
    transferAngleBuckets,
  };
}

function fineLineAngleBucket(degrees: number): number {
  const normalized = ((degrees % 360) + 360) % 360;
  const bucket =
    Math.round(normalized / FINE_LINE_ANGLE_BUCKET_SIZE_DEGREES) *
    FINE_LINE_ANGLE_BUCKET_SIZE_DEGREES;
  return bucket === 360 ? 0 : bucket;
}

function migrateLegacyV7Progress(): ProgressStore | null {
  const raw = window.localStorage.getItem(LEGACY_V7_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isLegacyV7ProgressStore(parsed)) {
      console.error('Ignoring malformed v7 progress payload from localStorage.');
      return null;
    }
    const migrated: ProgressStore = {
      version: 8,
      attempts: parsed.attempts,
      aggregates: parsed.aggregates,
      dimensions: {
        lineAngleBuckets: parsed.dimensions.lineAngleBuckets,
        lineAngleDegreeBuckets: parsed.dimensions.lineAngleDegreeBuckets ?? {},
        angleOpeningBuckets: parsed.dimensions.angleOpeningBuckets,
        divisionLengthBuckets: parsed.dimensions.divisionLengthBuckets,
        divisionDirectionBuckets: parsed.dimensions.divisionDirectionBuckets,
        transferLengthBuckets: parsed.dimensions.transferLengthBuckets,
        transferAngleBuckets: {},
      },
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    } catch (error) {
      console.error('Failed to persist migrated progress.', error);
    }
    return migrated;
  } catch (error) {
    console.error('Failed to parse stored v7 progress.', error);
    return null;
  }
}

function migrateLegacyV6Progress(): ProgressStore | null {
  const raw = window.localStorage.getItem(LEGACY_V6_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isLegacyV6ProgressStore(parsed)) {
      console.error('Ignoring malformed v6 progress payload from localStorage.');
      return null;
    }
    const migrated: ProgressStore = {
      version: 8,
      attempts: parsed.attempts,
      aggregates: parsed.aggregates,
      dimensions: {
        lineAngleBuckets: parsed.dimensions.lineAngleBuckets,
        lineAngleDegreeBuckets: parsed.dimensions.lineAngleDegreeBuckets ?? {},
        angleOpeningBuckets: parsed.dimensions.angleOpeningBuckets,
        divisionLengthBuckets: parsed.dimensions.divisionLengthBuckets,
        divisionDirectionBuckets: parsed.dimensions.divisionDirectionBuckets,
        transferLengthBuckets: {},
        transferAngleBuckets: {},
      },
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    } catch (error) {
      console.error('Failed to persist migrated progress.', error);
    }
    return migrated;
  } catch (error) {
    console.error('Failed to parse stored v6 progress.', error);
    return null;
  }
}

function migrateLegacyV5Progress(): ProgressStore | null {
  const raw = window.localStorage.getItem(LEGACY_V5_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isLegacyV5ProgressStore(parsed)) {
      console.error('Ignoring malformed v5 progress payload from localStorage.');
      return null;
    }
    const migrated: ProgressStore = {
      version: 8,
      attempts: parsed.attempts,
      aggregates: parsed.aggregates,
      dimensions: {
        lineAngleBuckets: parsed.dimensions.lineAngleBuckets,
        lineAngleDegreeBuckets: parsed.dimensions.lineAngleDegreeBuckets ?? {},
        angleOpeningBuckets: parsed.dimensions.angleOpeningBuckets,
        divisionLengthBuckets: {},
        divisionDirectionBuckets: {},
        transferLengthBuckets: {},
        transferAngleBuckets: {},
      },
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    } catch (error) {
      console.error('Failed to persist migrated progress.', error);
    }
    return migrated;
  } catch (error) {
    console.error('Failed to parse stored v5 progress.', error);
    return null;
  }
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
      version: 8,
      attempts: parsed.attempts,
      aggregates: parsed.aggregates,
      dimensions: {
        lineAngleBuckets: parsed.dimensions.lineAngleBuckets,
        lineAngleDegreeBuckets: parsed.dimensions.lineAngleDegreeBuckets ?? {},
        angleOpeningBuckets: {},
        divisionLengthBuckets: {},
        divisionDirectionBuckets: {},
        transferLengthBuckets: {},
        transferAngleBuckets: {},
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
      version: 8,
      attempts: parsed.attempts,
      aggregates: parsed.aggregates,
      dimensions: {
        lineAngleBuckets: {},
        lineAngleDegreeBuckets: {},
        angleOpeningBuckets: {},
        divisionLengthBuckets: {},
        divisionDirectionBuckets: {},
        transferLengthBuckets: {},
        transferAngleBuckets: {},
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
      version: 8,
      attempts: parsed.attempts,
      aggregates: parsed.aggregates,
      dimensions: {
        lineAngleBuckets: {},
        lineAngleDegreeBuckets: {},
        angleOpeningBuckets: {},
        divisionLengthBuckets: {},
        divisionDirectionBuckets: {},
        transferLengthBuckets: {},
        transferAngleBuckets: {},
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

function isLegacyV6ProgressStore(
  value: unknown,
): value is Omit<ProgressStore, 'version' | 'dimensions'> & {
  version: 6;
  dimensions: Omit<ProgressDimensions, 'transferLengthBuckets'>;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (v['version'] !== 6) return false;
  if (!Array.isArray(v['attempts'])) return false;
  if (!v['aggregates'] || typeof v['aggregates'] !== 'object' || Array.isArray(v['aggregates'])) return false;
  if (!v['dimensions'] || typeof v['dimensions'] !== 'object' || Array.isArray(v['dimensions'])) return false;
  const dimensions = v['dimensions'] as Record<string, unknown>;
  if (!dimensions['lineAngleBuckets'] || typeof dimensions['lineAngleBuckets'] !== 'object' || Array.isArray(dimensions['lineAngleBuckets'])) return false;
  if (!dimensions['angleOpeningBuckets'] || typeof dimensions['angleOpeningBuckets'] !== 'object' || Array.isArray(dimensions['angleOpeningBuckets'])) return false;
  if (!dimensions['divisionLengthBuckets'] || typeof dimensions['divisionLengthBuckets'] !== 'object' || Array.isArray(dimensions['divisionLengthBuckets'])) return false;
  if (!dimensions['divisionDirectionBuckets'] || typeof dimensions['divisionDirectionBuckets'] !== 'object' || Array.isArray(dimensions['divisionDirectionBuckets'])) return false;
  return true;
}

function isLegacyV7ProgressStore(
  value: unknown,
): value is Omit<ProgressStore, 'version' | 'dimensions'> & {
  version: 7;
  dimensions: Omit<ProgressDimensions, 'transferAngleBuckets'>;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (v['version'] !== 7) return false;
  if (!Array.isArray(v['attempts'])) return false;
  if (!v['aggregates'] || typeof v['aggregates'] !== 'object' || Array.isArray(v['aggregates'])) return false;
  if (!v['dimensions'] || typeof v['dimensions'] !== 'object' || Array.isArray(v['dimensions'])) return false;
  const dimensions = v['dimensions'] as Record<string, unknown>;
  if (!dimensions['lineAngleBuckets'] || typeof dimensions['lineAngleBuckets'] !== 'object' || Array.isArray(dimensions['lineAngleBuckets'])) return false;
  if (!dimensions['angleOpeningBuckets'] || typeof dimensions['angleOpeningBuckets'] !== 'object' || Array.isArray(dimensions['angleOpeningBuckets'])) return false;
  if (!dimensions['divisionLengthBuckets'] || typeof dimensions['divisionLengthBuckets'] !== 'object' || Array.isArray(dimensions['divisionLengthBuckets'])) return false;
  if (!dimensions['divisionDirectionBuckets'] || typeof dimensions['divisionDirectionBuckets'] !== 'object' || Array.isArray(dimensions['divisionDirectionBuckets'])) return false;
  if (!dimensions['transferLengthBuckets'] || typeof dimensions['transferLengthBuckets'] !== 'object' || Array.isArray(dimensions['transferLengthBuckets'])) return false;
  return true;
}

function isLegacyV5ProgressStore(
  value: unknown,
): value is Omit<ProgressStore, 'version' | 'dimensions'> & {
  version: 5;
  dimensions: Omit<
    ProgressDimensions,
    'divisionLengthBuckets' | 'divisionDirectionBuckets'
  >;
} {
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
