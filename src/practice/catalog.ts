/**
 * Defines selectable drills and their trial generation and scoring behavior.
 */
import type {
  ProgressAttemptMetadata,
  ProgressStore,
} from "../storage/progress";
import {
  bucketDivisionLength,
  directionRadiansForBucket,
  divisionDirectionBucketsForAxis,
  divisionDirectionMetadata,
  divisionLengthForBucket,
  divisionLengthRange,
  selectDivisionDirectionBucket,
  selectDivisionLengthBucket,
} from "./divisions";
import {
  selectTransferLengthBucket,
  transferAngleMetadata,
  transferLengthMetadata,
  transferLengthRange,
  transferTargetDistanceForBucket,
} from "./lengthTransfers";
import {
  clampNumber,
  distanceBetween,
  radiansToDegrees,
} from "../geometry/primitives";

export type ExerciseId =
  | "freehand-straight-line"
  | "freehand-circle"
  | "freehand-ellipse"
  | "target-line-two-points"
  | "target-circle-center-point"
  | "target-circle-three-points"
  | "trace-line"
  | "trace-circle"
  | "trace-ellipse"
  | "angle-copy-horizontal-aligned"
  | "angle-copy-vertical-aligned"
  | "angle-copy-horizontal-rotated"
  | "angle-copy-vertical-rotated"
  | "angle-copy-arbitrary-aligned"
  | "angle-copy-arbitrary-rotated"
  | "angle-copy-horizontal-aligned-adjustable-1-shot"
  | "angle-copy-vertical-aligned-adjustable-1-shot"
  | "angle-copy-horizontal-rotated-adjustable-1-shot"
  | "angle-copy-vertical-rotated-adjustable-1-shot"
  | "angle-copy-arbitrary-aligned-adjustable-1-shot"
  | "angle-copy-arbitrary-rotated-adjustable-1-shot"
  | "angle-copy-horizontal-aligned-free-draw-1-shot"
  | "angle-copy-vertical-aligned-free-draw-1-shot"
  | "angle-copy-horizontal-rotated-free-draw-1-shot"
  | "angle-copy-vertical-rotated-free-draw-1-shot"
  | "angle-copy-arbitrary-aligned-free-draw-1-shot"
  | "angle-copy-arbitrary-rotated-free-draw-1-shot"
  | "division-horizontal-halves"
  | "division-horizontal-thirds"
  | "division-horizontal-quarters"
  | "division-horizontal-fifths"
  | "division-vertical-halves"
  | "division-vertical-thirds"
  | "division-vertical-quarters"
  | "division-vertical-fifths"
  | "division-random-halves"
  | "division-random-thirds"
  | "division-random-quarters"
  | "division-random-fifths"
  | "division-horizontal-halves-1-shot"
  | "division-horizontal-thirds-1-shot"
  | "division-horizontal-quarters-1-shot"
  | "division-horizontal-fifths-1-shot"
  | "division-vertical-halves-1-shot"
  | "division-vertical-thirds-1-shot"
  | "division-vertical-quarters-1-shot"
  | "division-vertical-fifths-1-shot"
  | "division-random-halves-1-shot"
  | "division-random-thirds-1-shot"
  | "division-random-quarters-1-shot"
  | "division-random-fifths-1-shot"
  | "copy-horizontal-horizontal"
  | "copy-horizontal-vertical"
  | "copy-vertical-vertical"
  | "copy-vertical-horizontal"
  | "copy-random-random"
  | "copy-horizontal-horizontal-1-shot"
  | "copy-horizontal-vertical-1-shot"
  | "copy-vertical-vertical-1-shot"
  | "copy-vertical-horizontal-1-shot"
  | "copy-random-random-1-shot"
  | "double-horizontal-horizontal"
  | "double-horizontal-vertical"
  | "double-vertical-vertical"
  | "double-vertical-horizontal"
  | "double-random-random"
  | "double-horizontal-horizontal-1-shot"
  | "double-horizontal-vertical-1-shot"
  | "double-vertical-vertical-1-shot"
  | "double-vertical-horizontal-1-shot"
  | "double-random-random-1-shot"
  | "intersection-random"
  | "intersection-extrapolated"
  | "intersection-random-1-shot"
  | "intersection-extrapolated-1-shot"
  | "flat-triangle"
  | "flat-quadrilateral"
  | "flat-pentagon"
  | "flat-hexagon"
  | "solids-cube-2pt"
  | "solids-box-2pt"
  | "solids-triangular-prism-2pt"
  | "solids-square-pyramid-2pt"
  | "solids-triangular-pyramid-2pt"
  | "loop-chain-freehand"
  | "loop-chain-linear"
  | "loop-chain-linear-scored"
  | "loop-chain-circular"
  | "loop-chain-circular-scored"
  | "loop-chain-wedge"
  | "loop-chain-wedge-scored"
  | "trace-spiral-archimedean-left"
  | "trace-spiral-archimedean-right"
  | "trace-spiral-logarithmic-left"
  | "trace-spiral-logarithmic-right";

export type LineAxis = "horizontal" | "vertical" | "free";

type ExerciseBase = {
  id: ExerciseId;
  family: string;
  label: string;
  description: string;
};

export type SingleMarkTrial = {
  label: string;
  prompt: string;
  viewport: {
    width: number;
    height: number;
  };
  line: TrialLine;
  referenceLine?: TrialLine;
  projectionLine?: TrialLine;
  projectionOrigin?: { x: number; y: number };
  anchorScalar?: number;
  anchorDirectionSign?: -1 | 1;
  progressMetadata?: ProgressAttemptMetadata;
  scoreSelection: (placedScalar: number) => SingleMarkTrialResult;
  scorePoint?: (point: {
    x: number;
    y: number;
  }) => SingleMarkTrialResult | null;
};

export type TrialLine = {
  axis: LineAxis;
  anchorX: number;
  anchorY: number;
  startScalar: number;
  endScalar: number;
  startPoint?: { x: number; y: number };
  endPoint?: { x: number; y: number };
  showEndpointTicks?: boolean;
};

export type SingleMarkTrialResult = {
  placedScalar: number;
  targetScalar: number;
  signedErrorPixels: number;
  relativeErrorPercent: number;
  relativeAccuracyPercent: number;
  directionLabel: string;
  angleErrorDegrees?: number;
  signedAngleErrorDegrees?: number;
  distanceErrorPixels?: number;
  placedPoint?: { x: number; y: number };
  targetPoint?: { x: number; y: number };
};

export type SingleMarkExerciseDefinition = ExerciseBase & {
  implemented: true;
  kind: "single-mark";
  inputMode?: "single-mark" | "unlimited-adjustment";
  createTrial: (progress?: ProgressStore) => SingleMarkTrial;
};

export type FreehandExerciseDefinition = ExerciseBase & {
  implemented: true;
  kind:
    | "freehand-line"
    | "freehand-circle"
    | "freehand-ellipse"
    | "target-line-two-points"
    | "target-circle-center-point"
    | "target-circle-three-points"
    | "trace-line"
    | "trace-circle"
    | "trace-ellipse"
    | "angle-copy-horizontal-aligned"
    | "angle-copy-vertical-aligned"
    | "angle-copy-horizontal-rotated"
    | "angle-copy-vertical-rotated"
    | "angle-copy-arbitrary-aligned"
    | "angle-copy-arbitrary-rotated"
    | "loop-chain-freehand"
    | "loop-chain-linear"
    | "loop-chain-linear-scored"
    | "loop-chain-circular"
    | "loop-chain-circular-scored"
    | "loop-chain-wedge"
    | "loop-chain-wedge-scored"
    | "trace-spiral-archimedean-left"
    | "trace-spiral-archimedean-right"
    | "trace-spiral-logarithmic-left"
    | "trace-spiral-logarithmic-right";
  inputMode?:
    | "single-stroke"
    | "unlimited-strokes"
    | "adjustable-line"
    | "adjustable-line-1-shot";
};

