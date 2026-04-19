/**
 * Algebraic least-squares ellipse fit via normal equations, plus helpers that measure
 * how closely a point lies to a fitted ellipse surface.
 *
 * Fits ax² + bxy + cy² + dx + ey = 1, then extracts (center, semi-axes, rotation)
 * via eigendecomposition of the quadratic form.
 */
import { solveLinearSystem } from './linearAlgebra';
import type { Point } from './primitives';

export type EllipseFit = {
  center: Point;
  majorRadius: number;
  minorRadius: number;
  rotationRadians: number;
};

export function fitEllipse(points: Point[]): EllipseFit | null {
  const C = Array.from({ length: 5 }, () => Array<number>(5).fill(0));
  const b = Array<number>(5).fill(0);

  for (const p of points) {
    const row = [p.x * p.x, p.x * p.y, p.y * p.y, p.x, p.y];
    for (let r = 0; r < 5; r += 1) {
      b[r] += row[r];
      for (let c = 0; c < 5; c += 1) {
        C[r][c] += row[r] * row[c];
      }
    }
  }

  const sol = solveLinearSystem(C, b);
  if (!sol) {
    return null;
  }

  const [a, bCoef, c, d, e] = sol;
  const f = -1;
  const disc = bCoef * bCoef - 4 * a * c;
  // Negative discriminant is required for an ellipse (not a hyperbola or parabola).
  if (disc >= 0) {
    return null;
  }

  const center = {
    x: (2 * c * d - bCoef * e) / disc,
    y: (2 * a * e - bCoef * d) / disc,
  };
  const k =
    a * center.x * center.x +
    bCoef * center.x * center.y +
    c * center.y * center.y +
    d * center.x +
    e * center.y +
    f;

  const cross = bCoef / 2;
  const tr = (a + c) / 2;
  const sp = Math.hypot((a - c) / 2, cross);
  const l1 = tr + sp;
  const l2 = tr - sp;
  const r1sq = -k / l1;
  const r2sq = -k / l2;

  if (
    !Number.isFinite(r1sq) ||
    !Number.isFinite(r2sq) ||
    r1sq <= 0 ||
    r2sq <= 0
  ) {
    return null;
  }

  const r1 = Math.sqrt(r1sq);
  const r2 = Math.sqrt(r2sq);
  const angle1 = eigenvectorAngle(a, cross, c, l1);
  const angle2 = eigenvectorAngle(a, cross, c, l2);

  return r1 >= r2
    ? { center, majorRadius: r1, minorRadius: r2, rotationRadians: angle1 }
    : { center, majorRadius: r2, minorRadius: r1, rotationRadians: angle2 };
}

// Perpendicular distance from a point to the ellipse surface in the radial direction.
export function ellipseRadialErrorPixels(
  point: Point,
  ellipse: EllipseFit,
): number {
  const cos = Math.cos(ellipse.rotationRadians);
  const sin = Math.sin(ellipse.rotationRadians);
  const dx = point.x - ellipse.center.x;
  const dy = point.y - ellipse.center.y;
  const lx = dx * cos + dy * sin;
  const ly = -dx * sin + dy * cos;
  const dist = Math.hypot(lx, ly);

  if (dist === 0) {
    return ellipse.minorRadius;
  }

  const dc = lx / dist;
  const ds = ly / dist;
  const r =
    1 /
    Math.sqrt(
      (dc * dc) / (ellipse.majorRadius * ellipse.majorRadius) +
        (ds * ds) / (ellipse.minorRadius * ellipse.minorRadius),
    );

  return Math.abs(dist - r);
}

// Ramanujan's second approximation; accurate to ~0.1% across practical axis ratios.
export function ellipseCircumferenceApproximation(ellipse: {
  majorRadius: number;
  minorRadius: number;
}): number {
  const h =
    ((ellipse.majorRadius - ellipse.minorRadius) *
      (ellipse.majorRadius - ellipse.minorRadius)) /
    ((ellipse.majorRadius + ellipse.minorRadius) *
      (ellipse.majorRadius + ellipse.minorRadius));
  return (
    Math.PI *
    (ellipse.majorRadius + ellipse.minorRadius) *
    (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)))
  );
}

function eigenvectorAngle(
  a: number,
  cross: number,
  c: number,
  eigenvalue: number,
): number {
  if (Math.abs(cross) > 1e-9) {
    return Math.atan2(eigenvalue - a, cross);
  }
  return Math.abs(a - eigenvalue) <= Math.abs(c - eigenvalue) ? 0 : Math.PI / 2;
}
