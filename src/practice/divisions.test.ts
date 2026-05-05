import { describe, expect, it } from "vitest";
import {
  DIVISION_DIRECTION_BUCKETS,
  bucketDivisionDirectionDegrees,
  bucketDivisionLength,
  directionRadiansForBucket,
  divisionDirectionBucketsForAxis,
  divisionDirectionMetadata,
  divisionDirectionTrackerModel,
  divisionLengthForBucket,
  divisionLengthRange,
  divisionLengthTrackerModel,
  selectDivisionDirectionBucket,
  selectDivisionLengthBucket,
} from "./divisions";
import type { ProgressStore } from "../storage/progress";
import type { TrialLine } from "./catalog";

const NOW = new Date(2026, 4, 1, 12, 0, 0).getTime();
const YESTERDAY = new Date(2026, 3, 30, 23, 59, 0).getTime();

function store(progress: Partial<ProgressStore>): ProgressStore {
  return {
    version: 9,
    attempts: [],
    aggregates: {},
    dimensions: {
      lineAngleBuckets: {},
      lineAngleDegreeBuckets: {},
      angleOpeningBuckets: {},
      divisionLengthBuckets: {},
      divisionDirectionBuckets: {},
      transferLengthBuckets: {},
      transferAngleBuckets: {},
    },
    ...progress,
  };
}

describe("division length buckets", () => {
  it("buckets lengths by normalized position inside the axis range", () => {
    const horizontal = divisionLengthRange("horizontal");
    expect(bucketDivisionLength(horizontal.min, horizontal)).toBe(0);
    expect(bucketDivisionLength(328, horizontal)).toBe(1);
    expect(bucketDivisionLength(376, horizontal)).toBe(2);
    expect(bucketDivisionLength(424, horizontal)).toBe(3);
    expect(bucketDivisionLength(horizontal.max, horizontal)).toBe(4);
  });

  it("generates selected bucket lengths inside each normalized fifth", () => {
    const range = divisionLengthRange("vertical");
    expect(divisionLengthForBucket(0, range, () => 0)).toBe(range.min);
    expect(divisionLengthForBucket(0, range, () => 1)).toBeLessThanOrEqual(392);
    expect(divisionLengthForBucket(4, range, () => 0)).toBeGreaterThanOrEqual(488);
    expect(divisionLengthForBucket(4, range, () => 1)).toBe(range.max);
  });

  it("selects weak or unplayed length buckets from progress", () => {
    const progress = store({
      dimensions: {
        lineAngleBuckets: {},
        lineAngleDegreeBuckets: {},
        angleOpeningBuckets: {},
        divisionLengthBuckets: {
          "division-horizontal-thirds": {
            "0": { ema: 90, attempts: 8, lastPracticedAt: NOW },
            "1": { ema: 90, attempts: 8, lastPracticedAt: NOW },
            "2": { ema: 90, attempts: 8, lastPracticedAt: NOW },
            "4": { ema: 90, attempts: 8, lastPracticedAt: NOW },
          },
        },
        divisionDirectionBuckets: {},
      transferLengthBuckets: {},
      transferAngleBuckets: {},
      },
    });

    expect(
      selectDivisionLengthBucket(
        progress,
        "division-horizontal-thirds",
        () => 0.45,
      ),
    ).toBe(3);
  });
});

