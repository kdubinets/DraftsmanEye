/**
 * Bootstraps the Draftsman Eye MVP shell, exercise list, and first drill flow.
 */
import './styles/main.css';
import {
  AUTO_EXERCISE_ID,
  EXERCISES,
  getAutoExercise,
  getExerciseById,
  type ExerciseDefinition,
  type ExerciseId,
  type SingleMarkTrialResult,
} from './practice/catalog';
import { getStoredProgress, updateStoredProgress } from './storage/progress';

type AppState =
  | {
      screen: 'list';
    }
  | {
      screen: 'exercise';
      exerciseId: ExerciseId;
      source: 'direct' | 'auto';
    };

const root = document.querySelector<HTMLElement>('#app');

if (!root) {
  throw new Error('Expected #app root element.');
}

const appRoot = root;

let state: AppState = { screen: 'list' };

renderApp();

function renderApp(): void {
  appRoot.replaceChildren();

  if (state.screen === 'list') {
    appRoot.append(renderListScreen());
    return;
  }

  const exercise = getExerciseById(state.exerciseId);
  appRoot.append(renderExerciseScreen(exercise, state.source));
}

function renderListScreen(): HTMLElement {
  const progress = getStoredProgress();

  return pageShell(
    headerBlock(),
    autoCard(),
    exerciseGrid(
      EXERCISES.map((exercise) => exerciseCard(exercise, progress[exercise.id]?.emaScore)),
    ),
  );
}

