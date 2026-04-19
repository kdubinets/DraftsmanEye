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
  type FreehandExerciseDefinition,
  type LineAxis,
  type SingleMarkExerciseDefinition,
  type SingleMarkTrial,
  type SingleMarkTrialResult,
  type TrialLine,
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
let renderVersion = 0;

renderApp();

function renderApp(): void {
  renderVersion += 1;
  appRoot.replaceChildren();

  if (state.screen === 'list') {
    appRoot.append(renderListScreen());
    return;
  }

  const exercise = getExerciseById(state.exerciseId);
  if (exercise.kind === 'freehand-line') {
    appRoot.append(renderFreehandLineExerciseScreen(exercise, state.source));
    return;
  }

  appRoot.append(renderSingleMarkExerciseScreen(exercise, state.source));
}

function renderListScreen(): HTMLElement {
  const progress = getStoredProgress();

  return pageShell(
    headerBlock(),
    autoCard(),
    exerciseGrid(
      EXERCISES.map((exercise) =>
        exerciseCard(exercise, progress[exercise.id]?.emaScore),
      ),
    ),
  );
}

function renderSingleMarkExerciseScreen(
  exercise: SingleMarkExerciseDefinition,
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

  const svg = renderTrialSvg(
    trial,
    () => result,
    (nextX) => {
      if (result) {
        return;
      }

      revealResult(trial.scoreSelection(nextX));
    },
  );

  actions.append(againButton, backButton, autoButton);
  stage.append(prompt, svg, feedback, summary, actions);
  screen.append(header, stage);
  return screen;

  function rerenderScene(): void {
    svg.replaceWith(
      renderTrialSvg(
        trial,
        () => result,
        (nextX) => {
          if (result) {
            return;
          }

          revealResult(trial.scoreSelection(nextX));
        },
      ),
    );
  }

  function revealResult(nextResult: SingleMarkTrialResult): void {
    result = nextResult;
    updateStoredProgress(exercise.id, result.relativeAccuracyPercent);

    const feedbackHue = feedbackHueForError(result.relativeErrorPercent);
    const feedbackClass = feedbackBandClass(result.relativeErrorPercent);

    feedback.dataset.tone = feedbackClass;
    summary.dataset.tone = feedbackClass;

    feedback.style.setProperty(
      '--result-accent',
      `hsl(${feedbackHue} 55% 42%)`,
    );
    summary.style.setProperty('--result-accent', `hsl(${feedbackHue} 55% 42%)`);

    feedback.textContent =
      `${feedbackLabel(result.relativeErrorPercent)} · ` +
      `Error ${formatSignedValue(result.signedErrorPixels)} px · ` +
      `${result.relativeErrorPercent.toFixed(1)}% of line length`;

    summary.hidden = false;
    summary.replaceChildren(
      resultStat('Score', result.relativeAccuracyPercent.toFixed(1)),
      resultStat('Placed', `${Math.round(result.placedScalar)} px`),
      resultStat('Target', `${Math.round(result.targetScalar)} px`),
      resultStat(
        'Direction',
        result.signedErrorPixels === 0 ? 'Exact' : result.directionLabel,
      ),
    );

    againButton.hidden = false;
    backButton.hidden = false;
    autoButton.hidden = false;
    rerenderScene();
  }
}

type FreehandPoint = {
  x: number;
  y: number;
  time: number;
  pressure: number;
  pointerType: string;
};

type FreehandLineResult = {
  score: number;
  meanErrorPixels: number;
  maxErrorPixels: number;
  strokeLengthPixels: number;
  pointCount: number;
  fitStart: { x: number; y: number };
  fitEnd: { x: number; y: number };
};

