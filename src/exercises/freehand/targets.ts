/** Trial target geometry generation for target and trace exercise variants. */
import { randomRange, pointOnCircle } from "../../geometry/primitives";
import type { FreehandExerciseDefinition } from "../../practice/catalog";
import type {
  FreehandTarget,
  TargetLine,
  TargetCircle,
  TargetEllipse,
  TargetAngle,
  TargetLoopChainLinear,
  TargetLoopChainCircular,
} from "./types";

export function createFreehandTarget(
  kind: FreehandExerciseDefinition["kind"],
): FreehandTarget | null {
  switch (kind) {
    case "target-line-two-points":
      return createTargetLine();
    case "trace-line":
      return { ...createTargetLine(), trace: true };
    case "target-circle-center-point":
      return createTargetCircle(1);
    case "target-circle-three-points":
      return createTargetCircle(3);
    case "trace-circle":
      return createTraceCircle();
    case "trace-ellipse":
      return createTraceEllipse();
    case "angle-copy-horizontal-aligned":
      return createTargetAngle("horizontal", "aligned");
    case "angle-copy-vertical-aligned":
      return createTargetAngle("vertical", "aligned");
    case "angle-copy-horizontal-rotated":
      return createTargetAngle("horizontal", "rotated");
    case "angle-copy-vertical-rotated":
      return createTargetAngle("vertical", "rotated");
    case "angle-copy-arbitrary-aligned":
      return createTargetAngle("arbitrary", "aligned");
    case "angle-copy-arbitrary-rotated":
      return createTargetAngle("arbitrary", "rotated");
    case "loop-chain-linear":
    case "loop-chain-linear-scored":
      return createLoopChainLinearTarget();
    case "loop-chain-circular":
    case "loop-chain-circular-scored":
      return createLoopChainCircularTarget();
    case "freehand-circle":
    case "freehand-ellipse":
    case "freehand-line":
    case "loop-chain-freehand":
      return null;
  }
}

export function createLoopChainLinearTarget(): TargetLoopChainLinear {
  return {
    kind: "loop-chain-linear",
    centerY: randomRange(200, 420),
    bandHalf: randomRange(45, 70),
  };
}

export function createLoopChainCircularTarget(): TargetLoopChainCircular {
  const mid = randomRange(140, 200);
  const half = randomRange(30, 55);
  const margin = 20;
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

function createTargetLine(): TargetLine {
  const length = randomRange(340, 520);
  const angle = randomRange(-0.45, 0.45);
  const center = { x: randomRange(320, 680), y: randomRange(210, 410) };
  const half = length / 2;
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
): TargetAngle {
  const referenceLength = 150;
  const targetLength = 230;
  const bounds = { minX: 78, maxX: 922, minY: 70, maxY: 550 };

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const referenceBase = baseAngle(baseMode);
    const openingSign = Math.random() < 0.5 ? 1 : -1;
    const openingRadians = randomRange(
      (28 * Math.PI) / 180,
      (145 * Math.PI) / 180,
    );
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
  const openingRadians = Math.PI / 3;
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
