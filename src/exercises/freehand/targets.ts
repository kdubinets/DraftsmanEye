/** Trial target geometry generation for target and trace exercise variants. */
import {
  distanceBetween,
  randomRange,
  pointOnCircle,
} from "../../geometry/primitives";
import {
  compoundCurveSamplePoints,
  sCurveSamplePoints,
} from "../../geometry/sCurve";
import { clampAngleOpeningDegrees } from "../../practice/angleOpenings";
import {
  angleEstimateRangeForBucket,
  bucketAngleEstimateDegrees,
} from "../../practice/angleEstimation";
import type { FreehandExerciseDefinition } from "../../practice/catalog";
import type {
  FreehandTarget,
  FreehandTargetSequence,
  TargetLine,
  TargetCircle,
  TargetEllipse,
  TargetAngle,
  TargetLoopChainLinear,
  TargetLoopChainCircular,
  TargetLoopChainWedge,
  TargetSpiral,
  TargetCompoundCurve,
  TargetSCurve,
} from "./types";

type TraceCurveKind =
  | "trace-s-curve"
  | "trace-compound-curve"
  | "trace-spiral-archimedean-left"
  | "trace-spiral-archimedean-right"
  | "trace-spiral-logarithmic-left"
  | "trace-spiral-logarithmic-right";

type GuidedSequenceKind =
  | "target-line-two-points"
  | "trace-line"
  | "target-circle-center-point"
  | "target-circle-three-points"
  | "trace-circle"
  | "trace-ellipse"
  | TraceCurveKind;

export function createFreehandTarget(
  kind: FreehandExerciseDefinition["kind"],
  options: {
    lineAngleBucket?: number;
    showDirectionCue?: boolean;
    angleOpeningBucket?: number;
    angleEstimateBucket?: number;
  } = {},
): FreehandTarget | null {
  switch (kind) {
    case "target-line-two-points":
      return createTargetLine(
        options.lineAngleBucket,
        options.showDirectionCue,
      );
    case "trace-line":
      return {
        ...createTargetLine(options.lineAngleBucket, options.showDirectionCue),
        trace: true,
      };
    case "target-circle-center-point":
      return createTargetCircle(1);
    case "target-circle-three-points":
      return createTargetCircle(3);
    case "trace-circle":
      return createTraceCircle();
    case "trace-ellipse":
      return createTraceEllipse();
    case "angle-copy-horizontal-aligned":
      return createTargetAngle(
        "horizontal",
        "aligned",
        options.angleOpeningBucket,
      );
    case "angle-copy-vertical-aligned":
      return createTargetAngle(
        "vertical",
        "aligned",
        options.angleOpeningBucket,
      );
    case "angle-copy-horizontal-rotated":
      return createTargetAngle(
        "horizontal",
        "rotated",
        options.angleOpeningBucket,
      );
    case "angle-copy-vertical-rotated":
      return createTargetAngle(
        "vertical",
        "rotated",
        options.angleOpeningBucket,
      );
    case "angle-copy-arbitrary-aligned":
      return createTargetAngle(
        "arbitrary",
        "aligned",
        options.angleOpeningBucket,
      );
    case "angle-copy-arbitrary-rotated":
      return createTargetAngle(
        "arbitrary",
        "rotated",
        options.angleOpeningBucket,
      );
    case "angle-construct-horizontal":
      return createConstructAngle("horizontal", options.angleEstimateBucket);
    case "angle-construct-vertical":
      return createConstructAngle("vertical", options.angleEstimateBucket);
    case "angle-construct-arbitrary":
      return createConstructAngle("arbitrary", options.angleEstimateBucket);
    case "loop-chain-linear":
    case "loop-chain-linear-scored":
      return createLoopChainLinearTarget();
    case "loop-chain-circular":
    case "loop-chain-circular-scored":
      return createLoopChainCircularTarget();
    case "loop-chain-wedge":
    case "loop-chain-wedge-scored":
      return createLoopChainWedgeTarget();
    case "trace-spiral-archimedean-left":
      return createTraceSpiral("archimedean", "left");
    case "trace-spiral-archimedean-right":
      return createTraceSpiral("archimedean", "right");
    case "trace-spiral-logarithmic-left":
      return createTraceSpiral("logarithmic", "left");
    case "trace-spiral-logarithmic-right":
      return createTraceSpiral("logarithmic", "right");
    case "trace-s-curve":
      return createTraceSCurve();
    case "trace-compound-curve":
      return createTraceCompoundCurve();
    case "freehand-circle":
    case "freehand-ellipse":
    case "freehand-line":
    case "loop-chain-freehand":
      return null;
  }
}

