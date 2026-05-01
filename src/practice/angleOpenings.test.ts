import { describe, expect, it } from "vitest";
import {
  ANGLE_OPENING_BUCKETS,
  bucketAngleOpeningDegrees,
  clampAngleOpeningDegrees,
  selectAngleOpeningBucket,
} from "./angleOpenings";
import type { ProgressStore } from "../storage/progress";

function progressWithBuckets(
  buckets: Record<string, { ema: number; attempts: number; lastPracticedAt: number }>,
): ProgressStore {
  return {
    version: 6,
    attempts: [],
    aggregates: {},
    dimensions: {
      lineAngleBuckets: {},
      lineAngleDegreeBuckets: {},
      angleOpeningBuckets: {
        "angle-copy-horizontal-aligned": buckets,
      },
      divisionLengthBuckets: {},
      divisionDirectionBuckets: {},
    },
  };
}

describe("angle opening buckets", () => {
  it("covers ten through one hundred seventy degrees", () => {
    expect(ANGLE_OPENING_BUCKETS[0]).toBe(10);
    expect(ANGLE_OPENING_BUCKETS.at(-1)).toBe(170);
    expect(ANGLE_OPENING_BUCKETS).toHaveLength(17);
  });

  it("clamps values outside the supported angle range", () => {
    expect(clampAngleOpeningDegrees(0)).toBe(5);
    expect(clampAngleOpeningDegrees(180)).toBe(175);
  });

  it("rounds openings to the nearest ten-degree bucket", () => {
    expect(bucketAngleOpeningDegrees(5)).toBe(10);
    expect(bucketAngleOpeningDegrees(10)).toBe(10);
    expect(bucketAngleOpeningDegrees(14)).toBe(10);
    expect(bucketAngleOpeningDegrees(15)).toBe(20);
    expect(bucketAngleOpeningDegrees(65)).toBe(70);
    expect(bucketAngleOpeningDegrees(74.9)).toBe(70);
    expect(bucketAngleOpeningDegrees(75)).toBe(80);
    expect(bucketAngleOpeningDegrees(170)).toBe(170);
    expect(bucketAngleOpeningDegrees(175)).toBe(170);
  });
});

describe("selectAngleOpeningBucket", () => {
  it("biases toward unplayed buckets", () => {
    const played = Object.fromEntries(
      ANGLE_OPENING_BUCKETS.map((bucket) => [
        String(bucket),
        { ema: 90, attempts: 8, lastPracticedAt: Date.now() },
      ]),
    );
    delete played["80"];
    const progress = progressWithBuckets(played);

    expect(
      selectAngleOpeningBucket(
        progress,
        "angle-copy-horizontal-aligned",
        () => 0.45,
      ),
    ).toBe(80);
  });

  it("keeps selected buckets inside the supported range", () => {
    const progress = progressWithBuckets({});
    expect(
      ANGLE_OPENING_BUCKETS,
    ).toContain(
      selectAngleOpeningBucket(
        progress,
        "angle-copy-horizontal-aligned",
        () => 0.99,
      ),
    );
  });
});
