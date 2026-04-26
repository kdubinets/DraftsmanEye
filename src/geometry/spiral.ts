export function spiralSamplePoints(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  turns: number,
  kind: "archimedean" | "logarithmic",
  ySign: 1 | -1,
  steps: number,
): { x: number; y: number }[] {
  const thetaMax = turns * 2 * Math.PI;
  const pts: { x: number; y: number }[] = [];

  if (kind === "archimedean") {
    const b = (outerRadius - innerRadius) / thetaMax;
    for (let i = 0; i <= steps; i++) {
      const theta = (i / steps) * thetaMax;
      const r = innerRadius + b * theta;
      pts.push({ x: cx + r * Math.cos(theta), y: cy + ySign * r * Math.sin(theta) });
    }
  } else {
    const b = Math.log(outerRadius / innerRadius) / thetaMax;
    for (let i = 0; i <= steps; i++) {
      const theta = (i / steps) * thetaMax;
      const r = innerRadius * Math.exp(b * theta);
      pts.push({ x: cx + r * Math.cos(theta), y: cy + ySign * r * Math.sin(theta) });
    }
  }

  return pts;
}

export function spiralPathData(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  turns: number,
  kind: "archimedean" | "logarithmic",
  ySign: 1 | -1,
): string {
  const pts = spiralSamplePoints(cx, cy, innerRadius, outerRadius, turns, kind, ySign, 400);
  if (pts.length === 0) return "";
  return pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
}