export function createFreehandTargetSequence(
  kind: GuidedSequenceKind,
  key?: string,
  options: {
    lineAngleBucket?: number;
    showDirectionCue?: boolean;
  } = {},
): FreehandTargetSequence {
  switch (kind) {
    case "target-line-two-points":
    case "trace-line":
      return createLineSequence(kind === "trace-line", key, options);
    case "target-circle-center-point":
      return createCircleSequence(1, false, key);
    case "target-circle-three-points":
      return createCircleSequence(3, false, key);
    case "trace-circle":
      return createCircleSequence(1, true, key);
    case "trace-ellipse":
      return createEllipseSequence(key);
    case "trace-spiral-archimedean-left":
      return createSpiralSequence("archimedean", "left");
    case "trace-spiral-archimedean-right":
      return createSpiralSequence("archimedean", "right");
    case "trace-spiral-logarithmic-left":
      return createSpiralSequence("logarithmic", "left");
    case "trace-spiral-logarithmic-right":
      return createSpiralSequence("logarithmic", "right");
    case "trace-s-curve":
      return createSCurveSequence(key);
    case "trace-compound-curve":
      return createCompoundCurveSequence();
  }
}

const SPIRAL_CANVAS_W = 1000;
const SPIRAL_CANVAS_H = 620;
const SPIRAL_MARGIN = 30;
const S_CURVE_MARGIN = 42;
const LINE_CANVAS_W = 1000;
const LINE_CANVAS_H = 620;
const LINE_MARGIN = 48;

const SEQUENCE_STEPS = [-4, -3, -2, -1, 0, 1, 2, 3, 4] as const;

function createLineSequence(
  trace: boolean,
  key: string | undefined,
  options: { lineAngleBucket?: number; showDirectionCue?: boolean },
): FreehandTargetSequence {
  const setKind = sequenceKind(key, ["parallel", "angle", "length"]);
  const baseAngle =
    options.lineAngleBucket === undefined
      ? randomRange(-0.18, 0.18)
      : (options.lineAngleBucket * Math.PI) / 180;
  const showDirectionCue = options.showDirectionCue ?? false;

  if (setKind === "angle") {
    return {
      key: "angle",
      label: "Angle ladder",
      restartLabel: "Restart",
      targets: SEQUENCE_STEPS.map((step) =>
        lineTargetFromGeometry({
          angle: baseAngle + (step * 3 * Math.PI) / 180,
          center: { x: LINE_CANVAS_W / 2, y: LINE_CANVAS_H / 2 },
          length: 430,
          trace,
          showDirectionCue,
        }),
      ),
    };
  }

  if (setKind === "length") {
    return {
      key: "length",
      label: "Length ladder",
      restartLabel: "Restart",
      targets: SEQUENCE_STEPS.map((step) =>
        lineTargetFromGeometry({
          angle: baseAngle,
          center: { x: LINE_CANVAS_W / 2, y: LINE_CANVAS_H / 2 },
          length: 420 + step * 18,
          trace,
          showDirectionCue,
        }),
      ),
    };
  }

  const normal = { x: -Math.sin(baseAngle), y: Math.cos(baseAngle) };
  return {
    key: "parallel",
    label: "Parallel set",
    restartLabel: "Restart",
    targets: SEQUENCE_STEPS.map((step) =>
      lineTargetFromGeometry({
        angle: baseAngle,
        center: {
          x: LINE_CANVAS_W / 2 + normal.x * step * 28,
          y: LINE_CANVAS_H / 2 + normal.y * step * 22,
        },
        length: 430,
        trace,
        showDirectionCue,
      }),
    ),
  };
}

