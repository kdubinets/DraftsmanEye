/** Type definitions for freehand stroke data, per-kind results, and target geometries. */

export type FreehandPoint = {
  x: number;
  y: number;
  time: number;
  pressure: number;
  pointerType: string;
};

export type FreehandLineResult = {
  kind: 'line';
  score: number;
  meanErrorPixels: number;
  maxErrorPixels: number;
  strokeLengthPixels: number;
  pointCount: number;
  fitStart: { x: number; y: number };
  fitEnd: { x: number; y: number };
};

export type FreehandTargetLineResult = Omit<FreehandLineResult, 'kind'> & {
  kind: 'target-line';
  target: TargetLine;
  startErrorPixels: number;
  endErrorPixels: number;
  angleErrorDegrees: number;
};

export type FreehandCircleResult = {
  kind: 'circle';
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

export type FreehandTargetCircleResult = Omit<FreehandCircleResult, 'kind'> & {
  kind: 'target-circle';
  target: TargetCircle;
  centerErrorPixels: number;
  radiusErrorPixels: number;
};

export type FreehandEllipseResult = {
  kind: 'ellipse';
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

export type FreehandTargetEllipseResult = Omit<FreehandEllipseResult, 'kind'> & {
  kind: 'target-ellipse';
  target: TargetEllipse;
  centerErrorPixels: number;
  majorRadiusErrorPixels: number;
  minorRadiusErrorPixels: number;
  rotationErrorDegrees: number;
};

export type FreehandResult =
  | FreehandLineResult
  | FreehandTargetLineResult
  | FreehandCircleResult
  | FreehandTargetCircleResult
  | FreehandEllipseResult
  | FreehandTargetEllipseResult;

export type TargetLine = {
  kind: 'line';
  start: { x: number; y: number };
  end: { x: number; y: number };
  trace?: boolean;
};

export type TargetCircle = {
  kind: 'circle';
  center: { x: number; y: number };
  radius: number;
  marks: { x: number; y: number }[];
  showCenter: boolean;
  trace?: boolean;
};

export type TargetEllipse = {
  kind: 'ellipse';
  center: { x: number; y: number };
  majorRadius: number;
  minorRadius: number;
  rotationRadians: number;
  trace?: boolean;
};

export type FreehandTarget = TargetLine | TargetCircle | TargetEllipse;

export type FreehandAttemptSnapshot = {
  id: number;
  points: FreehandPoint[];
  result: FreehandResult;
  target: FreehandTarget | null;
};