export const SOLID_EXERCISE_KINDS = [
  "solid-cube-2pt",
  "solid-box-2pt",
  "solid-triangular-prism-2pt",
  "solid-square-pyramid-2pt",
  "solid-triangular-pyramid-2pt",
  "solid-cube-3pt",
  "solid-box-3pt",
  "solid-triangular-prism-3pt",
  "solid-square-pyramid-3pt",
  "solid-triangular-pyramid-3pt",
  "flat-triangle",
  "flat-quadrilateral",
  "flat-pentagon",
  "flat-hexagon",
] as const;

export type SolidExerciseDefinition = ExerciseBase & {
  implemented: true;
  kind: (typeof SOLID_EXERCISE_KINDS)[number];
};

export function isSolidExercise(
  exercise: ExerciseDefinition,
): exercise is SolidExerciseDefinition {
  if (!exercise.implemented) return false;
  return (SOLID_EXERCISE_KINDS as readonly string[]).includes(exercise.kind);
}

export type UnimplementedExerciseDefinition = ExerciseBase & {
  implemented: false;
};

export type ExerciseDefinition =
  | SingleMarkExerciseDefinition
  | FreehandExerciseDefinition
  | SolidExerciseDefinition
  | UnimplementedExerciseDefinition;

export const EXERCISES: ExerciseDefinition[] = [
  {
    id: "freehand-straight-line",
    family: "Freehand Control",
    label: "Straight Line",
    description: "Draw one deliberate line and compare it with its best fit.",
    implemented: true,
    kind: "freehand-line",
  },
  {
    id: "freehand-circle",
    family: "Freehand Control",
    label: "Circle",
    description: "Draw one deliberate circle and compare it with its best fit.",
    implemented: true,
    kind: "freehand-circle",
  },
  {
    id: "freehand-ellipse",
    family: "Freehand Control",
    label: "Ellipse",
    description:
      "Draw one deliberate ellipse and compare it with its best fit.",
    implemented: true,
    kind: "freehand-ellipse",
  },
  {
    id: "target-line-two-points",
    family: "Target Drawing",
    label: "Line Through Two Points",
    description: "Draw a straight line connecting the shown endpoint marks.",
    implemented: true,
    kind: "target-line-two-points",
  },
  {
    id: "target-circle-center-point",
    family: "Target Drawing",
    label: "Circle From Center",
    description: "Draw a circle from the shown center and radius point.",
    implemented: true,
    kind: "target-circle-center-point",
  },
  {
    id: "target-circle-three-points",
    family: "Target Drawing",
    label: "Circle Through Three Points",
    description: "Draw a circle passing through the three shown points.",
    implemented: true,
    kind: "target-circle-three-points",
  },
  {
    id: "trace-line",
    family: "Trace Control",
    label: "Trace Line",
    description: "Trace the faint straight guide as accurately as possible.",
    implemented: true,
    kind: "trace-line",
  },
  {
    id: "trace-circle",
    family: "Trace Control",
    label: "Trace Circle",
    description: "Trace the faint circle guide as accurately as possible.",
    implemented: true,
    kind: "trace-circle",
  },
  {
    id: "trace-ellipse",
    family: "Trace Control",
    label: "Trace Ellipse",
    description: "Trace the faint ellipse guide as accurately as possible.",
    implemented: true,
    kind: "trace-ellipse",
  },
  {
    id: "trace-spiral-archimedean-right",
    family: "Trace Control",
    label: "Trace Archimedean Spiral — Right",
    description: "Trace the faint right-winding Archimedean spiral guide. Coil spacing is uniform.",
    implemented: true,
    kind: "trace-spiral-archimedean-right",
  },
  {
    id: "trace-spiral-archimedean-left",
    family: "Trace Control",
    label: "Trace Archimedean Spiral — Left",
    description: "Trace the faint left-winding Archimedean spiral guide. Coil spacing is uniform.",
    implemented: true,
    kind: "trace-spiral-archimedean-left",
  },
  {
    id: "trace-spiral-logarithmic-right",
    family: "Trace Control",
    label: "Trace Logarithmic Spiral — Right",
    description: "Trace the faint right-winding logarithmic spiral guide. Spacing grows with each turn.",
    implemented: true,
    kind: "trace-spiral-logarithmic-right",
  },
  {
    id: "trace-spiral-logarithmic-left",
    family: "Trace Control",
    label: "Trace Logarithmic Spiral — Left",
    description: "Trace the faint left-winding logarithmic spiral guide. Spacing grows with each turn.",
    implemented: true,
    kind: "trace-spiral-logarithmic-left",
  },
  {
    id: "flat-triangle",
    family: "Flat Shapes",
    label: "Triangle",
    description:
      "Rebuild an irregular triangle from a reference using vertices and edges.",
    implemented: true,
    kind: "flat-triangle",
  },
  {
    id: "flat-quadrilateral",
    family: "Flat Shapes",
    label: "Four-Sided Figure",
    description:
      "Rebuild an irregular four-sided figure, preserving angles and proportions.",
    implemented: true,
    kind: "flat-quadrilateral",
  },
  {
    id: "flat-pentagon",
    family: "Flat Shapes",
    label: "Five-Sided Figure",
    description:
      "Rebuild an irregular five-sided figure, preserving angles and proportions.",
    implemented: true,
    kind: "flat-pentagon",
  },
  {
    id: "flat-hexagon",
    family: "Flat Shapes",
    label: "Six-Sided Figure",
    description:
      "Rebuild an irregular six-sided figure, preserving angles and proportions.",
    implemented: true,
    kind: "flat-hexagon",
  },
  {
    id: "solids-triangular-pyramid-2pt",
    family: "Solids",
    label: "Triangular Pyramid — 2-Point Perspective",
    description:
      "Build the visible base and apex edges of a triangular pyramid from a reference drawing.",
    implemented: true,
    kind: "solid-triangular-pyramid-2pt",
  },
  {
    id: "solids-square-pyramid-2pt",
    family: "Solids",
    label: "Square Pyramid — 2-Point Perspective",
    description:
      "Build the visible base and apex edges of a square pyramid from a reference drawing.",
    implemented: true,
    kind: "solid-square-pyramid-2pt",
  },
  {
    id: "solids-triangular-prism-2pt",
    family: "Solids",
    label: "Triangular Prism — 2-Point Perspective",
    description:
      "Build a triangular prism in standing or lying poses from a reference drawing.",
    implemented: true,
    kind: "solid-triangular-prism-2pt",
  },
  {
    id: "solids-cube-2pt",
    family: "Solids",
    label: "Cube — 2-Point Perspective",
    description:
      "Build the visible corner-and-edge graph of a cube from a reference drawing.",
    implemented: true,
    kind: "solid-cube-2pt",
  },
  {
    id: "solids-box-2pt",
    family: "Solids",
    label: "Box — 2-Point Perspective",
    description:
      "Build a rectangular box with varied proportions from a reference drawing.",
    implemented: true,
    kind: "solid-box-2pt",
  },
  {
    id: "solids-cube-3pt",
    family: "Solids",
    label: "Cube — 3-Point Perspective",
    description:
      "Build the visible corner-and-edge graph of a cube from a steep bird's-eye or worm's-eye reference drawing.",
    implemented: true,
    kind: "solid-cube-3pt",
  },
  {
    id: "solids-box-3pt",
    family: "Solids",
    label: "Box — 3-Point Perspective",
    description:
      "Build a rectangular box with varied proportions from a steep bird's-eye or worm's-eye reference drawing.",
    implemented: true,
    kind: "solid-box-3pt",
  },
  {
    id: "solids-triangular-prism-3pt",
    family: "Solids",
    label: "Triangular Prism — 3-Point Perspective",
    description:
      "Build a triangular prism in standing or lying poses from a steep bird's-eye or worm's-eye reference drawing.",
    implemented: true,
    kind: "solid-triangular-prism-3pt",
  },
  {
    id: "solids-square-pyramid-3pt",
    family: "Solids",
    label: "Square Pyramid — 3-Point Perspective",
    description:
      "Build the visible base and apex edges of a square pyramid from a steep bird's-eye or worm's-eye reference drawing.",
    implemented: true,
    kind: "solid-square-pyramid-3pt",
  },
  {
    id: "solids-triangular-pyramid-3pt",
    family: "Solids",
    label: "Triangular Pyramid — 3-Point Perspective",
    description:
      "Build the visible base and apex edges of a triangular pyramid from a steep bird's-eye or worm's-eye reference drawing.",
    implemented: true,
    kind: "solid-triangular-pyramid-3pt",
  },
  ...angleCopyExercises(
    "angle-copy-horizontal-aligned",
    "Horizontal Reference, Aligned Base",
    "Copy an angle from a horizontal reference onto a matching base ray.",
  ),
  ...angleCopyExercises(
    "angle-copy-vertical-aligned",
    "Vertical Reference, Aligned Base",
    "Copy an angle from a vertical reference onto a matching base ray.",
  ),
  ...angleCopyExercises(
    "angle-copy-horizontal-rotated",
    "Horizontal Reference, Rotated Base",
    "Copy an angle from a horizontal reference onto a rotated base ray.",
  ),
  ...angleCopyExercises(
    "angle-copy-vertical-rotated",
    "Vertical Reference, Rotated Base",
    "Copy an angle from a vertical reference onto a rotated base ray.",
  ),
  ...angleCopyExercises(
    "angle-copy-arbitrary-aligned",
    "Arbitrary Reference, Aligned Base",
    "Copy an angle from a random reference orientation onto a matching base ray.",
  ),
  ...angleCopyExercises(
    "angle-copy-arbitrary-rotated",
    "Arbitrary Reference, Rotated Base",
    "Copy an angle from one random base orientation onto another.",
  ),
  ...divisionExercises("division-horizontal-halves", "horizontal", 2),
  ...divisionExercises("division-horizontal-thirds", "horizontal", 3),
  ...divisionExercises("division-horizontal-quarters", "horizontal", 4),
  ...divisionExercises("division-horizontal-fifths", "horizontal", 5),
  ...divisionExercises("division-vertical-halves", "vertical", 2),
  ...divisionExercises("division-vertical-thirds", "vertical", 3),
  ...divisionExercises("division-vertical-quarters", "vertical", 4),
  ...divisionExercises("division-vertical-fifths", "vertical", 5),
  ...divisionExercises("division-random-halves", "free", 2),
  ...divisionExercises("division-random-thirds", "free", 3),
  ...divisionExercises("division-random-quarters", "free", 4),
  ...divisionExercises("division-random-fifths", "free", 5),
  ...transferExercises(
    "copy-horizontal-horizontal",
    "Same-Axis Transfer",
    "Copy Horizontal to Horizontal",
    "Transfer a horizontal reference length to a horizontal guide.",
    "copy",
    "horizontal",
    "horizontal",
  ),
  ...transferExercises(
    "copy-horizontal-vertical",
    "Cross-Axis Transfer",
    "Copy Horizontal to Vertical",
    "Transfer a horizontal reference length to a vertical guide.",
    "copy",
    "horizontal",
    "vertical",
  ),
  ...transferExercises(
    "copy-vertical-vertical",
    "Same-Axis Transfer",
    "Copy Vertical to Vertical",
    "Transfer a vertical reference length to a vertical guide.",
    "copy",
    "vertical",
    "vertical",
  ),
  ...transferExercises(
    "copy-vertical-horizontal",
    "Cross-Axis Transfer",
    "Copy Vertical to Horizontal",
    "Transfer a vertical reference length to a horizontal guide.",
    "copy",
    "vertical",
    "horizontal",
  ),
  ...transferExercises(
    "copy-random-random",
    "Random-Line Transfer",
    "Copy Distance on Random Lines",
    "Transfer a random reference length to a separate random guide.",
    "copy",
    "free",
    "free",
  ),
  ...transferExercises(
    "double-horizontal-horizontal",
    "Same-Axis Transfer",
    "Double Horizontal on Horizontal",
    "Mark a point at double the shown horizontal length.",
    "double",
    "horizontal",
    "horizontal",
  ),
  ...transferExercises(
    "double-horizontal-vertical",
    "Cross-Axis Transfer",
    "Double Horizontal on Vertical",
    "Double a horizontal reference along a vertical guide.",
    "double",
    "horizontal",
    "vertical",
  ),
  ...transferExercises(
    "double-vertical-vertical",
    "Same-Axis Transfer",
    "Double Vertical on Vertical",
    "Mark a point at double the shown vertical length.",
    "double",
    "vertical",
    "vertical",
  ),
  ...transferExercises(
    "double-vertical-horizontal",
    "Cross-Axis Transfer",
    "Double Vertical on Horizontal",
    "Double a vertical reference along a horizontal guide.",
    "double",
    "vertical",
    "horizontal",
  ),
  ...transferExercises(
    "double-random-random",
    "Random-Line Transfer",
    "Double Distance on Random Lines",
    "Double a random reference length along a separate random guide.",
    "double",
    "free",
    "free",
  ),
  ...intersectionExercises(),
  {
    id: "loop-chain-freehand",
    family: "Loop Chain",
    label: "Free Loops",
    description:
      "Draw a continuous chain of small loops across the canvas to warm up your looping motion.",
    implemented: true,
    kind: "loop-chain-freehand",
  },
  {
    id: "loop-chain-linear",
    family: "Loop Chain",
    label: "Linear Loops",
    description:
      "Draw a chain of loops between two horizontal guide lines. Scored on band use, roundness, consistency, and path.",
    implemented: true,
    kind: "loop-chain-linear",
  },
  {
    id: "loop-chain-circular",
    family: "Loop Chain",
    label: "Circular Loops",
    description:
      "Draw a chain of loops following two concentric circle guides. Scored on ring use, roundness, consistency, and path.",
    implemented: true,
    kind: "loop-chain-circular",
  },
  {
    id: "loop-chain-wedge",
    family: "Loop Chain",
    label: "Wedge Loops",
    description:
      "Draw a chain of loops between two converging or diverging guide lines. Scored on wedge use, roundness, consistency, and path.",
    implemented: true,
    kind: "loop-chain-wedge",
  },
];