function createCircleSequence(
  markCount: 1 | 3,
  trace: boolean,
  key?: string,
): FreehandTargetSequence {
  const setKind = sequenceKind(key, ["radius", "position", "combined"]);
  const center = { x: 500, y: 310 };
  const startAngle = randomRange(0, Math.PI * 2);

  if (setKind === "position") {
    return {
      key: "position",
      label: "Position grid",
      restartLabel: "Restart",
      targets: SEQUENCE_STEPS.map((step) =>
        circleTargetFromGeometry({
          center: { x: center.x + step * 28, y: center.y + step * 13 },
          radius: 135,
          markCount,
          startAngle,
          trace,
        }),
      ),
    };
  }

  if (setKind === "combined") {
    return {
      key: "combined",
      label: "Circle ladder",
      restartLabel: "Restart",
      targets: SEQUENCE_STEPS.map((step) =>
        circleTargetFromGeometry({
          center: { x: center.x + step * 16, y: center.y - step * 8 },
          radius: 136 + step * 7,
          markCount,
          startAngle,
          trace,
        }),
      ),
    };
  }

  return {
    key: "radius",
    label: "Radius ladder",
    restartLabel: "Restart",
    targets: SEQUENCE_STEPS.map((step) =>
      circleTargetFromGeometry({
        center,
        radius: 140 + step * 8,
        markCount,
        startAngle,
        trace,
      }),
    ),
  };
}

function createEllipseSequence(key?: string): FreehandTargetSequence {
  const setKind = sequenceKind(key, ["rotation", "ratio", "size"]);
  const center = { x: 500, y: 310 };

  if (setKind === "ratio") {
    return {
      key: "ratio",
      label: "Ratio ladder",
      restartLabel: "Restart",
      targets: SEQUENCE_STEPS.map((step) =>
        ellipseTargetFromGeometry(center, 205, 105 + step * 8, 0.16),
      ),
    };
  }

  if (setKind === "size") {
    return {
      key: "size",
      label: "Size ladder",
      restartLabel: "Restart",
      targets: SEQUENCE_STEPS.map((step) =>
        ellipseTargetFromGeometry(center, 200 + step * 10, 106 + step * 5, 0.16),
      ),
    };
  }

  return {
    key: "rotation",
    label: "Rotation ladder",
    restartLabel: "Restart",
    targets: SEQUENCE_STEPS.map((step) =>
      ellipseTargetFromGeometry(center, 205, 108, (step * 5 * Math.PI) / 180),
    ),
  };
}

function createSpiralSequence(
  spiralKind: "archimedean" | "logarithmic",
  direction: "left" | "right",
): FreehandTargetSequence {
  const center = { x: SPIRAL_CANVAS_W / 2, y: SPIRAL_CANVAS_H / 2 };
  const innerRadius = 22;
  const outerRadius =
    Math.min(
      center.x,
      center.y,
      SPIRAL_CANVAS_W - center.x,
      SPIRAL_CANVAS_H - center.y,
    ) - SPIRAL_MARGIN;
  return {
    key: spiralKind === "archimedean" ? "spacing" : "growth",
    label:
      spiralKind === "archimedean" ? "Spacing ladder" : "Growth ladder",
    restartLabel: "Restart",
    targets: SEQUENCE_STEPS.map((step) => {
      const turns =
        spiralKind === "archimedean"
          ? (outerRadius - innerRadius) / (42 + step * 3)
          : Math.log(outerRadius / innerRadius) /
            Math.log(1.65 + step * 0.06);
      return {
        kind: "spiral",
        spiralKind,
        direction,
        center,
        innerRadius,
        outerRadius,
        turns,
      };
    }),
  };
}

function createSCurveSequence(key?: string): FreehandTargetSequence {
  const setKind = sequenceKind(key, ["bend", "rotation"]);
  return {
    key: setKind,
    label: setKind === "bend" ? "Bend ladder" : "Rotation ladder",
    restartLabel: "Restart",
    targets: SEQUENCE_STEPS.map((step) =>
      createTraceSCurveFromParams({
        halfLength: 330,
        bend: setKind === "bend" ? 145 + step * 12 : 155,
        rotationRadians:
          setKind === "rotation" ? (step * 7 * Math.PI) / 180 : 0.18,
      }),
    ),
  };
}

function createCompoundCurveSequence(): FreehandTargetSequence {
  return {
    key: "family",
    label: "Family set",
    restartLabel: "New Set",
    targets: SEQUENCE_STEPS.map((step) =>
      createTraceCompoundCurveFromParams({
        segmentCount: 4,
        amplitude: 118 + step * 9,
        rotationRadians: (step * 4 * Math.PI) / 180,
      }),
    ),
  };
}

