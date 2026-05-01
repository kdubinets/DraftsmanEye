import { describe, it, expect } from 'vitest';
import { scoreFreehandLine, scoreTargetLine } from './line';
import type { FreehandPoint } from '../exercises/freehand/types';

function pt(x: number, y: number): FreehandPoint {
  return { x, y, time: 0, pressure: 0.5, pointerType: 'mouse' };
}

/** n evenly spaced points on a horizontal line at y=yVal from x=x0 to x=x1 */
function hLine(x0: number, x1: number, yVal: number, n = 60): FreehandPoint[] {
  return Array.from({ length: n }, (_, i) => pt(x0 + (i / (n - 1)) * (x1 - x0), yVal));
}

/** Adds perpendicular noise to a horizontal line */
function noisyHLine(x0: number, x1: number, yVal: number, noiseAmplitude: number, n = 60): FreehandPoint[] {
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    // Sine wave perpendicular noise
    const noise = noiseAmplitude * Math.sin(t * Math.PI * 4);
    return pt(x0 + t * (x1 - x0), yVal + noise);
  });
}

describe('scoreFreehandLine', () => {
  it('returns null for fewer than 4 points', () => {
    expect(scoreFreehandLine([pt(0,0), pt(100,0), pt(200,0)])).toBeNull();
  });

  it('returns null for a very short stroke (< 80px)', () => {
    const pts = hLine(0, 50, 100);
    expect(scoreFreehandLine(pts)).toBeNull();
  });

  it('scores a perfect straight line at 100', () => {
    const pts = hLine(100, 600, 200);
    const result = scoreFreehandLine(pts);
    expect(result).not.toBeNull();
    expect(result!.score).toBeCloseTo(100, 5);
    expect(result!.meanErrorPixels).toBeCloseTo(0, 8);
    expect(result!.kind).toBe('line');
  });

  it('scores a slightly wobbly line lower than a perfect line', () => {
    const perfect = scoreFreehandLine(hLine(100, 600, 200))!;
    const wobbly = scoreFreehandLine(noisyHLine(100, 600, 200, 5))!;
    expect(wobbly.score).toBeLessThan(perfect.score);
    expect(wobbly.score).toBeGreaterThan(0);
  });

  it('score clamps to [0, 100] for a wildly off stroke', () => {
    // Zigzag: extreme perpendicular deviation
    const pts = Array.from({ length: 60 }, (_, i) =>
      pt(100 + i * 10, i % 2 === 0 ? 0 : 500),
    );
    const result = scoreFreehandLine(pts);
    if (result !== null) {
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    }
  });

  it('golden: perfect horizontal line score=100, meanErr≈0', () => {
    const result = scoreFreehandLine(hLine(50, 650, 300))!;
    expect(result.score).toMatchInlineSnapshot(`100`);
    expect(result.meanErrorPixels).toMatchInlineSnapshot(`0`);
  });

  it('golden: sine-wave noise amplitude=10px', () => {
    const result = scoreFreehandLine(noisyHLine(50, 650, 300, 10))!;
    expect(result.score).toMatchInlineSnapshot(`80.37240640448356`);
  });

  it('golden: sine-wave noise amplitude=30px', () => {
    const result = scoreFreehandLine(noisyHLine(50, 650, 300, 30))!;
    expect(result.score).toMatchInlineSnapshot(`41.11175792889516`);
  });
});

describe('scoreTargetLine', () => {
  const target = {
    kind: 'line' as const,
    start: { x: 100, y: 300 },
    end: { x: 600, y: 300 },
  };

  it('returns null when base scoreFreehandLine returns null', () => {
    expect(scoreTargetLine([pt(0,0), pt(10,0)], target)).toBeNull();
  });

  it('perfect stroke hitting both endpoints scores near 100', () => {
    // Stroke exactly from target.start to target.end
    const pts = hLine(100, 600, 300);
    const result = scoreTargetLine(pts, target);
    expect(result).not.toBeNull();
    expect(result!.score).toBeCloseTo(100, 2);
    expect(result!.kind).toBe('target-line');
    expect(result!.directionMatched).toBe(true);
  });

  it('directional mode scores a perfect forward stroke near 100', () => {
    const result = scoreTargetLine(hLine(100, 600, 300), target, {
      requireDirection: true,
    })!;

    expect(result.score).toBeCloseTo(100, 2);
    expect(result.directionMatched).toBe(true);
  });

  it('directional mode scores a perfect reverse stroke as a miss', () => {
    const result = scoreTargetLine(hLine(600, 100, 300), target, {
      requireDirection: true,
    })!;

    expect(result.score).toBe(0);
    expect(result.directionMatched).toBe(false);
  });

  it('non-directional mode accepts a perfect reverse stroke geometrically', () => {
    const result = scoreTargetLine(hLine(600, 100, 300), target)!;

    expect(result.score).toBeCloseTo(100, 2);
    expect(result.directionMatched).toBe(false);
  });

  it('endpoint errors reduce score below perfect freehand score', () => {
    // Stroke that is straight but misses endpoint by 50px
    const pts = hLine(150, 650, 300);
    const result = scoreTargetLine(pts, target)!;
    const base = scoreFreehandLine(pts)!;
    expect(result.score).toBeLessThan(base.score);
  });

  it('score clamps to [0, 100]', () => {
    const pts = hLine(100, 600, 300);
    const result = scoreTargetLine(pts, target)!;
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('golden: perfect stroke on target', () => {
    const pts = hLine(100, 600, 300);
    const result = scoreTargetLine(pts, target)!;
    expect(result.score).toMatchInlineSnapshot(`100`);
    expect(result.startErrorPixels).toMatchInlineSnapshot(`0`);
    expect(result.endErrorPixels).toMatchInlineSnapshot(`0`);
    expect(result.angleErrorDegrees).toMatchInlineSnapshot(`0`);
  });
});