type AngleCopyKind = Extract<
  FreehandExerciseDefinition["kind"],
  `angle-copy-${string}`
>;

function angleCopyExercises(
  kind: AngleCopyKind,
  label: string,
  description: string,
): FreehandExerciseDefinition[] {
  return [
    {
      id: kind,
      family: "Angle Copy",
      label,
      description,
      implemented: true,
      kind,
      inputMode: "adjustable-line",
    },
    {
      id: `${kind}-adjustable-1-shot` as ExerciseId,
      family: "Angle Copy",
      label: `${label} 1-Shot`,
      description: `${description} Drag the free end of a straight segment once to commit the answer.`,
      implemented: true,
      kind,
      inputMode: "adjustable-line-1-shot",
    },
    {
      id: `${kind}-free-draw-1-shot` as ExerciseId,
      family: "Angle Copy",
      label: `${label} Free Draw 1-Shot`,
      description: `${description} Commit the first stroke immediately.`,
      implemented: true,
      kind,
      inputMode: "single-stroke",
    },
  ];
}

export const AUTO_EXERCISE_ID: ExerciseId = "division-horizontal-halves";

const EXERCISE_MAP = new Map<ExerciseId, ExerciseDefinition>(
  EXERCISES.map((exercise) => [exercise.id, exercise]),
);

