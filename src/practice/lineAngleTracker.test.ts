import { describe, expect, it } from "vitest";
import { lineAngleTrackerModel } from "./lineAngleTracker";
import type { ProgressStore } from "../storage/progress";

const NOW = new Date(2026, 4, 1, 12, 0, 0).getTime();
const YESTERDAY = new Date(2026, 3, 30, 23, 59, 0).getTime();

function store(progress: Partial<ProgressStore>): ProgressStore {
  return {
    version: 5,
    attempts: [],
    aggregates: {},
    dimensions: {
      lineAngleBuckets: {},
      lineAngleDegreeBuckets: {},
      angleOpeningBuckets: {},
    },
    ...progress,
  };
}

describe("lineAngleTrackerModel", () => {
  it("uses gray sectors for buckets without proficiency data", () => {
    const model = lineAngleTrackerModel(store({}), "trace-line", NOW);
    expect(model.buckets[0]).toMatchObject({
      bucket: 0,
      tone: "empty",
      todayAttempts: 0,
      todayOpacity: 0,
    });
  });

  it("marks buckets with fewer than three counted attempts as low confidence", () => {
    const model = lineAngleTrackerModel(
      store({
        dimensions: {
          lineAngleBuckets: {
            "trace-line": {
              "0": { ema: 90, attempts: 2, lastPracticedAt: NOW },
            },
          },
          lineAngleDegreeBuckets: {},
          angleOpeningBuckets: {},
        },
      }),
      "trace-line",
      NOW,
    );

    expect(model.buckets.find((bucket) => bucket.bucket === 0)?.tone).toBe(
      "low-confidence",
    );
  });

  it("colors confident buckets by relative score rank", () => {
    const model = lineAngleTrackerModel(
      store({
        dimensions: {
          lineAngleBuckets: {
            "trace-line": {
              "0": { ema: 40, attempts: 3, lastPracticedAt: NOW },
              "10": { ema: 60, attempts: 3, lastPracticedAt: NOW },
              "20": { ema: 80, attempts: 3, lastPracticedAt: NOW },
              "30": { ema: 95, attempts: 3, lastPracticedAt: NOW },
            },
          },
          lineAngleDegreeBuckets: {},
          angleOpeningBuckets: {},
        },
      }),
      "trace-line",
      NOW,
    );

    expect(model.buckets.find((bucket) => bucket.bucket === 0)?.tone).toBe(
      "weak",
    );
    expect(model.buckets.find((bucket) => bucket.bucket === 10)?.tone).toBe(
      "developing",
    );
    expect(model.buckets.find((bucket) => bucket.bucket === 20)?.tone).toBe(
      "good",
    );
    expect(model.buckets.find((bucket) => bucket.bucket === 30)?.tone).toBe(
      "strong",
    );
  });

  it("counts today's completed line attempts separately from proficiency", () => {
    const model = lineAngleTrackerModel(
      store({
        attempts: [
          {
            exerciseId: "trace-line",
            score: 0,
            signedError: 0,
            timestamp: NOW - 1000,
            metadata: { lineAngleDegrees: 87, lineAngleBucket: 90 },
          },
          {
            exerciseId: "trace-line",
            score: 90,
            signedError: 0,
            timestamp: NOW - 2000,
            metadata: { lineAngleDegrees: 92, lineAngleBucket: 90 },
          },
          {
            exerciseId: "trace-line",
            score: 90,
            signedError: 0,
            timestamp: YESTERDAY,
            metadata: { lineAngleDegrees: 92, lineAngleBucket: 90 },
          },
          {
            exerciseId: "freehand-straight-line",
            score: 90,
            signedError: 0,
            timestamp: NOW - 3000,
            metadata: { lineAngleDegrees: 92, lineAngleBucket: 90 },
          },
        ],
      }),
      "trace-line",
      NOW,
    );

    const bucket = model.buckets.find((entry) => entry.bucket === 90);
    expect(model.todayTotal).toBe(2);
    expect(bucket?.todayAttempts).toBe(2);
    expect(bucket?.todayOpacity).toBe(0.55);
  });

  it("scales the center fill to strong blue at fifty attempts", () => {
    const attempts = Array.from({ length: 50 }, (_, index) => ({
      exerciseId: "trace-line" as const,
      score: 80,
      signedError: 0,
      timestamp: NOW - index,
      metadata: { lineAngleDegrees: 0, lineAngleBucket: 0 },
    }));
    const model = lineAngleTrackerModel(store({ attempts }), "trace-line", NOW);

    expect(model.todayTotal).toBe(50);
    expect(model.centerFill).toBe("rgba(47, 85, 125, 0.780)");
  });
});
