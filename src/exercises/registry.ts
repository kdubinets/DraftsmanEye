/**
 * Binds each exercise definition to its screen mount function.
 * Keeps catalog.ts free of screen/state dependencies by doing the wiring here.
 */
import { EXERCISES, getExerciseById, getAutoExercise } from '../practice/catalog';
import type {
  ExerciseDefinition,
  ExerciseId,
  FreehandExerciseDefinition,
} from '../practice/catalog';
import { mountSingleMarkScreen } from '../screens/singleMark';
import { mountFreehandScreen } from '../screens/freehand';
import { scoreFreehandLine, scoreTargetLine } from '../scoring/line';
import { scoreFreehandCircle, scoreTargetCircle } from '../scoring/circle';
import { scoreFreehandEllipse, scoreTargetEllipse } from '../scoring/ellipse';
import { createFreehandTarget } from './freehand/targets';
import type { FreehandExerciseConfig, FreehandPoint, FreehandTarget } from './freehand/types';
import type { AppState } from '../app/state';

export type MountableExercise = ExerciseDefinition & {
  mount(root: HTMLElement, source: 'direct' | 'auto', onNavigate: (next: AppState) => void): () => void;
};

type FreehandKind = FreehandExerciseDefinition['kind'];

function freehandConfig(kind: FreehandKind): FreehandExerciseConfig {
  return FREEHAND_CONFIGS[kind];
}

const FREEHAND_CONFIGS = {
  'freehand-line': {
    isClosedShape: false,
    createTarget: () => null,
    scoreStroke: (points) => scoreFreehandLine(points),
    promptText: 'Draw one straight line in the field.',
    readyText: 'Use Pencil, touch, or mouse to draw one line.',
    retryText: 'Stroke was too short. Draw a longer line.',
    canvasLabel: 'Straight line drawing field',
  },
  'freehand-circle': {
    isClosedShape: true,
    createTarget: () => null,
    scoreStroke: (points) => scoreFreehandCircle(points),
    promptText: 'Draw one circle in the field.',
    readyText: 'Use Pencil, touch, or mouse to draw one circle.',
    retryText: 'Stroke was too short. Draw a larger circle.',
    canvasLabel: 'Circle drawing field',
  },
  'freehand-ellipse': {
    isClosedShape: true,
    createTarget: () => null,
    scoreStroke: (points) => scoreFreehandEllipse(points),
    promptText: 'Draw one ellipse in the field.',
    readyText: 'Use Pencil, touch, or mouse to draw one ellipse.',
    retryText: 'Stroke was too short. Draw a larger ellipse.',
    canvasLabel: 'Ellipse drawing field',
  },
  'target-line-two-points': {
    isClosedShape: false,
    createTarget: () => createFreehandTarget('target-line-two-points'),
    scoreStroke: (points: FreehandPoint[], target: FreehandTarget | null) =>
      target?.kind === 'line' ? scoreTargetLine(points, target) : null,
    promptText: 'Draw one straight line connecting the two marks.',
    readyText: 'Use Pencil, touch, or mouse to connect the two marks.',
    retryText: 'Stroke was too short. Connect the two marks.',
    canvasLabel: 'Straight line drawing field',
  },
  'target-circle-center-point': {
    isClosedShape: true,
    createTarget: () => createFreehandTarget('target-circle-center-point'),
    scoreStroke: (points: FreehandPoint[], target: FreehandTarget | null) =>
      target?.kind === 'circle' ? scoreTargetCircle(points, target) : null,
    promptText: 'Draw a circle using the center and radius point.',
    readyText: 'Use Pencil, touch, or mouse to draw the target circle.',
    retryText: 'Stroke was too short. Draw a larger circle.',
    canvasLabel: 'Circle drawing field',
  },
  'target-circle-three-points': {
    isClosedShape: true,
    createTarget: () => createFreehandTarget('target-circle-three-points'),
    scoreStroke: (points: FreehandPoint[], target: FreehandTarget | null) =>
      target?.kind === 'circle' ? scoreTargetCircle(points, target) : null,
    promptText: 'Draw a circle through the three marks.',
    readyText: 'Use Pencil, touch, or mouse to pass through the three marks.',
    retryText: 'Stroke was too short. Draw a larger circle.',
    canvasLabel: 'Circle drawing field',
  },
  'trace-line': {
    isClosedShape: false,
    createTarget: () => createFreehandTarget('trace-line'),
    scoreStroke: (points: FreehandPoint[], target: FreehandTarget | null) =>
      target?.kind === 'line' ? scoreTargetLine(points, target) : null,
    promptText: 'Trace the faint straight guide.',
    readyText: 'Use Pencil, touch, or mouse to trace the faint guide.',
    retryText: 'Stroke was too short. Trace more of the line.',
    canvasLabel: 'Straight line drawing field',
  },
  'trace-circle': {
    isClosedShape: true,
    createTarget: () => createFreehandTarget('trace-circle'),
    scoreStroke: (points: FreehandPoint[], target: FreehandTarget | null) =>
      target?.kind === 'circle' ? scoreTargetCircle(points, target) : null,
    promptText: 'Trace the faint circle guide.',
    readyText: 'Use Pencil, touch, or mouse to trace the faint guide.',
    retryText: 'Stroke was too short. Draw a larger circle.',
    canvasLabel: 'Circle drawing field',
  },
  'trace-ellipse': {
    isClosedShape: true,
    createTarget: () => createFreehandTarget('trace-ellipse'),
    scoreStroke: (points: FreehandPoint[], target: FreehandTarget | null) =>
      target?.kind === 'ellipse' ? scoreTargetEllipse(points, target) : null,
    promptText: 'Trace the faint ellipse guide.',
    readyText: 'Use Pencil, touch, or mouse to trace the faint guide.',
    retryText: 'Stroke was too short. Draw a larger ellipse.',
    canvasLabel: 'Ellipse drawing field',
  },
} satisfies Record<FreehandKind, FreehandExerciseConfig>;

function toMountable(exercise: ExerciseDefinition): MountableExercise {
  if (!exercise.implemented) {
    return {
      ...exercise,
      mount(_root, _source, onNavigate) {
        console.error(`Exercise "${exercise.id}" is not implemented; falling back to list.`);
        queueMicrotask(() => onNavigate({ screen: 'list' }));
        return () => {};
      },
    };
  }

  if (exercise.kind === 'single-mark') {
    return {
      ...exercise,
      mount(root, source, onNavigate) {
        return mountSingleMarkScreen(root, exercise, source, onNavigate);
      },
    };
  }

  const config = freehandConfig(exercise.kind);
  return {
    ...exercise,
    mount(root, source, onNavigate) {
      return mountFreehandScreen(root, exercise, config, source, onNavigate);
    },
  };
}

export const MOUNTABLE_EXERCISES: MountableExercise[] = EXERCISES.map(toMountable);

const MOUNTABLE_MAP = new Map<ExerciseId, MountableExercise>(
  MOUNTABLE_EXERCISES.map((e) => [e.id, e]),
);

export function getMountableById(exerciseId: ExerciseId): MountableExercise {
  const exercise = MOUNTABLE_MAP.get(exerciseId);
  if (!exercise) {
    throw new Error(`Unknown exercise id: ${exerciseId}`);
  }
  return exercise;
}

export { getExerciseById, getAutoExercise, EXERCISES };