export function getExerciseById(exerciseId: ExerciseId): ExerciseDefinition {
  const exercise = EXERCISE_MAP.get(exerciseId);
  if (!exercise) {
    throw new Error(`Unknown exercise id: ${exerciseId}`);
  }
  return exercise;
}

export type AutoResult = {
  exercise: ExerciseDefinition;
  reason: string;
};

/**
 * Selects the next exercise using a scored heuristic:
 *   weaknessBonus  – higher for drills with a lower EMA (unplayed drills treated as EMA=0)
 *   recencyBonus   – higher for drills not practiced recently (full bonus if never played)
 *   jitter         – small deterministic per-exercise nudge to break ties without RNG state
 *
 * The drill with the highest combined score is returned alongside a one-line reason
 * so the UI can explain the pick rather than appearing opaque.
 */
export function getAutoExercise(progress: ProgressStore): AutoResult {
  const implementedExercises = EXERCISES.filter(
    (exercise) => exercise.implemented,
  );

  const now = Date.now();
  // Recency half-life: full bonus decays to half after this many milliseconds.
  const RECENCY_HALF_LIFE_MS = 24 * 60 * 60 * 1000; // 1 day

  let best = implementedExercises[0];
  let bestScore = -Infinity;
  let bestWeakness = 0;
  let bestRecency = 0;

  for (let i = 0; i < implementedExercises.length; i++) {
    const exercise = implementedExercises[i];
    const entry = progress.aggregates[exercise.id];
    const ema = entry?.ema ?? 0;
    const lastPracticedAt = entry?.lastPracticedAt ?? 0;

    const weaknessBonus = 100 - ema;

    // Exponential decay: unplayed drills (lastPracticedAt=0) get full 100 bonus.
    const msSince = lastPracticedAt === 0 ? Infinity : now - lastPracticedAt;
    const recencyBonus =
      msSince === Infinity
        ? 100
        : 100 * Math.pow(0.5, msSince / RECENCY_HALF_LIFE_MS);

    // Deterministic per-position jitter ±5 so equal-scoring drills don't always
    // resolve in registry order. Uses index parity rather than RNG to stay testable.
    const jitter = (i % 3) * 2 - 2; // -2, 0, 2 cycling

    const total = weaknessBonus + recencyBonus + jitter;

    if (total > bestScore) {
      bestScore = total;
      best = exercise;
      bestWeakness = weaknessBonus;
      bestRecency = recencyBonus;
    }
  }

  const reason = autoReason(bestWeakness, bestRecency);
  return { exercise: best, reason };
}

function autoReason(weaknessBonus: number, recencyBonus: number): string {
  // Recency bonus >90 means never or very rarely practiced.
  if (recencyBonus > 90) return "Least practiced drill";
  if (weaknessBonus >= recencyBonus) return "Weakest recent score";
  return "Not practiced recently";
}

type DivisionExerciseId = Extract<
  ExerciseId,
  | "division-horizontal-halves"
  | "division-horizontal-thirds"
  | "division-horizontal-quarters"
  | "division-horizontal-fifths"
  | "division-vertical-halves"
  | "division-vertical-thirds"
  | "division-vertical-quarters"
  | "division-vertical-fifths"
  | "division-random-halves"
  | "division-random-thirds"
  | "division-random-quarters"
  | "division-random-fifths"
>;

function divisionExercises(
  id: DivisionExerciseId,
  axis: LineAxis,
  denominator: 2 | 3 | 4 | 5,
): SingleMarkExerciseDefinition[] {
  const base = divisionExercise(id, axis, denominator);
  return [
    {
      ...base,
      description: `${base.description} Place and revise the mark before committing.`,
      inputMode: "unlimited-adjustment",
    },
    {
      ...base,
      id: `${id}-1-shot` as ExerciseId,
      label: `${base.label} 1-Shot`,
      description: `${base.description} Commit the first mark immediately.`,
      inputMode: "single-mark",
    },
  ];
}

function divisionExercise(
  id: Extract<
    ExerciseId,
    | "division-horizontal-halves"
    | "division-horizontal-thirds"
    | "division-horizontal-quarters"
    | "division-horizontal-fifths"
    | "division-vertical-halves"
    | "division-vertical-thirds"
    | "division-vertical-quarters"
    | "division-vertical-fifths"
    | "division-random-halves"
    | "division-random-thirds"
    | "division-random-quarters"
    | "division-random-fifths"
  >,
  axis: LineAxis,
  denominator: 2 | 3 | 4 | 5,
): SingleMarkExerciseDefinition {
  const orientationLabel =
    axis === "horizontal"
      ? "Horizontal"
      : axis === "vertical"
        ? "Vertical"
        : "Random";
  const fractionLabel = denominatorLabel(denominator);
  const axisDescription = axis === "free" ? "random line" : `${axis} line`;

  return {
    id,
    family: "Division",
    label: `${orientationLabel} ${fractionLabel}`,
    description: `Divide a ${axisDescription} into ${denominator} equal parts.`,
    implemented: true,
    kind: "single-mark",
    inputMode: "single-mark",
    createTrial: (progress) =>
      createDivisionTrial(
        id,
        axis,
        denominator,
        `${orientationLabel} ${fractionLabel}`,
        progress,
      ),
  };
}

