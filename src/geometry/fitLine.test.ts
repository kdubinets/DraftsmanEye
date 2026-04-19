import { describe, it, expect } from 'vitest';
import { fitLine } from './fitLine';

/** Sample points along a line: y = slope*x + intercept, evenly spaced. */
function linePoints(
  start: { x: number; y: number },
  end: { x: number; y: number },
  n = 50,
) {
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    return { x: start.x + t * (end.x - start.x), y: start.y + t * (end.y - start.y) };
  });
}

describe('fitLine', () => {
  it('returns null for fewer than 2 points', () => {
    expect(fitLine([])).toBeNull();
    expect(fitLine([{ x: 0, y: 0 }])).toBeNull();
  });

  it('fits perfectly collinear points with near-zero residual', () => {
    const pts = linePoints({ x: 100, y: 50 }, { x: 500, y: 50 });
    const fit = fitLine(pts);
    expect(fit).not.toBeNull();
    expect(fit!.meanErrorPixels).toBeCloseTo(0, 8);
    expect(fit!.maxErrorPixels).toBeCloseTo(0, 8);
  });

  it('direction is parallel to input for horizontal line', () => {
    const pts = linePoints({ x: 0, y: 100 }, { x: 400, y: 100 });
    const fit = fitLine(pts)!;
    // direction should be (1, 0) or (-1, 0)
    expect(Math.abs(fit.direction.x)).toBeCloseTo(1, 10);
    expect(Math.abs(fit.direction.y)).toBeCloseTo(0, 10);
  });

  it('direction is parallel to input for vertical line', () => {
    const pts = linePoints({ x: 200, y: 0 }, { x: 200, y: 400 });
    const fit = fitLine(pts)!;
    expect(Math.abs(fit.direction.x)).toBeCloseTo(0, 10);
    expect(Math.abs(fit.direction.y)).toBeCloseTo(1, 10);
  });

  it('orientation invariance: same residual after 90° rotation', () => {
    const pts = linePoints({ x: 100, y: 50 }, { x: 500, y: 200 }, 40);
    // Rotate 90° around origin
    const rotated = pts.map((p) => ({ x: -p.y, y: p.x }));

    const fitOrig = fitLine(pts)!;
    const fitRot = fitLine(rotated)!;

    expect(fitOrig.meanErrorPixels).toBeCloseTo(fitRot.meanErrorPixels, 8);
    expect(fitOrig.maxErrorPixels).toBeCloseTo(fitRot.maxErrorPixels, 8);
  });

  it('fitStart and fitEnd are on the fitted line', () => {
    const pts = linePoints({ x: 50, y: 50 }, { x: 450, y: 250 });
    const fit = fitLine(pts)!;
    const { centroid, direction, fitStart, fitEnd } = fit;

    // A point is on the line through centroid in direction dir if its cross product with dir is 0
    const crossStart = (fitStart.x - centroid.x) * direction.y - (fitStart.y - centroid.y) * direction.x;
    const crossEnd = (fitEnd.x - centroid.x) * direction.y - (fitEnd.y - centroid.y) * direction.x;
    expect(Math.abs(crossStart)).toBeCloseTo(0, 8);
    expect(Math.abs(crossEnd)).toBeCloseTo(0, 8);
  });

  it('direction is a unit vector', () => {
    const pts = linePoints({ x: 0, y: 0 }, { x: 300, y: 400 });
    const fit = fitLine(pts)!;
    const len = Math.hypot(fit.direction.x, fit.direction.y);
    expect(len).toBeCloseTo(1, 10);
  });
});
