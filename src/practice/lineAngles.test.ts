import { describe, expect, it } from "vitest";
import {
  LINE_ANGLE_BUCKETS,
  bucketLineAngleDegrees,
  directionlessLineAngleDegrees,
  lineAngleMetadataFromPoints,
  selectLineAngleBucket,
} from "./lineAngles";
import type { ProgressStore } from "../storage/progress";

function progressWithBuckets(
  buckets: Record<string, { ema: number; attempts: number }>,
): ProgressStore {
  return {
    version: 3,
    attempts: [],
    aggregates: {},
    dimensions: {
      lineAngleBuckets: {
        "target-line-two-points": Object.fromEntries(
          Object.entries(buckets).map(([bucket, value]) => [
            bucket,
            {
              ...value,
              lastPracticedAt: Date.now(),
            },
          ]),
        ),
      },
    },
  };
}

describe("line angle buckets", () => {
  it("normalizes opposite line directions to the same angle", () => {
    expect(directionlessLineAngleDegrees({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(
      0,
    );
    expect(
      directionlessLineAngleDegrees({ x: 10, y: 0 }, { x: 0, y: 0 }),
    ).toBe(0);
  });

  it("buckets to nearest 10 degrees with wraparound at 180", () => {
    expect(bucketLineAngleDegrees(4)).toBe(0);
    expect(bucketLineAngleDegrees(86)).toBe(90);
    expect(bucketLineAngleDegrees(178)).toBe(0);
    expect(bucketLineAngleDegrees(-6)).toBe(170);
  });

  it("creates metadata from line endpoints", () => {
    expect(
      lineAngleMetadataFromPoints({ x: 0, y: 0 }, { x: 10, y: 10 }),
    ).toMatchObject({
      lineAngleDegrees: 45,
      lineAngleBucket: 50,
    });
  });
});

describe("selectLineAngleBucket", () => {
  it("uses deterministic weighted selection with injected random", () => {
    const buckets = Object.fromEntries(
      LINE_ANGLE_BUCKETS.map((bucket) => [
        String(bucket),
        { ema: bucket === 20 ? 10 : 95, attempts: 8 },
      ]),
    );
    const progress = progressWithBuckets(buckets);

    expect(
      selectLineAngleBucket(progress, "target-line-two-points", () => 0.12),
    ).toBe(20);
  });
});
