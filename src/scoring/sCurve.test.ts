import { describe, expect, it } from "vitest";
import { sCurveSamplePoints } from "../geometry/sCurve";
import { createFreehandTarget } from "../exercises/freehand/targets";
import { scoreTraceSCurve } from "./sCurve";
import type { FreehandPoint } from "../exercises/freehand/types";

describe("scoreTraceSCurve", () => {
  it("scores points sampled from the target S-curve as accurate", () => {
    const target = createFreehandTarget("trace-s-curve");
    expect(target?.kind).toBe("s-curve");
    if (target?.kind !== "s-curve") return;

    const points: FreehandPoint[] = sCurveSamplePoints(target, 64).map(
      (point, index) => ({
        ...point,
        time: index * 16,
        pressure: 0.5,
        pointerType: "pen",
      }),
    );
    const result = scoreTraceSCurve(points, target);

    expect(result).not.toBeNull();
    expect(result?.score).toBeGreaterThan(99);
    expect(result?.meanErrorPixels).toBeLessThan(0.5);
  });
});
