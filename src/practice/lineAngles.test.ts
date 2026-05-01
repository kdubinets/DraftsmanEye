import { describe, expect, it } from "vitest";
import {
  LINE_ANGLE_BUCKETS,
  bucketLineAngleDegrees,
  directionalLineAngleDegrees,
  lineAngleMetadataFromPoints,
  normalizeDirectionalAngleDegrees,
  selectLineAngleBucket,
} from "./lineAngles";
import type { ProgressStore } from "../storage/progress";

function progressWithBuckets(
  buckets: Record<string, { ema: number; attempts: number }>,
): ProgressStore {
  return {
    version: 6,
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
      lineAngleDegreeBuckets: {},
      angleOpeningBuckets: {},
      divisionLengthBuckets: {},
      divisionDirectionBuckets: {},
    },
  };
}

describe("line angle buckets", () => {
  it("keeps opposite line directions separate", () => {
    expect(directionalLineAngleDegrees({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(
      0,
    );
    expect(
      directionalLineAngleDegrees({ x: 10, y: 0 }, { x: 0, y: 0 }),
    ).toBe(180);
  });

  it("normalizes to directional degrees", () => {
    expect(normalizeDirectionalAngleDegrees(0)).toBe(0);
    expect(normalizeDirectionalAngleDegrees(180)).toBe(180);
    expect(normalizeDirectionalAngleDegrees(356)).toBe(356);
    expect(normalizeDirectionalAngleDegrees(-4)).toBe(356);
    expect(normalizeDirectionalAngleDegrees(-90)).toBe(270);
  });

  it("buckets to nearest 10 degrees with wraparound at 360", () => {
    expect(bucketLineAngleDegrees(0)).toBe(0);
    expect(bucketLineAngleDegrees(4)).toBe(0);
    expect(bucketLineAngleDegrees(178)).toBe(180);
    expect(bucketLineAngleDegrees(180)).toBe(180);
    expect(bucketLineAngleDegrees(356)).toBe(0);
    expect(bucketLineAngleDegrees(-4)).toBe(0);
    expect(bucketLineAngleDegrees(-90)).toBe(270);
  });

  it("creates metadata from line endpoints", () => {
    expect(
      lineAngleMetadataFromPoints({ x: 0, y: 0 }, { x: 10, y: 10 }),
    ).toMatchObject({
      lineAngleDegrees: 45,
      lineAngleBucket: 50,
    });
  });

  it("uses 36 buckets over the full circle", () => {
    expect(LINE_ANGLE_BUCKETS).toHaveLength(36);
    expect(LINE_ANGLE_BUCKETS.at(-1)).toBe(350);
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
