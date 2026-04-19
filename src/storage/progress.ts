/**
 * Stores and reads per-drill progress from browser local storage.
 *
 * Schema v2: a ring buffer of raw attempt records plus pre-computed aggregates.
 * v1 data (key draftsman-eye.progress.v1) is silently abandoned on first load.
 */
import type { ExerciseId } from '../practice/catalog';

export type AttemptRecord = {
  exerciseId: ExerciseId;
  score: number;       // 0..100
  signedError: number; // signed pixel error; 0 for exercise families with no directional concept
  timestamp: number;   // Date.now()
};

export type ExerciseAggregate = {
  ema: number;
  attempts: number;
  lastPracticedAt: number;
};

export type ProgressStore = {
  version: 2;
  attempts: AttemptRecord[];
  aggregates: Partial<Record<ExerciseId, ExerciseAggregate>>;
};

const STORAGE_KEY = 'draftsman-eye.progress.v2';
const MAX_ATTEMPTS = 500;
const EMA_ALPHA = 0.35;

const EMPTY_STORE: ProgressStore = { version: 2, attempts: [], aggregates: {} };

export function getStoredProgress(): ProgressStore {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return EMPTY_STORE;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isProgressStore(parsed)) {
      console.error('Ignoring malformed progress payload from localStorage.');
      return EMPTY_STORE;
    }
    return parsed;
  } catch (error) {
    console.error('Failed to parse stored progress.', error);
    return EMPTY_STORE;
  }
}

export function updateStoredProgress(
  exerciseId: ExerciseId,
  score: number,
  signedError: number,
): ProgressStore {
  const store = getStoredProgress();

  const record: AttemptRecord = { exerciseId, score, signedError, timestamp: Date.now() };
  const attempts = [...store.attempts, record];
  if (attempts.length > MAX_ATTEMPTS) attempts.splice(0, attempts.length - MAX_ATTEMPTS);

  const prev = store.aggregates[exerciseId];
  const nextEma = prev === undefined ? score : prev.ema + EMA_ALPHA * (score - prev.ema);
  const nextAggregate: ExerciseAggregate = {
    ema: nextEma,
    attempts: (prev?.attempts ?? 0) + 1,
    lastPracticedAt: record.timestamp,
  };

  const next: ProgressStore = {
    version: 2,
    attempts,
    aggregates: { ...store.aggregates, [exerciseId]: nextAggregate },
  };

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
  return { ...store, aggregates: filtered };
}

function isProgressStore(value: unknown): value is ProgressStore {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (v['version'] !== 2) return false;
  if (!Array.isArray(v['attempts'])) return false;
  if (!v['aggregates'] || typeof v['aggregates'] !== 'object' || Array.isArray(v['aggregates'])) return false;
  return true;
}
