import { describe, it, expect, vi } from "vitest";
import type { ProgressStore } from "../storage/progress";
import {
  ANGLE_ESTIMATE_BUCKETS,
  angleEstimateRangeForBucket,
  bucketAngleEstimateDegrees,
  createAngleEstimateTrial,
  scoreAngleEstimate,
  selectAngleEstimateBucket,
} from "./angleEstimation";

function progress(partial: Partial<ProgressStore> = {}): ProgressStore {
  return {
    version: 9,
    attempts: [],
    aggregates: {},
    dimensions: {
      lineAngleBuckets: {},
      lineAngleDegreeBuckets: {},
      angleOpeningBuckets: {},
      angleEstimateBuckets: {},
      divisionLengthBuckets: {},
      divisionDirectionBuckets: {},
      transferLengthBuckets: {},
      transferAngleBuckets: {},
    },
    ...partial,
  };
}

describe("angle estimation buckets", () => {
  it("maps edge-expanded ranges into the first and last buckets", () => {
    expect(bucketAngleEstimateDegrees(2)).toBe(5);
    expect(bucketAngleEstimateDegrees(7)).toBe(5);
    expect(bucketAngleEstimateDegrees(8)).toBe(10);
    expect(bucketAngleEstimateDegrees(12)).toBe(10);
    expect(bucketAngleEstimateDegrees(173)).toBe(175);
    expect(bucketAngleEstimateDegrees(178)).toBe(175);
  });

  it("uses nearest-center 5-degree buckets through the middle", () => {
    expect(bucketAngleEstimateDegrees(13)).toBe(15);
    expect(bucketAngleEstimateDegrees(47)).toBe(45);
    expect(bucketAngleEstimateDegrees(48)).toBe(50);
    expect(bucketAngleEstimateDegrees(172)).toBe(170);
  });

  it("returns actual generation ranges for edge and middle buckets", () => {
    expect(angleEstimateRangeForBucket(5)).toEqual({ min: 2, max: 7 });
    expect(angleEstimateRangeForBucket(90)).toEqual({ min: 88, max: 92 });
    expect(angleEstimateRangeForBucket(175)).toEqual({ min: 173, max: 178 });
  });
});

describe("angle estimation target selection", () => {
  it("generates targets within the selected bucket range", () => {
    const trial = createAngleEstimateTrial(
      "angle-estimate-horizontal",
      progress(),
      () => 0,
    );
    expect(trial.targetBucket).toBe(5);
    expect(trial.targetDegrees).toBeGreaterThanOrEqual(2);
    expect(trial.targetDegrees).toBeLessThanOrEqual(7);
    expect(trial.baseRadians).toBe(0);
  });

  it("biases selection toward weak and unplayed buckets", () => {
    vi.setSystemTime(1_000_000);
    const aggregates: NonNullable<
      ProgressStore["dimensions"]["angleEstimateBuckets"]
    >["angle-estimate-random"] = {};
    for (const bucket of ANGLE_ESTIMATE_BUCKETS) {
      aggregates[String(bucket)] = {
        ema: bucket === 90 ? 5 : 95,
        attempts: 10,
        lastPracticedAt: 1_000_000,
      };
    }
    const selected = selectAngleEstimateBucket(
      progress({
        dimensions: {
          lineAngleBuckets: {},
          lineAngleDegreeBuckets: {},
          angleOpeningBuckets: {},
          angleEstimateBuckets: { "angle-estimate-random": aggregates },
          divisionLengthBuckets: {},
          divisionDirectionBuckets: {},
          transferLengthBuckets: {},
          transferAngleBuckets: {},
        },
      }),
      "angle-estimate-random",
      () => 0.5,
    );
    expect(selected).toBe(90);
    vi.useRealTimers();
  });
});

describe("angle estimation scoring", () => {
  it("uses strict linear degree-error scoring", () => {
    expect(scoreAngleEstimate(90, 90)).toMatchObject({
      score: 100,
      signedErrorDegrees: 0,
      absoluteErrorDegrees: 0,
    });
    expect(scoreAngleEstimate(90, 91)).toMatchObject({
      score: 90,
      signedErrorDegrees: 1,
      absoluteErrorDegrees: 1,
    });
    expect(scoreAngleEstimate(90, 85)).toMatchObject({
      score: 50,
      signedErrorDegrees: -5,
      absoluteErrorDegrees: 5,
    });
    expect(scoreAngleEstimate(90, 100)).toMatchObject({
      score: 0,
      signedErrorDegrees: 10,
      absoluteErrorDegrees: 10,
    });
  });
});
