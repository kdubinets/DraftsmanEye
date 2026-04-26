/** Scoring for loop chain exercises (band containment and full loop detection variants). */
import { distanceBetween, clampNumber } from '../geometry/primitives';
import { fitLine } from '../geometry/fitLine';
import { fitCircle } from '../geometry/fitCircle';
import { detectLoops } from '../geometry/loopDetection';
import type { FreehandPoint } from '../exercises/freehand/types';
import type {
  LoopChainBandResult,
  LoopChainScoredResult,
  TargetLoopChainLinear,
  TargetLoopChainCircular,
} from '../exercises/freehand/types';

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

export function scoreBandContainmentLinear(
  points: FreehandPoint[],
  target: TargetLoopChainLinear,
): LoopChainBandResult | null {
  const len = strokeLength(points);
  if (len < 200 || points.length < 20) return null;

  let inCount = 0;
  for (const p of points) {
    if (Math.abs(p.y - target.centerY) <= target.bandHalf) inCount += 1;
  }
  const containmentPercent = (inCount / points.length) * 100;

  return {
    kind: 'loop-chain-band',
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

  let inCount = 0;
  for (const p of points) {
    const d = distanceBetween(p, target.center);
    if (d >= target.innerRadius && d <= target.outerRadius) inCount += 1;
  }
  const containmentPercent = (inCount / points.length) * 100;

  return {
    kind: 'loop-chain-band',
    score: containmentPercent,
    containmentPercent,
    strokeLengthPixels: len,
    pointCount: points.length,
  };
}

export function scoreLoopChainFreehand(
  points: FreehandPoint[],
): LoopChainScoredResult | null {
  const len = strokeLength(points);
  if (len < 200 || points.length < 20) return null;

  const loops = detectLoops(points);
  if (loops.length === 0) {
    return {
      kind: 'loop-chain-scored',
      score: 0,
      loopCount: 0,
      meanLoopRadius: 0,
      radiusConsistencyScore: 0,
      roundnessScore: 0,
      pathAdherenceScore: 0,
      centerLineDeviationPixels: 0,
      loopCenters: [],
      strokeLengthPixels: len,
      pointCount: points.length,
    };
  }

  const radii = loops.map((l) => l.radius);
  const mean = radii.reduce((a, b) => a + b, 0) / radii.length;
  const consistency = mean > 0
    ? clampNumber(100 - (stdDev(radii) / mean) * 100, 0, 100)
    : 0;
  const roundness = (loops.reduce((a, l) => a + l.circularity, 0) / loops.length) * 100;
  const score = clampNumber(0.5 * roundness + 0.5 * consistency, 0, 100);

  return {
    kind: 'loop-chain-scored',
    score,
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
  if (loops.length === 0) {
    return {
      kind: 'loop-chain-scored',
      score: 0,
      loopCount: 0,
      meanLoopRadius: 0,
      radiusConsistencyScore: 0,
      roundnessScore: 0,
      pathAdherenceScore: 0,
      centerLineDeviationPixels: 0,
      loopCenters: [],
      strokeLengthPixels: len,
      pointCount: points.length,
    };
  }

  const radii = loops.map((l) => l.radius);
  const mean = radii.reduce((a, b) => a + b, 0) / radii.length;
  const consistency = mean > 0
    ? clampNumber(100 - (stdDev(radii) / mean) * 100, 0, 100)
    : 0;
  const roundness = (loops.reduce((a, l) => a + l.circularity, 0) / loops.length) * 100;

  const centers = loops.map((l) => l.center);
  const lineFit = fitLine(centers);
  let adherence = 50;
  let deviation = 0;
  if (lineFit && target.bandHalf > 0) {
    deviation = lineFit.meanErrorPixels;
    adherence = clampNumber(100 - (deviation / target.bandHalf) * 100, 0, 100);
  }

  const score = clampNumber(
    0.3 * roundness + 0.35 * consistency + 0.35 * adherence,
    0,
    100,
  );

  return {
    kind: 'loop-chain-scored',
    score,
    loopCount: loops.length,
    meanLoopRadius: mean,
    radiusConsistencyScore: consistency,
    roundnessScore: roundness,
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
  if (loops.length === 0) {
    return {
      kind: 'loop-chain-scored',
      score: 0,
      loopCount: 0,
      meanLoopRadius: 0,
      radiusConsistencyScore: 0,
      roundnessScore: 0,
      pathAdherenceScore: 0,
      centerLineDeviationPixels: 0,
      loopCenters: [],
      strokeLengthPixels: len,
      pointCount: points.length,
    };
  }

  const radii = loops.map((l) => l.radius);
  const mean = radii.reduce((a, b) => a + b, 0) / radii.length;
  const consistency = mean > 0
    ? clampNumber(100 - (stdDev(radii) / mean) * 100, 0, 100)
    : 0;
  const roundness = (loops.reduce((a, l) => a + l.circularity, 0) / loops.length) * 100;

  const centers = loops.map((l) => l.center);
  const halfBand = (target.outerRadius - target.innerRadius) / 2;
  let adherence = 50;
  let deviation = 0;

  if (centers.length >= 3) {
    const circleFit = fitCircle(centers);
    if (circleFit && halfBand > 0) {
      let totalDev = 0;
      for (const c of centers) {
        totalDev += Math.abs(distanceBetween(c, circleFit.center) - circleFit.radius);
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

  const score = clampNumber(
    0.3 * roundness + 0.35 * consistency + 0.35 * adherence,
    0,
    100,
  );

  return {
    kind: 'loop-chain-scored',
    score,
    loopCount: loops.length,
    meanLoopRadius: mean,
    radiusConsistencyScore: consistency,
    roundnessScore: roundness,
    pathAdherenceScore: adherence,
    centerLineDeviationPixels: deviation,
    loopCenters: centers,
    strokeLengthPixels: len,
    pointCount: points.length,
  };
}
