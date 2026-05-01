import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock window.localStorage before importing the module
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { for (const k in store) delete store[k]; }),
};
vi.stubGlobal('window', { localStorage: localStorageMock });

import { getStoredProgress, updateStoredProgress, filterStaleAggregates, _resetProgressCache } from './progress';

const STORAGE_KEY = 'draftsman-eye.progress.v6';
const LEGACY_V5_STORAGE_KEY = 'draftsman-eye.progress.v5';
const LEGACY_V4_STORAGE_KEY = 'draftsman-eye.progress.v4';
const LEGACY_V3_STORAGE_KEY = 'draftsman-eye.progress.v3';
const LEGACY_V2_STORAGE_KEY = 'draftsman-eye.progress.v2';

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
  _resetProgressCache();
});

describe('getStoredProgress', () => {
  it('returns empty store when localStorage has no entry', () => {
    const p = getStoredProgress();
    expect(p.version).toBe(6);
    expect(p.attempts).toEqual([]);
    expect(p.aggregates).toEqual({});
    expect(p.dimensions.lineAngleBuckets).toEqual({});
    expect(p.dimensions.angleOpeningBuckets).toEqual({});
    expect(p.dimensions.divisionLengthBuckets).toEqual({});
    expect(p.dimensions.divisionDirectionBuckets).toEqual({});
  });

  it('returns empty store and logs error for non-JSON payload', () => {
    store[STORAGE_KEY] = 'not-json{{{';
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const p = getStoredProgress();
    expect(p.attempts).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledOnce();
    consoleSpy.mockRestore();
  });

  it('returns empty store and logs error for wrong shape (null)', () => {
    store[STORAGE_KEY] = 'null';
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const p = getStoredProgress();
    expect(p.attempts).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledOnce();
    consoleSpy.mockRestore();
  });

  it('returns empty store and logs error for array at root', () => {
    store[STORAGE_KEY] = '[]';
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const p = getStoredProgress();
    expect(p.attempts).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledOnce();
    consoleSpy.mockRestore();
  });

  it('returns empty store and logs error for wrong version', () => {
    store[STORAGE_KEY] = JSON.stringify({ version: 1, attempts: [], aggregates: {} });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const p = getStoredProgress();
    expect(p.attempts).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledOnce();
    consoleSpy.mockRestore();
  });

  it('migrates v5 progress into v6 with empty division dimensions', () => {
    store[LEGACY_V5_STORAGE_KEY] = JSON.stringify({
      version: 5,
      attempts: [{ exerciseId: 'angle-copy-horizontal-aligned', score: 80, signedError: 2, timestamp: 12345 }],
      aggregates: { 'angle-copy-horizontal-aligned': { ema: 80, attempts: 1, lastPracticedAt: 12345 } },
      dimensions: {
        lineAngleBuckets: {},
        lineAngleDegreeBuckets: {},
        angleOpeningBuckets: {
          'angle-copy-horizontal-aligned': {
            '90': { ema: 80, attempts: 1, lastPracticedAt: 12345 },
          },
        },
      },
    });
    const p = getStoredProgress();
    expect(p.version).toBe(6);
    expect(p.aggregates['angle-copy-horizontal-aligned']!.ema).toBe(80);
    expect(
      p.dimensions.angleOpeningBuckets['angle-copy-horizontal-aligned']!['90']!
        .ema,
    ).toBe(80);
    expect(p.dimensions.divisionLengthBuckets).toEqual({});
    expect(p.dimensions.divisionDirectionBuckets).toEqual({});
  });

  it('migrates v4 progress into v6 with empty angle opening dimensions', () => {
    store[LEGACY_V4_STORAGE_KEY] = JSON.stringify({
      version: 4,
      attempts: [{ exerciseId: 'trace-line', score: 80, signedError: 2, timestamp: 12345 }],
      aggregates: { 'trace-line': { ema: 80, attempts: 1, lastPracticedAt: 12345 } },
      dimensions: {
        lineAngleBuckets: {
          'trace-line': {
            '90': { ema: 80, attempts: 1, lastPracticedAt: 12345 },
          },
        },
        lineAngleDegreeBuckets: {
          'trace-line': {
            '87': { ema: 80, attempts: 1, lastPracticedAt: 12345 },
          },
        },
      },
    });
    const p = getStoredProgress();
    expect(p.version).toBe(6);
    expect(p.aggregates['trace-line']!.ema).toBe(80);
    expect(p.dimensions.lineAngleBuckets['trace-line']!['90']!.ema).toBe(80);
    expect(p.dimensions.lineAngleDegreeBuckets!['trace-line']!['87']!.ema).toBe(80);
    expect(p.dimensions.angleOpeningBuckets).toEqual({});
    expect(p.dimensions.divisionLengthBuckets).toEqual({});
    expect(p.dimensions.divisionDirectionBuckets).toEqual({});
  });

  it('migrates v3 progress into v6 with empty directional dimensions', () => {
    store[LEGACY_V3_STORAGE_KEY] = JSON.stringify({
      version: 3,
      attempts: [{ exerciseId: 'trace-line', score: 80, signedError: 2, timestamp: 12345 }],
      aggregates: { 'trace-line': { ema: 80, attempts: 1, lastPracticedAt: 12345 } },
      dimensions: {
        lineAngleBuckets: {
          'trace-line': {
            '90': { ema: 80, attempts: 1, lastPracticedAt: 12345 },
          },
        },
      },
    });
    const p = getStoredProgress();
    expect(p.version).toBe(6);
    expect(p.aggregates['trace-line']!.ema).toBe(80);
    expect(p.dimensions.lineAngleBuckets).toEqual({});
    expect(p.dimensions.angleOpeningBuckets).toEqual({});
    expect(p.dimensions.divisionLengthBuckets).toEqual({});
    expect(p.dimensions.divisionDirectionBuckets).toEqual({});
  });

  it('migrates v2 progress into v6 with empty dimensions', () => {
    store[LEGACY_V2_STORAGE_KEY] = JSON.stringify({
      version: 2,
      attempts: [{ exerciseId: 'freehand-straight-line', score: 80, signedError: 2, timestamp: 12345 }],
      aggregates: { 'freehand-straight-line': { ema: 80, attempts: 1, lastPracticedAt: 12345 } },
    });
    const p = getStoredProgress();
    expect(p.version).toBe(6);
    expect(p.aggregates['freehand-straight-line']!.ema).toBe(80);
    expect(p.dimensions.lineAngleBuckets).toEqual({});
    expect(p.dimensions.angleOpeningBuckets).toEqual({});
    expect(p.dimensions.divisionLengthBuckets).toEqual({});
    expect(p.dimensions.divisionDirectionBuckets).toEqual({});
  });

  it('returns stored data for a valid payload', () => {
    const payload = {
      version: 6,
      attempts: [{ exerciseId: 'freehand-straight-line', score: 80, signedError: 2, timestamp: 12345 }],
      aggregates: { 'freehand-straight-line': { ema: 80, attempts: 1, lastPracticedAt: 12345 } },
      dimensions: {
        lineAngleBuckets: {},
        angleOpeningBuckets: {},
        divisionLengthBuckets: {},
        divisionDirectionBuckets: {},
      },
    };
    store[STORAGE_KEY] = JSON.stringify(payload);
    const p = getStoredProgress();
    expect(p.version).toBe(6);
    expect(p.attempts).toHaveLength(1);
    expect(p.aggregates['freehand-straight-line']!.ema).toBe(80);
  });
});

