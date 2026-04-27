/** Scoring for loop chain exercises (band containment and full loop detection variants). */
import { distanceBetween, clampNumber } from "../geometry/primitives";
import { fitLine } from "../geometry/fitLine";
import { fitCircle } from "../geometry/fitCircle";
import { detectLoops } from "../geometry/loopDetection";
import type { FreehandPoint } from "../exercises/freehand/types";
import type {
  LoopChainBandResult,
  LoopChainScoredResult,
  TargetLoopChainLinear,
  TargetLoopChainCircular,
  TargetLoopChainWedge,
} from "../exercises/freehand/types";
import type { DetectedLoop } from "../geometry/loopDetection";

function strokeLength(points: FreehandPoint[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i += 1) {
    len += distanceBetween(points[i - 1], points[i]);
  }
  return len;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / values.length;
  return Math.sqrt(variance);
}

function bandScore(
  containmentPercent: number,
  bandTouchPercent: number,
): number {
  return clampNumber(
    0.55 * containmentPercent + 0.45 * bandTouchPercent,
    0,
    100,
  );
}

function emptyLoopChainResult(
  len: number,
  pointCount: number,
  band?: {
    bandScore: number;
    containmentPercent: number;
    bandTouchPercent: number;
  },
): LoopChainScoredResult {
  return {
    kind: "loop-chain-scored",
    score: band ? band.bandScore * 0.5 : 0,
    loopQualityScore: 0,
    ...(band ?? {}),
    loopCount: 0,
    meanLoopRadius: 0,
    radiusConsistencyScore: 0,
    roundnessScore: 0,
    pathAdherenceScore: 0,
    centerLineDeviationPixels: 0,
    loopCenters: [],
    strokeLengthPixels: len,
    pointCount,
  };
}

function loopQualityScore(
  loops: DetectedLoop[],
  adherence: number,
): {
  score: number;
  meanRadius: number;
  consistency: number;
  roundness: number;
} {
  const radii = loops.map((l) => l.radius);
  const meanRadius = radii.reduce((a, b) => a + b, 0) / radii.length;
  const consistency =
    meanRadius > 0
      ? clampNumber(100 - (stdDev(radii) / meanRadius) * 100, 0, 100)
      : 0;
  const roundness =
    (loops.reduce((a, l) => a + l.circularity, 0) / loops.length) * 100;
  const score = clampNumber(
    0.3 * roundness + 0.35 * consistency + 0.35 * adherence,
    0,
    100,
  );
  return { score, meanRadius, consistency, roundness };
}

function combinedGuidedScore(loopQuality: number, band: number): number {
  return clampNumber(0.5 * loopQuality + 0.5 * band, 0, 100);
}

export function scoreBandContainmentLinear(
  points: FreehandPoint[],
  target: TargetLoopChainLinear,
): LoopChainBandResult | null {
  const len = strokeLength(points);
  if (len < 200 || points.length < 20) return null;

  const containmentPercent = linearContainmentPercent(points, target);

  return {
    kind: "loop-chain-band",
    score: containmentPercent,
    containmentPercent,
    strokeLengthPixels: len,
    pointCount: points.length,
  };
}

export function scoreBandContainmentCircular(
  points: FreehandPoint[],
  target: TargetLoopChainCircular,
): LoopChainBandResult | null {
  const len = strokeLength(points);
  if (len < 200 || points.length < 20) return null;

  const containmentPercent = circularContainmentPercent(points, target);

  return {
    kind: "loop-chain-band",
    score: containmentPercent,
    containmentPercent,
    strokeLengthPixels: len,
    pointCount: points.length,
  };
}

function linearContainmentPercent(
  points: FreehandPoint[],
  target: TargetLoopChainLinear,
): number {
  let inCount = 0;
  for (const p of points) {
    if (Math.abs(p.y - target.centerY) <= target.bandHalf) inCount += 1;
  }
  return (inCount / points.length) * 100;
}

function circularContainmentPercent(
  points: FreehandPoint[],
  target: TargetLoopChainCircular,
): number {
  let inCount = 0;
  for (const p of points) {
    const d = distanceBetween(p, target.center);
    if (d >= target.innerRadius && d <= target.outerRadius) inCount += 1;
  }
  return (inCount / points.length) * 100;
}

