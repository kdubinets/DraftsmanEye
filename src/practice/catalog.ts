/**
 * Defines selectable drills and their trial generation and scoring behavior.
 */
import type { StoredProgress } from '../storage/progress';

export type ExerciseId =
  | 'division-horizontal-halves'
  | 'division-vertical-thirds'
  | 'copy-horizontal-horizontal'
  | 'copy-horizontal-vertical'
  | 'double-vertical-vertical'
  | 'double-vertical-horizontal';

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
  line: {
    startX: number;
    endX: number;
    y: number;
  };
  scoreSelection: (placedX: number) => SingleMarkTrialResult;
};

export type SingleMarkTrialResult = {
  placedX: number;
  targetX: number;
  signedErrorPixels: number;
  relativeErrorPercent: number;
  relativeAccuracyPercent: number;
  directionLabel: string;
};

export type ExerciseDefinition = ExerciseBase & {
  createTrial: () => SingleMarkTrial;
};

export const EXERCISES: ExerciseDefinition[] = [
  horizontalHalvesExercise(),
  placeholderExercise(
    'division-vertical-thirds',
    'Division',
    'Vertical Thirds',
    'Divide a vertical line into thirds.',
  ),
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

function horizontalHalvesExercise(): ExerciseDefinition {
  return {
    id: 'division-horizontal-halves',
    family: 'Division',
    label: 'Horizontal Halves',
    description: 'Divide a horizontal line in half.',
    createTrial: () => {
      const width = 760;
      const height = 320;
      const length = randomInteger(280, 520);
      const edgePadding = 52;
      const maxCenterOffsetX = width / 2 - length / 2 - edgePadding;
      const centerX = width / 2 + boundedNormalOffset(maxCenterOffsetX, 0.2);
      const startX = centerX - length / 2;
      const endX = centerX + length / 2;
      const maxCenterOffsetY = height / 2 - 68;
      const y = height / 2 + boundedNormalOffset(maxCenterOffsetY, 0.2);
      const targetX = (startX + endX) / 2;

      return {
        label: 'Horizontal Halves',
        prompt: 'Click where the line should be divided into two equal halves.',
        viewport: { width, height },
        line: { startX, endX, y },
        scoreSelection: (placedX) => scoreHorizontalSelection(placedX, targetX, length),
      };
    },
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
      line: { startX: 180, endX: 580, y: 160 },
      scoreSelection: (placedX) => scoreHorizontalSelection(placedX, 380, 400),
    }),
  };
}

function scoreHorizontalSelection(
  placedX: number,
  targetX: number,
  referenceLength: number,
): SingleMarkTrialResult {
  const signedErrorPixels = placedX - targetX;
  const absoluteErrorPixels = Math.abs(signedErrorPixels);
  const relativeErrorPercent = (absoluteErrorPixels / referenceLength) * 100;
  const relativeAccuracyPercent = clamp(100 - relativeErrorPercent, 0, 100);

  return {
    placedX,
    targetX,
    signedErrorPixels,
    relativeErrorPercent,
    relativeAccuracyPercent,
    directionLabel:
      signedErrorPixels < 0 ? 'Too far left' : signedErrorPixels > 0 ? 'Too far right' : 'Exact',
  };
}

function randomInteger(min: number, max: number): number {
  const span = max - min + 1;
  return min + Math.floor(Math.random() * span);
}

function boundedNormalOffset(maxMagnitude: number, sigmaFraction: number): number {
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