function renderFreehandLineExerciseScreen(
  exercise: FreehandExerciseDefinition,
  source: 'direct' | 'auto',
): HTMLElement {
  const currentRender = renderVersion;
  let points: FreehandPoint[] = [];
  let drawingPointerId: number | null = null;
  let result: FreehandLineResult | null = null;
  let resetTimer: number | null = null;

  const screen = pageShell();
  const header = exerciseHeader(exercise, source);
  const stage = document.createElement('section');
  stage.className = 'exercise-stage freehand-stage';

  const toolbar = document.createElement('div');
  toolbar.className = 'freehand-toolbar';

  const prompt = document.createElement('p');
  prompt.className = 'exercise-prompt';
  prompt.textContent = 'Draw one straight line in the field.';

  const fullscreenButton = actionButton('Fullscreen', () => {
    void toggleFreehandFullscreen(stage, fullscreenButton);
  });
  fullscreenButton.classList.add('freehand-fullscreen-action');

  const backButton = actionButton('Back to List', () => {
    if (resetTimer !== null) {
      window.clearTimeout(resetTimer);
    }
    state = { screen: 'list' };
    renderApp();
  });

  toolbar.append(prompt, fullscreenButton, backButton);

  const feedback = document.createElement('p');
  feedback.className = 'feedback-banner';
  feedback.textContent = 'Use Pencil, touch, or mouse to draw one line.';

  const summary = document.createElement('div');
  summary.className = 'result-summary';
  summary.hidden = true;

  const svg = createSvg('svg');
  svg.setAttribute('class', 'freehand-canvas');
  svg.setAttribute('viewBox', '0 0 1000 620');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Straight line drawing field');
  svg.dataset.testid = 'freehand-canvas';

  const frame = createSvg('rect');
  frame.setAttribute('x', '1');
  frame.setAttribute('y', '1');
  frame.setAttribute('width', '998');
  frame.setAttribute('height', '618');
  frame.setAttribute('rx', '18');
  frame.setAttribute('class', 'canvas-frame');

  const userStroke = createSvg('path');
  userStroke.setAttribute('class', 'freehand-user-stroke');

  const fittedLine = createSvg('line');
  fittedLine.setAttribute('class', 'freehand-fit-line');
  fittedLine.style.display = 'none';

  svg.append(frame, userStroke, fittedLine);

  svg.addEventListener('pointerdown', (event) => {
    if (drawingPointerId !== null || result) {
      return;
    }

    const point = freehandPointFromEvent(svg, event);
    if (!point) {
      return;
    }

    drawingPointerId = event.pointerId;
    points = [point];
    userStroke.setAttribute('d', freehandPath(points));
    svg.setPointerCapture(event.pointerId);
    feedback.textContent = 'Keep the stroke continuous, then lift.';
  });

  svg.addEventListener('pointermove', (event) => {
    if (drawingPointerId !== event.pointerId || result) {
      return;
    }

    const nextPoints = freehandPointsFromPointerEvent(svg, event);
    if (nextPoints.length === 0) {
      return;
    }

    points.push(...nextPoints);
    userStroke.setAttribute('d', freehandPath(points));
  });

  const finishStroke = (event: PointerEvent): void => {
    if (drawingPointerId !== event.pointerId || result) {
      return;
    }

    const nextPoints = freehandPointsFromPointerEvent(svg, event);
    points.push(...nextPoints);
    drawingPointerId = null;
    if (svg.hasPointerCapture(event.pointerId)) {
      svg.releasePointerCapture(event.pointerId);
    }
    revealFreehandResult();
  };

  svg.addEventListener('pointerup', finishStroke);
  svg.addEventListener('pointercancel', finishStroke);

  stage.append(toolbar, svg, feedback, summary);
  screen.append(header, stage);
  return screen;

  function revealFreehandResult(): void {
    const nextResult = scoreFreehandLine(points);
    if (!nextResult) {
      points = [];
      userStroke.removeAttribute('d');
      feedback.textContent = 'Stroke was too short. Draw a longer line.';
      return;
    }

    result = nextResult;
    updateStoredProgress(exercise.id, result.score);

    fittedLine.setAttribute('x1', result.fitStart.x.toFixed(2));
    fittedLine.setAttribute('y1', result.fitStart.y.toFixed(2));
    fittedLine.setAttribute('x2', result.fitEnd.x.toFixed(2));
    fittedLine.setAttribute('y2', result.fitEnd.y.toFixed(2));
    fittedLine.style.display = '';

    const feedbackHue = feedbackHueForError(100 - result.score);
    const feedbackClass = feedbackBandClass(100 - result.score);
    feedback.dataset.tone = feedbackClass;
    summary.dataset.tone = feedbackClass;
    feedback.style.setProperty(
      '--result-accent',
      `hsl(${feedbackHue} 55% 42%)`,
    );
    summary.style.setProperty('--result-accent', `hsl(${feedbackHue} 55% 42%)`);

    feedback.textContent =
      `${feedbackLabel(100 - result.score)} · ` +
      `Straightness ${result.score.toFixed(1)} · ` +
      `Mean drift ${result.meanErrorPixels.toFixed(1)} px`;

    summary.hidden = false;
    summary.replaceChildren(
      resultStat('Score', result.score.toFixed(1)),
      resultStat('Mean drift', `${result.meanErrorPixels.toFixed(1)} px`),
      resultStat('Max drift', `${result.maxErrorPixels.toFixed(1)} px`),
      resultStat('Length', `${Math.round(result.strokeLengthPixels)} px`),
      resultStat('Samples', String(result.pointCount)),
    );

    resetTimer = window.setTimeout(() => {
      if (renderVersion !== currentRender) {
        return;
      }
      points = [];
      result = null;
      resetTimer = null;
      userStroke.removeAttribute('d');
      fittedLine.style.display = 'none';
      summary.hidden = true;
      feedback.removeAttribute('data-tone');
      summary.removeAttribute('data-tone');
      feedback.textContent = 'Draw one straight line in the field.';
    }, 1500);
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
    state = {
      screen: 'exercise',
      exerciseId: AUTO_EXERCISE_ID,
      source: 'auto',
    };
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

function exerciseCard(
  exercise: ExerciseDefinition,
  emaScore: number | undefined,
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
  button.textContent = exercise.implemented ? 'Practice' : 'Comming';
  button.disabled = !exercise.implemented;
  if (exercise.implemented) {
    button.addEventListener('click', () => {
      state = { screen: 'exercise', exerciseId: exercise.id, source: 'direct' };
      renderApp();
    });
  }

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

function freehandPointsFromPointerEvent(
  svg: SVGSVGElement,
  event: PointerEvent,
): FreehandPoint[] {
  const eventWithCoalesced = event as PointerEvent & {
    getCoalescedEvents?: () => PointerEvent[];
  };
  const sourceEvents = eventWithCoalesced.getCoalescedEvents?.() ?? [event];
  const points: FreehandPoint[] = [];

  for (const sourceEvent of sourceEvents) {
    const point = freehandPointFromEvent(svg, sourceEvent);
    if (point) {
      points.push(point);
    }
  }

  return points;
}

function freehandPointFromEvent(
  svg: SVGSVGElement,
  event: PointerEvent,
): FreehandPoint | null {
  const localPoint = localSvgPoint(svg, event.clientX, event.clientY);
  if (!localPoint) {
    return null;
  }

  return {
    x: clampNumber(localPoint.x, 0, 1000),
    y: clampNumber(localPoint.y, 0, 620),
    time: event.timeStamp,
    pressure: event.pressure,
    pointerType: event.pointerType,
  };
}

function freehandPath(points: FreehandPoint[]): string {
  if (points.length === 0) {
    return '';
  }

  const [firstPoint, ...rest] = points;
  return [
    `M ${firstPoint.x.toFixed(2)} ${firstPoint.y.toFixed(2)}`,
    ...rest.map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`),
  ].join(' ');
}

function scoreFreehandLine(
  points: FreehandPoint[],
): FreehandLineResult | null {
  if (points.length < 4) {
    return null;
  }

  let strokeLengthPixels = 0;
  for (let index = 1; index < points.length; index += 1) {
    strokeLengthPixels += distanceBetween(points[index - 1], points[index]);
  }

  if (strokeLengthPixels < 80) {
    return null;
  }

  const centroid = points.reduce(
    (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
    { x: 0, y: 0 },
  );
  centroid.x /= points.length;
  centroid.y /= points.length;

  let xx = 0;
  let xy = 0;
  let yy = 0;
  for (const point of points) {
    const dx = point.x - centroid.x;
    const dy = point.y - centroid.y;
    xx += dx * dx;
    xy += dx * dy;
    yy += dy * dy;
  }

  // Principal-axis fit handles any stroke angle without privileging x or y.
  const angle = 0.5 * Math.atan2(2 * xy, xx - yy);
  const direction = { x: Math.cos(angle), y: Math.sin(angle) };
  let minProjection = Number.POSITIVE_INFINITY;
  let maxProjection = Number.NEGATIVE_INFINITY;
  let totalErrorPixels = 0;
  let maxErrorPixels = 0;

  for (const point of points) {
    const dx = point.x - centroid.x;
    const dy = point.y - centroid.y;
    const projection = dx * direction.x + dy * direction.y;
    minProjection = Math.min(minProjection, projection);
    maxProjection = Math.max(maxProjection, projection);

    const perpendicularDistance = Math.abs(dx * direction.y - dy * direction.x);
    totalErrorPixels += perpendicularDistance;
    maxErrorPixels = Math.max(maxErrorPixels, perpendicularDistance);
  }

  const fittedLength = maxProjection - minProjection;
  if (fittedLength < 80) {
    return null;
  }

  const meanErrorPixels = totalErrorPixels / points.length;
  const normalizedMeanError = meanErrorPixels / fittedLength;
  const normalizedMaxError = maxErrorPixels / fittedLength;
  const score = clampNumber(
    100 - (normalizedMeanError * 1600 + normalizedMaxError * 250),
    0,
    100,
  );

  return {
    score,
    meanErrorPixels,
    maxErrorPixels,
    strokeLengthPixels,
    pointCount: points.length,
    fitStart: {
      x: centroid.x + direction.x * minProjection,
      y: centroid.y + direction.y * minProjection,
    },
    fitEnd: {
      x: centroid.x + direction.x * maxProjection,
      y: centroid.y + direction.y * maxProjection,
    },
  };
}

async function toggleFreehandFullscreen(
  stage: HTMLElement,
  button: HTMLButtonElement,
): Promise<void> {
  const isMaximized = stage.classList.contains('is-maximized');

  try {
    if (isMaximized) {
      stage.classList.remove('is-maximized');
      button.textContent = 'Fullscreen';
      if (document.fullscreenElement === stage) {
        await document.exitFullscreen();
      }
      return;
    }

    stage.classList.add('is-maximized');
    button.textContent = 'Exit Fullscreen';
    if (!document.fullscreenElement && stage.requestFullscreen) {
      await stage.requestFullscreen();
    }
  } catch (error) {
    console.error('Failed to toggle fullscreen mode.', error);
  }
}

function renderTrialSvg(
  trial: SingleMarkTrial,
  getResult: () => SingleMarkTrialResult | null,
  onSelect: (nextX: number) => void,
): SVGSVGElement {
  const svg = createSvg('svg');
  svg.setAttribute('class', 'exercise-canvas');
  svg.setAttribute(
    'viewBox',
    `0 0 ${trial.viewport.width} ${trial.viewport.height}`,
  );
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${trial.label} practice canvas`);
  svg.dataset.testid = 'exercise-canvas';
  svg.dataset.axis = trial.line.axis;

  const frame = createSvg('rect');
  frame.setAttribute('x', '1');
  frame.setAttribute('y', '1');
  frame.setAttribute('width', String(trial.viewport.width - 2));
  frame.setAttribute('height', String(trial.viewport.height - 2));
  frame.setAttribute('rx', '24');
  frame.setAttribute('class', 'canvas-frame');

  const line = createSvg('line');
  line.setAttribute('x1', String(linePoint(trial.line, 'start').x));
  line.setAttribute('y1', String(linePoint(trial.line, 'start').y));
  line.setAttribute('x2', String(linePoint(trial.line, 'end').x));
  line.setAttribute('y2', String(linePoint(trial.line, 'end').y));
  line.setAttribute('class', 'exercise-line');

  const guide = createSvg('rect');
  if (trial.line.axis === 'horizontal') {
    guide.setAttribute('x', String(trial.line.startScalar));
    guide.setAttribute('y', String(trial.line.anchorY - 22));
    guide.setAttribute(
      'width',
      String(trial.line.endScalar - trial.line.startScalar),
    );
    guide.setAttribute('height', '44');
  } else {
    guide.setAttribute('x', String(trial.line.anchorX - 22));
    guide.setAttribute('y', String(trial.line.startScalar));
    guide.setAttribute('width', '44');
    guide.setAttribute(
      'height',
      String(trial.line.endScalar - trial.line.startScalar),
    );
  }
  guide.setAttribute('class', 'click-guide');

  const startCap = createTick(
    trial.line.axis,
    trial.line,
    trial.line.startScalar,
    'endpoint-tick',
  );
  const endCap = createTick(
    trial.line.axis,
    trial.line,
    trial.line.endScalar,
    'endpoint-tick',
  );

  svg.addEventListener('pointerdown', (event) => {
    const localPoint = localSvgPoint(svg, event.clientX, event.clientY);
    if (!localPoint) {
      return;
    }

    const scalar = scalarFromPoint(trial.line.axis, localPoint);
    const crossAxisDistance = crossAxisDistanceFromPoint(
      trial.line.axis,
      trial.line,
      localPoint,
    );
    const withinGuideCrossAxis = crossAxisDistance <= 28;
    const withinGuideScalar =
      scalar >= trial.line.startScalar - 12 &&
      scalar <= trial.line.endScalar + 12;

    if (!withinGuideCrossAxis || !withinGuideScalar) {
      return;
    }

    const clampedScalar = Math.max(
      trial.line.startScalar,
      Math.min(scalar, trial.line.endScalar),
    );
    onSelect(clampedScalar);
  });

  svg.append(frame, guide, line, startCap, endCap);

  const result = getResult();
  if (result) {
    const accent = `hsl(${feedbackHueForError(result.relativeErrorPercent)} 55% 42%)`;

    const gap = createSvg('line');
    const gapStart = gapPoint(trial.line.axis, trial.line, result.placedScalar);
    const gapEnd = gapPoint(trial.line.axis, trial.line, result.targetScalar);
    gap.setAttribute('x1', String(gapStart.x));
    gap.setAttribute('y1', String(gapStart.y));
    gap.setAttribute('x2', String(gapEnd.x));
    gap.setAttribute('y2', String(gapEnd.y));
    gap.setAttribute('class', 'error-gap');
    gap.style.stroke = accent;

    const placedTick = createTick(
      trial.line.axis,
      trial.line,
      result.placedScalar,
      'user-tick',
    );
    placedTick.style.stroke = accent;

    svg.append(
      gap,
      placedTick,
      createTick(
        trial.line.axis,
        trial.line,
        result.targetScalar,
        'target-tick',
      ),
    );
  }

  return svg;
}

function createTick(
  axis: LineAxis,
  line: TrialLine,
  scalar: number,
  className: string,
): SVGLineElement {
  const tick = createSvg('line');
  const tickLength = 30;

  if (axis === 'horizontal') {
    tick.setAttribute('x1', String(scalar));
    tick.setAttribute('y1', String(line.anchorY - tickLength));
    tick.setAttribute('x2', String(scalar));
    tick.setAttribute('y2', String(line.anchorY + tickLength));
  } else {
    tick.setAttribute('x1', String(line.anchorX - tickLength));
    tick.setAttribute('y1', String(scalar));
    tick.setAttribute('x2', String(line.anchorX + tickLength));
    tick.setAttribute('y2', String(scalar));
  }

  tick.setAttribute('class', className);
  return tick;
}

function linePoint(
  line: TrialLine,
  edge: 'start' | 'end',
): { x: number; y: number } {
  const scalar = edge === 'start' ? line.startScalar : line.endScalar;
  return line.axis === 'horizontal'
    ? { x: scalar, y: line.anchorY }
    : { x: line.anchorX, y: scalar };
}

function gapPoint(
  axis: LineAxis,
  line: TrialLine,
  scalar: number,
): { x: number; y: number } {
  const gapOffset = 34;
  return axis === 'horizontal'
    ? { x: scalar, y: line.anchorY - gapOffset }
    : { x: line.anchorX - gapOffset, y: scalar };
}

function scalarFromPoint(axis: LineAxis, point: DOMPoint | SVGPoint): number {
  return axis === 'horizontal' ? point.x : point.y;
}

function crossAxisDistanceFromPoint(
  axis: LineAxis,
  line: TrialLine,
  point: DOMPoint | SVGPoint,
): number {
  return axis === 'horizontal'
    ? Math.abs(point.y - line.anchorY)
    : Math.abs(point.x - line.anchorX);
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

  return score.toFixed(1);
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

function distanceBetween(
  firstPoint: { x: number; y: number },
  secondPoint: { x: number; y: number },
): number {
  return Math.hypot(secondPoint.x - firstPoint.x, secondPoint.y - firstPoint.y);
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
