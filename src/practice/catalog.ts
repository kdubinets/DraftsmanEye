/**
 * Defines selectable drills and their trial generation and scoring behavior.
 */
import type { ProgressStore } from '../storage/progress';

export type ExerciseId =
  | 'freehand-straight-line'
  | 'freehand-circle'
  | 'freehand-ellipse'
  | 'target-line-two-points'
  | 'target-circle-center-point'
  | 'target-circle-three-points'
  | 'trace-line'
  | 'trace-circle'
  | 'trace-ellipse'
  | 'division-horizontal-halves'
  | 'division-horizontal-thirds'
  | 'division-horizontal-quarters'
  | 'division-horizontal-fifths'
  | 'division-vertical-halves'
  | 'division-vertical-thirds'
  | 'division-vertical-quarters'
  | 'division-vertical-fifths'
  | 'copy-horizontal-horizontal'
  | 'copy-horizontal-vertical'
  | 'copy-vertical-vertical'
  | 'copy-vertical-horizontal'
  | 'double-horizontal-horizontal'
  | 'double-horizontal-vertical'
  | 'double-vertical-vertical'
  | 'double-vertical-horizontal';

export type LineAxis = 'horizontal' | 'vertical';

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
  scoreSelection: (placedScalar: number) => SingleMarkTrialResult;
};

export type TrialLine = {
  axis: LineAxis;
  anchorX: number;
  anchorY: number;
  startScalar: number;
  endScalar: number;
};

export type SingleMarkTrialResult = {
  placedScalar: number;
  targetScalar: number;
  signedErrorPixels: number;
  relativeErrorPercent: number;
  relativeAccuracyPercent: number;
  directionLabel: string;
};

export type SingleMarkExerciseDefinition = ExerciseBase & {
  implemented: true;
  kind: 'single-mark';
  createTrial: () => SingleMarkTrial;
};

export type FreehandExerciseDefinition = ExerciseBase & {
  implemented: true;
  kind:
    | 'freehand-line'
    | 'freehand-circle'
    | 'freehand-ellipse'
    | 'target-line-two-points'
    | 'target-circle-center-point'
    | 'target-circle-three-points'
    | 'trace-line'
    | 'trace-circle'
    | 'trace-ellipse';
};

export type UnimplementedExerciseDefinition = ExerciseBase & {
  implemented: false;
};

export type ExerciseDefinition =
  | SingleMarkExerciseDefinition
  | FreehandExerciseDefinition
  | UnimplementedExerciseDefinition;

export const EXERCISES: ExerciseDefinition[] = [
  {
    id: 'freehand-straight-line',
    family: 'Freehand Control',
    label: 'Straight Line',
    description: 'Draw one deliberate line and compare it with its best fit.',
    implemented: true,
    kind: 'freehand-line',
  },
  {
    id: 'freehand-circle',
    family: 'Freehand Control',
    label: 'Circle',
    description: 'Draw one deliberate circle and compare it with its best fit.',
    implemented: true,
    kind: 'freehand-circle',
  },
  {
    id: 'freehand-ellipse',
    family: 'Freehand Control',
    label: 'Ellipse',
    description: 'Draw one deliberate ellipse and compare it with its best fit.',
    implemented: true,
    kind: 'freehand-ellipse',
  },
  {
    id: 'target-line-two-points',
    family: 'Target Drawing',
    label: 'Line Through Two Points',
    description: 'Draw a straight line connecting the shown endpoint marks.',
    implemented: true,
    kind: 'target-line-two-points',
  },
  {
    id: 'target-circle-center-point',
    family: 'Target Drawing',
    label: 'Circle From Center',
    description: 'Draw a circle from the shown center and radius point.',
    implemented: true,
    kind: 'target-circle-center-point',
  },
  {
    id: 'target-circle-three-points',
    family: 'Target Drawing',
    label: 'Circle Through Three Points',
    description: 'Draw a circle passing through the three shown points.',
    implemented: true,
    kind: 'target-circle-three-points',
  },
  {
    id: 'trace-line',
    family: 'Trace Control',
    label: 'Trace Line',
    description: 'Trace the faint straight guide as accurately as possible.',
    implemented: true,
    kind: 'trace-line',
  },
  {
    id: 'trace-circle',
    family: 'Trace Control',
    label: 'Trace Circle',
    description: 'Trace the faint circle guide as accurately as possible.',
    implemented: true,
    kind: 'trace-circle',
  },
  {
    id: 'trace-ellipse',
    family: 'Trace Control',
    label: 'Trace Ellipse',
    description: 'Trace the faint ellipse guide as accurately as possible.',
    implemented: true,
    kind: 'trace-ellipse',
  },
  divisionExercise('division-horizontal-halves', 'horizontal', 2),
  divisionExercise('division-horizontal-thirds', 'horizontal', 3),
  divisionExercise('division-horizontal-quarters', 'horizontal', 4),
  divisionExercise('division-horizontal-fifths', 'horizontal', 5),
  divisionExercise('division-vertical-halves', 'vertical', 2),
  divisionExercise('division-vertical-thirds', 'vertical', 3),
  divisionExercise('division-vertical-quarters', 'vertical', 4),
  divisionExercise('division-vertical-fifths', 'vertical', 5),
  placeholderExercise(
    'copy-horizontal-horizontal',
    'Same-Axis Transfer',
    'Copy Horizontal to Horizontal',
    'Transfer a horizontal reference length to a horizontal guide.',
  ),
  placeholderExercise(
    'copy-horizontal-vertical',
    'Cross-Axis Transfer',
    'Copy Horizontal to Vertical',
    'Transfer a horizontal reference length to a vertical guide.',
  ),
  placeholderExercise(
    'copy-vertical-vertical',
    'Same-Axis Transfer',
    'Copy Vertical to Vertical',
    'Transfer a vertical reference length to a vertical guide.',
  ),
  placeholderExercise(
    'copy-vertical-horizontal',
    'Cross-Axis Transfer',
    'Copy Vertical to Horizontal',
    'Transfer a vertical reference length to a horizontal guide.',
  ),
  placeholderExercise(
    'double-horizontal-horizontal',
    'Same-Axis Transfer',
    'Double Horizontal on Horizontal',
    'Mark a point at double the shown horizontal length.',
  ),
  placeholderExercise(
    'double-horizontal-vertical',
    'Cross-Axis Transfer',
    'Double Horizontal on Vertical',
    'Double a horizontal reference along a vertical guide.',
  ),
  placeholderExercise(
    'double-vertical-vertical',
    'Same-Axis Transfer',
    'Double Vertical on Vertical',
    'Mark a point at double the shown vertical length.',
  ),
  placeholderExercise(
    'double-vertical-horizontal',
    'Cross-Axis Transfer',
    'Double Vertical on Horizontal',
    'Double a vertical reference along a horizontal guide.',
  ),
];

