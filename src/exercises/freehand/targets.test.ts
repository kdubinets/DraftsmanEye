import { describe, expect, it } from "vitest";
import {
  compoundCurveSamplePoints,
  sCurveSamplePoints,
} from "../../geometry/sCurve";
import { distanceBetween } from "../../geometry/primitives";
import type { FreehandExerciseDefinition } from "../../practice/catalog";
import { createFreehandTarget, createFreehandTargetSequence } from "./targets";
import type { TargetAngle } from "./types";
import type {
  FreehandTarget,
  TargetCompoundCurve,
  TargetSCurve,
} from "./types";

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

describe("createFreehandTarget S-curve trace", () => {
  it("keeps randomized S-curve samples inside the drawing field", () => {
    for (let attempt = 0; attempt < 160; attempt += 1) {
      const target = createFreehandTarget("trace-s-curve");
      expect(target?.kind).toBe("s-curve");
      if (target?.kind !== "s-curve") continue;

      expect(target.referenceLength).toBeGreaterThan(300);
      for (const point of sCurveSamplePoints(target, 100)) {
        expect(point.x).toBeGreaterThanOrEqual(42);
        expect(point.x).toBeLessThanOrEqual(958);
        expect(point.y).toBeGreaterThanOrEqual(42);
        expect(point.y).toBeLessThanOrEqual(578);
      }
    }
  });
});

describe("createFreehandTarget compound curve trace", () => {
  it("keeps randomized compound curve samples inside the drawing field", () => {
    for (let attempt = 0; attempt < 160; attempt += 1) {
      const target = createFreehandTarget("trace-compound-curve");
      expect(target?.kind).toBe("compound-curve");
      if (target?.kind !== "compound-curve") continue;

      expect(target.segments.length).toBeGreaterThanOrEqual(3);
      expect(target.referenceLength).toBeGreaterThan(500);
      for (const point of compoundCurveSamplePoints(target, 40)) {
        expect(point.x).toBeGreaterThanOrEqual(41.99);
        expect(point.x).toBeLessThanOrEqual(958.01);
        expect(point.y).toBeGreaterThanOrEqual(41.99);
        expect(point.y).toBeLessThanOrEqual(578.01);
      }
    }
  });
});

describe("createFreehandTargetSequence", () => {
  it("keeps guided line sequences inside the drawing field", () => {
    for (const kind of ["target-line-two-points", "trace-line"] as const) {
      const sequence = createFreehandTargetSequence(kind, undefined, {
        showDirectionCue: true,
      });

      expect(sequence.targets).toHaveLength(9);
      for (const target of sequence.targets) {
        expect(target.kind).toBe("line");
        expect(pointsForTarget(target).every(pointIsInBounds)).toBe(true);
      }
    }
  });

  it("builds requested sequence progression types", () => {
    expect(createFreehandTargetSequence("trace-line", "angle").label).toBe(
      "Angle ladder",
    );
    expect(
      createFreehandTargetSequence("target-circle-center-point", "position")
        .label,
    ).toBe("Position grid");
    expect(createFreehandTargetSequence("trace-ellipse", "ratio").label).toBe(
      "Ratio ladder",
    );
    expect(createFreehandTargetSequence("trace-s-curve", "rotation").label).toBe(
      "Rotation ladder",
    );
  });

  it("keeps circle and ellipse sequences inside the drawing field", () => {
    for (const kind of [
      "target-circle-center-point",
      "target-circle-three-points",
      "trace-circle",
      "trace-ellipse",
    ] as const) {
      const sequence = createFreehandTargetSequence(kind);

      expect(sequence.targets).toHaveLength(9);
      for (const target of sequence.targets) {
        expect(pointsForTarget(target).every(pointIsInBounds)).toBe(true);
      }
    }
  });

  it("keeps curve and spiral sequences renderable inside the drawing field", () => {
    for (const kind of [
      "trace-spiral-archimedean-left",
      "trace-spiral-archimedean-right",
      "trace-spiral-logarithmic-left",
      "trace-spiral-logarithmic-right",
      "trace-s-curve",
      "trace-compound-curve",
    ] as const) {
      const sequence = createFreehandTargetSequence(kind);

      expect(sequence.targets).toHaveLength(9);
      for (const target of sequence.targets) {
        expect(pointsForTarget(target).every(pointIsInBounds)).toBe(true);
      }
    }
  });
});

function pointsForTarget(target: FreehandTarget): { x: number; y: number }[] {
  switch (target.kind) {
    case "line":
      return [target.start, target.end];
    case "circle":
      return [
        target.center,
        { x: target.center.x - target.radius, y: target.center.y },
        { x: target.center.x + target.radius, y: target.center.y },
        { x: target.center.x, y: target.center.y - target.radius },
        { x: target.center.x, y: target.center.y + target.radius },
        ...target.marks,
      ];
    case "ellipse":
      return ellipseCardinalPoints(target);
    case "spiral":
      return [
        target.center,
        { x: target.center.x - target.outerRadius, y: target.center.y },
        { x: target.center.x + target.outerRadius, y: target.center.y },
        { x: target.center.x, y: target.center.y - target.outerRadius },
        { x: target.center.x, y: target.center.y + target.outerRadius },
      ];
    case "s-curve":
      return sCurvePoints(target);
    case "compound-curve":
      return compoundCurvePoints(target);
    case "angle":
    case "loop-chain-linear":
    case "loop-chain-circular":
    case "loop-chain-wedge":
      return [];
  }
}

function ellipseCardinalPoints(
  target: Extract<FreehandTarget, { kind: "ellipse" }>,
): { x: number; y: number }[] {
  const cos = Math.cos(target.rotationRadians);
  const sin = Math.sin(target.rotationRadians);
  return [
    { x: target.majorRadius, y: 0 },
    { x: -target.majorRadius, y: 0 },
    { x: 0, y: target.minorRadius },
    { x: 0, y: -target.minorRadius },
  ].map((point) => ({
    x: target.center.x + point.x * cos - point.y * sin,
    y: target.center.y + point.x * sin + point.y * cos,
  }));
}

function sCurvePoints(target: TargetSCurve): { x: number; y: number }[] {
  return [target.start, target.control1, target.control2, target.end];
}

function compoundCurvePoints(
  target: TargetCompoundCurve,
): { x: number; y: number }[] {
  return target.segments.flatMap((segment) => [
    segment.start,
    segment.control1,
    segment.control2,
    segment.end,
  ]);
}

function pointIsInBounds(point: { x: number; y: number }): boolean {
  return point.x >= 0 && point.x <= 1000 && point.y >= 0 && point.y <= 620;
}

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