function sequenceKind<const T extends string>(
  key: string | undefined,
  choices: readonly T[],
): T {
  return choices.includes(key as T)
    ? (key as T)
    : randomSequenceKind(choices);
}

function randomSequenceKind<const T extends string>(choices: readonly T[]): T {
  return choices[Math.floor(Math.random() * choices.length)] ?? choices[0];
}

function lineTargetFromGeometry(options: {
  center: { x: number; y: number };
  angle: number;
  length: number;
  trace: boolean;
  showDirectionCue: boolean;
}): TargetLine {
  const half = options.length / 2;
  return {
    kind: "line",
    start: {
      x: options.center.x - Math.cos(options.angle) * half,
      y: options.center.y - Math.sin(options.angle) * half,
    },
    end: {
      x: options.center.x + Math.cos(options.angle) * half,
      y: options.center.y + Math.sin(options.angle) * half,
    },
    trace: options.trace,
    showDirectionCue: options.showDirectionCue,
  };
}

function circleTargetFromGeometry(options: {
  center: { x: number; y: number };
  radius: number;
  markCount: 1 | 3;
  startAngle: number;
  trace: boolean;
}): TargetCircle {
  return {
    kind: "circle",
    center: options.center,
    radius: options.radius,
    marks: options.trace
      ? []
      : Array.from({ length: options.markCount }, (_, index) =>
          pointOnCircle(
            options.center,
            options.radius,
            options.startAngle + index * ((Math.PI * 2) / options.markCount),
          ),
        ),
    showCenter: !options.trace && options.markCount === 1,
    trace: options.trace,
  };
}

function ellipseTargetFromGeometry(
  center: { x: number; y: number },
  majorRadius: number,
  minorRadius: number,
  rotationRadians: number,
): TargetEllipse {
  return {
    kind: "ellipse",
    center,
    majorRadius,
    minorRadius,
    rotationRadians,
    trace: true,
  };
}

function createTraceSpiral(
  spiralKind: "archimedean" | "logarithmic",
  direction: "left" | "right",
): TargetSpiral {
  const center = { x: SPIRAL_CANVAS_W / 2, y: SPIRAL_CANVAS_H / 2 };
  const innerRadius = randomRange(18, 28);
  const outerRadius =
    Math.min(
      center.x,
      center.y,
      SPIRAL_CANVAS_W - center.x,
      SPIRAL_CANVAS_H - center.y,
    ) - SPIRAL_MARGIN;

  let turns: number;
  if (spiralKind === "archimedean") {
    const step = randomRange(25, 60);
    turns = (outerRadius - innerRadius) / step;
  } else {
    const ratioPerTurn = randomRange(1.3, 2.2);
    turns = Math.log(outerRadius / innerRadius) / Math.log(ratioPerTurn);
  }

  return {
    kind: "spiral",
    spiralKind,
    direction,
    center,
    innerRadius,
    outerRadius,
    turns,
  };
}

function createTraceSCurve(): TargetSCurve {
  return createTraceSCurveFromParams({
    halfLength: randomRange(260, 390),
    bend: randomRange(90, 220) * (Math.random() < 0.5 ? -1 : 1),
    controlInsetRatio: randomRange(0.35, 0.72),
    rotationRadians: randomRange(0, Math.PI * 2),
  });
}

