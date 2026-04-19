import { describe, it, expect } from 'vitest';
import { scoreFreehandEllipse, scoreTargetEllipse } from './ellipse';
import type { FreehandPoint } from '../exercises/freehand/types';

function pt(x: number, y: number): FreehandPoint {
  return { x, y, time: 0, pressure: 0.5, pointerType: 'mouse' };
}

function ellipsePoints(
  cx: number,
  cy: number,
  a: number,
  b: number,
  rotation: number,
  n = 80,
): FreehandPoint[] {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const pts = Array.from({ length: n }, (_, i) => {
    const t = (i / n) * 2 * Math.PI;
    const lx = a * Math.cos(t);
    const ly = b * Math.sin(t);
    return pt(cx + lx * cos - ly * sin, cy + lx * sin + ly * cos);
  });
  pts.push(pts[0]); // close: exactly the first point → zero closure gap
  return pts;
}

function noisyEllipse(
  cx: number,
  cy: number,
  a: number,
  b: number,
  rotation: number,
  noiseAmp: number,
  n = 80,
): FreehandPoint[] {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * 2 * Math.PI;
    const noise = noiseAmp * Math.sin(t * 7);
    const lx = (a + noise) * Math.cos(t);
    const ly = (b + noise) * Math.sin(t);
    return pt(cx + lx * cos - ly * sin, cy + lx * sin + ly * cos);
  });
}

describe('scoreFreehandEllipse', () => {
  it('returns null for fewer than 12 points', () => {
    const pts = Array.from({ length: 11 }, (_, i) => pt(i * 10, 0));
    expect(scoreFreehandEllipse(pts)).toBeNull();
  });

  it('scores a perfect ellipse highly (join angle penalty applies)', () => {
    const pts = ellipsePoints(400, 300, 180, 90, 0);
    const result = scoreFreehandEllipse(pts);
    expect(result).not.toBeNull();
    // Join angle penalty means even a perfect geometric ellipse scores below 100.
    expect(result!.score).toBeGreaterThan(70);
    expect(result!.kind).toBe('ellipse');
  });

  it('noisy ellipse scores lower than perfect', () => {
    const perfect = scoreFreehandEllipse(ellipsePoints(400, 300, 180, 90, 0))!;
    const noisy = scoreFreehandEllipse(noisyEllipse(400, 300, 180, 90, 0, 8))!;
    if (perfect && noisy) {
      expect(noisy.score).toBeLessThan(perfect.score);
    }
  });

  it('score clamps to [0, 100]', () => {
    const result = scoreFreehandEllipse(ellipsePoints(400, 300, 180, 90, 0));
    if (result !== null) {
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    }
  });

  it('golden: perfect ellipse 180×90 at rotation=0', () => {
    const result = scoreFreehandEllipse(ellipsePoints(400, 300, 180, 90, 0))!;
    expect(result.score).toMatchInlineSnapshot(`85.33447478384423`);
    expect(result.closureGapPixels).toMatchInlineSnapshot(`0`);
  });

  it('golden: noisy ellipse noiseAmp=8', () => {
    const result = scoreFreehandEllipse(noisyEllipse(400, 300, 180, 90, 0, 8))!;
    expect(result.score).toMatchInlineSnapshot(`15.110643564663718`);
  });
});

describe('scoreTargetEllipse', () => {
  const target = {
    kind: 'ellipse' as const,
    center: { x: 400, y: 300 },
    majorRadius: 180,
    minorRadius: 90,
    rotationRadians: 0,
  };

  it('returns null with fewer than 12 points', () => {
    const pts = Array.from({ length: 11 }, (_, i) => pt(i * 20, 0));
    expect(scoreTargetEllipse(pts, target)).toBeNull();
  });

  it('perfect stroke on target scores well (join angle penalty applies)', () => {
    const pts = ellipsePoints(400, 300, 180, 90, 0);
    const result = scoreTargetEllipse(pts, target);
    expect(result).not.toBeNull();
    expect(result!.score).toBeGreaterThan(70);
    expect(result!.kind).toBe('target-ellipse');
  });

  it('score clamps to [0, 100]', () => {
    const pts = ellipsePoints(400, 300, 180, 90, 0);
    const result = scoreTargetEllipse(pts, target)!;
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('golden: perfect stroke on target', () => {
    const pts = ellipsePoints(400, 300, 180, 90, 0);
    const result = scoreTargetEllipse(pts, target)!;
    expect(result.score).toMatchInlineSnapshot(`85.33447478409337`);
    expect(result.centerErrorPixels).toBeCloseTo(0, 6);
  });
});