function createDivisionTrial(
  exerciseId: DivisionExerciseId,
  axis: LineAxis,
  denominator: 2 | 3 | 4 | 5,
  label: string,
  progress: ProgressStore | undefined,
): SingleMarkTrial {
  const width = 760;
  const height = axis === "horizontal" ? 320 : 640;
  const lengthRange = divisionLengthRange(axis);
  const lengthBucket =
    progress === undefined
      ? (randomInteger(0, 4) as 0 | 1 | 2 | 3 | 4)
      : selectDivisionLengthBucket(progress, exerciseId);
  const length = divisionLengthForBucket(lengthBucket, lengthRange);
  const edgePadding = 52;
  const centerOffsetSigma = 0.2;
  const orientationText =
    axis === "horizontal"
      ? "horizontal"
      : axis === "vertical"
        ? "vertical"
        : "random";
  const usesDirectionCue = denominator !== 2;
  const selectedDirectionBucket =
    usesDirectionCue && progress !== undefined
      ? selectDivisionDirectionBucket(
          progress,
          exerciseId,
          divisionDirectionBucketsForAxis(axis),
        )
      : undefined;
  const anchorDirectionSign =
    selectedDirectionBucket === undefined
      ? Math.random() < 0.5
        ? -1
        : 1
      : anchorDirectionSignForAxis(axis, selectedDirectionBucket);
  const lengthMetadata = {
    divisionLengthPixels: length,
    divisionLengthBucket: bucketDivisionLength(length, lengthRange),
  };

  if (axis === "horizontal") {
    const maxCenterOffsetX = width / 2 - length / 2 - edgePadding;
    const centerX =
      width / 2 + boundedNormalOffset(maxCenterOffsetX, centerOffsetSigma);
    const maxCenterOffsetY = height / 2 - 68;
    const anchorY =
      height / 2 + boundedNormalOffset(maxCenterOffsetY, centerOffsetSigma);
    const startScalar = centerX - length / 2;
    const endScalar = centerX + length / 2;
    const targetScalar = usesDirectionCue
      ? (anchorDirectionSign < 0 ? endScalar : startScalar) +
        anchorDirectionSign * (length / denominator)
      : startScalar + length / 2;

    const trialLine: TrialLine = {
      axis,
      anchorX: 0,
      anchorY,
      startScalar,
      endScalar,
    };
    const metadata: ProgressAttemptMetadata = {
      ...lengthMetadata,
      ...(usesDirectionCue
        ? divisionDirectionMetadata(trialLine, anchorDirectionSign)
        : {}),
    };
    return {
      label,
      prompt: divisionPrompt(orientationText, denominator, usesDirectionCue),
      viewport: { width, height },
      line: trialLine,
      progressMetadata: metadata,
      ...(usesDirectionCue
        ? {
            anchorScalar: anchorDirectionSign < 0 ? endScalar : startScalar,
            anchorDirectionSign,
          }
        : {}),
      scoreSelection: (placedScalar) =>
        scoreSelection(placedScalar, targetScalar, length, axis),
    };
  }

  if (axis === "free") {
    const directionRadians =
      selectedDirectionBucket === undefined
        ? undefined
        : directionRadiansForBucket(selectedDirectionBucket);
    const lineAngle =
      directionRadians === undefined
        ? undefined
        : directionRadians + (anchorDirectionSign < 0 ? Math.PI : 0);
    const line = createRandomLine(width, height, length, edgePadding, lineAngle);
    const targetScalar = usesDirectionCue
      ? (anchorDirectionSign < 0 ? line.endScalar : line.startScalar) +
        anchorDirectionSign * (length / denominator)
      : line.startScalar + length / 2;
    const metadata: ProgressAttemptMetadata = {
      ...lengthMetadata,
      ...(usesDirectionCue
        ? divisionDirectionMetadata(line, anchorDirectionSign)
        : {}),
    };
    return {
      label,
      prompt: divisionPrompt("random", denominator, usesDirectionCue),
      viewport: { width, height },
      line,
      progressMetadata: metadata,
      ...(usesDirectionCue
        ? {
            anchorScalar:
              anchorDirectionSign < 0 ? line.endScalar : line.startScalar,
            anchorDirectionSign,
          }
        : {}),
      scoreSelection: (placedScalar) =>
        scoreSelection(placedScalar, targetScalar, length, axis),
    };
  }

  const maxCenterOffsetY = height / 2 - length / 2 - edgePadding;
  const centerY =
    height / 2 + boundedNormalOffset(maxCenterOffsetY, centerOffsetSigma);
  const maxCenterOffsetX = width / 2 - 68;
  const anchorX =
    width / 2 + boundedNormalOffset(maxCenterOffsetX, centerOffsetSigma);
  const startScalar = centerY - length / 2;
  const endScalar = centerY + length / 2;
  const targetScalar = usesDirectionCue
    ? (anchorDirectionSign < 0 ? endScalar : startScalar) +
      anchorDirectionSign * (length / denominator)
    : startScalar + length / 2;

  const trialLine: TrialLine = {
    axis,
    anchorX,
    anchorY: 0,
    startScalar,
    endScalar,
  };
  const metadata: ProgressAttemptMetadata = {
    ...lengthMetadata,
    ...(usesDirectionCue
      ? divisionDirectionMetadata(trialLine, anchorDirectionSign)
      : {}),
  };
  return {
    label,
    prompt: divisionPrompt(orientationText, denominator, usesDirectionCue),
    viewport: { width, height },
    line: trialLine,
    progressMetadata: metadata,
    ...(usesDirectionCue
      ? {
          anchorScalar: anchorDirectionSign < 0 ? endScalar : startScalar,
          anchorDirectionSign,
        }
      : {}),
    scoreSelection: (placedScalar) =>
      scoreSelection(placedScalar, targetScalar, length, axis),
  };
}

function anchorDirectionSignForAxis(
  axis: LineAxis,
  directionBucket: number,
): -1 | 1 {
  if (axis === "horizontal") return directionBucket === 180 ? -1 : 1;
  if (axis === "vertical") return directionBucket === 270 ? -1 : 1;
  return Math.random() < 0.5 ? -1 : 1;
}

function divisionPrompt(
  orientationText: string,
  denominator: 2 | 3 | 4 | 5,
  usesDirectionCue: boolean,
): string {
  if (!usesDirectionCue) {
    return `Click where the ${orientationText} line should be divided at one half of its length.`;
  }
  return `Click where the ${orientationText} line should be marked at ${fractionPrompt(
    denominator,
  )} of its length from the indicated end.`;
}

type TransferExerciseId = Extract<
  ExerciseId,
  | "copy-horizontal-horizontal"
  | "copy-horizontal-vertical"
  | "copy-vertical-vertical"
  | "copy-vertical-horizontal"
  | "copy-random-random"
  | "double-horizontal-horizontal"
  | "double-horizontal-vertical"
  | "double-vertical-vertical"
  | "double-vertical-horizontal"
  | "double-random-random"
>;

function transferExercises(
  id: TransferExerciseId,
  family: string,
  label: string,
  description: string,
  mode: "copy" | "double",
  referenceAxis: LineAxis,
  guideAxis: LineAxis,
): SingleMarkExerciseDefinition[] {
  const base = transferExercise(
    id,
    family,
    label,
    description,
    mode,
    referenceAxis,
    guideAxis,
  );
  return [
    {
      ...base,
      description: `${description} Place and revise the mark before committing.`,
      inputMode: "unlimited-adjustment",
    },
    {
      ...base,
      id: `${id}-1-shot` as ExerciseId,
      label: `${label} 1-Shot`,
      description: `${description} Commit the first mark immediately.`,
      inputMode: "single-mark",
    },
  ];
}

function transferExercise(
  id: TransferExerciseId,
  family: string,
  label: string,
  description: string,
  mode: "copy" | "double",
  referenceAxis: LineAxis,
  guideAxis: LineAxis,
): SingleMarkExerciseDefinition {
  return {
    id,
    family,
    label,
    description,
    implemented: true,
    kind: "single-mark",
    inputMode: "single-mark",
    createTrial: (progress) =>
      createTransferTrial(mode, referenceAxis, guideAxis, label, id, progress),
  };
}

function createTransferTrial(
  mode: "copy" | "double",
  referenceAxis: LineAxis,
  guideAxis: LineAxis,
  label: string,
  exerciseId: ExerciseId,
  progress?: ProgressStore,
): SingleMarkTrial {
  const width = 760;
  const height = 640;
  const margin = 52;
  const multiplier = mode === "copy" ? 1 : 2;
  const lengthRange = transferLengthRange(mode);
  const selectedBucket =
    progress === undefined
      ? undefined
      : selectTransferLengthBucket(progress, exerciseId);
  const targetDistance =
    selectedBucket === undefined
      ? randomInteger(lengthRange.min, lengthRange.max)
      : transferTargetDistanceForBucket(selectedBucket, lengthRange);
  const referenceLength = targetDistance / multiplier;
  const progressMetadata = transferLengthMetadata(targetDistance, lengthRange);
  if (referenceAxis === "free" && guideAxis === "free") {
    return createRandomTransferTrial(
      mode,
      referenceLength,
      targetDistance,
      label,
      progressMetadata,
    );
  }
  const guideStart = margin;
  const guideEnd = (guideAxis === "horizontal" ? width : height) - margin;
  const anchorDirectionSign = Math.random() < 0.5 ? -1 : 1;
  const minAnchor =
    anchorDirectionSign < 0
      ? guideStart + targetDistance + 72
      : guideStart + 72;
  const maxAnchor =
    anchorDirectionSign < 0 ? guideEnd - 72 : guideEnd - targetDistance - 72;
  const anchorScalar = randomInteger(
    Math.min(minAnchor, maxAnchor),
    Math.max(minAnchor, maxAnchor),
  );
  const targetScalar = anchorScalar + anchorDirectionSign * targetDistance;
  const referenceLine = createTransferReferenceLine(
    referenceAxis,
    guideAxis,
    referenceLength,
    width,
    height,
    margin,
    anchorScalar,
    targetScalar,
  );
  const guideLine = createTransferGuideLine(
    guideAxis,
    width,
    height,
    margin,
    referenceLine,
  );
  const guideName = guideAxis === "horizontal" ? "horizontal" : "vertical";
  const action =
    mode === "copy"
      ? "copy the reference length"
      : "mark double the reference length";

  return {
    label,
    prompt: `Use the reference segment to ${action} on the ${guideName} guide.`,
    viewport: { width, height },
    line: guideLine,
    referenceLine,
    anchorScalar,
    anchorDirectionSign,
    progressMetadata: {
      ...progressMetadata,
      ...transferAngleMetadata(referenceLine, guideLine),
    },
    scoreSelection: (placedScalar) =>
      scoreSelection(placedScalar, targetScalar, targetDistance, guideAxis),
  };
}

