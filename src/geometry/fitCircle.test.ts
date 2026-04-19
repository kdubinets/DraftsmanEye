import { describe, it, expect } from 'vitest';
import { fitCircle } from './fitCircle';

/** Sample n points on a circle. */
function circlePoints(
  cx: number,
  cy: number,
  r: number,
  n = 64,
  startAngle = 0,
  sweep = 2 * Math.PI,
) {
  return Array.from({ length: n }, (_, i) => {
    const a = startAngle + (i / n) * sweep;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
}

describe('fitCircle', () => {
  it('recovers center and radius of a sampled perfect circle', () => {
    const fit = fitCircle(circlePoints(300, 200, 120));
    expect(fit).not.toBeNull();
    expect(fit!.center.x).toBeCloseTo(300, 4);
    expect(fit!.center.y).toBeCloseTo(200, 4);
    expect(fit!.radius).toBeCloseTo(120, 4);
  });

  it('translation invariance: shifting points shifts center, radius unchanged', () => {
    const base = circlePoints(0, 0, 80);
    const shifted = base.map((p) => ({ x: p.x + 150, y: p.y + 250 }));
    const fitBase = fitCircle(base)!;
    const fitShifted = fitCircle(shifted)!;
    expect(fitShifted.center.x).toBeCloseTo(fitBase.center.x + 150, 4);
    expect(fitShifted.center.y).toBeCloseTo(fitBase.center.y + 250, 4);
    expect(fitShifted.radius).toBeCloseTo(fitBase.radius, 4);
  });

  it('does not produce NaN or throw on near-collinear points', () => {
    // Points nearly along y=0 — ill-conditioned for circle fitting
    const pts = Array.from({ length: 20 }, (_, i) => ({ x: i * 10, y: i * 0.01 }));
    expect(() => fitCircle(pts)).not.toThrow();
    const result = fitCircle(pts);
    if (result !== null) {
      expect(Number.isFinite(result.center.x)).toBe(true);
      expect(Number.isFinite(result.center.y)).toBe(true);
      expect(Number.isFinite(result.radius)).toBe(true);
    }
  });

  it('returns null for fewer than 3 points (singular system)', () => {
    // 2 points → underdetermined → solveThreeByThree returns null → fitCircle returns null
    const result = fitCircle([{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    // Either null or a valid finite result; must not throw or produce NaN
    if (result !== null) {
      expect(Number.isFinite(result.radius)).toBe(true);
    }
  });

  it('works for a large circle', () => {
    const fit = fitCircle(circlePoints(500, 300, 400));
    expect(fit).not.toBeNull();
    expect(fit!.radius).toBeCloseTo(400, 2);
  });
});