function createTraceSCurveFromParams(options: {
  halfLength: number;
  bend: number;
  controlInsetRatio?: number;
  rotationRadians: number;
}): TargetSCurve {
  const controlInset =
    (options.controlInsetRatio ?? 0.54) * options.halfLength;
  const local = {
    start: { x: -options.halfLength, y: 0 },
    control1: { x: -controlInset, y: options.bend },
    control2: { x: controlInset, y: -options.bend },
    end: { x: options.halfLength, y: 0 },
  };

  const cos = Math.cos(options.rotationRadians);
  const sin = Math.sin(options.rotationRadians);
  const rotated = {
    start: rotatePoint(local.start, cos, sin),
    control1: rotatePoint(local.control1, cos, sin),
    control2: rotatePoint(local.control2, cos, sin),
    end: rotatePoint(local.end, cos, sin),
  };
  const rotatedSamples = sCurveSamplePoints(rotated, 80);
  const bounds = boundsForPoints([
    rotated.start,
    rotated.control1,
    rotated.control2,
    rotated.end,
    ...rotatedSamples,
  ]);
  const scale = Math.min(
    1,
    (SPIRAL_CANVAS_W - S_CURVE_MARGIN * 2) / (bounds.maxX - bounds.minX),
    (SPIRAL_CANVAS_H - S_CURVE_MARGIN * 2) / (bounds.maxY - bounds.minY),
  );
  const scaledBounds = {
    minX: bounds.minX * scale,
    maxX: bounds.maxX * scale,
    minY: bounds.minY * scale,
    maxY: bounds.maxY * scale,
  };
  const width = scaledBounds.maxX - scaledBounds.minX;
  const height = scaledBounds.maxY - scaledBounds.minY;
  const center = {
    x: randomRange(
      S_CURVE_MARGIN + width / 2,
      SPIRAL_CANVAS_W - S_CURVE_MARGIN - width / 2,
    ),
    y: randomRange(
      S_CURVE_MARGIN + height / 2,
      SPIRAL_CANVAS_H - S_CURVE_MARGIN - height / 2,
    ),
  };
  const offset = {
    x: center.x - (scaledBounds.minX + scaledBounds.maxX) / 2,
    y: center.y - (scaledBounds.minY + scaledBounds.maxY) / 2,
  };
  const curve = {
    kind: "s-curve" as const,
    start: scaleAndOffset(rotated.start, scale, offset),
    control1: scaleAndOffset(rotated.control1, scale, offset),
    control2: scaleAndOffset(rotated.control2, scale, offset),
    end: scaleAndOffset(rotated.end, scale, offset),
    referenceLength: 1,
  };

  const samples = sCurveSamplePoints(curve, 120);
  let referenceLength = 0;
  for (let i = 1; i < samples.length; i++) {
    referenceLength += distanceBetween(samples[i - 1], samples[i]);
  }
  return { ...curve, referenceLength };
}

function createTraceCompoundCurve(): TargetCompoundCurve {
  return createTraceCompoundCurveFromParams({
    segmentCount: Math.random() < 0.45 ? 3 : 4,
    amplitude: randomRange(80, 175),
    step: randomRange(170, 230),
    phase: randomRange(0, Math.PI * 2),
    rotationRadians: randomRange(0, Math.PI * 2),
  });
}

function createTraceCompoundCurveFromParams(options: {
  segmentCount: number;
  amplitude: number;
  step?: number;
  phase?: number;
  rotationRadians: number;
}): TargetCompoundCurve {
  const segmentCount = options.segmentCount;
  const step = options.step ?? 200;
  const amplitude = options.amplitude;
  const phase = options.phase ?? 0.4;
  const points = Array.from({ length: segmentCount + 1 }, (_, index) => {
    const x = (index - segmentCount / 2) * step;
    const y =
      Math.sin(phase + index * 0.94 * Math.PI) *
      amplitude *
      (0.84 + (index % 2) * 0.1);
    return { x, y };
  });
  const segments = Array.from({ length: segmentCount }, (_, index) => {
    const start = points[index];
    const end = points[index + 1];
    const dx = end.x - start.x;
    const localBend = amplitude * 0.54;
    const bendSign = index % 2 === 0 ? 1 : -1;
    return {
      start,
      control1: {
        x: start.x + dx * 0.35,
        y: start.y + bendSign * localBend,
      },
      control2: {
        x: end.x - dx * 0.35,
        y: end.y - bendSign * localBend * 0.95,
      },
      end,
    };
  });
  const cos = Math.cos(options.rotationRadians);
  const sin = Math.sin(options.rotationRadians);
  const rotated = {
    segments: segments.map((segment) => ({
      start: rotatePoint(segment.start, cos, sin),
      control1: rotatePoint(segment.control1, cos, sin),
      control2: rotatePoint(segment.control2, cos, sin),
      end: rotatePoint(segment.end, cos, sin),
    })),
    referenceLength: 1,
  };

  const rotatedSamples = compoundCurveSamplePoints(rotated, 48);
  const bounds = boundsForPoints([
    ...compoundCurveControlPoints(rotated.segments),
    ...rotatedSamples,
  ]);
  const scale = Math.min(
    1,
    (SPIRAL_CANVAS_W - S_CURVE_MARGIN * 2) / (bounds.maxX - bounds.minX),
    (SPIRAL_CANVAS_H - S_CURVE_MARGIN * 2) / (bounds.maxY - bounds.minY),
  );
  const scaledBounds = {
    minX: bounds.minX * scale,
    maxX: bounds.maxX * scale,
    minY: bounds.minY * scale,
    maxY: bounds.maxY * scale,
  };
  const width = scaledBounds.maxX - scaledBounds.minX;
  const height = scaledBounds.maxY - scaledBounds.minY;
  const center = {
    x: randomRange(
      S_CURVE_MARGIN + width / 2,
      SPIRAL_CANVAS_W - S_CURVE_MARGIN - width / 2,
    ),
    y: randomRange(
      S_CURVE_MARGIN + height / 2,
      SPIRAL_CANVAS_H - S_CURVE_MARGIN - height / 2,
    ),
  };
  const offset = {
    x: center.x - (scaledBounds.minX + scaledBounds.maxX) / 2,
    y: center.y - (scaledBounds.minY + scaledBounds.maxY) / 2,
  };
  const curve = {
    kind: "compound-curve" as const,
    segments: rotated.segments.map((segment) => ({
      start: scaleAndOffset(segment.start, scale, offset),
      control1: scaleAndOffset(segment.control1, scale, offset),
      control2: scaleAndOffset(segment.control2, scale, offset),
      end: scaleAndOffset(segment.end, scale, offset),
    })),
    referenceLength: 1,
  };

  const samples = compoundCurveSamplePoints(curve, 80);
  let referenceLength = 0;
  for (let i = 1; i < samples.length; i++) {
    referenceLength += distanceBetween(samples[i - 1], samples[i]);
  }
  return { ...curve, referenceLength };
}