describe("division direction buckets", () => {
  it("maps horizontal and vertical measurement directions", () => {
    const horizontal: TrialLine = {
      axis: "horizontal",
      anchorX: 0,
      anchorY: 100,
      startScalar: 20,
      endScalar: 220,
    };
    const vertical: TrialLine = {
      axis: "vertical",
      anchorX: 100,
      anchorY: 0,
      startScalar: 20,
      endScalar: 220,
    };

    expect(divisionDirectionMetadata(horizontal, 1).divisionDirectionBucket).toBe(0);
    expect(divisionDirectionMetadata(horizontal, -1).divisionDirectionBucket).toBe(180);
    expect(divisionDirectionMetadata(vertical, 1).divisionDirectionBucket).toBe(90);
    expect(divisionDirectionMetadata(vertical, -1).divisionDirectionBucket).toBe(270);
  });

  it("wraps directional buckets near zero degrees", () => {
    expect(bucketDivisionDirectionDegrees(356)).toBe(0);
    expect(bucketDivisionDirectionDegrees(-4)).toBe(0);
    expect(bucketDivisionDirectionDegrees(344)).toBe(330);
  });

  it("offers two fixed directions for axis-aligned drills and twelve for random", () => {
    expect(divisionDirectionBucketsForAxis("horizontal")).toEqual([0, 180]);
    expect(divisionDirectionBucketsForAxis("vertical")).toEqual([90, 270]);
    expect(divisionDirectionBucketsForAxis("free")).toEqual(
      DIVISION_DIRECTION_BUCKETS,
    );
  });

  it("jitters selected direction buckets inside the thirty-degree sector", () => {
    expect(directionRadiansForBucket(90, () => 0) * (180 / Math.PI)).toBeCloseTo(75);
    expect(directionRadiansForBucket(90, () => 1) * (180 / Math.PI)).toBeCloseTo(105);
  });

  it("selects from the provided allowed direction buckets", () => {
    const progress = store({
      dimensions: {
        lineAngleBuckets: {},
        lineAngleDegreeBuckets: {},
        angleOpeningBuckets: {},
        divisionLengthBuckets: {},
        divisionDirectionBuckets: {
          "division-horizontal-thirds": {
            "0": { ema: 90, attempts: 8, lastPracticedAt: NOW },
          },
        },
        transferLengthBuckets: {},
      transferAngleBuckets: {},
      },
    });

    expect(
      selectDivisionDirectionBucket(
        progress,
        "division-horizontal-thirds",
        [0, 180],
        () => 0.75,
      ),
    ).toBe(180);
  });
});

describe("division tracker models", () => {
  it("tracks length proficiency and today's attempts", () => {
    const model = divisionLengthTrackerModel(
      store({
        attempts: [
          {
            exerciseId: "division-horizontal-thirds",
            score: 10,
            signedError: 0,
            timestamp: NOW - 1000,
            metadata: { divisionLengthPixels: 310, divisionLengthBucket: 0 },
          },
          {
            exerciseId: "division-horizontal-thirds",
            score: 90,
            signedError: 0,
            timestamp: YESTERDAY,
            metadata: { divisionLengthPixels: 310, divisionLengthBucket: 0 },
          },
        ],
        dimensions: {
          lineAngleBuckets: {},
          lineAngleDegreeBuckets: {},
          angleOpeningBuckets: {},
          divisionLengthBuckets: {
            "division-horizontal-thirds": {
              "0": { ema: 80, attempts: 2, lastPracticedAt: NOW },
            },
          },
          divisionDirectionBuckets: {},
          transferLengthBuckets: {},
      transferAngleBuckets: {},
        },
      }),
      "division-horizontal-thirds",
      NOW,
    );

    expect(model.buckets).toHaveLength(5);
    expect(model.buckets[0]).toMatchObject({
      label: "shortest",
      tone: "low-confidence",
      todayAttempts: 1,
    });
    expect(model.todayTotal).toBe(1);
  });

  it("ranks confident direction buckets by score", () => {
    const model = divisionDirectionTrackerModel(
      store({
        dimensions: {
          lineAngleBuckets: {},
          lineAngleDegreeBuckets: {},
          angleOpeningBuckets: {},
          divisionLengthBuckets: {},
          divisionDirectionBuckets: {
            "division-horizontal-thirds": {
              "0": { ema: 40, attempts: 3, lastPracticedAt: NOW },
              "180": { ema: 90, attempts: 3, lastPracticedAt: NOW },
            },
          },
          transferLengthBuckets: {},
      transferAngleBuckets: {},
        },
      }),
      "division-horizontal-thirds",
      [0, 180],
      NOW,
    );

    expect(model.buckets.find((bucket) => bucket.bucket === "0")?.tone).toBe(
      "weak",
    );
    expect(model.buckets.find((bucket) => bucket.bucket === "180")?.tone).toBe(
      "good",
    );
  });
});
