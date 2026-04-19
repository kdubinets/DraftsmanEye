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

export function mountListScreen(
  root: HTMLElement,
  onNavigate: (next: AppState) => void,
): () => void {
  const knownIds = new Set(EXERCISES.map((e) => e.id));
  const progress = filterStaleAggregates(getStoredProgress(), knownIds);
  root.append(
    pageShell(
      headerBlock(onNavigate),
      autoCard(onNavigate, progress),
      exerciseGrid(
        EXERCISES.map((ex) =>
          exerciseCard(ex, progress.aggregates[ex.id]?.ema, onNavigate),
        ),
      ),
    ),
  );
  return () => {};
}

function headerBlock(onNavigate: (next: AppState) => void): HTMLElement {
  return h('header', { class: 'hero' }, [
    h('p', { class: 'eyebrow' }, ['Draftsman Eye']),
    h('h1', {}, ['Choose a drill and keep the loop short.']),
    h('p', { class: 'hero-copy' }, [
      'Practice one estimation task at a time, review the result immediately, then repeat, return to the list, or let Auto choose the next drill.',
    ]),
    h('button', { type: 'button', class: 'hero-settings-link', on: { click: () => onNavigate({ screen: 'settings' }) } }, [
      'Settings',
    ]),
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

function exerciseGrid(cards: HTMLElement[]): HTMLElement {
  return h('section', { class: 'exercise-section' }, [
    h('h2', {}, ['Exercises']),
    h('div', { class: 'exercise-grid' }, cards),
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
      h('p', { class: 'score-chip' }, [exercise.implemented ? formatScore(emaScore) : '---']),
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