function compoundCurveControlPoints(
  segments: TargetCompoundCurve["segments"],
): { x: number; y: number }[] {
  return segments.flatMap((segment) => [
    segment.start,
    segment.control1,
    segment.control2,
    segment.end,
  ]);
}

function rotatePoint(
  point: { x: number; y: number },
  cos: number,
  sin: number,
): { x: number; y: number } {
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}

function scaleAndOffset(
  point: { x: number; y: number },
  scale: number,
  offset: { x: number; y: number },
): { x: number; y: number } {
  return {
    x: point.x * scale + offset.x,
    y: point.y * scale + offset.y,
  };
}

function boundsForPoints(points: { x: number; y: number }[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );
}

export function createLoopChainLinearTarget(): TargetLoopChainLinear {
  return {
    kind: "loop-chain-linear",
    centerY: randomRange(210, 410),
    bandHalf: randomRange(60, 200),
  };
}

export function createLoopChainCircularTarget(): TargetLoopChainCircular {
  const half = randomRange(45, 137.5);
  const margin = 20;
  const mid = randomRange(Math.max(140, half + 12), 290 - half);
  const minR = mid + half;
  const center = {
    x: randomRange(minR + margin, 1000 - minR - margin),
    y: randomRange(minR + margin, 620 - minR - margin),
  };
  return {
    kind: "loop-chain-circular",
    center,
    innerRadius: mid - half,
    outerRadius: mid + half,
  };
}

export function createLoopChainWedgeTarget(): TargetLoopChainWedge {
  const bandHalfLeft = randomRange(60, 200);
  const factor = randomRange(0.4, 2.5);
  const bandHalfRight = Math.max(35, Math.min(250, bandHalfLeft * factor));
  const maxHalf = Math.max(bandHalfLeft, bandHalfRight);
  const centerY = randomRange(20 + maxHalf, 600 - maxHalf);
  return { kind: "loop-chain-wedge", centerY, bandHalfLeft, bandHalfRight };
}

function createTargetLine(
  lineAngleBucket?: number,
  showDirectionCue = false,
): TargetLine {
  const length = randomRange(340, 500);
  const angle =
    lineAngleBucket === undefined
      ? randomRange(-0.45, 0.45)
      : ((lineAngleBucket + randomRange(-4.5, 4.5)) * Math.PI) / 180;
  const half = length / 2;
  const halfX = Math.abs(Math.cos(angle) * half);
  const halfY = Math.abs(Math.sin(angle) * half);
  const center = {
    x: randomRange(LINE_MARGIN + halfX, LINE_CANVAS_W - LINE_MARGIN - halfX),
    y: randomRange(LINE_MARGIN + halfY, LINE_CANVAS_H - LINE_MARGIN - halfY),
  };
  return {
    kind: "line",
    start: {
      x: center.x - Math.cos(angle) * half,
      y: center.y - Math.sin(angle) * half,
    },
    end: {
      x: center.x + Math.cos(angle) * half,
      y: center.y + Math.sin(angle) * half,
    },
    showDirectionCue,
  };
}

