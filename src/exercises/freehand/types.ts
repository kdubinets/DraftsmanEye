/**
 * Type definitions for freehand stroke data, per-kind results, target geometries,
 * and the per-exercise config consumed by mountFreehandScreen.
 */

export type FreehandPoint = {
  x: number;
  y: number;
  time: number;
  pressure: number;
  pointerType: string;
};

export type FreehandLineResult = {
  kind: "line";
  score: number;
  meanErrorPixels: number;
  maxErrorPixels: number;
  strokeLengthPixels: number;
  pointCount: number;
  fitStart: { x: number; y: number };
  fitEnd: { x: number; y: number };
};

export type FreehandTargetLineResult = Omit<FreehandLineResult, "kind"> & {
  kind: "target-line";
  target: TargetLine;
  startErrorPixels: number;
  endErrorPixels: number;
  angleErrorDegrees: number;
};

export type FreehandTargetAngleResult = Omit<FreehandLineResult, "kind"> & {
  kind: "target-angle";
  target: TargetAngle;
  startErrorPixels: number;
  angleErrorDegrees: number;
  signedOpenErrorDegrees: number;
  userRayStart: { x: number; y: number };
  userRayEnd: { x: number; y: number };
};

export type FreehandCircleResult = {
  kind: "circle";
  score: number;
  meanErrorPixels: number;
  maxErrorPixels: number;
  strokeLengthPixels: number;
  pointCount: number;
  center: { x: number; y: number };
  radius: number;
  closureGapPixels: number;
  joinAngleDegrees: number;
};

export type FreehandTargetCircleResult = Omit<FreehandCircleResult, "kind"> & {
  kind: "target-circle";
  target: TargetCircle;
  centerErrorPixels: number;
  radiusErrorPixels: number;
};

export type FreehandEllipseResult = {
  kind: "ellipse";
  score: number;
  meanErrorPixels: number;
  maxErrorPixels: number;
  strokeLengthPixels: number;
  pointCount: number;
  center: { x: number; y: number };
  majorRadius: number;
  minorRadius: number;
  rotationRadians: number;
  closureGapPixels: number;
  joinAngleDegrees: number;
};

export type FreehandTargetEllipseResult = Omit<
  FreehandEllipseResult,
  "kind"
> & {
  kind: "target-ellipse";
  target: TargetEllipse;
  centerErrorPixels: number;
  majorRadiusErrorPixels: number;
  minorRadiusErrorPixels: number;
  rotationErrorDegrees: number;
};

export type LoopChainBandResult = {
  kind: "loop-chain-band";
  score: number;
  containmentPercent: number;
  strokeLengthPixels: number;
  pointCount: number;
};

export type FreehandSpiralResult = {
  kind: "trace-spiral";
  score: number;
  meanErrorPixels: number;
  maxErrorPixels: number;
  strokeLengthPixels: number;
  pointCount: number;
  target: TargetSpiral;
};

export type LoopChainScoredResult = {
  kind: "loop-chain-scored";
  score: number;
  loopQualityScore: number;
  bandScore?: number;
  containmentPercent?: number;
  bandTouchPercent?: number;
  loopCount: number;
  meanLoopRadius: number;
  radiusConsistencyScore: number;
  roundnessScore: number;
  pathAdherenceScore: number;
  centerLineDeviationPixels: number;
  loopCenters: { x: number; y: number }[];
  strokeLengthPixels: number;
  pointCount: number;
};

export type FreehandResult =
  | FreehandLineResult
  | FreehandTargetLineResult
  | FreehandTargetAngleResult
  | FreehandCircleResult
  | FreehandTargetCircleResult
  | FreehandEllipseResult
  | FreehandTargetEllipseResult
  | LoopChainBandResult
  | LoopChainScoredResult
  | FreehandSpiralResult;

export type TargetLine = {
  kind: "line";
  start: { x: number; y: number };
  end: { x: number; y: number };
  trace?: boolean;
};

export type TargetCircle = {
  kind: "circle";
  center: { x: number; y: number };
  radius: number;
  marks: { x: number; y: number }[];
  showCenter: boolean;
  trace?: boolean;
};

export type TargetEllipse = {
  kind: "ellipse";
  center: { x: number; y: number };
  majorRadius: number;
  minorRadius: number;
  rotationRadians: number;
  trace?: boolean;
};

export type TargetAngle = {
  kind: "angle";
  reference: {
    vertex: { x: number; y: number };
    baseEnd: { x: number; y: number };
    angleEnd: { x: number; y: number };
  };
  target: {
    vertex: { x: number; y: number };
    baseEnd: { x: number; y: number };
    correctEnd: { x: number; y: number };
  };
  openingRadians: number;
  openingSign: 1 | -1;
};

export type TargetLoopChainLinear = {
  kind: "loop-chain-linear";
  centerY: number;
  bandHalf: number;
};

export type TargetLoopChainCircular = {
  kind: "loop-chain-circular";
  center: { x: number; y: number };
  innerRadius: number;
  outerRadius: number;
};

export type TargetLoopChainWedge = {
  kind: "loop-chain-wedge";
  centerY: number;
  bandHalfLeft: number;
  bandHalfRight: number;
};

export type TargetSpiral = {
  kind: "spiral";
  spiralKind: "archimedean" | "logarithmic";
  direction: "left" | "right";
  center: { x: number; y: number };
  innerRadius: number;
  outerRadius: number;
  turns: number;
};

export type FreehandTarget =
  | TargetLine
  | TargetCircle
  | TargetEllipse
  | TargetAngle
  | TargetLoopChainLinear
  | TargetLoopChainCircular
  | TargetLoopChainWedge
  | TargetSpiral;

export type FreehandAttemptSnapshot = {
  id: number;
  points: FreehandPoint[];
  result: FreehandResult;
  target: FreehandTarget | null;
};

/**
 * Per-exercise configuration passed to mountFreehandScreen.
 * Encapsulates every kind-specific decision so the screen body stays kind-agnostic.
 */
export type FreehandExerciseConfig = {
  isClosedShape: boolean;
  createTarget: () => FreehandTarget | null;
  scoreStroke: (
    points: FreehandPoint[],
    target: FreehandTarget | null,
  ) => FreehandResult | null;
  promptText: string;
  readyText: string;
  retryText: string;
  canvasLabel: string;
  renderCorrection?: (
    correctionLayer: SVGGElement,
    result: FreehandResult,
  ) => void;
};
