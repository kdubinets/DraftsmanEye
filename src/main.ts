/**
 * App bootstrap: mounts the root element and drives top-level screen transitions.
 * Each screen owns its DOM, timers, and listeners; navigate() calls the previous
 * screen's cleanup before mounting the next one.
 */
import './styles/main.css';
import { getMountableById } from './exercises/registry';
import { mountScreen } from './app/screens';
import { mountListScreen } from './screens/list';
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

  const exercise = getMountableById(state.exerciseId);
  const { source } = state;
  currentCleanup = mountScreen(root, (r) => exercise.mount(r, source, navigate));
}
