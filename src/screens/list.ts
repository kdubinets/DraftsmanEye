/**
 * List screen: app home page showing the exercise grid, Auto card, and per-drill scores.
 * Calls getAutoExercise() on the stored progress snapshot so the Auto button always
 * reflects current performance data rather than a static fallback ID.
 */
import { EXERCISES, getAutoExercise } from '../practice/catalog';
import type { ExerciseDefinition } from '../practice/catalog';
import { getStoredProgress, filterStaleAggregates } from '../storage/progress';
import type { ProgressStore } from '../storage/progress';
import { pageShell, formatScore, actionButton } from '../render/components';
import { h } from '../render/h';
import type { AppState } from '../app/state';

const FAMILY_ORDER = [
  'Division',
  'Length Transfer',
  'Angle Copy',
  'Intersection',
  'Freehand Control',
  'Trace Control',
  'Target Drawing',
];

export function mountListScreen(
  root: HTMLElement,
  onNavigate: (next: AppState) => void,
): () => void {
  const knownIds = new Set(EXERCISES.map((e) => e.id));
  const progress = filterStaleAggregates(getStoredProgress(), knownIds);
  let activeFamily: string | null = null;
  const familyNav = h('div', { class: 'exercise-filter-list' });
  const groupedList = h('div', { class: 'exercise-group-list' });

  function renderExerciseIndex(): void {
    familyNav.replaceChildren(...familyFilterButtons(activeFamily, (nextFamily) => {
      activeFamily = nextFamily;
      renderExerciseIndex();
    }));
    groupedList.replaceChildren(
      ...visibleFamilies(activeFamily).map((family) =>
        exerciseFamilySection(
          family,
          exercisesByFamily(family),
          progress,
          onNavigate,
        ),
      ),
    );
  }

  renderExerciseIndex();

  root.append(
    pageShell(
      headerBlock(onNavigate),
      autoCard(onNavigate, progress),
      exerciseIndex(familyNav, groupedList),
    ),
  );
  return () => {};
}

function headerBlock(onNavigate: (next: AppState) => void): HTMLElement {
  const img = h('img', { class: 'hero-image', alt: '' });
  img.setAttribute('src', '/title-image.webp');
  return h('header', { class: 'hero' }, [
    h('div', { class: 'hero-content' }, [
      h('p', { class: 'eyebrow' }, ['Draftsman Eye']),
      h('h1', {}, ['Choose a drill and keep the loop short.']),
      h('p', { class: 'hero-copy' }, [
        'Practice one skill at a time, review the result immediately, then repeat, return to the list, or let Auto choose the next drill.',
      ]),
      h('button', { type: 'button', class: 'hero-settings-link', on: { click: () => onNavigate({ screen: 'settings' }) } }, [
        'Settings',
      ]),
    ]),
    img,
  ]);
}

function autoCard(
  onNavigate: (next: AppState) => void,
  progress: ProgressStore,
): HTMLElement {
  const { exercise: next, reason } = getAutoExercise(progress);
  return h('section', { class: 'auto-card' }, [
    h('p', { class: 'card-kicker' }, ['Auto']),
    h('h2', {}, ['Let the app choose the next drill.']),
    h('p', { class: 'auto-suggestion' }, [`Next up: ${next.label} — ${reason}`]),
    h('button', {
      type: 'button',
      class: 'primary-action',
      on: { click: () => onNavigate({ screen: 'exercise', exerciseId: next.id, source: 'auto' }) },
    }, ['Start Auto']),
  ]);
}

function exerciseIndex(familyNav: HTMLElement, groupedList: HTMLElement): HTMLElement {
  return h('section', { class: 'exercise-section' }, [
    h('h2', {}, ['Exercises']),
    familyNav,
    groupedList,
  ]);
}

function familyFilterButtons(
  activeFamily: string | null,
  onSelect: (family: string | null) => void,
): HTMLButtonElement[] {
  return [
    familyFilterButton('All', EXERCISES.length, activeFamily === null, () => onSelect(null)),
    ...FAMILY_ORDER.map((family) =>
      familyFilterButton(
        family,
        exercisesByFamily(family).length,
        activeFamily === family,
        () => onSelect(family),
      ),
    ),
  ];
}

function familyFilterButton(
  label: string,
  count: number,
  active: boolean,
  onClick: () => void,
): HTMLButtonElement {
  const button = h('button', {
    type: 'button',
    class: active ? 'exercise-filter is-active' : 'exercise-filter',
    on: { click: onClick },
  }, [
    h('span', {}, [label]),
    h('span', { class: 'exercise-filter-count' }, [String(count)]),
  ]);
  button.setAttribute('aria-pressed', active ? 'true' : 'false');
  return button;
}

function visibleFamilies(activeFamily: string | null): string[] {
  return activeFamily === null ? FAMILY_ORDER : [activeFamily];
}

function exercisesByFamily(family: string): ExerciseDefinition[] {
  return EXERCISES.filter((exercise) => displayFamily(exercise) === family);
}

function displayFamily(exercise: ExerciseDefinition): string {
  if (
    exercise.family === 'Same-Axis Transfer' ||
    exercise.family === 'Cross-Axis Transfer' ||
    exercise.family === 'Random-Line Transfer'
  ) {
    return 'Length Transfer';
  }
  return exercise.family;
}

function exerciseFamilySection(
  family: string,
  exercises: ExerciseDefinition[],
  progress: ProgressStore,
  onNavigate: (next: AppState) => void,
): HTMLElement {
  return h('section', { class: 'exercise-family-section' }, [
    h('div', { class: 'exercise-family-header' }, [
      h('h3', {}, [family]),
      h('p', { class: 'exercise-family-count' }, [`${exercises.length} drills`]),
    ]),
    h('div', { class: 'exercise-grid' }, exercises.map((ex) =>
      exerciseCard(ex, progress.aggregates[ex.id]?.ema, onNavigate),
    )),
  ]);
}

function exerciseCard(
  exercise: ExerciseDefinition,
  emaScore: number | undefined,
  onNavigate: (next: AppState) => void,
): HTMLElement {
  const button = h('button', {
    type: 'button',
    class: 'secondary-action',
    disabled: !exercise.implemented,
    ...(exercise.implemented
      ? { on: { click: () => onNavigate({ screen: 'exercise', exerciseId: exercise.id, source: 'direct' }) } }
      : {}),
  }, [exercise.implemented ? 'Practice' : 'Coming soon']);

  return h('article', { class: 'exercise-card' }, [
    h('p', { class: 'card-kicker' }, [exercise.family]),
    h('h3', {}, [exercise.label]),
    h('p', {}, [exercise.description]),
    h('div', { class: 'card-footer' }, [
      h('p', {
        class: exercise.implemented && emaScore !== undefined
          ? 'score-chip has-score'
          : 'score-chip',
      }, [exercise.implemented ? formatScore(emaScore) : '---']),
      button,
    ]),
  ]);
}

export function primaryActionButton(
  label: string,
  onClick: () => void,
): HTMLButtonElement {
  return h('button', { type: 'button', class: 'primary-action', on: { click: onClick } }, [label]);
}

export { actionButton };
