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
    // Call twice — must return the same id
    const second = getAutoExercise(emptyProgress());
    expect(first.id).toBe(second.id);
  });

  it('only returns implemented drills', () => {
    const result = getAutoExercise(emptyProgress());
    expect(result.implemented).toBe(true);
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
    const result = getAutoExercise(progress);
    expect(result.implemented).toBe(true);
    expect(result.id).not.toBe(notImplemented.id);
  });

  it('least-practiced drill wins over lowest-score when attempts differ', () => {
    const implemented = EXERCISES.filter((e) => e.implemented);
    // Give all drills 5 attempts with score 50 except the last one, which has 0 attempts
    const aggregates: ProgressStore['aggregates'] = {};
    for (const ex of implemented.slice(0, -1)) {
      aggregates[ex.id] = { ema: 50, attempts: 5, lastPracticedAt: 0 };
    }
    const leastPracticed = implemented[implemented.length - 1];

    const progress: ProgressStore = { version: 2, attempts: [], aggregates };
    const result = getAutoExercise(progress);
    expect(result.id).toBe(leastPracticed.id);
  });

  it('with equal attempts, picks the drill with lower ema score', () => {
    const implemented = EXERCISES.filter((e) => e.implemented);
    // Give all drills equal 2 attempts except one which has ema=10
    const aggregates: ProgressStore['aggregates'] = {};
    for (const ex of implemented) {
      aggregates[ex.id] = { ema: 80, attempts: 2, lastPracticedAt: 0 };
    }
    const weakDrill = implemented[3];
    aggregates[weakDrill.id] = { ema: 10, attempts: 2, lastPracticedAt: 0 };

    const progress: ProgressStore = { version: 2, attempts: [], aggregates };
    const result = getAutoExercise(progress);
    expect(result.id).toBe(weakDrill.id);
  });
});