describe('updateStoredProgress', () => {
  it('first attempt sets ema equal to the score', () => {
    const result = updateStoredProgress('freehand-straight-line', 80, 0);
    expect(result.aggregates['freehand-straight-line']!.ema).toBe(80);
  });

  it('second attempt applies EMA: ema = prev + 0.35*(next - prev)', () => {
    updateStoredProgress('freehand-straight-line', 80, 0);
    const result = updateStoredProgress('freehand-straight-line', 60, 0);
    const expected = 80 + 0.35 * (60 - 80);
    expect(result.aggregates['freehand-straight-line']!.ema).toBeCloseTo(expected, 10);
  });

  it('attempts count is monotonically incremented', () => {
    const r1 = updateStoredProgress('freehand-straight-line', 70, 0);
    expect(r1.aggregates['freehand-straight-line']!.attempts).toBe(1);
    const r2 = updateStoredProgress('freehand-straight-line', 80, 0);
    expect(r2.aggregates['freehand-straight-line']!.attempts).toBe(2);
  });

  it('records are stored independently per exercise id', () => {
    updateStoredProgress('freehand-straight-line', 70, 0);
    const result = updateStoredProgress('freehand-circle', 90, 0);
    expect(result.aggregates['freehand-straight-line']!.attempts).toBe(1);
    expect(result.aggregates['freehand-circle']!.attempts).toBe(1);
  });

  it('logs error but still returns in-memory result when localStorage.setItem fails', () => {
    localStorageMock.setItem.mockImplementationOnce(() => { throw new Error('QuotaExceededError'); });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = updateStoredProgress('freehand-straight-line', 75, 0);
    expect(result.aggregates['freehand-straight-line']!.ema).toBe(75);
    expect(consoleSpy).toHaveBeenCalledOnce();
    consoleSpy.mockRestore();
  });

  it('appends an AttemptRecord with correct fields', () => {
    const before = Date.now();
    const result = updateStoredProgress('freehand-circle', 85, -3);
    const after = Date.now();
    expect(result.attempts).toHaveLength(1);
    const rec = result.attempts[0];
    expect(rec.exerciseId).toBe('freehand-circle');
    expect(rec.score).toBe(85);
    expect(rec.signedError).toBe(-3);
    expect(rec.timestamp).toBeGreaterThanOrEqual(before);
    expect(rec.timestamp).toBeLessThanOrEqual(after);
  });

  it('updates line angle bucket aggregates when metadata is provided', () => {
    const result = updateStoredProgress('trace-line', 70, 0, {
      lineAngleDegrees: 87,
      lineAngleBucket: 90,
    });

    const bucket = result.dimensions.lineAngleBuckets['trace-line']!['90']!;
    const fineBucket = result.dimensions.lineAngleDegreeBuckets!['trace-line']!['87']!;
    expect(bucket.ema).toBe(70);
    expect(bucket.attempts).toBe(1);
    expect(fineBucket.ema).toBe(70);
    expect(fineBucket.attempts).toBe(1);
    expect(result.attempts[0].metadata?.lineAngleBucket).toBe(90);
  });

  it('applies EMA independently per line angle bucket', () => {
    updateStoredProgress('trace-line', 80, 0, {
      lineAngleDegrees: 87,
      lineAngleBucket: 90,
    });
    const result = updateStoredProgress('trace-line', 60, 0, {
      lineAngleDegrees: 91,
      lineAngleBucket: 90,
    });
    const expected = 80 + 0.35 * (60 - 80);
    expect(result.dimensions.lineAngleBuckets['trace-line']!['90']!.ema).toBeCloseTo(expected, 10);
  });

  it('keeps durable one-degree line angle aggregates for future re-bucketing', () => {
    updateStoredProgress('trace-line', 80, 0, {
      lineAngleDegrees: 87.4,
      lineAngleBucket: 90,
    });
    const result = updateStoredProgress('trace-line', 60, 0, {
      lineAngleDegrees: 87.6,
      lineAngleBucket: 90,
    });

    expect(result.dimensions.lineAngleBuckets['trace-line']!['90']!.attempts).toBe(2);
    expect(result.dimensions.lineAngleDegreeBuckets!['trace-line']!['87']!.attempts).toBe(1);
    expect(result.dimensions.lineAngleDegreeBuckets!['trace-line']!['88']!.attempts).toBe(1);
  });

  it('keeps low-score line attempts out of proficiency aggregates', () => {
    const result = updateStoredProgress('trace-line', 19, 0, {
      lineAngleDegrees: 87,
      lineAngleBucket: 90,
    });

    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0].metadata?.lineAngleBucket).toBe(90);
    expect(result.aggregates['trace-line']!.attempts).toBe(1);
    expect(result.dimensions.lineAngleBuckets['trace-line']).toBeUndefined();
    expect(result.dimensions.lineAngleDegreeBuckets?.['trace-line']).toBeUndefined();
  });

  it('updates angle opening bucket aggregates when metadata is provided', () => {
    const result = updateStoredProgress('angle-copy-horizontal-aligned', 70, 0, {
      angleOpeningDegrees: 87,
      angleOpeningBucket: 90,
    });

    const bucket =
      result.dimensions.angleOpeningBuckets['angle-copy-horizontal-aligned']![
        '90'
      ]!;
    expect(bucket.ema).toBe(70);
    expect(bucket.attempts).toBe(1);
    expect(result.attempts[0].metadata?.angleOpeningBucket).toBe(90);
  });

  it('keeps low-score angle attempts out of proficiency aggregates', () => {
    const result = updateStoredProgress('angle-copy-horizontal-aligned', 19, 0, {
      angleOpeningDegrees: 87,
      angleOpeningBucket: 90,
    });

    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0].metadata?.angleOpeningBucket).toBe(90);
    expect(result.aggregates['angle-copy-horizontal-aligned']!.attempts).toBe(1);
    expect(
      result.dimensions.angleOpeningBuckets['angle-copy-horizontal-aligned'],
    ).toBeUndefined();
  });

  it('updates division length and direction bucket aggregates when metadata is provided', () => {
    const result = updateStoredProgress('division-random-thirds', 70, 0, {
      divisionLengthPixels: 390,
      divisionLengthBucket: 2,
      divisionDirectionDegrees: 92,
      divisionDirectionBucket: 90,
    });

    const lengthBucket =
      result.dimensions.divisionLengthBuckets['division-random-thirds']!['2']!;
    const directionBucket =
      result.dimensions.divisionDirectionBuckets['division-random-thirds']![
        '90'
      ]!;
    expect(lengthBucket.ema).toBe(70);
    expect(lengthBucket.attempts).toBe(1);
    expect(directionBucket.ema).toBe(70);
    expect(directionBucket.attempts).toBe(1);
    expect(result.attempts[0].metadata?.divisionLengthBucket).toBe(2);
    expect(result.attempts[0].metadata?.divisionDirectionBucket).toBe(90);
  });

  it('keeps low-score division attempts out of proficiency aggregates', () => {
    const result = updateStoredProgress('division-random-thirds', 19, 0, {
      divisionLengthPixels: 390,
      divisionLengthBucket: 2,
      divisionDirectionDegrees: 92,
      divisionDirectionBucket: 90,
    });

    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0].metadata?.divisionLengthBucket).toBe(2);
    expect(result.aggregates['division-random-thirds']!.attempts).toBe(1);
    expect(
      result.dimensions.divisionLengthBuckets['division-random-thirds'],
    ).toBeUndefined();
    expect(
      result.dimensions.divisionDirectionBuckets['division-random-thirds'],
    ).toBeUndefined();
  });
});

