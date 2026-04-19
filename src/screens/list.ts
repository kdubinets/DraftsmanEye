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
import type { AppState } from '../app/state';

export function mountListScreen(
  root: HTMLElement,
  onNavigate: (next: AppState) => void,
): () => void {
  const knownIds = new Set(EXERCISES.map((e) => e.id));
  const progress = filterStaleAggregates(getStoredProgress(), knownIds);
  root.append(
    pageShell(
      headerBlock(),
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

function headerBlock(): HTMLElement {
  const header = document.createElement('header');
  header.className = 'hero';

  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = 'Draftsman Eye';

  const title = document.createElement('h1');
  title.textContent = 'Choose a drill and keep the loop short.';

  const body = document.createElement('p');
  body.className = 'hero-copy';
  body.textContent =
    'Practice one estimation task at a time, review the result immediately, then repeat, return to the list, or let Auto choose the next drill.';

  header.append(eyebrow, title, body);
  return header;
}

function autoCard(
  onNavigate: (next: AppState) => void,
  progress: ProgressStore,
): HTMLElement {
  const { exercise: next, reason } = getAutoExercise(progress);

  const section = document.createElement('section');
  section.className = 'auto-card';

  const label = document.createElement('p');
  label.className = 'card-kicker';
  label.textContent = 'Auto';

  const title = document.createElement('h2');
  title.textContent = 'Let the app choose the next drill.';

  const suggestion = document.createElement('p');
  suggestion.className = 'auto-suggestion';
  suggestion.textContent = `Next up: ${next.label} — ${reason}`;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'primary-action';
  button.textContent = 'Start Auto';
  button.addEventListener('click', () => {
    onNavigate({ screen: 'exercise', exerciseId: next.id, source: 'auto' });
  });

  section.append(label, title, suggestion, button);
  return section;
}

function exerciseGrid(cards: HTMLElement[]): HTMLElement {
  const section = document.createElement('section');
  section.className = 'exercise-section';

  const heading = document.createElement('h2');
  heading.textContent = 'Exercises';

  const grid = document.createElement('div');
  grid.className = 'exercise-grid';
  grid.append(...cards);

  section.append(heading, grid);
  return section;
}

function exerciseCard(
  exercise: ExerciseDefinition,
  emaScore: number | undefined,
  onNavigate: (next: AppState) => void,
): HTMLElement {
  const article = document.createElement('article');
  article.className = 'exercise-card';

  const family = document.createElement('p');
  family.className = 'card-kicker';
  family.textContent = exercise.family;

  const title = document.createElement('h3');
  title.textContent = exercise.label;

  const body = document.createElement('p');
  body.textContent = exercise.description;

  const footer = document.createElement('div');
  footer.className = 'card-footer';

  const score = document.createElement('p');
  score.className = 'score-chip';
  score.textContent = exercise.implemented ? formatScore(emaScore) : '---';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'secondary-action';
  button.textContent = exercise.implemented ? 'Practice' : 'Coming soon';
  button.disabled = !exercise.implemented;
  if (exercise.implemented) {
    button.addEventListener('click', () => {
      onNavigate({
        screen: 'exercise',
        exerciseId: exercise.id,
        source: 'direct',
      });
    });
  }

  footer.append(score, button);
  article.append(family, title, body, footer);
  return article;
}

export function primaryActionButton(
  label: string,
  onClick: () => void,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'primary-action';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

export { actionButton };