function createRandomTransferTrial(
  mode: "copy" | "double",
  referenceLength: number,
  targetDistance: number,
  label: string,
  progressMetadata: ProgressAttemptMetadata,
): SingleMarkTrial {
  const width = 760;
  const height = 640;
  const margin = 52;
  const referenceLine = createRandomLineInRegion(
    { minX: margin + 18, maxX: width - margin - 18, minY: 90, maxY: 270 },
    referenceLength,
    null,
  );
  const guideLength = Math.max(470, targetDistance + 190);
  const guideLine = createRandomLineInRegion(
    { minX: margin + 18, maxX: width - margin - 18, minY: 360, maxY: 570 },
    guideLength,
    lineAngle(referenceLine),
  );
  const anchorDirectionSign = Math.random() < 0.5 ? -1 : 1;
  const minAnchor = anchorDirectionSign < 0 ? targetDistance + 72 : 72;
  const maxAnchor =
    anchorDirectionSign < 0
      ? guideLength - 72
      : guideLength - targetDistance - 72;
  const anchorScalar = randomInteger(
    Math.min(minAnchor, maxAnchor),
    Math.max(minAnchor, maxAnchor),
  );
  const targetScalar = anchorScalar + anchorDirectionSign * targetDistance;
  const action =
    mode === "copy"
      ? "copy the reference distance"
      : "mark double the reference distance";

  return {
    label,
    prompt: `Use the reference segment to ${action} on the random guide.`,
    viewport: { width, height },
    line: { ...guideLine, showEndpointTicks: false },
    referenceLine,
    anchorScalar,
    anchorDirectionSign,
    progressMetadata: {
      ...progressMetadata,
      ...transferAngleMetadata(referenceLine, guideLine),
    },
    scoreSelection: (placedScalar) =>
      scoreSelection(placedScalar, targetScalar, targetDistance, "free"),
  };
}

function createTransferGuideLine(
  guideAxis: LineAxis,
  width: number,
  height: number,
  margin: number,
  referenceLine: TrialLine,
): TrialLine {
  const startScalar = margin;
  const endScalar = (guideAxis === "horizontal" ? width : height) - margin;

  if (guideAxis === "horizontal") {
    const anchorY =
      referenceLine.axis === "horizontal"
        ? separatedCoordinate(referenceLine.anchorY, [370, 450, 530], 96)
        : randomInteger(430, 540);
    return {
      axis: guideAxis,
      anchorX: 0,
      anchorY,
      startScalar,
      endScalar,
      showEndpointTicks: false,
    };
  }

  const anchorX =
    referenceLine.axis === "vertical"
      ? separatedCoordinate(referenceLine.anchorX, [430, 520, 610], 112)
      : randomInteger(500, 650);
  return {
    axis: guideAxis,
    anchorX,
    anchorY: 0,
    startScalar,
    endScalar,
    showEndpointTicks: false,
  };
}

function createTransferReferenceLine(
  referenceAxis: LineAxis,
  guideAxis: LineAxis,
  length: number,
  width: number,
  height: number,
  margin: number,
  anchorScalar: number,
  targetScalar: number,
): TrialLine {
  if (referenceAxis === "free") {
    return createRandomLine(width, height, length, margin);
  }
  const startScalar = randomTransferReferenceStart(
    referenceAxis === "horizontal" ? width : height,
    margin,
    length,
    anchorScalar,
    targetScalar,
  );

  if (referenceAxis === "horizontal") {
    const anchorY =
      guideAxis === "horizontal"
        ? randomInteger(112, 230)
        : randomInteger(140, 260);
    return {
      axis: referenceAxis,
      anchorX: 0,
      anchorY,
      startScalar,
      endScalar: startScalar + length,
    };
  }

  const anchorX =
    guideAxis === "vertical"
      ? randomInteger(118, 250)
      : randomInteger(130, 270);
  return {
    axis: referenceAxis,
    anchorX,
    anchorY: 0,
    startScalar,
    endScalar: startScalar + length,
  };
}

function createRandomLine(
  width: number,
  height: number,
  length: number,
  margin: number,
  angle?: number,
): TrialLine {
  const region = {
    minX: margin,
    maxX: width - margin,
    minY: margin,
    maxY: height - margin,
  };
  if (angle === undefined) {
    return createRandomLineInRegion(region, length, null);
  }
  return createLineAtAngleInRegion(region, length, angle);
}

function createRandomLineInRegion(
  region: { minX: number; maxX: number; minY: number; maxY: number },
  length: number,
  avoidAngle: number | null,
): TrialLine {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const angle = randomLineAngle(avoidAngle);
    const halfX = Math.abs(Math.cos(angle) * length) / 2;
    const halfY = Math.abs(Math.sin(angle) * length) / 2;
    if (
      halfX > (region.maxX - region.minX) / 2 ||
      halfY > (region.maxY - region.minY) / 2
    ) {
      continue;
    }
    const center = {
      x: randomRange(region.minX + halfX, region.maxX - halfX),
      y: randomRange(region.minY + halfY, region.maxY - halfY),
    };
    return lineFromCenter(center, length, angle);
  }

  const center = {
    x: (region.minX + region.maxX) / 2,
    y: (region.minY + region.maxY) / 2,
  };
  return lineFromCenter(
    center,
    length,
    avoidAngle === null ? 0.45 : avoidAngle + 1.1,
  );
}

function createLineAtAngleInRegion(
  region: { minX: number; maxX: number; minY: number; maxY: number },
  length: number,
  angle: number,
): TrialLine {
  const halfX = Math.abs(Math.cos(angle) * length) / 2;
  const halfY = Math.abs(Math.sin(angle) * length) / 2;
  if (
    halfX <= (region.maxX - region.minX) / 2 &&
    halfY <= (region.maxY - region.minY) / 2
  ) {
    const center = {
      x: randomRange(region.minX + halfX, region.maxX - halfX),
      y: randomRange(region.minY + halfY, region.maxY - halfY),
    };
    return lineFromCenter(center, length, angle);
  }
  return createRandomLineInRegion(region, length, null);
}

function lineFromCenter(
  center: { x: number; y: number },
  length: number,
  angle: number,
): TrialLine {
  const half = length / 2;
  const dx = Math.cos(angle) * half;
  const dy = Math.sin(angle) * half;
  return {
    axis: "free",
    anchorX: 0,
    anchorY: 0,
    startScalar: 0,
    endScalar: length,
    startPoint: { x: center.x - dx, y: center.y - dy },
    endPoint: { x: center.x + dx, y: center.y + dy },
  };
}

