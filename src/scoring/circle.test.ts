import { describe, it, expect } from 'vitest';
import { scoreFreehandCircle, scoreTargetCircle } from './circle';
import type { FreehandPoint } from '../exercises/freehand/types';

function pt(x: number, y: number): FreehandPoint {
  return { x, y, time: 0, pressure: 0.5, pointerType: 'mouse' };
}

/** n evenly spaced points on a circle, closing back to the first point. */
function circlePoints(cx: number, cy: number, r: number, n = 80): FreehandPoint[] {
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 2 * Math.PI;
    return pt(cx + r * Math.cos(a), cy + r * Math.sin(a));
  });
  pts.push(pts[0]); // close: exactly the first point → zero closure gap
  return pts;
}

/** Circle points with radial noise, closed. */
function noisyCircle(cx: number, cy: number, r: number, noiseAmp: number, n = 80): FreehandPoint[] {
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 2 * Math.PI;
    const rr = r + noiseAmp * Math.sin(a * 5);
    return pt(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
  });
  pts.push(pts[0]);
  return pts;
}

describe('scoreFreehandCircle', () => {
  it('returns null for fewer than 12 points', () => {
    const pts = Array.from({ length: 11 }, (_, i) => pt(Math.cos(i) * 100 + 200, Math.sin(i) * 100 + 200));
    expect(scoreFreehandCircle(pts)).toBeNull();
  });

  it('returns null for very short stroke (< 180px circumference)', () => {
    // Circle r=10 → circumference ≈ 63px
    const pts = circlePoints(200, 200, 10);
    expect(scoreFreehandCircle(pts)).toBeNull();
  });

  it('scores a perfect geometric circle highly (join angle penalty applies)', () => {
    const pts = circlePoints(300, 300, 120);
    const result = scoreFreehandCircle(pts);
    expect(result).not.toBeNull();
    // The join angle penalty means even a perfect geometric circle scores below 100.
    // This golden threshold captures the actual scorer behavior.
    expect(result!.score).toBeGreaterThan(80);
    expect(result!.kind).toBe('circle');
  });

  it('noisy circle scores lower than perfect circle', () => {
    const perfect = scoreFreehandCircle(circlePoints(300, 300, 120))!;
    const noisy = scoreFreehandCircle(noisyCircle(300, 300, 120, 8))!;
    expect(noisy.score).toBeLessThan(perfect.score);
  });

  it('score clamps to [0, 100]', () => {
    const result = scoreFreehandCircle(noisyCircle(300, 300, 120, 8));
    if (result !== null) {
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    }
  });

  it('closure gap: open stroke (large gap) reduces score vs closed', () => {
    // Closed circle
    const closed = circlePoints(300, 300, 120);
    // Open arc: ~270° arc, gap ≈ r*√2 ≈ 85px
    const open = Array.from({ length: 80 }, (_, i) => {
      const a = (i / 80) * 1.5 * Math.PI; // 270°
      return pt(300 + 120 * Math.cos(a), 300 + 120 * Math.sin(a));
    });
    const closedResult = scoreFreehandCircle(closed);
    const openResult = scoreFreehandCircle(open);
    if (closedResult !== null && openResult !== null) {
      expect(closedResult.score).toBeGreaterThan(openResult.score);
    }
  });

  it('golden: perfect circle r=120', () => {
    const result = scoreFreehandCircle(circlePoints(300, 300, 120))!;
    expect(result.score).toMatchInlineSnapshot(`93.92204501653673`);
    expect(result.closureGapPixels).toMatchInlineSnapshot(`0`);
  });

  it('golden: noisy circle noiseAmp=8', () => {
    const result = scoreFreehandCircle(noisyCircle(300, 300, 120, 8))!;
    expect(result.score).toMatchInlineSnapshot(`32.06087404718329`);
  });
});

describe('scoreTargetCircle', () => {
  const target = {
    kind: 'circle' as const,
    center: { x: 300, y: 300 },
    radius: 120,
    marks: [],
    showCenter: true,
  };

  it('returns null with fewer than 12 points', () => {
    const pts = Array.from({ length: 11 }, (_, i) => pt(Math.cos(i) * 100 + 300, Math.sin(i) * 100 + 300));
    expect(scoreTargetCircle(pts, target)).toBeNull();
  });

  it('perfect stroke on target scores well (join angle penalty applies)', () => {
    const pts = circlePoints(300, 300, 120);
    const result = scoreTargetCircle(pts, target);
    expect(result).not.toBeNull();
    expect(result!.score).toBeGreaterThan(80);
    expect(result!.kind).toBe('target-circle');
  });

  it('score clamps to [0, 100]', () => {
    const pts = circlePoints(300, 300, 120);
    const result = scoreTargetCircle(pts, target)!;
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('golden: perfect stroke on target', () => {
    const pts = circlePoints(300, 300, 120);
    const result = scoreTargetCircle(pts, target)!;
    expect(result.score).toMatchInlineSnapshot(`93.92204501656427`);
    expect(result.centerErrorPixels).toBeCloseTo(0, 6);
    expect(result.radiusErrorPixels).toBeCloseTo(0, 6);
  });
});
