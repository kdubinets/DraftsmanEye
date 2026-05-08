/** Geometry helpers for sampled S-curve trace guides. */

export type SCurveControlPoints = {
  start: { x: number; y: number };
  control1: { x: number; y: number };
  control2: { x: number; y: number };
  end: { x: number; y: number };
};

export function sCurveSamplePoints(
  curve: SCurveControlPoints,
  steps: number,
): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    pts.push(cubicBezierPoint(curve, i / steps));
  }
  return pts;
}

export function sCurvePathData(curve: SCurveControlPoints): string {
  return [
    `M ${curve.start.x.toFixed(1)} ${curve.start.y.toFixed(1)}`,
    `C ${curve.control1.x.toFixed(1)} ${curve.control1.y.toFixed(1)}`,
    `${curve.control2.x.toFixed(1)} ${curve.control2.y.toFixed(1)}`,
    `${curve.end.x.toFixed(1)} ${curve.end.y.toFixed(1)}`,
  ].join(" ");
}

function cubicBezierPoint(
  curve: SCurveControlPoints,
  t: number,
): { x: number; y: number } {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x:
      a * curve.start.x +
      b * curve.control1.x +
      c * curve.control2.x +
      d * curve.end.x,
    y:
      a * curve.start.y +
      b * curve.control1.y +
      c * curve.control2.y +
      d * curve.end.y,
  };
}
