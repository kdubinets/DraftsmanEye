import { describe, it, expect } from 'vitest';
import { fitEllipse, ellipseRadialErrorPixels, ellipseCircumferenceApproximation } from './fitEllipse';

/** Sample n points on an ellipse rotated by `rotation` radians. */
function ellipsePoints(
  cx: number,
  cy: number,
  a: number,
  b: number,
  rotation: number,
  n = 80,
) {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * 2 * Math.PI;
    const lx = a * Math.cos(t);
    const ly = b * Math.sin(t);
    return { x: cx + lx * cos - ly * sin, y: cy + lx * sin + ly * cos };
  });
}

describe('fitEllipse', () => {
  it('recovers a circle (majorRadius ≈ minorRadius) when given circle points', () => {
    // A circle is an ellipse with equal axes
    const pts = ellipsePoints(300, 200, 100, 100, 0);
    const fit = fitEllipse(pts);
    expect(fit).not.toBeNull();
    expect(Math.abs(fit!.majorRadius - fit!.minorRadius)).toBeLessThan(1);
    expect(fit!.center.x).toBeCloseTo(300, 1);
    expect(fit!.center.y).toBeCloseTo(200, 1);
  });

  it('recovers axes for a rotated ellipse at rotation=0', () => {
    const pts = ellipsePoints(400, 300, 200, 100, 0);
    const fit = fitEllipse(pts);
    expect(fit).not.toBeNull();
    expect(fit!.majorRadius).toBeCloseTo(200, 1);
    expect(fit!.minorRadius).toBeCloseTo(100, 1);
  });

  it('recovers axes for a rotated ellipse at rotation=π/4', () => {
    const pts = ellipsePoints(400, 300, 200, 80, Math.PI / 4);
    const fit = fitEllipse(pts);
    expect(fit).not.toBeNull();
    expect(fit!.majorRadius).toBeCloseTo(200, 0);
    expect(fit!.minorRadius).toBeCloseTo(80, 0);
  });

  it('recovers axes for a rotated ellipse at rotation=π/2', () => {
    const pts = ellipsePoints(400, 300, 180, 90, Math.PI / 2);
    const fit = fitEllipse(pts);
    expect(fit).not.toBeNull();
    expect(fit!.majorRadius).toBeCloseTo(180, 0);
    expect(fit!.minorRadius).toBeCloseTo(90, 0);
  });

  it('returns null or does not throw on degenerate input (< 5 points)', () => {
    const pts = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }];
    expect(() => fitEllipse(pts)).not.toThrow();
    // Result may be null (singular system) or a degenerate ellipse — just no NaN
    const fit = fitEllipse(pts);
    if (fit !== null) {
      expect(Number.isFinite(fit.majorRadius)).toBe(true);
      expect(Number.isFinite(fit.minorRadius)).toBe(true);
    }
  });

  it('returns null or does not throw for all-equal points', () => {
    const pts = Array.from({ length: 20 }, () => ({ x: 100, y: 100 }));
    expect(() => fitEllipse(pts)).not.toThrow();
  });

  it('majorRadius >= minorRadius is always satisfied', () => {
    for (const [a, b, rot] of [[150, 60, 0], [80, 200, Math.PI / 3], [120, 120, 1.2]] as [number, number, number][]) {
      const pts = ellipsePoints(300, 200, a, b, rot);
      const fit = fitEllipse(pts);
      if (fit) {
        expect(fit.majorRadius).toBeGreaterThanOrEqual(fit.minorRadius);
      }
    }
  });
});

describe('ellipseRadialErrorPixels', () => {
  it('returns 0 for a point exactly on the ellipse', () => {
    const fit = { center: { x: 0, y: 0 }, majorRadius: 100, minorRadius: 50, rotationRadians: 0 };
    // Point at (100, 0) is on the ellipse boundary
    const err = ellipseRadialErrorPixels({ x: 100, y: 0 }, fit);
    expect(err).toBeCloseTo(0, 4);
  });

  it('returns minorRadius for center point', () => {
    const fit = { center: { x: 0, y: 0 }, majorRadius: 100, minorRadius: 50, rotationRadians: 0 };
    const err = ellipseRadialErrorPixels({ x: 0, y: 0 }, fit);
    expect(err).toBeCloseTo(50, 4);
  });
});

describe('ellipseCircumferenceApproximation', () => {
  it('equals 2πr for a circle', () => {
    const r = 100;
    const circ = ellipseCircumferenceApproximation({ majorRadius: r, minorRadius: r });
    expect(circ).toBeCloseTo(2 * Math.PI * r, 4);
  });

  it('is greater than 2π*minorRadius and less than 2π*majorRadius for non-circular ellipse', () => {
    const circ = ellipseCircumferenceApproximation({ majorRadius: 200, minorRadius: 80 });
    expect(circ).toBeGreaterThan(2 * Math.PI * 80);
    expect(circ).toBeLessThan(2 * Math.PI * 200);
  });
});