function createTargetCircle(markCount: 1 | 3): TargetCircle {
  const radius = randomRange(100, 170);
  const center = {
    x: randomRange(260 + radius, 740 - radius),
    y: randomRange(120 + radius, 500 - radius),
  };
  const startAngle = randomRange(0, Math.PI * 2);
  const marks =
    markCount === 1
      ? [pointOnCircle(center, radius, startAngle)]
      : [0, 1, 2].map((i) =>
          pointOnCircle(
            center,
            radius,
            startAngle + i * ((Math.PI * 2) / 3) + randomRange(-0.24, 0.24),
          ),
        );
  return { kind: "circle", center, radius, marks, showCenter: markCount === 1 };
}

function createTraceCircle(): TargetCircle {
  const radius = randomRange(105, 180);
  return {
    kind: "circle",
    center: {
      x: randomRange(260 + radius, 740 - radius),
      y: randomRange(120 + radius, 500 - radius),
    },
    radius,
    marks: [],
    showCenter: false,
    trace: true,
  };
}

function createTraceEllipse(): TargetEllipse {
  const majorRadius = randomRange(150, 240);
  const minorRadius = randomRange(70, 130);
  // Both bounds use majorRadius so the rotated ellipse stays within the canvas
  // regardless of orientation.
  return {
    kind: "ellipse",
    center: {
      x: randomRange(80 + majorRadius, 920 - majorRadius),
      y: randomRange(70 + majorRadius, 550 - majorRadius),
    },
    majorRadius,
    minorRadius,
    rotationRadians: randomRange(-0.65, 0.65),
    trace: true,
  };
}

type AngleBaseMode = "horizontal" | "vertical" | "arbitrary";
type AngleTransferMode = "aligned" | "rotated";

function createTargetAngle(
  baseMode: AngleBaseMode,
  transferMode: AngleTransferMode,
  openingBucket?: number,
): TargetAngle {
  const referenceLength = 150;
  const targetLength = 230;
  const bounds = { minX: 78, maxX: 922, minY: 70, maxY: 550 };

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const referenceBase = baseAngle(baseMode);
    const openingSign = Math.random() < 0.5 ? 1 : -1;
    const openingRadians = targetOpeningRadians(openingBucket);
    const targetBase =
      transferMode === "aligned"
        ? referenceBase
        : rotatedTargetBase(referenceBase);
    const referenceVertex = {
      x: randomRange(180, 380),
      y: randomRange(160, 460),
    };
    const targetVertex = {
      x: randomRange(600, 820),
      y: randomRange(160, 460),
    };

    const target: TargetAngle = {
      kind: "angle",
      reference: {
        vertex: referenceVertex,
        baseEnd: pointAtAngle(referenceVertex, referenceLength, referenceBase),
        angleEnd: pointAtAngle(
          referenceVertex,
          referenceLength,
          referenceBase + openingSign * openingRadians,
        ),
      },
      target: {
        vertex: targetVertex,
        baseEnd: pointAtAngle(targetVertex, targetLength, targetBase),
        correctEnd: pointAtAngle(
          targetVertex,
          targetLength,
          targetBase + openingSign * openingRadians,
        ),
      },
      openingRadians,
      openingSign,
    };

    if (angleTargetWithinBounds(target, bounds)) {
      return target;
    }
  }

  // Conservative fallback avoids invisible targets if random generation is unlucky.
  const referenceBase = baseAngle(baseMode);
  const targetBase =
    transferMode === "aligned" ? referenceBase : referenceBase + Math.PI / 3;
  const openingRadians = targetOpeningRadians(openingBucket);
  const openingSign = 1;
  const referenceVertex = { x: 260, y: 310 };
  const targetVertex = { x: 720, y: 310 };
  return {
    kind: "angle",
    reference: {
      vertex: referenceVertex,
      baseEnd: pointAtAngle(referenceVertex, referenceLength, referenceBase),
      angleEnd: pointAtAngle(
        referenceVertex,
        referenceLength,
        referenceBase + openingRadians,
      ),
    },
    target: {
      vertex: targetVertex,
      baseEnd: pointAtAngle(targetVertex, targetLength, targetBase),
      correctEnd: pointAtAngle(
        targetVertex,
        targetLength,
        targetBase + openingRadians,
      ),
    },
    openingRadians,
    openingSign,
  };
}

