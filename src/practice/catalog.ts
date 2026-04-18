/**
 * Defines selectable drills and their trial generation and scoring behavior.
 */
import type { StoredProgress } from '../storage/progress';

export type ExerciseId =
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

export type ExerciseDefinition = ExerciseBase & {
  createTrial: () => SingleMarkTrial;
};

export const EXERCISES: ExerciseDefinition[] = [
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

export function getAutoExercise(progress: StoredProgress): ExerciseDefinition {
  let selected = EXERCISES[0];
  let lowestScore = Number.POSITIVE_INFINITY;
  let lowestAttempts = Number.POSITIVE_INFINITY;

  for (const exercise of EXERCISES) {
    const entry = progress[exercise.id];
    const attempts = entry?.attempts ?? 0;
    const emaScore = entry?.emaScore ?? 0;

    if (attempts < lowestAttempts) {
      lowestAttempts = attempts;
      lowestScore = emaScore;
      selected = exercise;
      continue;
    }

    if (attempts === lowestAttempts && emaScore < lowestScore) {
      lowestScore = emaScore;
      selected = exercise;
    }
  }

  return selected;
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
): ExerciseDefinition {
  const orientationLabel = axis === 'horizontal' ? 'Horizontal' : 'Vertical';
  const fractionLabel = denominatorLabel(denominator);

  return {
    id,
    family: 'Division',
    label: `${orientationLabel} ${fractionLabel}`,
    description: `Divide a ${axis} line into ${denominator} equal parts.`,
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
): ExerciseDefinition {
  return {
    id,
    family,
    label,
    description,
    createTrial: () => ({
      label,
      prompt: 'This drill is not implemented yet.',
      viewport: { width: 760, height: 320 },
      line: {
        axis: 'horizontal',
        anchorX: 0,
        anchorY: 160,
        startScalar: 180,
        endScalar: 580,
      },
      scoreSelection: (placedScalar) =>
        scoreSelection(placedScalar, 380, 400, 'horizontal'),
    }),
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
