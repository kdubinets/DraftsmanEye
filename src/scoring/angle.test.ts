import { describe, expect, it } from "vitest";
import { scoreTargetAngle } from "./angle";
import type { FreehandPoint, TargetAngle } from "../exercises/freehand/types";

function pt(x: number, y: number): FreehandPoint {
  return { x, y, time: 0, pressure: 0.5, pointerType: "mouse" };
}

function linePoints(
  start: { x: number; y: number },
  end: { x: number; y: number },
  n = 60,
): FreehandPoint[] {
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    return pt(start.x + (end.x - start.x) * t, start.y + (end.y - start.y) * t);
  });
}

function targetAngle(openingSign: 1 | -1 = 1): TargetAngle {
  const vertex = { x: 500, y: 300 };
  const baseEnd = { x: 730, y: 300 };
  const openingRadians = Math.PI / 3;
  const correctEnd = {
    x: vertex.x + Math.cos(openingRadians * openingSign) * 230,
    y: vertex.y + Math.sin(openingRadians * openingSign) * 230,
  };
  return {
    kind: "angle",
    reference: {
      vertex: { x: 200, y: 300 },
      baseEnd: { x: 350, y: 300 },
      angleEnd: {
        x: 200 + Math.cos(openingRadians * openingSign) * 150,
        y: 300 + Math.sin(openingRadians * openingSign) * 150,
      },
    },
    target: { vertex, baseEnd, correctEnd },
    openingRadians,
    openingSign,
  };
}

describe("scoreTargetAngle", () => {
  it("returns null for too few points", () => {
    expect(
      scoreTargetAngle([pt(500, 300), pt(520, 320)], targetAngle()),
    ).toBeNull();
  });

  it("returns null when the stroke starts too far from the target vertex", () => {
    const target = targetAngle();
    const pts = linePoints({ x: 600, y: 300 }, target.target.correctEnd);
    expect(scoreTargetAngle(pts, target)).toBeNull();
  });

  it("scores a perfect copied angle near 100", () => {
    const target = targetAngle();
    const result = scoreTargetAngle(
      linePoints(target.target.vertex, target.target.correctEnd),
      target,
    )!;
    expect(result.kind).toBe("target-angle");
    expect(result.angleErrorDegrees).toBeCloseTo(0, 6);
    expect(result.score).toBeCloseTo(100, 5);
  });

  it("accepts a copied angle stroke drawn toward the vertex", () => {
    const target = targetAngle();
    const result = scoreTargetAngle(
      linePoints(target.target.correctEnd, target.target.vertex),
      target,
    )!;
    expect(result).not.toBeNull();
    expect(result.angleErrorDegrees).toBeCloseTo(0, 6);
    expect(result.score).toBeCloseTo(100, 5);
  });

  it("reports too-open and too-narrow signed opening errors", () => {
    const target = targetAngle();
    const tooOpenEnd = {
      x: 500 + Math.cos(Math.PI / 2) * 230,
      y: 300 + Math.sin(Math.PI / 2) * 230,
    };
    const tooNarrowEnd = {
      x: 500 + Math.cos(Math.PI / 6) * 230,
      y: 300 + Math.sin(Math.PI / 6) * 230,
    };

    expect(
      scoreTargetAngle(linePoints(target.target.vertex, tooOpenEnd), target)!
        .signedOpenErrorDegrees,
    ).toBeGreaterThan(0);
    expect(
      scoreTargetAngle(linePoints(target.target.vertex, tooNarrowEnd), target)!
        .signedOpenErrorDegrees,
    ).toBeLessThan(0);
  });
});
