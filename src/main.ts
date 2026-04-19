/**
 * App bootstrap: mounts the root element and drives top-level screen transitions.
 * All exercise rendering, geometry, and scoring live in their own modules; this file
 * owns only the routing loop and the renderVersion guard.
 *
 * TODO (PR 3): replace renderVersion + renderApp() with a Screen lifecycle so each
 * screen cancels its own timers and listeners on unmount.
 */
import './styles/main.css';
import { getExerciseById } from './practice/catalog';
import type { FreehandExerciseDefinition, SingleMarkExerciseDefinition } from './practice/catalog';
import { renderListScreen } from './screens/list';
import { renderSingleMarkExerciseScreen } from './screens/singleMark';
import { renderFreehandExerciseScreen } from './screens/freehand';
import type { AppState } from './app/state';

const rootEl = document.querySelector<HTMLElement>('#app');
if (!rootEl) {
  throw new Error('Expected #app root element.');
}
const root: HTMLElement = rootEl;

let state: AppState = { screen: 'list' };
let renderVersion = 0;

renderApp();

function navigate(next: AppState): void {
  state = next;
  renderApp();
}

function renderApp(): void {
  renderVersion += 1;
  const thisRender = renderVersion;
  root.replaceChildren();

  if (state.screen === 'list') {
    root.append(renderListScreen(navigate));
    return;
  }

  const exercise = getExerciseById(state.exerciseId);

  if (exercise.kind === 'single-mark') {
    root.append(
      renderSingleMarkExerciseScreen(
        exercise as SingleMarkExerciseDefinition,
        state.source,
        navigate,
      ),
    );
    return;
  }

  // All remaining kinds are freehand variants.
  root.append(
    renderFreehandExerciseScreen(
      exercise as FreehandExerciseDefinition,
      state.source,
      navigate,
      thisRender,
      () => renderVersion,
    ),
  );
}
