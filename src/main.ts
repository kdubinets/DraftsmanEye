/**
 * App bootstrap: mounts the root element and drives top-level screen transitions.
 * Each screen owns its DOM, timers, and listeners; navigate() calls the previous
 * screen's cleanup before mounting the next one.
 *
 * URL scheme:
 *   /                        → list screen
 *   /exercise/:id            → exercise screen (source defaults to 'direct' on deep-link)
 */
import './styles/main.css';
import { getMountableById } from './exercises/registry';
import { mountScreen } from './app/screens';
import { mountListScreen } from './screens/list';
import type { AppState } from './app/state';
import type { ExerciseId } from './practice/catalog';

const rootEl = document.querySelector<HTMLElement>('#app');
if (!rootEl) {
  throw new Error('Expected #app root element.');
}
const root: HTMLElement = rootEl;

let currentCleanup: () => void = () => {};

// Parse the current URL into an AppState, falling back to list for unknown paths.
function stateFromUrl(): AppState {
  const match = /^\/exercise\/([^/]+)$/.exec(window.location.pathname);
  if (match) {
    return { screen: 'exercise', exerciseId: match[1] as ExerciseId, source: 'direct' };
  }
  return { screen: 'list' };
}

function urlFromState(state: AppState): string {
  return state.screen === 'exercise' ? `/exercise/${state.exerciseId}` : '/';
}

window.addEventListener('popstate', () => {
  mountState(stateFromUrl());
});

navigate(stateFromUrl());

function navigate(next: AppState): void {
  history.pushState(null, '', urlFromState(next));
  mountState(next);
}

function mountState(state: AppState): void {
  currentCleanup();

  if (state.screen === 'list') {
    currentCleanup = mountScreen(root, (r) => mountListScreen(r, navigate));
    return;
  }

  let exercise;
  try {
    exercise = getMountableById(state.exerciseId);
  } catch (err) {
    console.error('Unknown exercise id; falling back to list.', err);
    navigate({ screen: 'list' });
    return;
  }

  const { source } = state;
  currentCleanup = mountScreen(root, (r) => {
    try {
      return exercise.mount(r, source, navigate);
    } catch (err) {
      console.error('Exercise mount failed; falling back to list.', err);
      navigate({ screen: 'list' });
      return () => {};
    }
  });
}
