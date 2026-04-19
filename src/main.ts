/**
 * App bootstrap: mounts the root element and drives top-level screen transitions.
 * Each screen owns its DOM, timers, and listeners; navigate() calls the previous
 * screen's cleanup before mounting the next one.
 */
import './styles/main.css';
import { getExerciseById } from './practice/catalog';
import type { FreehandExerciseDefinition, SingleMarkExerciseDefinition } from './practice/catalog';
import { mountScreen } from './app/screens';
import { mountListScreen } from './screens/list';
import { mountSingleMarkScreen } from './screens/singleMark';
import { mountFreehandScreen } from './screens/freehand';
import type { AppState } from './app/state';

const rootEl = document.querySelector<HTMLElement>('#app');
if (!rootEl) {
  throw new Error('Expected #app root element.');
}
const root: HTMLElement = rootEl;

let state: AppState = { screen: 'list' };
let currentCleanup: () => void = () => {};

navigate({ screen: 'list' });

function navigate(next: AppState): void {
  state = next;
  currentCleanup();

  if (state.screen === 'list') {
    currentCleanup = mountScreen(root, (r) => mountListScreen(r, navigate));
    return;
  }

  const exercise = getExerciseById(state.exerciseId);

  if (!exercise.implemented) {
    console.error(`Exercise "${state.exerciseId}" is not implemented; falling back to list.`);
    navigate({ screen: 'list' });
    return;
  }

  const { source } = state;

  if (exercise.kind === 'single-mark') {
    currentCleanup = mountScreen(root, (r) =>
      mountSingleMarkScreen(r, exercise as SingleMarkExerciseDefinition, source, navigate),
    );
    return;
  }

  // All remaining kinds are freehand variants.
  currentCleanup = mountScreen(root, (r) =>
    mountFreehandScreen(r, exercise as FreehandExerciseDefinition, source, navigate),
  );
}