function renderExerciseScreen(
  exercise: ExerciseDefinition,
  source: 'direct' | 'auto',
): HTMLElement {
  const trial = exercise.createTrial();
  let result: SingleMarkTrialResult | null = null;

  const screen = pageShell();
  const header = exerciseHeader(exercise, source);
  const stage = document.createElement('section');
  stage.className = 'exercise-stage';

  const prompt = document.createElement('p');
  prompt.className = 'exercise-prompt';
  prompt.textContent = trial.prompt;

  const feedback = document.createElement('p');
  feedback.className = 'feedback-banner';
  feedback.textContent = 'Place one mark on the line.';

  const summary = document.createElement('div');
  summary.className = 'result-summary';
  summary.hidden = true;

  const actions = document.createElement('div');
  actions.className = 'session-actions';

  const againButton = actionButton('Again', () => {
    state = { screen: 'exercise', exerciseId: exercise.id, source };
    renderApp();
  });
  againButton.hidden = true;

  const backButton = actionButton('Back to List', () => {
    state = { screen: 'list' };
    renderApp();
  });
  backButton.hidden = true;

  const autoButton = actionButton('Auto Next', () => {
    const nextExercise = getAutoExercise(getStoredProgress());
    state = { screen: 'exercise', exerciseId: nextExercise.id, source: 'auto' };
    renderApp();
  });
  autoButton.hidden = true;

  const svg = renderTrialSvg(trial, () => result, (nextX) => {
    if (result) {
      return;
    }

    revealResult(trial.scoreSelection(nextX));
  });

  actions.append(againButton, backButton, autoButton);
  stage.append(prompt, svg, feedback, summary, actions);
  screen.append(header, stage);
  return screen;

  function rerenderScene(): void {
    svg.replaceWith(
      renderTrialSvg(trial, () => result, (nextX) => {
        if (result) {
          return;
        }

        revealResult(trial.scoreSelection(nextX));
      }),
    );
  }

  function revealResult(nextResult: SingleMarkTrialResult): void {
    result = nextResult;
    updateStoredProgress(exercise.id, result.relativeAccuracyPercent);

    const feedbackHue = feedbackHueForError(result.relativeErrorPercent);
    const feedbackClass = feedbackBandClass(result.relativeErrorPercent);

    feedback.dataset.tone = feedbackClass;
    summary.dataset.tone = feedbackClass;

    feedback.style.setProperty('--result-accent', `hsl(${feedbackHue} 55% 42%)`);
    summary.style.setProperty('--result-accent', `hsl(${feedbackHue} 55% 42%)`);

    feedback.textContent =
      `${feedbackLabel(result.relativeErrorPercent)} · ` +
      `Error ${formatSignedValue(result.signedErrorPixels)} px · ` +
      `${result.relativeErrorPercent.toFixed(1)}% of line length`;

    summary.hidden = false;
    summary.replaceChildren(
      resultStat('Accuracy', `${result.relativeAccuracyPercent.toFixed(1)} EMA-ready score`),
      resultStat('Placed', `${Math.round(result.placedX)} px`),
      resultStat('Target', `${Math.round(result.targetX)} px`),
      resultStat('Direction', result.signedErrorPixels === 0 ? 'Exact' : result.directionLabel),
    );

    againButton.hidden = false;
    backButton.hidden = false;
    autoButton.hidden = false;
    rerenderScene();
  }
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
    'Auto mode uses stored performance data to pick weaker or less-established drills first.';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'primary-action';
  button.textContent = 'Start Auto';
  button.addEventListener('click', () => {
    state = { screen: 'exercise', exerciseId: AUTO_EXERCISE_ID, source: 'auto' };
    renderApp();
  });

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

function exerciseCard(exercise: ExerciseDefinition, emaScore: number | undefined): HTMLElement {
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
  button.addEventListener('click', () => {
    state = { screen: 'exercise', exerciseId: exercise.id, source: 'direct' };
    renderApp();
  });

  footer.append(score, button);
  article.append(family, title, body, footer);
  return article;
}

function exerciseHeader(
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

function renderTrialSvg(
  trial: ExerciseDefinition['createTrial'] extends () => infer Trial ? Trial : never,
  getResult: () => SingleMarkTrialResult | null,
  onSelect: (nextX: number) => void,
): SVGSVGElement {
  const svg = createSvg('svg');
  svg.setAttribute('class', 'exercise-canvas');
  svg.setAttribute('viewBox', `0 0 ${trial.viewport.width} ${trial.viewport.height}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${trial.label} practice canvas`);
  svg.dataset.testid = 'exercise-canvas';

  const frame = createSvg('rect');
  frame.setAttribute('x', '1');
  frame.setAttribute('y', '1');
  frame.setAttribute('width', String(trial.viewport.width - 2));
  frame.setAttribute('height', String(trial.viewport.height - 2));
  frame.setAttribute('rx', '24');
  frame.setAttribute('class', 'canvas-frame');

  const line = createSvg('line');
  line.setAttribute('x1', String(trial.line.startX));
  line.setAttribute('y1', String(trial.line.y));
  line.setAttribute('x2', String(trial.line.endX));
  line.setAttribute('y2', String(trial.line.y));
  line.setAttribute('class', 'exercise-line');

  const guide = createSvg('rect');
  guide.setAttribute('x', String(trial.line.startX));
  guide.setAttribute('y', String(trial.line.y - 22));
  guide.setAttribute('width', String(trial.line.endX - trial.line.startX));
  guide.setAttribute('height', '44');
  guide.setAttribute('class', 'click-guide');

  const startCap = createTick(trial.line.startX, trial.line.y, 'endpoint-tick');
  const endCap = createTick(trial.line.endX, trial.line.y, 'endpoint-tick');

  svg.addEventListener('pointerdown', (event) => {
    const localPoint = localSvgPoint(svg, event.clientX, event.clientY);
    if (!localPoint) {
      return;
    }

    const withinGuideY = Math.abs(localPoint.y - trial.line.y) <= 28;
    const withinGuideX =
      localPoint.x >= trial.line.startX - 12 && localPoint.x <= trial.line.endX + 12;

    if (!withinGuideY || !withinGuideX) {
      return;
    }

    const clampedX = Math.max(trial.line.startX, Math.min(localPoint.x, trial.line.endX));
    onSelect(clampedX);
  });

  svg.append(frame, guide, line, startCap, endCap);

  const result = getResult();
  if (result) {
    const accent = `hsl(${feedbackHueForError(result.relativeErrorPercent)} 55% 42%)`;

    const gap = createSvg('line');
    gap.setAttribute('x1', String(result.placedX));
    gap.setAttribute('y1', String(trial.line.y - 34));
    gap.setAttribute('x2', String(result.targetX));
    gap.setAttribute('y2', String(trial.line.y - 34));
    gap.setAttribute('class', 'error-gap');
    gap.style.stroke = accent;

    const placedTick = createTick(result.placedX, trial.line.y, 'user-tick');
    placedTick.style.stroke = accent;

    svg.append(gap, placedTick, createTick(result.targetX, trial.line.y, 'target-tick'));
  }

  return svg;
}

function createTick(x: number, y: number, className: string): SVGLineElement {
  const tick = createSvg('line');
  tick.setAttribute('x1', String(x));
  tick.setAttribute('y1', String(y - 30));
  tick.setAttribute('x2', String(x));
  tick.setAttribute('y2', String(y + 30));
  tick.setAttribute('class', className);
  return tick;
}

function localSvgPoint(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): DOMPoint | SVGPoint | null {
  const inverse = svg.getScreenCTM()?.inverse();
  if (!inverse) {
    return null;
  }

  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  return point.matrixTransform(inverse);
}

function createSvg<TagName extends keyof SVGElementTagNameMap>(
  tagName: TagName,
): SVGElementTagNameMap[TagName] {
  return document.createElementNS('http://www.w3.org/2000/svg', tagName);
}

function resultStat(label: string, value: string): HTMLElement {
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

function actionButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'secondary-action';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

function formatScore(score: number | undefined): string {
  if (score === undefined) {
    return 'No score yet';
  }

  return `EMA ${score.toFixed(1)}`;
}

function formatSignedValue(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return rounded > 0 ? `+${rounded}` : String(rounded);
}

function feedbackHueForError(relativeErrorPercent: number): number {
  if (relativeErrorPercent <= 1) {
    return 135;
  }

  if (relativeErrorPercent <= 3) {
    return 102;
  }

  if (relativeErrorPercent <= 5) {
    return 48;
  }

  return 4;
}

function feedbackBandClass(relativeErrorPercent: number): string {
  if (relativeErrorPercent <= 1) {
    return 'excellent';
  }

  if (relativeErrorPercent <= 3) {
    return 'good';
  }

  if (relativeErrorPercent <= 5) {
    return 'ok';
  }

  return 'bad';
}

function feedbackLabel(relativeErrorPercent: number): string {
  if (relativeErrorPercent <= 1) {
    return 'Excellent';
  }

  if (relativeErrorPercent <= 3) {
    return 'Good';
  }

  if (relativeErrorPercent <= 5) {
    return 'OK';
  }

  return 'Off target';
}
