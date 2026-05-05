import { describe, expect, it } from "vitest";
import { angleOpeningTrackerModel } from "./angleOpeningTracker";
import type { ProgressStore } from "../storage/progress";

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

describe("angleOpeningTrackerModel", () => {
  it("uses gray cells for buckets without proficiency data", () => {
    const model = angleOpeningTrackerModel(
      store({}),
      "angle-copy-horizontal-aligned",
      NOW,
    );
    expect(model.buckets[0]).toMatchObject({
      bucket: 10,
      tone: "empty",
      todayAttempts: 0,
      todayOpacity: 0,
      todayHeightPercent: 0,
    });
  });

  it("marks buckets with fewer than three counted attempts as low confidence", () => {
    const model = angleOpeningTrackerModel(
      store({
        dimensions: {
          lineAngleBuckets: {},
          lineAngleDegreeBuckets: {},
          angleOpeningBuckets: {
            "angle-copy-horizontal-aligned": {
              "30": { ema: 90, attempts: 2, lastPracticedAt: NOW },
            },
          },
          divisionLengthBuckets: {},
          divisionDirectionBuckets: {},
      transferLengthBuckets: {},
      transferAngleBuckets: {},
        },
      }),
      "angle-copy-horizontal-aligned",
      NOW,
    );

    expect(model.buckets.find((bucket) => bucket.bucket === 30)?.tone).toBe(
      "low-confidence",
    );
  });

  it("colors confident buckets by relative score rank", () => {
    const model = angleOpeningTrackerModel(
      store({
        dimensions: {
          lineAngleBuckets: {},
          lineAngleDegreeBuckets: {},
          angleOpeningBuckets: {
            "angle-copy-horizontal-aligned": {
              "30": { ema: 40, attempts: 3, lastPracticedAt: NOW },
              "40": { ema: 60, attempts: 3, lastPracticedAt: NOW },
              "50": { ema: 80, attempts: 3, lastPracticedAt: NOW },
              "60": { ema: 95, attempts: 3, lastPracticedAt: NOW },
            },
          },
          divisionLengthBuckets: {},
          divisionDirectionBuckets: {},
      transferLengthBuckets: {},
      transferAngleBuckets: {},
        },
      }),
      "angle-copy-horizontal-aligned",
      NOW,
    );

    expect(model.buckets.find((bucket) => bucket.bucket === 30)?.tone).toBe(
      "weak",
    );
    expect(model.buckets.find((bucket) => bucket.bucket === 40)?.tone).toBe(
      "developing",
    );
    expect(model.buckets.find((bucket) => bucket.bucket === 50)?.tone).toBe(
      "good",
    );
    expect(model.buckets.find((bucket) => bucket.bucket === 60)?.tone).toBe(
      "strong",
    );
  });

  it("counts today's completed angle attempts separately from proficiency", () => {
    const model = angleOpeningTrackerModel(
      store({
        attempts: [
          {
            exerciseId: "angle-copy-horizontal-aligned",
            score: 0,
            signedError: 0,
            timestamp: NOW - 1000,
            metadata: { angleOpeningDegrees: 87, angleOpeningBucket: 90 },
          },
          {
            exerciseId: "angle-copy-horizontal-aligned",
            score: 90,
            signedError: 0,
            timestamp: NOW - 2000,
            metadata: { angleOpeningDegrees: 92, angleOpeningBucket: 90 },
          },
          {
            exerciseId: "angle-copy-horizontal-aligned",
            score: 90,
            signedError: 0,
            timestamp: YESTERDAY,
            metadata: { angleOpeningDegrees: 92, angleOpeningBucket: 90 },
          },
          {
            exerciseId: "angle-copy-vertical-aligned",
            score: 90,
            signedError: 0,
            timestamp: NOW - 3000,
            metadata: { angleOpeningDegrees: 92, angleOpeningBucket: 90 },
          },
        ],
      }),
      "angle-copy-horizontal-aligned",
      NOW,
    );

    const bucket = model.buckets.find((entry) => entry.bucket === 90);
    expect(model.todayTotal).toBe(2);
    expect(bucket?.todayAttempts).toBe(2);
    expect(bucket?.todayOpacity).toBe(0.58);
    expect(bucket?.todayHeightPercent).toBe(64);
  });

  it("caps total today progress at fifty attempts", () => {
    const attempts = Array.from({ length: 51 }, (_, index) => ({
      exerciseId: "angle-copy-horizontal-aligned" as const,
      score: 80,
      signedError: 0,
      timestamp: NOW - index,
      metadata: { angleOpeningDegrees: 90, angleOpeningBucket: 90 },
    }));
    const model = angleOpeningTrackerModel(
      store({ attempts }),
      "angle-copy-horizontal-aligned",
      NOW,
    );

    expect(model.todayTotal).toBe(51);
    expect(model.todayProgress).toBe(1);
  });
});
