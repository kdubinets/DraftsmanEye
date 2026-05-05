/** Trial target geometry generation for target and trace exercise variants. */
import { randomRange, pointOnCircle } from "../../geometry/primitives";
import { clampAngleOpeningDegrees } from "../../practice/angleOpenings";
import {
  angleEstimateRangeForBucket,
  bucketAngleEstimateDegrees,
} from "../../practice/angleEstimation";
import type { FreehandExerciseDefinition } from "../../practice/catalog";
import type {
  FreehandTarget,
  TargetLine,
  TargetCircle,
  TargetEllipse,
  TargetAngle,
  TargetLoopChainLinear,
  TargetLoopChainCircular,
  TargetLoopChainWedge,
  TargetSpiral,
} from "./types";

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
      return createTargetLine(options.lineAngleBucket, options.showDirectionCue);
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
      return createTargetAngle("horizontal", "aligned", options.angleOpeningBucket);
    case "angle-copy-vertical-aligned":
      return createTargetAngle("vertical", "aligned", options.angleOpeningBucket);
    case "angle-copy-horizontal-rotated":
      return createTargetAngle("horizontal", "rotated", options.angleOpeningBucket);
    case "angle-copy-vertical-rotated":
      return createTargetAngle("vertical", "rotated", options.angleOpeningBucket);
    case "angle-copy-arbitrary-aligned":
      return createTargetAngle("arbitrary", "aligned", options.angleOpeningBucket);
    case "angle-copy-arbitrary-rotated":
      return createTargetAngle("arbitrary", "rotated", options.angleOpeningBucket);
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
    case "freehand-circle":
    case "freehand-ellipse":
    case "freehand-line":
    case "loop-chain-freehand":
      return null;
  }
}

const SPIRAL_CANVAS_W = 1000;
const SPIRAL_CANVAS_H = 620;
const SPIRAL_MARGIN = 30;
const LINE_CANVAS_W = 1000;
const LINE_CANVAS_H = 620;
const LINE_MARGIN = 48;

function createTraceSpiral(
  spiralKind: "archimedean" | "logarithmic",
  direction: "left" | "right",
): TargetSpiral {
  const center = { x: SPIRAL_CANVAS_W / 2, y: SPIRAL_CANVAS_H / 2 };
  const innerRadius = randomRange(18, 28);
  const outerRadius =
    Math.min(center.x, center.y, SPIRAL_CANVAS_W - center.x, SPIRAL_CANVAS_H - center.y) -
    SPIRAL_MARGIN;

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
    x: randomRange(
      LINE_MARGIN + halfX,
      LINE_CANVAS_W - LINE_MARGIN - halfX,
    ),
    y: randomRange(
      LINE_MARGIN + halfY,
      LINE_CANVAS_H - LINE_MARGIN - halfY,
    ),
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
