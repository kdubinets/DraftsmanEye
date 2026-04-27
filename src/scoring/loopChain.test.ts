/** Regression tests for loop-chain band use and loop quality scoring. */
import { describe, expect, it } from "vitest";
import { scoreLoopChainCircular, scoreLoopChainLinear } from "./loopChain";
import type { FreehandPoint } from "../exercises/freehand/types";

describe("loop chain scoring", () => {
  it("penalizes linear loops that stay too small inside the band", () => {
    const target = {
      kind: "loop-chain-linear" as const,
      centerY: 300,
      bandHalf: 100,
    };
    const points = loopChainPoints({
      centerY: target.centerY,
      radius: 28,
      count: 4,
      xStart: 220,
      xStep: 120,
    });

    const result = scoreLoopChainLinear(points, target);

    expect(result).not.toBeNull();
    expect(result!.containmentPercent).toBe(100);
    expect(result!.bandTouchPercent).toBeLessThan(40);
    expect(result!.bandScore).toBeLessThan(result!.containmentPercent!);
  });

  it("penalizes circular loops that stay too small inside the ring", () => {
    const target = {
      kind: "loop-chain-circular" as const,
      center: { x: 500, y: 310 },
      innerRadius: 150,
      outerRadius: 350,
    };
    const points = circularLoopChainPoints({
      targetCenter: target.center,
      pathRadius: 250,
      loopRadius: 28,
      count: 5,
    });

    const result = scoreLoopChainCircular(points, target);

    expect(result).not.toBeNull();
    expect(result!.containmentPercent).toBe(100);
    expect(result!.bandTouchPercent).toBeLessThan(40);
    expect(result!.bandScore).toBeLessThan(result!.containmentPercent!);
  });
});

function loopChainPoints(options: {
  centerY: number;
  radius: number;
  count: number;
  xStart: number;
  xStep: number;
}): FreehandPoint[] {
  const points: FreehandPoint[] = [];
  for (let loop = 0; loop < options.count; loop += 1) {
    const cx = options.xStart + loop * options.xStep;
    appendLoop(points, cx, options.centerY, options.radius);
  }
  return points;
}

function circularLoopChainPoints(options: {
  targetCenter: { x: number; y: number };
  pathRadius: number;
  loopRadius: number;
  count: number;
}): FreehandPoint[] {
  const points: FreehandPoint[] = [];
  for (let loop = 0; loop < options.count; loop += 1) {
    const angle = loop * 0.34;
    const cx = options.targetCenter.x + Math.cos(angle) * options.pathRadius;
    const cy = options.targetCenter.y + Math.sin(angle) * options.pathRadius;
    appendLoop(points, cx, cy, options.loopRadius);
  }
  return points;
}

function appendLoop(
  points: FreehandPoint[],
  cx: number,
  cy: number,
  radius: number,
): void {
  const startTime = points.length;
  for (let i = 0; i <= 34; i += 1) {
    const t = (i / 34) * Math.PI * 2.18;
    points.push({
      x: cx + Math.cos(t) * radius,
      y: cy + Math.sin(t) * radius,
      time: startTime + i,
      pressure: 0.5,
      pointerType: "mouse",
    });
  }
}
