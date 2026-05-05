import { describe, expect, it } from "vitest";
import type { ProgressStore } from "../storage/progress";
import {
  bucketEllipseAxisRatio,
  bucketEllipseAngle,
  bucketNormalizedSizeRatio,
  circleRadiusMetadata,
  circleRadiusTrackerModel,
  closedShapeCanvasMetrics,
  ellipseSizeMetadata,
  ellipseAngleTrackerModel,
} from "./closedShapeDimensions";

const NOW = new Date(2026, 4, 5, 12).getTime();

function store(partial: Partial<ProgressStore>): ProgressStore {
  return {
    version: 9,
    attempts: [],
    aggregates: {},
    dimensions: {
      lineAngleBuckets: {},
      lineAngleDegreeBuckets: {},
      angleOpeningBuckets: {},
      circleRadiusBuckets: {},
      ellipseAngleBuckets: {},
      ellipseMajorRadiusBuckets: {},
      ellipseAxisRatioBuckets: {},
      divisionLengthBuckets: {},
      divisionDirectionBuckets: {},
      transferLengthBuckets: {},
      transferAngleBuckets: {},
    },
    ...partial,
  };
}

describe("closed shape dimensions", () => {
  it("buckets size ratios into five inspectable ranges", () => {
    expect(bucketNormalizedSizeRatio(0.05)).toBe(0);
    expect(bucketNormalizedSizeRatio(0.2)).toBe(0);
    expect(bucketNormalizedSizeRatio(0.21)).toBe(1);
    expect(bucketNormalizedSizeRatio(0.3)).toBe(2);
    expect(bucketNormalizedSizeRatio(0.4)).toBe(3);
    expect(bucketNormalizedSizeRatio(0.5)).toBe(4);
    expect(bucketNormalizedSizeRatio(0.8)).toBe(4);
  });

  it("uses the drawing field short side for circle and ellipse size ratios", () => {
    const wide = closedShapeCanvasMetrics(1000, 620);
    const square = closedShapeCanvasMetrics(800, 800);
    const tall = closedShapeCanvasMetrics(720, 1200);
    if (!wide || !square || !tall) throw new Error("Expected valid metrics");

    expect(circleRadiusMetadata(124, wide)?.circleRadiusBucket).toBe(0);
    expect(circleRadiusMetadata(160, square)?.circleRadiusBucket).toBe(0);
    expect(circleRadiusMetadata(144, tall)?.circleRadiusBucket).toBe(0);

    expect(ellipseSizeMetadata(248, wide)?.ellipseMajorRadiusBucket).toBe(3);
    expect(ellipseSizeMetadata(320, square)?.ellipseMajorRadiusBucket).toBe(3);
    expect(ellipseSizeMetadata(288, tall)?.ellipseMajorRadiusBucket).toBe(3);
  });

  it("buckets ellipse orientation over an undirected half-turn", () => {
    expect(bucketEllipseAngle(0)).toBe(0);
    expect(bucketEllipseAngle(7)).toBe(0);
    expect(bucketEllipseAngle(8)).toBe(15);
    expect(bucketEllipseAngle(22)).toBe(15);
    expect(bucketEllipseAngle(23)).toBe(30);
    expect(bucketEllipseAngle(172)).toBe(165);
    expect(bucketEllipseAngle(173)).toBe(0);
    expect(bucketEllipseAngle(190)).toBe(15);
    expect(bucketEllipseAngle(-10)).toBe(165);
  });

  it("buckets ellipse axis ratio from narrow to round", () => {
    expect(bucketEllipseAxisRatio(0.1)).toBe(0);
    expect(bucketEllipseAxisRatio(0.25)).toBe(0);
    expect(bucketEllipseAxisRatio(0.5)).toBe(1);
    expect(bucketEllipseAxisRatio(0.75)).toBe(3);
    expect(bucketEllipseAxisRatio(1)).toBe(4);
  });

  it("counts today's circle attempts separately from proficiency", () => {
    const model = circleRadiusTrackerModel(
      store({
        attempts: [
          {
            exerciseId: "freehand-circle",
            score: 10,
            signedError: 0,
            timestamp: NOW,
            metadata: { circleRadiusRatio: 0.25, circleRadiusBucket: 1 },
          },
        ],
        dimensions: {
          lineAngleBuckets: {},
          lineAngleDegreeBuckets: {},
          angleOpeningBuckets: {},
          circleRadiusBuckets: {
            "freehand-circle": {
              "1": { ema: 82, attempts: 1, lastPracticedAt: NOW },
            },
          },
          ellipseAngleBuckets: {},
          ellipseMajorRadiusBuckets: {},
          ellipseAxisRatioBuckets: {},
          divisionLengthBuckets: {},
          divisionDirectionBuckets: {},
          transferLengthBuckets: {},
          transferAngleBuckets: {},
        },
      }),
      "freehand-circle",
      NOW,
    );

    expect(model.todayTotal).toBe(1);
    expect(model.buckets[1].todayAttempts).toBe(1);
    expect(model.buckets[1].aggregate?.ema).toBe(82);
  });

  it("marks confident ellipse orientation buckets by relative proficiency", () => {
    const model = ellipseAngleTrackerModel(
      store({
        dimensions: {
          lineAngleBuckets: {},
          lineAngleDegreeBuckets: {},
          angleOpeningBuckets: {},
          circleRadiusBuckets: {},
          ellipseAngleBuckets: {
            "freehand-ellipse": {
              "0": { ema: 40, attempts: 3, lastPracticedAt: NOW },
              "15": { ema: 60, attempts: 3, lastPracticedAt: NOW },
              "30": { ema: 80, attempts: 3, lastPracticedAt: NOW },
              "45": { ema: 95, attempts: 3, lastPracticedAt: NOW },
            },
          },
          ellipseMajorRadiusBuckets: {},
          ellipseAxisRatioBuckets: {},
          divisionLengthBuckets: {},
          divisionDirectionBuckets: {},
          transferLengthBuckets: {},
          transferAngleBuckets: {},
        },
      }),
      "freehand-ellipse",
      NOW,
    );

    expect(model.buckets[0].tone).toBe("weak");
    expect(model.buckets[1].tone).toBe("developing");
    expect(model.buckets[2].tone).toBe("good");
    expect(model.buckets[3].tone).toBe("strong");
  });
});
