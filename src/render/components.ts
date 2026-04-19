/** Shared DOM component builders and formatting utilities used across screens. */
import type { ExerciseDefinition } from '../practice/catalog';

export function pageShell(...children: HTMLElement[]): HTMLElement {
  const main = document.createElement('main');
  main.className = 'page-shell';
  main.append(...children);
  return main;
}

export function exerciseHeader(
  exercise: ExerciseDefinition,
  source: 'direct' | 'auto',
): HTMLElement {
  const header = document.createElement('header');
  header.className = 'exercise-header';

  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = source === 'auto' ? 'Auto Drill' : exercise.family;

  const title = document.createElement('h1');
  title.className = 'exercise-title';
  title.textContent = exercise.label;

  const body = document.createElement('p');
  body.className = 'hero-copy';
  body.textContent = exercise.description;

  header.append(eyebrow, title, body);
  return header;
}

export function resultStat(label: string, value: string): HTMLElement {
  const block = document.createElement('div');
  block.className = 'result-stat';
  const term = document.createElement('p');
  term.className = 'result-label';
  term.textContent = label;
  const detail = document.createElement('p');
  detail.className = 'result-value';
  detail.textContent = value;
  block.append(term, detail);
  return block;
}

export function actionButton(
  label: string,
  onClick: () => void,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'secondary-action';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

export function formatScore(score: number | undefined): string {
  return score === undefined ? 'No score yet' : score.toFixed(1);
}

export function formatSignedValue(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return rounded > 0 ? `+${rounded}` : String(rounded);
}
