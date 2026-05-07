import { describe, it, expect, vi } from "vitest";
import type { ProgressStore } from "../storage/progress";
import {
  LENGTH_RATIO_BUCKETS,
  bucketLengthRatio,
  clampLengthRatio,
  createLengthRatioTrial,
  lengthRatioRangeForBucket,
  parseLengthRatioInput,
  scoreLengthRatioEstimate,
  selectLengthRatioBucket,
} from "./lengthRatioEstimation";

function progress(partial: Partial<ProgressStore> = {}): ProgressStore {
  return {
    version: 10,
    attempts: [],
    aggregates: {},
    dimensions: {
      lineAngleBuckets: {},
      lineAngleDegreeBuckets: {},
      angleOpeningBuckets: {},
      angleEstimateBuckets: {},
      lengthRatioBuckets: {},
      divisionLengthBuckets: {},
      divisionDirectionBuckets: {},
      transferLengthBuckets: {},
      transferAngleBuckets: {},
    },
    ...partial,
  };
}

describe("length ratio input", () => {
  it("accepts decimals and positive fractions", () => {
    expect(parseLengthRatioInput("2.5")).toBe(2.5);
    expect(parseLengthRatioInput("2/3")).toBeCloseTo(2 / 3, 10);
    expect(parseLengthRatioInput("4")).toBe(4);
  });

  it("rejects invalid or non-positive input", () => {
    expect(parseLengthRatioInput("")).toBeNull();
    expect(parseLengthRatioInput("abc")).toBeNull();
    expect(parseLengthRatioInput("1/0")).toBeNull();
    expect(parseLengthRatioInput("-1")).toBeNull();
  });

  it("clamps generated answer values to the drill range", () => {
    expect(clampLengthRatio(0.1)).toBe(0.25);
    expect(clampLengthRatio(10)).toBe(4);
  });
});

describe("length ratio buckets", () => {
  it("maps reciprocal edge ratios to edge buckets", () => {
    expect(bucketLengthRatio(0.25)).toBe(0);
    expect(bucketLengthRatio(1)).toBe(8);
    expect(bucketLengthRatio(4)).toBe(16);
  });

  it("returns log-spaced generation ranges", () => {
    expect(lengthRatioRangeForBucket(0).min).toBeCloseTo(0.25, 10);
    expect(lengthRatioRangeForBucket(16).max).toBeCloseTo(4, 10);
    expect(lengthRatioRangeForBucket(8)).toMatchObject({
      min: expect.any(Number),
      max: expect.any(Number),
    });
  });

  it("biases selection toward weak and unplayed buckets", () => {
    vi.setSystemTime(1_000_000);
    const aggregates: NonNullable<
      ProgressStore["dimensions"]["lengthRatioBuckets"]
    >["length-ratio-estimate-random-random"] = {};
    for (const bucket of LENGTH_RATIO_BUCKETS) {
      aggregates[String(bucket)] = {
        ema: bucket === 8 ? 5 : 95,
        attempts: 10,
        lastPracticedAt: 1_000_000,
      };
    }
    const selected = selectLengthRatioBucket(
      progress({
        dimensions: {
          lineAngleBuckets: {},
          lineAngleDegreeBuckets: {},
          angleOpeningBuckets: {},
          angleEstimateBuckets: {},
          lengthRatioBuckets: {
            "length-ratio-estimate-random-random": aggregates,
          },
          divisionLengthBuckets: {},
          divisionDirectionBuckets: {},
          transferLengthBuckets: {},
          transferAngleBuckets: {},
        },
      }),
      "length-ratio-estimate-random-random",
      () => 0.5,
    );
    expect(selected).toBe(8);
    vi.useRealTimers();
  });
});

describe("length ratio trials and scoring", () => {
  it("generates target/source ratios inside the selected bucket range", () => {
    const trial = createLengthRatioTrial(
      "length-ratio-estimate-horizontal-aligned",
      progress(),
      () => 0,
    );
    expect(trial.ratioBucket).toBe(0);
    expect(trial.ratio).toBeGreaterThanOrEqual(0.25);
    expect(trial.ratio).toBeLessThanOrEqual(lengthRatioRangeForBucket(0).max);
    expect(trial.target.length / trial.source.length).toBeCloseTo(
      trial.ratio,
      10,
    );
  });

  it("scores reciprocal errors symmetrically with log-ratio error", () => {
    const high = scoreLengthRatioEstimate(2, 1, 100, 200);
    const low = scoreLengthRatioEstimate(0.5, 1, 200, 100);
    expect(high.absoluteLogRatioError).toBeCloseTo(1, 10);
    expect(low.absoluteLogRatioError).toBeCloseTo(1, 10);
    expect(high.score).toBe(low.score);
  });
});