function createConstructAngle(
  baseMode: AngleBaseMode,
  estimateBucket?: number,
): TargetAngle {
  const targetLength = 230;
  const bounds = { minX: 78, maxX: 922, minY: 70, maxY: 550 };

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const targetBase = baseAngle(baseMode);
    const openingSign = Math.random() < 0.5 ? 1 : -1;
    const requestedDegrees = targetEstimateDegrees(estimateBucket);
    const openingRadians = (requestedDegrees * Math.PI) / 180;
    const targetVertex = {
      x: randomRange(250, 750),
      y: randomRange(170, 450),
    };
    const target = constructAngleTarget(
      targetVertex,
      targetLength,
      targetBase,
      openingSign,
      openingRadians,
      requestedDegrees,
    );

    if (angleTargetWithinBounds(target, bounds)) {
      return target;
    }
  }

  const targetBase = baseAngle(baseMode);
  const openingSign = 1;
  const requestedDegrees = targetEstimateDegrees(estimateBucket);
  return constructAngleTarget(
    { x: 500, y: 310 },
    targetLength,
    targetBase,
    openingSign,
    (requestedDegrees * Math.PI) / 180,
    requestedDegrees,
  );
}

function constructAngleTarget(
  vertex: { x: number; y: number },
  length: number,
  baseRadians: number,
  openingSign: 1 | -1,
  openingRadians: number,
  requestedDegrees: number,
): TargetAngle {
  const baseEnd = pointAtAngle(vertex, length, baseRadians);
  const correctEnd = pointAtAngle(
    vertex,
    length,
    baseRadians + openingSign * openingRadians,
  );
  return {
    kind: "angle",
    reference: {
      vertex,
      baseEnd,
      angleEnd: correctEnd,
    },
    showReference: false,
    target: {
      vertex,
      baseEnd,
      correctEnd,
    },
    openingRadians,
    openingSign,
    requestedDegrees,
  };
}

function targetEstimateDegrees(estimateBucket: number | undefined): number {
  const bucket =
    estimateBucket === undefined
      ? bucketAngleEstimateDegrees(randomRange(2, 178))
      : bucketAngleEstimateDegrees(estimateBucket);
  const range = angleEstimateRangeForBucket(bucket);
  return Math.round(randomRange(range.min, range.max));
}

function targetOpeningRadians(openingBucket: number | undefined): number {
  const degrees =
    openingBucket === undefined
      ? randomRange(5, 175)
      : clampAngleOpeningDegrees(openingBucket + randomRange(-5, 5));
  return (degrees * Math.PI) / 180;
}

function baseAngle(mode: AngleBaseMode): number {
  if (mode === "horizontal") return 0;
  if (mode === "vertical") return Math.PI / 2;
  return randomRange(-Math.PI, Math.PI);
}

function rotatedTargetBase(referenceBase: number): number {
  const delta = randomRange((40 * Math.PI) / 180, (140 * Math.PI) / 180);
  return referenceBase + (Math.random() < 0.5 ? -delta : delta);
}

function pointAtAngle(
  origin: { x: number; y: number },
  length: number,
  angle: number,
): { x: number; y: number } {
  return {
    x: origin.x + Math.cos(angle) * length,
    y: origin.y + Math.sin(angle) * length,
  };
}

function angleTargetWithinBounds(
  target: TargetAngle,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
): boolean {
  const points = [
    target.reference.vertex,
    target.reference.baseEnd,
    target.reference.angleEnd,
    target.target.vertex,
    target.target.baseEnd,
    target.target.correctEnd,
  ];
  return points.every(
    (point) =>
      point.x >= bounds.minX &&
      point.x <= bounds.maxX &&
      point.y >= bounds.minY &&
      point.y <= bounds.maxY,
  );
}