export const AUTO_EXERCISE_ID: ExerciseId = 'division-horizontal-halves';

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
  const implementedExercises = EXERCISES.filter((exercise) => exercise.implemented);

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
    const recencyBonus = msSince === Infinity ? 100 : 100 * Math.pow(0.5, msSince / RECENCY_HALF_LIFE_MS);

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
  if (recencyBonus > 90) return 'Least practiced drill';
  if (weaknessBonus >= recencyBonus) return 'Weakest recent score';
  return 'Not practiced recently';
}

function divisionExercise(
  id: Extract<
    ExerciseId,
    | 'division-horizontal-halves'
    | 'division-horizontal-thirds'
    | 'division-horizontal-quarters'
    | 'division-horizontal-fifths'
    | 'division-vertical-halves'
    | 'division-vertical-thirds'
    | 'division-vertical-quarters'
    | 'division-vertical-fifths'
  >,
  axis: LineAxis,
  denominator: 2 | 3 | 4 | 5,
): SingleMarkExerciseDefinition {
  const orientationLabel = axis === 'horizontal' ? 'Horizontal' : 'Vertical';
  const fractionLabel = denominatorLabel(denominator);

  return {
    id,
    family: 'Division',
    label: `${orientationLabel} ${fractionLabel}`,
    description: `Divide a ${axis} line into ${denominator} equal parts.`,
    implemented: true,
    kind: 'single-mark',
    createTrial: () =>
      createDivisionTrial(
        axis,
        denominator,
        `${orientationLabel} ${fractionLabel}`,
      ),
  };
}

function createDivisionTrial(
  axis: LineAxis,
  denominator: 2 | 3 | 4 | 5,
  label: string,
): SingleMarkTrial {
  const width = 760;
  const height = axis === 'horizontal' ? 320 : 640;
  const length =
    axis === 'horizontal' ? randomInteger(280, 520) : randomInteger(360, 520);
  const edgePadding = 52;
  const centerOffsetSigma = 0.2;
  const orientationText = axis === 'horizontal' ? 'horizontal' : 'vertical';

  if (axis === 'horizontal') {
    const maxCenterOffsetX = width / 2 - length / 2 - edgePadding;
    const centerX =
      width / 2 + boundedNormalOffset(maxCenterOffsetX, centerOffsetSigma);
    const maxCenterOffsetY = height / 2 - 68;
    const anchorY =
      height / 2 + boundedNormalOffset(maxCenterOffsetY, centerOffsetSigma);
    const startScalar = centerX - length / 2;
    const endScalar = centerX + length / 2;
    const targetScalar = startScalar + length / denominator;

    return {
      label,
      prompt: `Click where the ${orientationText} line should be divided at ${fractionPrompt(
        denominator,
      )} of its length.`,
      viewport: { width, height },
      line: { axis, anchorX: 0, anchorY, startScalar, endScalar },
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
  const targetScalar = startScalar + length / denominator;

  return {
    label,
    prompt: `Click where the ${orientationText} line should be divided at ${fractionPrompt(
      denominator,
    )} of its length.`,
    viewport: { width, height },
    line: { axis, anchorX, anchorY: 0, startScalar, endScalar },
    scoreSelection: (placedScalar) =>
      scoreSelection(placedScalar, targetScalar, length, axis),
  };
}

function placeholderExercise(
  id: ExerciseId,
  family: string,
  label: string,
  description: string,
): UnimplementedExerciseDefinition {
  return {
    id,
    family,
    label,
    description,
    implemented: false,
  };
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

function directionLabel(axis: LineAxis, signedErrorPixels: number): string {
  if (signedErrorPixels === 0) {
    return 'Exact';
  }

  if (axis === 'horizontal') {
    return signedErrorPixels < 0 ? 'Too far left' : 'Too far right';
  }

  return signedErrorPixels < 0 ? 'Too high' : 'Too low';
}

function denominatorLabel(denominator: 2 | 3 | 4 | 5): string {
  switch (denominator) {
    case 2:
      return 'Halves';
    case 3:
      return 'Thirds';
    case 4:
      return 'Quarters';
    case 5:
      return 'Fifths';
  }
}

function fractionPrompt(denominator: 2 | 3 | 4 | 5): string {
  switch (denominator) {
    case 2:
      return 'one half';
    case 3:
      return 'one third';
    case 4:
      return 'one quarter';
    case 5:
      return 'one fifth';
  }
}

function randomInteger(min: number, max: number): number {
  const span = max - min + 1;
  return min + Math.floor(Math.random() * span);
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
