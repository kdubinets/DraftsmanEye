/**
 * Bootstraps the Draftsman Eye MVP shell and renders the exercise index.
 */
import "./styles/main.css";
import { getStoredProgress } from './storage/progress';

type ExerciseOption = {
  id: string;
  family: string;
  label: string;
  description: string;
};

const EXERCISES: ExerciseOption[] = [
  {
    id: 'division-horizontal-halves',
    family: 'Division',
    label: 'Horizontal Halves',
    description: 'Divide a horizontal line in half.',
  },
  {
    id: 'division-vertical-thirds',
    family: 'Division',
    label: 'Vertical Thirds',
    description: 'Divide a vertical line into thirds.',
  },
  {
    id: 'copy-horizontal-horizontal',
    family: 'Same-Axis Transfer',
    label: 'Copy Horizontal to Horizontal',
    description: 'Transfer a horizontal reference length to a horizontal guide.',
  },
  {
    id: 'copy-horizontal-vertical',
    family: 'Cross-Axis Transfer',
    label: 'Copy Horizontal to Vertical',
    description: 'Transfer a horizontal reference length to a vertical guide.',
  },
  {
    id: 'double-vertical-vertical',
    family: 'Same-Axis Transfer',
    label: 'Double Vertical on Vertical',
    description: 'Mark a point at double the shown vertical length.',
  },
  {
    id: 'double-vertical-horizontal',
    family: 'Cross-Axis Transfer',
    label: 'Double Vertical on Horizontal',
    description: 'Double a vertical reference along a horizontal guide.',
  },
];

function renderApp(root: HTMLElement): void {
  const progress = getStoredProgress();

  root.replaceChildren(
    pageShell(
      headerBlock(),
      autoCard(),
      exerciseGrid(
        EXERCISES.map((exercise) => exerciseCard(exercise, progress[exercise.id]?.emaScore)),
      ),
    ),
  );
}

function pageShell(...children: HTMLElement[]): HTMLElement {
  const main = document.createElement('main');
  main.className = 'page-shell';
  main.append(...children);
  return main;
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

function autoCard(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'auto-card';

  const label = document.createElement('p');
  label.className = 'card-kicker';
  label.textContent = 'Auto';

  const title = document.createElement('h2');
  title.textContent = 'Let the app choose the next drill.';

  const body = document.createElement('p');
  body.textContent =
    'Auto mode will eventually use recent scores to steer practice toward weaker or less-established exercises.';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'primary-action';
  button.textContent = 'Start Auto';

  section.append(label, title, body, button);
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

function exerciseCard(exercise: ExerciseOption, emaScore: number | undefined): HTMLElement {
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
  score.textContent = formatScore(emaScore);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'secondary-action';
  button.textContent = 'Practice';

  footer.append(score, button);
  article.append(family, title, body, footer);
  return article;
}

function formatScore(score: number | undefined): string {
  if (score === undefined) {
    return 'No score yet';
  }

  return `EMA ${score.toFixed(1)}`;
}

const root = document.querySelector<HTMLElement>('#app');

if (!root) {
  throw new Error('Expected #app root element.');
}

renderApp(root);