function linearBandTouchPercent(
  loops: DetectedLoop[],
  target: TargetLoopChainLinear,
): number {
  if (loops.length === 0) return 0;
  const top = target.centerY - target.bandHalf;
  const bottom = target.centerY + target.bandHalf;
  const scores = loops.map((loop) => {
    const ys = loop.points.map((p) => p.y);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return bandExtentScore(minY - top, bottom - maxY, target.bandHalf);
  });
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function circularBandTouchPercent(
  loops: DetectedLoop[],
  target: TargetLoopChainCircular,
): number {
  if (loops.length === 0) return 0;
  const halfBand = (target.outerRadius - target.innerRadius) / 2;
  const scores = loops.map((loop) => {
    const distances = loop.points.map((p) => distanceBetween(p, target.center));
    const minR = Math.min(...distances);
    const maxR = Math.max(...distances);
    return bandExtentScore(
      minR - target.innerRadius,
      target.outerRadius - maxR,
      halfBand,
    );
  });
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function bandExtentScore(
  nearEdgeGap: number,
  farEdgeGap: number,
  halfBand: number,
): number {
  const tolerance = Math.max(halfBand * 0.35, 12);
  const near = clampNumber(1 - Math.max(nearEdgeGap, 0) / tolerance, 0, 1);
  const far = clampNumber(1 - Math.max(farEdgeGap, 0) / tolerance, 0, 1);
  return ((near + far) / 2) * 100;
}

export function scoreLoopChainFreehand(
  points: FreehandPoint[],
): LoopChainScoredResult | null {
  const len = strokeLength(points);
  if (len < 200 || points.length < 20) return null;

  const loops = detectLoops(points);
  if (loops.length === 0) {
    return emptyLoopChainResult(len, points.length);
  }

  const radii = loops.map((l) => l.radius);
  const mean = radii.reduce((a, b) => a + b, 0) / radii.length;
  const consistency =
    mean > 0 ? clampNumber(100 - (stdDev(radii) / mean) * 100, 0, 100) : 0;
  const roundness =
    (loops.reduce((a, l) => a + l.circularity, 0) / loops.length) * 100;
  const score = clampNumber(0.5 * roundness + 0.5 * consistency, 0, 100);

  return {
    kind: "loop-chain-scored",
    score,
    loopQualityScore: score,
    loopCount: loops.length,
    meanLoopRadius: mean,
    radiusConsistencyScore: consistency,
    roundnessScore: roundness,
    pathAdherenceScore: 0,
    centerLineDeviationPixels: 0,
    loopCenters: loops.map((l) => l.center),
    strokeLengthPixels: len,
    pointCount: points.length,
  };
}

export function scoreLoopChainLinear(
  points: FreehandPoint[],
  target: TargetLoopChainLinear,
): LoopChainScoredResult | null {
  const len = strokeLength(points);
  if (len < 200 || points.length < 20) return null;

  const loops = detectLoops(points);
  const containmentPercent = linearContainmentPercent(points, target);
  const bandTouchPercent = linearBandTouchPercent(loops, target);
  const band = {
    bandScore: bandScore(containmentPercent, bandTouchPercent),
    containmentPercent,
    bandTouchPercent,
  };
  if (loops.length === 0) {
    return emptyLoopChainResult(len, points.length, band);
  }

  const centers = loops.map((l) => l.center);
  const lineFit = fitLine(centers);
  let adherence = 50;
  let deviation = 0;
  if (lineFit && target.bandHalf > 0) {
    deviation = lineFit.meanErrorPixels;
    adherence = clampNumber(100 - (deviation / target.bandHalf) * 100, 0, 100);
  }

  const quality = loopQualityScore(loops, adherence);

  return {
    kind: "loop-chain-scored",
    score: combinedGuidedScore(quality.score, band.bandScore),
    loopQualityScore: quality.score,
    ...band,
    loopCount: loops.length,
    meanLoopRadius: quality.meanRadius,
    radiusConsistencyScore: quality.consistency,
    roundnessScore: quality.roundness,
    pathAdherenceScore: adherence,
    centerLineDeviationPixels: deviation,
    loopCenters: centers,
    strokeLengthPixels: len,
    pointCount: points.length,
  };
}

export function scoreLoopChainCircular(
  points: FreehandPoint[],
  target: TargetLoopChainCircular,
): LoopChainScoredResult | null {
  const len = strokeLength(points);
  if (len < 200 || points.length < 20) return null;

  const loops = detectLoops(points);
  const containmentPercent = circularContainmentPercent(points, target);
  const bandTouchPercent = circularBandTouchPercent(loops, target);
  const band = {
    bandScore: bandScore(containmentPercent, bandTouchPercent),
    containmentPercent,
    bandTouchPercent,
  };
  if (loops.length === 0) {
    return emptyLoopChainResult(len, points.length, band);
  }

  const centers = loops.map((l) => l.center);
  const halfBand = (target.outerRadius - target.innerRadius) / 2;
  let adherence = 50;
  let deviation = 0;

  if (centers.length >= 3) {
    const circleFit = fitCircle(centers);
    if (circleFit && halfBand > 0) {
      let totalDev = 0;
      for (const c of centers) {
        totalDev += Math.abs(
          distanceBetween(c, circleFit.center) - circleFit.radius,
        );
      }
      deviation = totalDev / centers.length;
      adherence = clampNumber(100 - (deviation / halfBand) * 100, 0, 100);
    }
  } else if (centers.length > 0 && halfBand > 0) {
    // Too few loops for circle fit — measure distance from target center path.
    const midRadius = (target.innerRadius + target.outerRadius) / 2;
    let totalDev = 0;
    for (const c of centers) {
      totalDev += Math.abs(distanceBetween(c, target.center) - midRadius);
    }
    deviation = totalDev / centers.length;
    adherence = clampNumber(100 - (deviation / halfBand) * 100, 0, 100);
  }

  const quality = loopQualityScore(loops, adherence);

  return {
    kind: "loop-chain-scored",
    score: combinedGuidedScore(quality.score, band.bandScore),
    loopQualityScore: quality.score,
    ...band,
    loopCount: loops.length,
    meanLoopRadius: quality.meanRadius,
    radiusConsistencyScore: quality.consistency,
    roundnessScore: quality.roundness,
    pathAdherenceScore: adherence,
    centerLineDeviationPixels: deviation,
    loopCenters: centers,
    strokeLengthPixels: len,
    pointCount: points.length,
  };
}

export function scoreBandContainmentWedge(
  points: FreehandPoint[],
  target: TargetLoopChainWedge,
): LoopChainBandResult | null {
  const len = strokeLength(points);
  if (len < 200 || points.length < 20) return null;

  const containmentPercent = wedgeContainmentPercent(points, target);
  return {
    kind: "loop-chain-band",
    score: containmentPercent,
    containmentPercent,
    strokeLengthPixels: len,
    pointCount: points.length,
  };
}

function wedgeContainmentPercent(
  points: FreehandPoint[],
  target: TargetLoopChainWedge,
): number {
  let inside = 0;
  for (const p of points) {
    const halfBand = wedgeHalfBandAtX(target, p.x);
    if (Math.abs(p.y - target.centerY) <= halfBand) inside += 1;
  }
  return (inside / points.length) * 100;
}

function wedgeBandTouchPercent(
  loops: DetectedLoop[],
  target: TargetLoopChainWedge,
): number {
  if (loops.length === 0) return 0;
  const scores = loops.map((loop) => {
    const centerX =
      loop.points.reduce((sum, p) => sum + p.x, 0) / loop.points.length;
    const halfBand = wedgeHalfBandAtX(target, centerX);
    const top = target.centerY - halfBand;
    const bottom = target.centerY + halfBand;
    const ys = loop.points.map((p) => p.y);
    return bandExtentScore(
      Math.min(...ys) - top,
      bottom - Math.max(...ys),
      halfBand,
    );
  });
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function wedgeHalfBandAtX(target: TargetLoopChainWedge, x: number): number {
  const t = clampNumber(x / 1000, 0, 1);
  return target.bandHalfLeft + (target.bandHalfRight - target.bandHalfLeft) * t;
}

export function scoreLoopChainWedge(
  points: FreehandPoint[],
  target: TargetLoopChainWedge,
): LoopChainScoredResult | null {
  const len = strokeLength(points);
  if (len < 200 || points.length < 20) return null;

  const loops = detectLoops(points);
  const containmentPercent = wedgeContainmentPercent(points, target);
  const bandTouchPercent = wedgeBandTouchPercent(loops, target);
  const band = {
    bandScore: bandScore(containmentPercent, bandTouchPercent),
    containmentPercent,
    bandTouchPercent,
  };
  if (loops.length === 0) {
    return emptyLoopChainResult(len, points.length, band);
  }

  const centers = loops.map((l) => l.center);
  const meanBandHalf = (target.bandHalfLeft + target.bandHalfRight) / 2;
  const lineFit = fitLine(centers);
  let adherence = 50;
  let deviation = 0;
  if (lineFit && meanBandHalf > 0) {
    deviation = lineFit.meanErrorPixels;
    adherence = clampNumber(100 - (deviation / meanBandHalf) * 100, 0, 100);
  }

  const quality = loopQualityScore(loops, adherence);

  return {
    kind: "loop-chain-scored",
    score: combinedGuidedScore(quality.score, band.bandScore),
    loopQualityScore: quality.score,
    ...band,
    loopCount: loops.length,
    meanLoopRadius: quality.meanRadius,
    radiusConsistencyScore: quality.consistency,
    roundnessScore: quality.roundness,
    pathAdherenceScore: adherence,
    centerLineDeviationPixels: deviation,
    loopCenters: centers,
    strokeLengthPixels: len,
    pointCount: points.length,
  };
}