describe('filterStaleAggregates', () => {
  it('retains entries whose ids are in the known set', () => {
    const store = updateStoredProgress('freehand-straight-line', 80, 0);
    const result = filterStaleAggregates(store, new Set(['freehand-straight-line']));
    expect(result.aggregates['freehand-straight-line']).toBeDefined();
  });

  it('drops entries whose ids are not in the known set', () => {
    const store = updateStoredProgress('freehand-straight-line', 80, 0);
    const result = filterStaleAggregates(store, new Set(['freehand-circle']));
    expect(result.aggregates['freehand-straight-line']).toBeUndefined();
  });

  it('does not modify the attempts ring buffer', () => {
    const store = updateStoredProgress('freehand-straight-line', 80, 0);
    const result = filterStaleAggregates(store, new Set());
    expect(result.attempts).toHaveLength(1);
  });

  it('drops line angle bucket entries whose exercise ids are not known', () => {
    const store = updateStoredProgress('trace-line', 80, 0, {
      lineAngleDegrees: 87,
      lineAngleBucket: 90,
    });
    const result = filterStaleAggregates(store, new Set(['freehand-straight-line']));
    expect(result.dimensions.lineAngleBuckets['trace-line']).toBeUndefined();
    expect(result.dimensions.lineAngleDegreeBuckets!['trace-line']).toBeUndefined();
  });

  it('drops angle opening bucket entries whose exercise ids are not known', () => {
    const store = updateStoredProgress('angle-copy-horizontal-aligned', 80, 0, {
      angleOpeningDegrees: 87,
      angleOpeningBucket: 90,
    });
    const result = filterStaleAggregates(store, new Set(['trace-line']));
    expect(
      result.dimensions.angleOpeningBuckets['angle-copy-horizontal-aligned'],
    ).toBeUndefined();
  });

  it('drops division bucket entries whose exercise ids are not known', () => {
    const store = updateStoredProgress('division-random-thirds', 80, 0, {
      divisionLengthPixels: 390,
      divisionLengthBucket: 2,
      divisionDirectionDegrees: 92,
      divisionDirectionBucket: 90,
    });
    const result = filterStaleAggregates(store, new Set(['trace-line']));
    expect(
      result.dimensions.divisionLengthBuckets['division-random-thirds'],
    ).toBeUndefined();
    expect(
      result.dimensions.divisionDirectionBuckets['division-random-thirds'],
    ).toBeUndefined();
  });

  it('returns empty aggregates when known set is empty', () => {
    const store = updateStoredProgress('freehand-straight-line', 80, 0);
    const result = filterStaleAggregates(store, new Set());
    expect(Object.keys(result.aggregates)).toHaveLength(0);
  });
});
