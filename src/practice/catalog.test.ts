import { describe, it, expect } from 'vitest';
import { EXERCISES, getExerciseById, getAutoExercise } from './catalog';
import type { ExerciseId } from './catalog';
import type { ProgressStore } from '../storage/progress';

function emptyProgress(): ProgressStore {
  return { version: 2, attempts: [], aggregates: {} };
}

describe('EXERCISES registry', () => {
  it('every id is reachable via getExerciseById', () => {
    for (const ex of EXERCISES) {
      expect(() => getExerciseById(ex.id)).not.toThrow();
      expect(getExerciseById(ex.id).id).toBe(ex.id);
    }
  });

  it('getExerciseById throws for unknown id', () => {
    expect(() => getExerciseById('not-a-real-id' as ExerciseId)).toThrow();
  });

  it('no duplicate ids', () => {
    const ids = EXERCISES.map((e) => e.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

describe('getAutoExercise', () => {
  it('with empty progress returns a deterministic first pick', () => {
    const first = getAutoExercise(emptyProgress());
    const second = getAutoExercise(emptyProgress());
    expect(first.exercise.id).toBe(second.exercise.id);
  });

  it('only returns implemented drills', () => {
    const { exercise } = getAutoExercise(emptyProgress());
    expect(exercise.implemented).toBe(true);
  });

  it('never returns an unimplemented drill even if given low-score progress for it', () => {
    const notImplemented = EXERCISES.find((e) => !e.implemented);
    if (!notImplemented) return; // all implemented — skip

    const progress: ProgressStore = {
      version: 2,
      attempts: [],
      aggregates: {
        [notImplemented.id]: { ema: 0, attempts: 0, lastPracticedAt: 0 },
      },
    };
    const { exercise } = getAutoExercise(progress);
    expect(exercise.implemented).toBe(true);
    expect(exercise.id).not.toBe(notImplemented.id);
  });

  it('picks a never-played drill over a recently-played one with a higher score', () => {
    const implemented = EXERCISES.filter((e) => e.implemented);
    const recentMs = Date.now() - 5 * 60 * 1000; // 5 min ago
    const aggregates: ProgressStore['aggregates'] = {};
    for (const ex of implemented.slice(0, -1)) {
      aggregates[ex.id] = { ema: 90, attempts: 5, lastPracticedAt: recentMs };
    }
    // Last drill has never been played — no entry
    const neverPlayed = implemented[implemented.length - 1];
    const progress: ProgressStore = { version: 2, attempts: [], aggregates };
    const { exercise } = getAutoExercise(progress);
    expect(exercise.id).toBe(neverPlayed.id);
  });

  it('picks the drill with the lowest EMA when all were practiced equally long ago', () => {
    const implemented = EXERCISES.filter((e) => e.implemented);
    const oldMs = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days ago
    const aggregates: ProgressStore['aggregates'] = {};
    for (const ex of implemented) {
      aggregates[ex.id] = { ema: 80, attempts: 5, lastPracticedAt: oldMs };
    }
    const weakDrill = implemented[3];
    aggregates[weakDrill.id] = { ema: 10, attempts: 5, lastPracticedAt: oldMs };

    const progress: ProgressStore = { version: 2, attempts: [], aggregates };
    const { exercise } = getAutoExercise(progress);
    expect(exercise.id).toBe(weakDrill.id);
  });

  it('returns a non-empty reason string', () => {
    const { reason } = getAutoExercise(emptyProgress());
    expect(typeof reason).toBe('string');
    expect(reason.length).toBeGreaterThan(0);
  });
});