function randomLineAngle(avoidAngle: number | null): number {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const angle = randomRange(-Math.PI, Math.PI);
    if (
      avoidAngle === null ||
      angleDifferenceRadians(angle, avoidAngle) > 0.55
    ) {
      return angle;
    }
  }
  return randomRange(-Math.PI, Math.PI);
}

function lineAngle(line: TrialLine): number {
  if (line.axis === "horizontal") return 0;
  if (line.axis === "vertical") return Math.PI / 2;
  const start = line.startPoint!;
  const end = line.endPoint!;
  return Math.atan2(end.y - start.y, end.x - start.x);
}

function angleDifferenceRadians(a: number, b: number): number {
  let diff = Math.abs(a - b) % Math.PI;
  if (diff > Math.PI / 2) diff = Math.PI - diff;
  return diff;
}

function randomTransferReferenceStart(
  extent: number,
  margin: number,
  length: number,
  anchorScalar: number,
  targetScalar: number,
): number {
  const minStart = margin + 18;
  const maxStart = extent - margin - length;
  const viable: number[] = [];

  // Avoid accidental endpoint alignment with the answer line; that makes the
  // exercise read as endpoint matching rather than length transfer.
  for (let start = minStart; start <= maxStart; start += 1) {
    const end = start + length;
    if (
      Math.abs(start - anchorScalar) > 28 &&
      Math.abs(start - targetScalar) > 28 &&
      Math.abs(end - anchorScalar) > 28 &&
      Math.abs(end - targetScalar) > 28
    ) {
      viable.push(start);
    }
  }

  if (viable.length === 0) {
    return randomInteger(minStart, maxStart);
  }

  return viable[randomInteger(0, viable.length - 1)];
}

function intersectionExercises(): SingleMarkExerciseDefinition[] {
  const base: SingleMarkExerciseDefinition[] = [
    {
      id: "intersection-random",
      family: "Intersection",
      label: "Projected Line Intersection",
      description:
        "Extend the short segment mentally and mark where it crosses the long segment.",
      implemented: true,
      kind: "single-mark",
      inputMode: "unlimited-adjustment",
      createTrial: createIntersectionTrial,
    },
    {
      id: "intersection-extrapolated",
      family: "Intersection",
      label: "Extrapolated Segment Intersection",
      description:
        "Extend two separated segments mentally and mark where their lines meet.",
      implemented: true,
      kind: "single-mark",
      inputMode: "unlimited-adjustment",
      createTrial: createExtrapolatedIntersectionTrial,
    },
  ];

  return base.flatMap((exercise) => [
    exercise,
    {
      ...exercise,
      id: `${exercise.id}-1-shot` as ExerciseId,
      label: `${exercise.label} 1-Shot`,
      description: `${exercise.description} Commit the first mark immediately.`,
      inputMode: "single-mark",
    },
  ]);
}

function createExtrapolatedIntersectionTrial(): SingleMarkTrial {
  const width = 760;
  const height = 520;
  const margin = 64;
  const targetPoint = {
    x: randomInteger(margin + 80, width - margin - 80),
    y: randomInteger(margin + 70, height - margin - 70),
  };

  for (let attempt = 0; attempt < 120; attempt += 1) {
    const firstAngle = randomRange(-Math.PI, Math.PI);
    const secondAngle = firstAngle + randomRange(0.65, 1.35) * randomSign();
    const first = createSegmentAwayFromPoint(
      targetPoint,
      firstAngle,
      randomInteger(86, 132),
      randomInteger(150, 250),
    );
    const second = createSegmentAwayFromPoint(
      targetPoint,
      secondAngle,
      randomInteger(86, 132),
      randomInteger(150, 250),
    );

    if (
      segmentInViewport(first, width, height, margin) &&
      segmentInViewport(second, width, height, margin)
    ) {
      return createExtrapolatedIntersectionTrialFromSegments(
        width,
        height,
        first,
        second,
        targetPoint,
      );
    }
  }

  const fallbackTarget = { x: width / 2, y: height / 2 };
  const first = createSegmentAwayFromPoint(fallbackTarget, -0.35, 104, 210);
  const second = createSegmentAwayFromPoint(fallbackTarget, 0.92, 104, 210);
  return createExtrapolatedIntersectionTrialFromSegments(
    width,
    height,
    first,
    second,
    fallbackTarget,
  );
}

function createExtrapolatedIntersectionTrialFromSegments(
  width: number,
  height: number,
  first: TrialLine,
  second: TrialLine,
  targetPoint: { x: number; y: number },
): SingleMarkTrial {
  const referenceDistance = Math.min(
    distanceBetween(targetPoint, first.endPoint!),
    distanceBetween(targetPoint, second.endPoint!),
  );
  return {
    label: "Extrapolated Segment Intersection",
    prompt: "Click where the two segments would meet if both were extended.",
    viewport: { width, height },
    line: first,
    projectionLine: second,
    projectionOrigin: targetPoint,
    scoreSelection: (placedScalar) =>
      scoreSelection(
        placedScalar,
        first.startScalar,
        referenceDistance,
        "free",
      ),
    scorePoint: (placedPoint) =>
      scoreExtrapolatedIntersectionPoint(
        placedPoint,
        targetPoint,
        referenceDistance,
      ),
  };
}

function createSegmentAwayFromPoint(
  point: { x: number; y: number },
  angle: number,
  gap: number,
  length: number,
): TrialLine {
  const unit = { x: Math.cos(angle), y: Math.sin(angle) };
  const near = {
    x: point.x + unit.x * gap,
    y: point.y + unit.y * gap,
  };
  const far = {
    x: point.x + unit.x * (gap + length),
    y: point.y + unit.y * (gap + length),
  };
  return lineFromEndpoints(far, near);
}

function segmentInViewport(
  segment: TrialLine,
  width: number,
  height: number,
  margin: number,
): boolean {
  return (
    pointInViewport(segment.startPoint!, width, height, margin) &&
    pointInViewport(segment.endPoint!, width, height, margin)
  );
}

function createIntersectionTrial(): SingleMarkTrial {
  const width = 760;
  const height = 520;
  const margin = 58;
  const longLength = randomInteger(500, 620);
  const shortLength = randomInteger(86, 132);
  const gap = randomInteger(105, 180);
  const minTargetPadding = 92;

  for (let attempt = 0; attempt < 120; attempt += 1) {
    const longLine = createRandomLineInRegion(
      {
        minX: margin,
        maxX: width - margin,
        minY: margin + 24,
        maxY: height - margin - 24,
      },
      longLength,
      null,
    );
    longLine.showEndpointTicks = false;

    const longAngle = lineAngle(longLine);
    const crossingAngle = longAngle + randomRange(0.55, 1.18) * randomSign();
    const targetScalar = randomRange(
      minTargetPadding,
      longLength - minTargetPadding,
    );
    const targetPoint = pointOnTrialLine(longLine, targetScalar);
    const rayUnit = {
      x: Math.cos(crossingAngle),
      y: Math.sin(crossingAngle),
    };
    const pointingEnd = {
      x: targetPoint.x - rayUnit.x * gap,
      y: targetPoint.y - rayUnit.y * gap,
    };
    const farEnd = {
      x: pointingEnd.x - rayUnit.x * shortLength,
      y: pointingEnd.y - rayUnit.y * shortLength,
    };

    if (
      pointInViewport(pointingEnd, width, height, margin) &&
      pointInViewport(farEnd, width, height, margin)
    ) {
      const projectionLine = lineFromEndpoints(farEnd, pointingEnd);
      return {
        label: "Projected Line Intersection",
        prompt:
          "Click where the short segment would cross the long segment if extended.",
        viewport: { width, height },
        line: longLine,
        projectionLine,
        projectionOrigin: pointingEnd,
        scoreSelection: (placedScalar) =>
          scoreIntersectionSelection(
            placedScalar,
            targetScalar,
            pointingEnd,
            targetPoint,
            pointOnTrialLine(longLine, placedScalar),
          ),
      };
    }
  }

  const longLine = lineFromCenter(
    { x: width / 2, y: height / 2 + 80 },
    longLength,
    -0.16,
  );
  longLine.showEndpointTicks = false;
  const targetScalar = longLength * 0.54;
  const targetPoint = pointOnTrialLine(longLine, targetScalar);
  const crossingAngle = lineAngle(longLine) - 0.84;
  const rayUnit = { x: Math.cos(crossingAngle), y: Math.sin(crossingAngle) };
  const pointingEnd = {
    x: targetPoint.x - rayUnit.x * gap,
    y: targetPoint.y - rayUnit.y * gap,
  };
  const farEnd = {
    x: pointingEnd.x - rayUnit.x * shortLength,
    y: pointingEnd.y - rayUnit.y * shortLength,
  };

  return {
    label: "Projected Line Intersection",
    prompt:
      "Click where the short segment would cross the long segment if extended.",
    viewport: { width, height },
    line: longLine,
    projectionLine: lineFromEndpoints(farEnd, pointingEnd),
    projectionOrigin: pointingEnd,
    scoreSelection: (placedScalar) =>
      scoreIntersectionSelection(
        placedScalar,
        targetScalar,
        pointingEnd,
        targetPoint,
        pointOnTrialLine(longLine, placedScalar),
      ),
  };
}

