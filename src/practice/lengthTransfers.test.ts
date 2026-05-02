import { describe, expect, it } from "vitest";
import type { ProgressStore } from "../storage/progress";
import {
  bucketTransferAngleDegrees,
  bucketTransferLength,
  selectTransferLengthBucket,
  transferAngleTrackerModel,
  transferLengthRange,
  transferLengthTrackerModel,
  transferTargetDistanceForBucket,
} from "./lengthTransfers";

const NOW = new Date(2026, 4, 1, 12, 0, 0).getTime();

function store(progress: Partial<ProgressStore>): ProgressStore {
  return {
    version: 8,
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

describe("transfer length buckets", () => {
  it("buckets copy target distances within the generated range", () => {
    const range = transferLengthRange("copy");
    expect(bucketTransferLength(130, range)).toBe(0);
    expect(bucketTransferLength(149, range)).toBe(0);
    expect(bucketTransferLength(150, range)).toBe(1);
    expect(bucketTransferLength(229, range)).toBe(4);
    expect(bucketTransferLength(230, range)).toBe(4);
  });

  it("clamps values outside the generated range", () => {
    const range = transferLengthRange("double");
    expect(bucketTransferLength(50, range)).toBe(0);
    expect(bucketTransferLength(400, range)).toBe(4);
  });

  it("buckets undirected transfer angles over a half-turn", () => {
    expect(bucketTransferAngleDegrees(0)).toBe(0);
    expect(bucketTransferAngleDegrees(14)).toBe(0);
    expect(bucketTransferAngleDegrees(15)).toBe(30);
    expect(bucketTransferAngleDegrees(89)).toBe(90);
    expect(bucketTransferAngleDegrees(166)).toBe(0);
    expect(bucketTransferAngleDegrees(181)).toBe(0);
  });

  it("generates selected target distances inside each normalized fifth", () => {
    const range = transferLengthRange("double");
    expect(transferTargetDistanceForBucket(0, range, () => 0)).toBe(190);
    expect(
      transferTargetDistanceForBucket(0, range, () => 0.95),
    ).toBeLessThan(214);
    expect(transferTargetDistanceForBucket(2, range, () => 0)).toBe(238);
    expect(transferTargetDistanceForBucket(4, range, () => 1)).toBe(310);
  });

  it("biases selection toward weak and unplayed buckets", () => {
    const progress = store({
      dimensions: {
        lineAngleBuckets: {},
        lineAngleDegreeBuckets: {},
        angleOpeningBuckets: {},
        divisionLengthBuckets: {},
        divisionDirectionBuckets: {},
        transferLengthBuckets: {
          "copy-horizontal-horizontal": {
            "0": { ema: 95, attempts: 12, lastPracticedAt: NOW },
            "1": { ema: 95, attempts: 12, lastPracticedAt: NOW },
            "2": { ema: 20, attempts: 12, lastPracticedAt: NOW },
            "3": { ema: 95, attempts: 12, lastPracticedAt: NOW },
            "4": { ema: 95, attempts: 12, lastPracticedAt: NOW },
          },
        },
        transferAngleBuckets: {},
      },
    });
    expect(
      selectTransferLengthBucket(progress, "copy-horizontal-horizontal", () => 0.5),
    ).toBe(2);
  });
});

describe("transferLengthTrackerModel", () => {
  it("reports empty, low-confidence, ranked, and today buckets", () => {
    const progress = store({
      attempts: [
        {
          exerciseId: "copy-horizontal-horizontal",
          score: 80,
          signedError: 0,
          timestamp: NOW - 60_000,
          metadata: { transferLengthPixels: 160, transferLengthBucket: 1 },
        },
      ],
      dimensions: {
        lineAngleBuckets: {},
        lineAngleDegreeBuckets: {},
        angleOpeningBuckets: {},
        divisionLengthBuckets: {},
        divisionDirectionBuckets: {},
        transferLengthBuckets: {
          "copy-horizontal-horizontal": {
            "1": { ema: 80, attempts: 1, lastPracticedAt: NOW },
            "2": { ema: 40, attempts: 3, lastPracticedAt: NOW },
            "3": { ema: 90, attempts: 3, lastPracticedAt: NOW },
          },
        },
        transferAngleBuckets: {},
      },
    });
    const model = transferLengthTrackerModel(
      progress,
      "copy-horizontal-horizontal",
      NOW,
    );
    expect(model.buckets[0].tone).toBe("empty");
    expect(model.buckets[1].tone).toBe("low-confidence");
    expect(model.buckets[1].todayAttempts).toBe(1);
    expect(model.buckets[2].tone).toBe("weak");
    expect(model.buckets[3].tone).toBe("good");
    expect(model.todayTotal).toBe(1);
    expect(model.todayProgress).toBeCloseTo(1 / 50);
  });

  it("caps total today progress at the daily target", () => {
    const attempts = Array.from({ length: 70 }, () => ({
      exerciseId: "copy-horizontal-horizontal" as const,
      score: 80,
      signedError: 0,
      timestamp: NOW - 60_000,
      metadata: { transferLengthPixels: 160, transferLengthBucket: 1 },
    }));
    const model = transferLengthTrackerModel(
      store({ attempts }),
      "copy-horizontal-horizontal",
      NOW,
    );
    expect(model.todayTotal).toBe(70);
    expect(model.todayProgress).toBe(1);
  });

  it("tracks transfer angle proficiency and today's attempts", () => {
    const progress = store({
      attempts: [
        {
          exerciseId: "copy-random-random",
          score: 80,
          signedError: 0,
          timestamp: NOW - 60_000,
          metadata: { transferAngleDegrees: 88, transferAngleBucket: 90 },
        },
      ],
      dimensions: {
        lineAngleBuckets: {},
        lineAngleDegreeBuckets: {},
        angleOpeningBuckets: {},
        divisionLengthBuckets: {},
        divisionDirectionBuckets: {},
        transferLengthBuckets: {},
        transferAngleBuckets: {
          "copy-random-random": {
            "90": { ema: 72, attempts: 3, lastPracticedAt: NOW },
          },
        },
      },
    });
    const model = transferAngleTrackerModel(progress, "copy-random-random", NOW);
    expect(model.buckets).toHaveLength(6);
    expect(model.buckets.find((bucket) => bucket.bucket === "90")).toMatchObject({
      todayAttempts: 1,
      tone: "weak",
    });
  });
});
