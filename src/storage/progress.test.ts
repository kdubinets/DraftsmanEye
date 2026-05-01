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

const STORAGE_KEY = 'draftsman-eye.progress.v3';
const LEGACY_V2_STORAGE_KEY = 'draftsman-eye.progress.v2';

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
  _resetProgressCache();
});

describe('getStoredProgress', () => {
  it('returns empty store when localStorage has no entry', () => {
    const p = getStoredProgress();
    expect(p.version).toBe(3);
    expect(p.attempts).toEqual([]);
    expect(p.aggregates).toEqual({});
    expect(p.dimensions.lineAngleBuckets).toEqual({});
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

  it('migrates v2 progress into v3 with empty dimensions', () => {
    store[LEGACY_V2_STORAGE_KEY] = JSON.stringify({
      version: 2,
      attempts: [{ exerciseId: 'freehand-straight-line', score: 80, signedError: 2, timestamp: 12345 }],
      aggregates: { 'freehand-straight-line': { ema: 80, attempts: 1, lastPracticedAt: 12345 } },
    });
    const p = getStoredProgress();
    expect(p.version).toBe(3);
    expect(p.aggregates['freehand-straight-line']!.ema).toBe(80);
    expect(p.dimensions.lineAngleBuckets).toEqual({});
  });

  it('returns stored data for a valid payload', () => {
    const payload = {
      version: 3,
      attempts: [{ exerciseId: 'freehand-straight-line', score: 80, signedError: 2, timestamp: 12345 }],
      aggregates: { 'freehand-straight-line': { ema: 80, attempts: 1, lastPracticedAt: 12345 } },
      dimensions: { lineAngleBuckets: {} },
    };
    store[STORAGE_KEY] = JSON.stringify(payload);
    const p = getStoredProgress();
    expect(p.version).toBe(3);
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
    expect(bucket.ema).toBe(70);
    expect(bucket.attempts).toBe(1);
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
  });

  it('returns empty aggregates when known set is empty', () => {
    const store = updateStoredProgress('freehand-straight-line', 80, 0);
    const result = filterStaleAggregates(store, new Set());
    expect(Object.keys(result.aggregates)).toHaveLength(0);
  });
});