function scoreExtrapolatedIntersectionPoint(
  placedPoint: { x: number; y: number },
  targetPoint: { x: number; y: number },
  referenceDistance: number,
): SingleMarkTrialResult | null {
  const distanceErrorPixels = distanceBetween(placedPoint, targetPoint);
  if (distanceErrorPixels > Math.max(170, referenceDistance * 1.7)) {
    return null;
  }
  const relativeErrorPercent = clampNumber(
    (distanceErrorPixels / referenceDistance) * 100,
    0,
    100,
  );

  return {
    placedScalar: placedPoint.x,
    targetScalar: targetPoint.x,
    signedErrorPixels: distanceErrorPixels,
    relativeErrorPercent,
    relativeAccuracyPercent: 100 - relativeErrorPercent,
    directionLabel: distanceErrorPixels === 0 ? "Exact" : "Off target",
    distanceErrorPixels,
    placedPoint,
    targetPoint,
  };
}

function scoreIntersectionSelection(
  placedScalar: number,
  targetScalar: number,
  origin: { x: number; y: number },
  targetPoint: { x: number; y: number },
  placedPoint: { x: number; y: number },
): SingleMarkTrialResult {
  const targetAngle = Math.atan2(
    targetPoint.y - origin.y,
    targetPoint.x - origin.x,
  );
  const placedAngle = Math.atan2(
    placedPoint.y - origin.y,
    placedPoint.x - origin.x,
  );
  const signedAngleErrorDegrees = radiansToDegrees(
    signedAngleDifferenceRadians(placedAngle, targetAngle),
  );
  const angleErrorDegrees = Math.abs(signedAngleErrorDegrees);
  const signedErrorPixels = placedScalar - targetScalar;
  const relativeErrorPercent = clampNumber(
    (angleErrorDegrees / 15) * 100,
    0,
    100,
  );

  return {
    placedScalar,
    targetScalar,
    signedErrorPixels,
    relativeErrorPercent,
    relativeAccuracyPercent: 100 - relativeErrorPercent,
    directionLabel: directionLabel("free", signedErrorPixels),
    angleErrorDegrees,
    signedAngleErrorDegrees,
  };
}

function separatedCoordinate(
  existing: number,
  candidates: number[],
  minGap: number,
): number {
  const viable = candidates.filter(
    (candidate) => Math.abs(candidate - existing) >= minGap,
  );
  const source = viable.length > 0 ? viable : candidates;
  return source[randomInteger(0, source.length - 1)];
}

function scoreSelection(
  placedScalar: number,
  targetScalar: number,
  referenceLength: number,
  axis: LineAxis,
): SingleMarkTrialResult {
  const signedErrorPixels = placedScalar - targetScalar;
  const absoluteErrorPixels = Math.abs(signedErrorPixels);
  const relativeErrorPercent = (absoluteErrorPixels / referenceLength) * 100;
  const relativeAccuracyPercent = clamp(100 - relativeErrorPercent, 0, 100);

  return {
    placedScalar,
    targetScalar,
    signedErrorPixels,
    relativeErrorPercent,
    relativeAccuracyPercent,
    directionLabel: directionLabel(axis, signedErrorPixels),
  };
}

function pointOnTrialLine(
  line: TrialLine,
  scalar: number,
): { x: number; y: number } {
  if (line.axis === "horizontal") return { x: scalar, y: line.anchorY };
  if (line.axis === "vertical") return { x: line.anchorX, y: scalar };
  const start = line.startPoint!;
  const angle = lineAngle(line);
  return {
    x: start.x + Math.cos(angle) * scalar,
    y: start.y + Math.sin(angle) * scalar,
  };
}

function lineFromEndpoints(
  start: { x: number; y: number },
  end: { x: number; y: number },
): TrialLine {
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  return {
    axis: "free",
    anchorX: 0,
    anchorY: 0,
    startScalar: 0,
    endScalar: length,
    startPoint: start,
    endPoint: end,
    showEndpointTicks: false,
  };
}

function pointInViewport(
  point: { x: number; y: number },
  width: number,
  height: number,
  margin: number,
): boolean {
  return (
    point.x >= margin &&
    point.x <= width - margin &&
    point.y >= margin &&
    point.y <= height - margin
  );
}

function randomSign(): -1 | 1 {
  return Math.random() < 0.5 ? -1 : 1;
}

function signedAngleDifferenceRadians(a: number, b: number): number {
  let diff = a - b;
  while (diff <= -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  return diff;
}

function directionLabel(axis: LineAxis, signedErrorPixels: number): string {
  if (signedErrorPixels === 0) {
    return "Exact";
  }

  if (axis === "horizontal") {
    return signedErrorPixels < 0 ? "Too far left" : "Too far right";
  }

  if (axis === "free") {
    return signedErrorPixels < 0 ? "Too far back" : "Too far forward";
  }

  return signedErrorPixels < 0 ? "Too high" : "Too low";
}

function denominatorLabel(denominator: 2 | 3 | 4 | 5): string {
  switch (denominator) {
    case 2:
      return "Halves";
    case 3:
      return "Thirds";
    case 4:
      return "Quarters";
    case 5:
      return "Fifths";
  }
}

function fractionPrompt(denominator: 2 | 3 | 4 | 5): string {
  switch (denominator) {
    case 2:
      return "one half";
    case 3:
      return "one third";
    case 4:
      return "one quarter";
    case 5:
      return "one fifth";
  }
}

function randomInteger(min: number, max: number): number {
  const span = max - min + 1;
  return min + Math.floor(Math.random() * span);
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function boundedNormalOffset(
  maxMagnitude: number,
  sigmaFraction: number,
): number {
  if (maxMagnitude <= 0) {
    return 0;
  }

  const sigma = maxMagnitude * sigmaFraction;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = gaussianRandom() * sigma;
    if (Math.abs(candidate) <= maxMagnitude) {
      return candidate;
    }
  }

  return clamp(gaussianRandom() * sigma, -maxMagnitude, maxMagnitude);
}

function gaussianRandom(): number {
  let u = 0;
  let v = 0;

  while (u === 0) {
    u = Math.random();
  }

  while (v === 0) {
    v = Math.random();
  }

  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
