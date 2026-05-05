import { describe, expect, it } from "vitest";
import { distanceBetween } from "../../geometry/primitives";
import type { FreehandExerciseDefinition } from "../../practice/catalog";
import { createFreehandTarget } from "./targets";
import type { TargetAngle } from "./types";

const ANGLE_COPY_KINDS: FreehandExerciseDefinition["kind"][] = [
  "angle-copy-horizontal-aligned",
  "angle-copy-vertical-aligned",
  "angle-copy-horizontal-rotated",
  "angle-copy-vertical-rotated",
  "angle-copy-arbitrary-aligned",
  "angle-copy-arbitrary-rotated",
];

const ANGLE_CONSTRUCT_KINDS: FreehandExerciseDefinition["kind"][] = [
  "angle-construct-horizontal",
  "angle-construct-vertical",
  "angle-construct-arbitrary",
];

describe("createFreehandTarget angle copy", () => {
  it("keeps all angle-copy rays inside a padded drawing field", () => {
    for (const kind of ANGLE_COPY_KINDS) {
      for (let attempt = 0; attempt < 120; attempt += 1) {
        const target = createFreehandTarget(kind);
        expect(target?.kind).toBe("angle");
        const angle = target as TargetAngle;

        for (const point of anglePoints(angle)) {
          expect(point.x).toBeGreaterThanOrEqual(70);
          expect(point.x).toBeLessThanOrEqual(930);
          expect(point.y).toBeGreaterThanOrEqual(62);
          expect(point.y).toBeLessThanOrEqual(558);
        }

        expect(
          distanceBetween(angle.target.vertex, angle.target.correctEnd),
        ).toBeGreaterThanOrEqual(220);
      }
    }
  });
});

describe("createFreehandTarget angle construction", () => {
  it("keeps construction rays inside a padded drawing field", () => {
    for (const kind of ANGLE_CONSTRUCT_KINDS) {
      for (let attempt = 0; attempt < 120; attempt += 1) {
        const target = createFreehandTarget(kind);
        expect(target?.kind).toBe("angle");
        const angle = target as TargetAngle;

        expect(angle.showReference).toBe(false);
        expect(angle.requestedDegrees).toBeGreaterThanOrEqual(2);
        expect(angle.requestedDegrees).toBeLessThanOrEqual(178);
        for (const point of [
          angle.target.vertex,
          angle.target.baseEnd,
          angle.target.correctEnd,
        ]) {
          expect(point.x).toBeGreaterThanOrEqual(70);
          expect(point.x).toBeLessThanOrEqual(930);
          expect(point.y).toBeGreaterThanOrEqual(62);
          expect(point.y).toBeLessThanOrEqual(558);
        }
      }
    }
  });

  it("uses angle-estimation bucket ranges", () => {
    for (const bucket of [5, 45, 90, 135, 175]) {
      for (let attempt = 0; attempt < 50; attempt += 1) {
        const target = createFreehandTarget("angle-construct-horizontal", {
          angleEstimateBucket: bucket,
        });
        expect(target?.kind).toBe("angle");
        const degrees = (target as TargetAngle).requestedDegrees;
        expect(degrees).toBeDefined();
        if (bucket === 5) {
          expect(degrees).toBeGreaterThanOrEqual(2);
          expect(degrees).toBeLessThanOrEqual(7);
        } else if (bucket === 175) {
          expect(degrees).toBeGreaterThanOrEqual(173);
          expect(degrees).toBeLessThanOrEqual(178);
        } else {
          expect(degrees).toBeGreaterThanOrEqual(bucket - 2);
          expect(degrees).toBeLessThanOrEqual(bucket + 2);
        }
      }
    }
  });
});

describe("createFreehandTarget line direction", () => {
  it("keeps directional line targets inside the drawing field", () => {
    for (const kind of ["target-line-two-points", "trace-line"] as const) {
      for (const bucket of [0, 90, 180, 270, 350]) {
        for (let attempt = 0; attempt < 40; attempt += 1) {
          const target = createFreehandTarget(kind, {
            lineAngleBucket: bucket,
            showDirectionCue: true,
          });
          expect(target?.kind).toBe("line");
          if (target?.kind !== "line") continue;

          expect(target.showDirectionCue).toBe(true);
          for (const point of [target.start, target.end]) {
            expect(point.x).toBeGreaterThanOrEqual(48);
            expect(point.x).toBeLessThanOrEqual(952);
            expect(point.y).toBeGreaterThanOrEqual(48);
            expect(point.y).toBeLessThanOrEqual(572);
          }
        }
      }
    }
  });
});

function anglePoints(target: TargetAngle): { x: number; y: number }[] {
  return [
    target.reference.vertex,
    target.reference.baseEnd,
    target.reference.angleEnd,
    target.target.vertex,
    target.target.baseEnd,
    target.target.correctEnd,
  ];
}
