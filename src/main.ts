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

const CONFIG = {
  freehand: {
    allowTouchDrawing: false,
  },
} as const;

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
  if (
    exercise.kind === 'freehand-line' ||
    exercise.kind === 'freehand-circle' ||
    exercise.kind === 'freehand-ellipse' ||
    exercise.kind === 'target-line-two-points' ||
    exercise.kind === 'target-circle-center-point' ||
    exercise.kind === 'target-circle-three-points' ||
    exercise.kind === 'trace-line' ||
    exercise.kind === 'trace-circle' ||
    exercise.kind === 'trace-ellipse'
  ) {
    appRoot.append(renderFreehandExerciseScreen(exercise, state.source));
    return;
  }

  if (exercise.kind === 'single-mark') {
    appRoot.append(renderSingleMarkExerciseScreen(exercise, state.source));
    return;
  }

  throw new Error(`Unsupported exercise kind: ${String(exercise)}`);
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
  kind: 'line';
  score: number;
  meanErrorPixels: number;
  maxErrorPixels: number;
  strokeLengthPixels: number;
  pointCount: number;
  fitStart: { x: number; y: number };
  fitEnd: { x: number; y: number };
};

type FreehandTargetLineResult = Omit<FreehandLineResult, 'kind'> & {
  kind: 'target-line';
  target: TargetLine;
  startErrorPixels: number;
  endErrorPixels: number;
  angleErrorDegrees: number;
};

type FreehandCircleResult = {
  kind: 'circle';
  score: number;
  meanErrorPixels: number;
  maxErrorPixels: number;
  strokeLengthPixels: number;
  pointCount: number;
  center: { x: number; y: number };
  radius: number;
  closureGapPixels: number;
  joinAngleDegrees: number;
};

type FreehandTargetCircleResult = Omit<FreehandCircleResult, 'kind'> & {
  kind: 'target-circle';
  target: TargetCircle;
  centerErrorPixels: number;
  radiusErrorPixels: number;
};

type FreehandEllipseResult = {
  kind: 'ellipse';
  score: number;
  meanErrorPixels: number;
  maxErrorPixels: number;
  strokeLengthPixels: number;
  pointCount: number;
  center: { x: number; y: number };
  majorRadius: number;
  minorRadius: number;
  rotationRadians: number;
  closureGapPixels: number;
  joinAngleDegrees: number;
};

type FreehandTargetEllipseResult = Omit<FreehandEllipseResult, 'kind'> & {
  kind: 'target-ellipse';
  target: TargetEllipse;
  centerErrorPixels: number;
  majorRadiusErrorPixels: number;
  minorRadiusErrorPixels: number;
  rotationErrorDegrees: number;
};

type FreehandResult =
  | FreehandLineResult
  | FreehandTargetLineResult
  | FreehandCircleResult
  | FreehandTargetCircleResult
  | FreehandEllipseResult
  | FreehandTargetEllipseResult;

type FreehandTarget = TargetLine | TargetCircle | TargetEllipse;

type TargetLine = {
  kind: 'line';
  start: { x: number; y: number };
  end: { x: number; y: number };
  trace?: boolean;
};

type TargetCircle = {
  kind: 'circle';
  center: { x: number; y: number };
  radius: number;
  marks: { x: number; y: number }[];
  showCenter: boolean;
  trace?: boolean;
};

type TargetEllipse = {
  kind: 'ellipse';
  center: { x: number; y: number };
  majorRadius: number;
  minorRadius: number;
  rotationRadians: number;
  trace?: boolean;
};

type FreehandAttemptSnapshot = {
  id: number;
  points: FreehandPoint[];
  result: FreehandResult;
  target: FreehandTarget | null;
};

function renderFreehandExerciseScreen(
  exercise: FreehandExerciseDefinition,
  source: 'direct' | 'auto',
): HTMLElement {
  const currentRender = renderVersion;
  let points: FreehandPoint[] = [];
  let drawingPointerId: number | null = null;
  let result: FreehandResult | null = null;
  let resetTimer: number | null = null;
  let nextAttemptId = 1;
  let target = createFreehandTarget(exercise.kind);
  const attempts: FreehandAttemptSnapshot[] = [];
  const maxAttempts = 36;
  const isCircleExercise = exercise.kind === 'freehand-circle';
  const isEllipseExercise = exercise.kind === 'freehand-ellipse';
  const isClosedShapeExercise =
    isCircleExercise ||
    isEllipseExercise ||
    exercise.kind === 'target-circle-center-point' ||
    exercise.kind === 'target-circle-three-points' ||
    exercise.kind === 'trace-circle' ||
    exercise.kind === 'trace-ellipse';

  const screen = pageShell();
  const header = exerciseHeader(exercise, source);
  const stage = document.createElement('section');
  stage.className = 'exercise-stage freehand-stage';

  const toolbar = document.createElement('div');
  toolbar.className = 'freehand-toolbar';

  const prompt = document.createElement('p');
  prompt.className = 'exercise-prompt';
  prompt.textContent = freehandPromptText(exercise.kind);

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
  feedback.textContent = freehandReadyText(exercise.kind);

  const summary = document.createElement('div');
  summary.className = 'result-summary';
  summary.hidden = true;

  const historySection = document.createElement('section');
  historySection.className = 'freehand-history';
  historySection.dataset.empty = 'true';

  const historyHeader = document.createElement('div');
  historyHeader.className = 'freehand-history-header';

  const historyTitle = document.createElement('h2');
  historyTitle.textContent = 'History';

  const correctionToggleLabel = document.createElement('label');
  correctionToggleLabel.className = 'freehand-history-toggle';

  const correctionToggle = document.createElement('input');
  correctionToggle.type = 'checkbox';
  correctionToggle.checked = true;
  correctionToggle.addEventListener('change', renderHistory);

  const correctionToggleText = document.createElement('span');
  correctionToggleText.textContent = 'Show fitted shapes';

  correctionToggleLabel.append(correctionToggle, correctionToggleText);
  historyHeader.append(historyTitle, correctionToggleLabel);

  const historyGrid = document.createElement('div');
  historyGrid.className = 'freehand-history-grid';
  historyGrid.dataset.testid = 'freehand-history';
  historyGrid.dataset.variant = isClosedShapeExercise ? 'closed' : 'line';

  const historyEmpty = document.createElement('p');
  historyEmpty.className = 'freehand-history-empty';
  historyEmpty.textContent = 'Completed attempts will collect here.';

  historySection.append(historyHeader, historyEmpty, historyGrid);

  const svg = createSvg('svg');
  svg.setAttribute('class', 'freehand-canvas');
  svg.setAttribute('viewBox', '0 0 1000 620');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', freehandCanvasLabel(exercise.kind));
  svg.dataset.testid = 'freehand-canvas';

  const frame = createSvg('rect');
  frame.setAttribute('x', '1');
  frame.setAttribute('y', '1');
  frame.setAttribute('width', '998');
  frame.setAttribute('height', '618');
  frame.setAttribute('rx', '18');
  frame.setAttribute('class', 'canvas-frame');

  const targetLayer = createSvg('g');
  targetLayer.setAttribute('class', 'freehand-target-layer');
  renderFreehandTargetMarks(targetLayer, target);

  const userStroke = createSvg('path');
  userStroke.setAttribute('class', 'freehand-user-stroke');

  const fittedLine = createSvg('line');
  fittedLine.setAttribute('class', 'freehand-fit-line');
  fittedLine.style.display = 'none';

  const fittedCircle = createSvg('circle');
  fittedCircle.setAttribute('class', 'freehand-fit-circle');
  fittedCircle.style.display = 'none';

  const fittedEllipse = createSvg('ellipse');
  fittedEllipse.setAttribute('class', 'freehand-fit-ellipse');
  fittedEllipse.style.display = 'none';

  const closureGap = createSvg('line');
  closureGap.setAttribute('class', 'freehand-closure-gap');
  closureGap.style.display = 'none';

  const startTangent = createSvg('line');
  startTangent.setAttribute('class', 'freehand-join-tangent');
  startTangent.style.display = 'none';

  const endTangent = createSvg('line');
  endTangent.setAttribute('class', 'freehand-join-tangent');
  endTangent.style.display = 'none';

  svg.append(
    frame,
    targetLayer,
    fittedLine,
    fittedCircle,
    fittedEllipse,
    userStroke,
    closureGap,
    startTangent,
    endTangent,
  );

  svg.addEventListener('pointerdown', (event) => {
    if (drawingPointerId !== null || result) {
      return;
    }

    if (!canStartFreehandStroke(event)) {
      feedback.textContent = 'Use Apple Pencil or mouse to draw.';
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
  screen.append(header, stage, historySection);
  return screen;

  function revealFreehandResult(): void {
    const nextResult = scoreFreehandStroke(exercise.kind, points, target);
    if (!nextResult) {
      points = [];
      userStroke.removeAttribute('d');
      feedback.textContent = freehandRetryText(exercise.kind);
      return;
    }

    result = nextResult;
    updateStoredProgress(exercise.id, result.score);
    attempts.unshift({
      id: nextAttemptId,
      points: points.map((point) => ({ ...point })),
      result,
      target,
    });
    nextAttemptId += 1;
    if (attempts.length > maxAttempts) {
      attempts.length = maxAttempts;
    }
    renderHistory();

    hideFreehandCorrectionElements(
      fittedLine,
      fittedCircle,
      fittedEllipse,
      closureGap,
      startTangent,
      endTangent,
    );
    applyFreehandCorrectionElements(
      result,
      fittedLine,
      fittedCircle,
      fittedEllipse,
    );
    if (isClosedFreehandResult(result)) {
      showClosedShapeMarkers(points, closureGap, startTangent, endTangent);
    }

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
      `${freehandScoreLabel(result.kind)} ${result.score.toFixed(1)} · ` +
      `Mean drift ${result.meanErrorPixels.toFixed(1)} px`;

    const resultStats = [
      ...freehandResultStats(result),
    ];
    summary.hidden = false;
    summary.replaceChildren(...resultStats);

    resetTimer = window.setTimeout(() => {
      if (renderVersion !== currentRender) {
        return;
      }
      points = [];
      result = null;
      target = createFreehandTarget(exercise.kind);
      resetTimer = null;
      userStroke.removeAttribute('d');
      renderFreehandTargetMarks(targetLayer, target);
      hideFreehandCorrectionElements(
        fittedLine,
        fittedCircle,
        fittedEllipse,
        closureGap,
        startTangent,
        endTangent,
      );
      summary.hidden = true;
      feedback.removeAttribute('data-tone');
      summary.removeAttribute('data-tone');
      feedback.textContent = freehandPromptText(exercise.kind);
    }, 1500);
  }

  function renderHistory(): void {
    historySection.dataset.empty = attempts.length === 0 ? 'true' : 'false';
    historyGrid.replaceChildren(
      ...attempts.map((attempt) =>
        renderFreehandAttemptThumbnail(attempt, correctionToggle.checked, () => {
          openHistoryAttempt(attempt);
        }),
      ),
    );
  }

  function openHistoryAttempt(attempt: FreehandAttemptSnapshot): void {
    const modal = renderFreehandHistoryModal(
      attempt,
      correctionToggle.checked,
      closeModal,
    );

    function closeModal(): void {
      document.removeEventListener('keydown', closeOnEscape);
      modal.remove();
    }

    function closeOnEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        closeModal();
      }
    }

    document.addEventListener('keydown', closeOnEscape);
    appRoot.append(modal);
  }
}

function canStartFreehandStroke(event: PointerEvent): boolean {
  return CONFIG.freehand.allowTouchDrawing || event.pointerType !== 'touch';
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

function freehandPromptText(kind: FreehandExerciseDefinition['kind']): string {
  switch (kind) {
    case 'freehand-circle':
      return 'Draw one circle in the field.';
    case 'freehand-ellipse':
      return 'Draw one ellipse in the field.';
    case 'target-line-two-points':
      return 'Draw one straight line connecting the two marks.';
    case 'target-circle-center-point':
      return 'Draw a circle using the center and radius point.';
    case 'target-circle-three-points':
      return 'Draw a circle through the three marks.';
    case 'trace-line':
      return 'Trace the faint straight guide.';
    case 'trace-circle':
      return 'Trace the faint circle guide.';
    case 'trace-ellipse':
      return 'Trace the faint ellipse guide.';
    case 'freehand-line':
      return 'Draw one straight line in the field.';
  }
}

function freehandReadyText(kind: FreehandExerciseDefinition['kind']): string {
  switch (kind) {
    case 'freehand-circle':
      return 'Use Pencil, touch, or mouse to draw one circle.';
    case 'freehand-ellipse':
      return 'Use Pencil, touch, or mouse to draw one ellipse.';
    case 'target-line-two-points':
      return 'Use Pencil, touch, or mouse to connect the two marks.';
    case 'target-circle-center-point':
      return 'Use Pencil, touch, or mouse to draw the target circle.';
    case 'target-circle-three-points':
      return 'Use Pencil, touch, or mouse to pass through the three marks.';
    case 'trace-line':
    case 'trace-circle':
    case 'trace-ellipse':
      return 'Use Pencil, touch, or mouse to trace the faint guide.';
    case 'freehand-line':
      return 'Use Pencil, touch, or mouse to draw one line.';
  }
}

function freehandCanvasLabel(kind: FreehandExerciseDefinition['kind']): string {
  switch (kind) {
    case 'freehand-circle':
    case 'target-circle-center-point':
    case 'target-circle-three-points':
    case 'trace-circle':
      return 'Circle drawing field';
    case 'freehand-ellipse':
    case 'trace-ellipse':
      return 'Ellipse drawing field';
    case 'freehand-line':
    case 'target-line-two-points':
    case 'trace-line':
      return 'Straight line drawing field';
  }
}

function freehandRetryText(kind: FreehandExerciseDefinition['kind']): string {
  switch (kind) {
    case 'freehand-circle':
      return 'Stroke was too short. Draw a larger circle.';
    case 'freehand-ellipse':
      return 'Stroke was too short. Draw a larger ellipse.';
    case 'target-line-two-points':
      return 'Stroke was too short. Connect the two marks.';
    case 'target-circle-center-point':
    case 'target-circle-three-points':
    case 'trace-circle':
      return 'Stroke was too short. Draw a larger circle.';
    case 'trace-ellipse':
      return 'Stroke was too short. Draw a larger ellipse.';
    case 'trace-line':
      return 'Stroke was too short. Trace more of the line.';
    case 'freehand-line':
      return 'Stroke was too short. Draw a longer line.';
  }
}

function freehandScoreLabel(kind: FreehandResult['kind']): string {
  switch (kind) {
    case 'circle':
      return 'Roundness';
    case 'target-circle':
      return 'Target circle';
    case 'target-ellipse':
      return 'Target ellipse';
    case 'ellipse':
      return 'Ellipse fit';
    case 'target-line':
      return 'Target line';
    case 'line':
      return 'Straightness';
  }
}

function isClosedFreehandResult(result: FreehandResult): boolean {
  return (
    result.kind === 'circle' ||
    result.kind === 'ellipse' ||
    result.kind === 'target-circle' ||
    result.kind === 'target-ellipse'
  );
}

function scoreFreehandStroke(
  kind: FreehandExerciseDefinition['kind'],
  points: FreehandPoint[],
  target: FreehandTarget | null,
): FreehandResult | null {
  switch (kind) {
    case 'freehand-circle':
      return scoreFreehandCircle(points);
    case 'freehand-ellipse':
      return scoreFreehandEllipse(points);
    case 'target-line-two-points':
    case 'trace-line':
      return target?.kind === 'line' ? scoreTargetLine(points, target) : null;
    case 'target-circle-center-point':
    case 'target-circle-three-points':
    case 'trace-circle':
      return target?.kind === 'circle' ? scoreTargetCircle(points, target) : null;
    case 'trace-ellipse':
      return target?.kind === 'ellipse' ? scoreTargetEllipse(points, target) : null;
    case 'freehand-line':
      return scoreFreehandLine(points);
  }
}

function createFreehandTarget(
  kind: FreehandExerciseDefinition['kind'],
): FreehandTarget | null {
  switch (kind) {
    case 'target-line-two-points':
      return createTargetLine();
    case 'trace-line':
      return { ...createTargetLine(), trace: true };
    case 'target-circle-center-point':
      return createTargetCircle(1);
    case 'target-circle-three-points':
      return createTargetCircle(3);
    case 'trace-circle':
      return createTraceCircle();
    case 'trace-ellipse':
      return createTraceEllipse();
    case 'freehand-circle':
    case 'freehand-ellipse':
    case 'freehand-line':
      return null;
  }
}

function createTargetLine(): TargetLine {
  const length = randomRange(340, 520);
  const angle = randomRange(-0.45, 0.45);
  const center = {
    x: randomRange(320, 680),
    y: randomRange(210, 410),
  };
  const half = length / 2;

  return {
    kind: 'line',
    start: {
      x: center.x - Math.cos(angle) * half,
      y: center.y - Math.sin(angle) * half,
    },
    end: {
      x: center.x + Math.cos(angle) * half,
      y: center.y + Math.sin(angle) * half,
    },
  };
}

function createTargetCircle(markCount: 1 | 3): TargetCircle {
  const radius = randomRange(100, 170);
  const center = {
    x: randomRange(260 + radius, 740 - radius),
    y: randomRange(120 + radius, 500 - radius),
  };
  const startAngle = randomRange(0, Math.PI * 2);
  const marks =
    markCount === 1
      ? [pointOnCircle(center, radius, startAngle)]
      : [0, 1, 2].map((index) =>
          pointOnCircle(
            center,
            radius,
            startAngle + index * ((Math.PI * 2) / 3) + randomRange(-0.24, 0.24),
          ),
        );

  return { kind: 'circle', center, radius, marks, showCenter: markCount === 1 };
}

function createTraceCircle(): TargetCircle {
  const radius = randomRange(105, 180);
  return {
    kind: 'circle',
    center: {
      x: randomRange(260 + radius, 740 - radius),
      y: randomRange(120 + radius, 500 - radius),
    },
    radius,
    marks: [],
    showCenter: false,
    trace: true,
  };
}

function createTraceEllipse(): TargetEllipse {
  const majorRadius = randomRange(150, 240);
  const minorRadius = randomRange(70, 130);
  const halfWidth = majorRadius;
  const halfHeight = majorRadius;
  return {
    kind: 'ellipse',
    center: {
      x: randomRange(80 + halfWidth, 920 - halfWidth),
      y: randomRange(70 + halfHeight, 550 - halfHeight),
    },
    majorRadius,
    minorRadius,
    rotationRadians: randomRange(-0.65, 0.65),
    trace: true,
  };
}

function renderFreehandTargetMarks(
  targetLayer: SVGGElement,
  target: FreehandTarget | null,
): void {
  targetLayer.replaceChildren();
  if (!target) {
    return;
  }

  appendFreehandTargetMarks(targetLayer, target);
}

function appendFreehandTargetMarks(
  targetLayer: SVGGElement,
  target: FreehandTarget,
): void {
  if (target.kind === 'line') {
    if (target.trace) {
      targetLayer.append(createTraceLineGuide(target));
      return;
    }
    targetLayer.append(
      createTargetPlusMark(target.start, 'freehand-target-mark'),
      createTargetPlusMark(target.end, 'freehand-target-mark'),
    );
    return;
  }

  if (target.kind === 'ellipse') {
    targetLayer.append(createTraceEllipseGuide(target));
    return;
  }

  if (target.trace) {
    targetLayer.append(createTraceCircleGuide(target));
    return;
  }

  if (target.showCenter) {
    targetLayer.append(createTargetDotMark(target.center, 'freehand-target-center'));
  }
  targetLayer.append(
    ...target.marks.map((mark) =>
      createTargetPlusMark(mark, 'freehand-target-mark'),
    ),
  );
}

function createTraceLineGuide(target: TargetLine): SVGLineElement {
  const guide = createSvg('line');
  guide.setAttribute('class', 'freehand-trace-guide');
  guide.setAttribute('x1', target.start.x.toFixed(2));
  guide.setAttribute('y1', target.start.y.toFixed(2));
  guide.setAttribute('x2', target.end.x.toFixed(2));
  guide.setAttribute('y2', target.end.y.toFixed(2));
  return guide;
}

function createTraceCircleGuide(target: TargetCircle): SVGCircleElement {
  const guide = createSvg('circle');
  guide.setAttribute('class', 'freehand-trace-guide');
  guide.setAttribute('cx', target.center.x.toFixed(2));
  guide.setAttribute('cy', target.center.y.toFixed(2));
  guide.setAttribute('r', target.radius.toFixed(2));
  return guide;
}

function createTraceEllipseGuide(target: TargetEllipse): SVGEllipseElement {
  const guide = createSvg('ellipse');
  guide.setAttribute('class', 'freehand-trace-guide');
  guide.setAttribute('cx', target.center.x.toFixed(2));
  guide.setAttribute('cy', target.center.y.toFixed(2));
  guide.setAttribute('rx', target.majorRadius.toFixed(2));
  guide.setAttribute('ry', target.minorRadius.toFixed(2));
  guide.setAttribute(
    'transform',
    `rotate(${radiansToDegrees(target.rotationRadians).toFixed(2)} ${target.center.x.toFixed(2)} ${target.center.y.toFixed(2)})`,
  );
  return guide;
}

function createTargetPlusMark(
  point: { x: number; y: number },
  className: string,
): SVGElement {
  const group = createSvg('g');
  group.setAttribute('class', className);

  const horizontal = createSvg('line');
  horizontal.setAttribute('x1', (point.x - 7).toFixed(2));
  horizontal.setAttribute('y1', point.y.toFixed(2));
  horizontal.setAttribute('x2', (point.x + 7).toFixed(2));
  horizontal.setAttribute('y2', point.y.toFixed(2));

  const vertical = createSvg('line');
  vertical.setAttribute('x1', point.x.toFixed(2));
  vertical.setAttribute('y1', (point.y - 7).toFixed(2));
  vertical.setAttribute('x2', point.x.toFixed(2));
  vertical.setAttribute('y2', (point.y + 7).toFixed(2));

  group.append(horizontal, vertical);
  return group;
}

function createTargetDotMark(
  point: { x: number; y: number },
  className: string,
): SVGElement {
  const dot = createSvg('circle');
  dot.setAttribute('class', className);
  dot.setAttribute('cx', point.x.toFixed(2));
  dot.setAttribute('cy', point.y.toFixed(2));
  dot.setAttribute('r', '4');
  return dot;
}

function scoreTargetLine(
  points: FreehandPoint[],
  target: TargetLine,
): FreehandTargetLineResult | null {
  const lineResult = scoreFreehandLine(points);
  if (!lineResult) {
    return null;
  }

  const targetLength = distanceBetween(target.start, target.end);
  const forwardStartError = distanceBetween(points[0], target.start);
  const forwardEndError = distanceBetween(points[points.length - 1], target.end);
  const reverseStartError = distanceBetween(points[0], target.end);
  const reverseEndError = distanceBetween(points[points.length - 1], target.start);
  const useForward =
    forwardStartError + forwardEndError <= reverseStartError + reverseEndError;
  const startErrorPixels = useForward ? forwardStartError : reverseEndError;
  const endErrorPixels = useForward ? forwardEndError : reverseStartError;
  const angleErrorDegrees = lineAngleDifferenceDegrees(
    target.start,
    target.end,
    lineResult.fitStart,
    lineResult.fitEnd,
  );
  const endpointPenalty =
    ((startErrorPixels + endErrorPixels) / targetLength) * 120;
  const anglePenalty = angleErrorDegrees * 0.65;
  const score = clampNumber(
    lineResult.score - endpointPenalty - anglePenalty,
    0,
    100,
  );

  return {
    ...lineResult,
    kind: 'target-line',
    score,
    target,
    startErrorPixels,
    endErrorPixels,
    angleErrorDegrees,
  };
}

function scoreTargetCircle(
  points: FreehandPoint[],
  target: TargetCircle,
): FreehandTargetCircleResult | null {
  const fit = fitCircle(points);
  if (!fit || points.length < 12) {
    return null;
  }

  let strokeLengthPixels = 0;
  let totalErrorPixels = 0;
  let maxErrorPixels = 0;
  for (let index = 0; index < points.length; index += 1) {
    if (index > 0) {
      strokeLengthPixels += distanceBetween(points[index - 1], points[index]);
    }
    const radialError = Math.abs(distanceBetween(points[index], target.center) - target.radius);
    totalErrorPixels += radialError;
    maxErrorPixels = Math.max(maxErrorPixels, radialError);
  }

  if (strokeLengthPixels < 180) {
    return null;
  }

  const meanErrorPixels = totalErrorPixels / points.length;
  const closureGapPixels = distanceBetween(points[0], points[points.length - 1]);
  const joinAngleDegrees = closedShapeJoinAngleDegrees(points) ?? 180;
  const centerErrorPixels = distanceBetween(fit.center, target.center);
  const radiusErrorPixels = Math.abs(fit.radius - target.radius);
  const normalizedMeanError = meanErrorPixels / target.radius;
  const normalizedMaxError = maxErrorPixels / target.radius;
  const normalizedClosureGap = closureGapPixels / (Math.PI * 2 * target.radius);
  const score = clampNumber(
    100 -
      (normalizedMeanError * 1150 +
        normalizedMaxError * 160 +
        (centerErrorPixels / target.radius) * 180 +
        (radiusErrorPixels / target.radius) * 160 +
        normalizedClosureGap * 360 +
        joinAngleDegrees * 0.3),
    0,
    100,
  );

  return {
    kind: 'target-circle',
    score,
    meanErrorPixels,
    maxErrorPixels,
    strokeLengthPixels,
    pointCount: points.length,
    center: fit.center,
    radius: fit.radius,
    closureGapPixels,
    joinAngleDegrees,
    target,
    centerErrorPixels,
    radiusErrorPixels,
  };
}

function scoreTargetEllipse(
  points: FreehandPoint[],
  target: TargetEllipse,
): FreehandTargetEllipseResult | null {
  const fit = fitEllipse(points);
  if (!fit || points.length < 12) {
    return null;
  }

  let strokeLengthPixels = 0;
  let totalErrorPixels = 0;
  let maxErrorPixels = 0;
  for (let index = 0; index < points.length; index += 1) {
    if (index > 0) {
      strokeLengthPixels += distanceBetween(points[index - 1], points[index]);
    }
    const radialError = ellipseRadialErrorPixels(points[index], target);
    totalErrorPixels += radialError;
    maxErrorPixels = Math.max(maxErrorPixels, radialError);
  }

  if (strokeLengthPixels < 180) {
    return null;
  }

  const meanErrorPixels = totalErrorPixels / points.length;
  const closureGapPixels = distanceBetween(points[0], points[points.length - 1]);
  const joinAngleDegrees = closedShapeJoinAngleDegrees(points) ?? 180;
  const referenceRadius = Math.sqrt(target.majorRadius * target.minorRadius);
  const centerErrorPixels = distanceBetween(fit.center, target.center);
  const majorRadiusErrorPixels = Math.abs(fit.majorRadius - target.majorRadius);
  const minorRadiusErrorPixels = Math.abs(fit.minorRadius - target.minorRadius);
  const rotationErrorDegrees = ellipseRotationDifferenceDegrees(
    fit.rotationRadians,
    target.rotationRadians,
  );
  const normalizedClosureGap =
    closureGapPixels / ellipseCircumferenceApproximation(target);
  const score = clampNumber(
    100 -
      (meanErrorPixels / referenceRadius) * 1200 -
      (maxErrorPixels / referenceRadius) * 170 -
      (centerErrorPixels / referenceRadius) * 160 -
      ((majorRadiusErrorPixels + minorRadiusErrorPixels) / referenceRadius) * 95 -
      normalizedClosureGap * 360 -
      rotationErrorDegrees * 0.3 -
      joinAngleDegrees * 0.3,
    0,
    100,
  );

  return {
    kind: 'target-ellipse',
    score,
    meanErrorPixels,
    maxErrorPixels,
    strokeLengthPixels,
    pointCount: points.length,
    center: fit.center,
    majorRadius: fit.majorRadius,
    minorRadius: fit.minorRadius,
    rotationRadians: fit.rotationRadians,
    closureGapPixels,
    joinAngleDegrees,
    target,
    centerErrorPixels,
    majorRadiusErrorPixels,
    minorRadiusErrorPixels,
    rotationErrorDegrees,
  };
}

function showClosedShapeMarkers(
  points: FreehandPoint[],
  closureGap: SVGLineElement,
  startTangent: SVGLineElement,
  endTangent: SVGLineElement,
): void {
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  closureGap.setAttribute('x1', firstPoint.x.toFixed(2));
  closureGap.setAttribute('y1', firstPoint.y.toFixed(2));
  closureGap.setAttribute('x2', lastPoint.x.toFixed(2));
  closureGap.setAttribute('y2', lastPoint.y.toFixed(2));
  closureGap.style.display = '';

  const tangents = closedShapeTangents(points);
  if (!tangents) {
    startTangent.style.display = 'none';
    endTangent.style.display = 'none';
    return;
  }

  setTangentMarker(startTangent, firstPoint, tangents.start);
  setTangentMarker(endTangent, lastPoint, tangents.end);
}

function setTangentMarker(
  marker: SVGLineElement,
  anchor: FreehandPoint,
  direction: { x: number; y: number },
): void {
  const length = 42;
  marker.setAttribute('x1', (anchor.x - direction.x * length).toFixed(2));
  marker.setAttribute('y1', (anchor.y - direction.y * length).toFixed(2));
  marker.setAttribute('x2', (anchor.x + direction.x * length).toFixed(2));
  marker.setAttribute('y2', (anchor.y + direction.y * length).toFixed(2));
  marker.style.display = '';
}

function hideFreehandCorrectionElements(
  fittedLine: SVGLineElement,
  fittedCircle: SVGCircleElement,
  fittedEllipse: SVGEllipseElement,
  closureGap: SVGLineElement,
  startTangent: SVGLineElement,
  endTangent: SVGLineElement,
): void {
  fittedLine.style.display = 'none';
  fittedCircle.style.display = 'none';
  fittedEllipse.style.display = 'none';
  closureGap.style.display = 'none';
  startTangent.style.display = 'none';
  endTangent.style.display = 'none';
}

function applyFreehandCorrectionElements(
  result: FreehandResult,
  fittedLine: SVGLineElement,
  fittedCircle: SVGCircleElement,
  fittedEllipse: SVGEllipseElement,
): void {
  if (result.kind === 'target-line') {
    fittedLine.setAttribute('x1', result.target.start.x.toFixed(2));
    fittedLine.setAttribute('y1', result.target.start.y.toFixed(2));
    fittedLine.setAttribute('x2', result.target.end.x.toFixed(2));
    fittedLine.setAttribute('y2', result.target.end.y.toFixed(2));
    fittedLine.classList.add('freehand-target-correction-line');
    fittedLine.style.display = '';
    return;
  }

  if (result.kind === 'line') {
    fittedLine.classList.remove('freehand-target-correction-line');
    fittedLine.setAttribute('x1', result.fitStart.x.toFixed(2));
    fittedLine.setAttribute('y1', result.fitStart.y.toFixed(2));
    fittedLine.setAttribute('x2', result.fitEnd.x.toFixed(2));
    fittedLine.setAttribute('y2', result.fitEnd.y.toFixed(2));
    fittedLine.style.display = '';
    return;
  }

  if (result.kind === 'target-circle') {
    fittedCircle.setAttribute('cx', result.target.center.x.toFixed(2));
    fittedCircle.setAttribute('cy', result.target.center.y.toFixed(2));
    fittedCircle.setAttribute('r', result.target.radius.toFixed(2));
    fittedCircle.classList.add('freehand-target-correction-circle');
    fittedCircle.style.display = '';
    return;
  }

  if (result.kind === 'target-ellipse') {
    fittedEllipse.setAttribute('cx', result.target.center.x.toFixed(2));
    fittedEllipse.setAttribute('cy', result.target.center.y.toFixed(2));
    fittedEllipse.setAttribute('rx', result.target.majorRadius.toFixed(2));
    fittedEllipse.setAttribute('ry', result.target.minorRadius.toFixed(2));
    fittedEllipse.setAttribute(
      'transform',
      `rotate(${radiansToDegrees(result.target.rotationRadians).toFixed(2)} ${result.target.center.x.toFixed(2)} ${result.target.center.y.toFixed(2)})`,
    );
    fittedEllipse.classList.add('freehand-target-correction-ellipse');
    fittedEllipse.style.display = '';
    return;
  }

  if (result.kind === 'circle') {
    fittedCircle.classList.remove('freehand-target-correction-circle');
    fittedCircle.setAttribute('cx', result.center.x.toFixed(2));
    fittedCircle.setAttribute('cy', result.center.y.toFixed(2));
    fittedCircle.setAttribute('r', result.radius.toFixed(2));
    fittedCircle.style.display = '';
    return;
  }

  fittedEllipse.classList.remove('freehand-target-correction-ellipse');
  fittedEllipse.setAttribute('cx', result.center.x.toFixed(2));
  fittedEllipse.setAttribute('cy', result.center.y.toFixed(2));
  fittedEllipse.setAttribute('rx', result.majorRadius.toFixed(2));
  fittedEllipse.setAttribute('ry', result.minorRadius.toFixed(2));
  fittedEllipse.setAttribute(
    'transform',
    `rotate(${radiansToDegrees(result.rotationRadians).toFixed(2)} ${result.center.x.toFixed(2)} ${result.center.y.toFixed(2)})`,
  );
  fittedEllipse.style.display = '';
}

function renderFreehandAttemptThumbnail(
  attempt: FreehandAttemptSnapshot,
  showCorrections: boolean,
  onOpen: () => void,
): HTMLButtonElement {
  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'freehand-history-item';
  item.addEventListener('click', onOpen);

  const svg = createSvg('svg');
  svg.setAttribute('class', 'freehand-history-canvas');
  svg.setAttribute('viewBox', '0 0 180 132');
  svg.setAttribute('role', 'img');
  svg.setAttribute(
    'aria-label',
    `${freehandScoreLabel(attempt.result.kind)} ${attempt.result.score.toFixed(1)}`,
  );

  const frame = createSvg('rect');
  frame.setAttribute('x', '1');
  frame.setAttribute('y', '1');
  frame.setAttribute('width', '178');
  frame.setAttribute('height', '130');
  frame.setAttribute('rx', '8');
  frame.setAttribute('class', 'freehand-history-frame');

  const transform = thumbnailTransformForAttempt(attempt);
  const content = createSvg('g');
  content.setAttribute(
    'transform',
    `translate(${transform.offsetX.toFixed(2)} ${transform.offsetY.toFixed(2)}) scale(${transform.scale.toFixed(4)})`,
  );

  if (showCorrections) {
    appendFreehandCorrection(content, attempt.result, true);
  }

  const stroke = createSvg('path');
  stroke.setAttribute('class', 'freehand-history-stroke');
  stroke.setAttribute('d', freehandPath(attempt.points));
  content.append(stroke);

  svg.append(frame, content);

  const score = document.createElement('p');
  score.className = 'freehand-history-score';
  score.textContent = attempt.result.score.toFixed(1);

  item.append(svg, score);
  return item;
}

function renderFreehandHistoryModal(
  attempt: FreehandAttemptSnapshot,
  showCorrections: boolean,
  onClose: () => void,
): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'freehand-history-modal';
  overlay.dataset.testid = 'freehand-history-modal';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'History attempt detail');

  const panel = document.createElement('div');
  panel.className = 'freehand-history-modal-panel';

  const preview = renderFreehandAttemptPreview(attempt, showCorrections);

  const feedback = document.createElement('p');
  feedback.className = 'feedback-banner';
  const feedbackHue = feedbackHueForError(100 - attempt.result.score);
  const feedbackClass = feedbackBandClass(100 - attempt.result.score);
  feedback.dataset.tone = feedbackClass;
  feedback.style.setProperty('--result-accent', `hsl(${feedbackHue} 55% 42%)`);
  feedback.textContent =
    `${feedbackLabel(100 - attempt.result.score)} · ` +
    `${freehandScoreLabel(attempt.result.kind)} ${attempt.result.score.toFixed(1)} · ` +
    `Mean drift ${attempt.result.meanErrorPixels.toFixed(1)} px`;

  const summary = document.createElement('div');
  summary.className = 'result-summary';
  summary.dataset.tone = feedbackClass;
  summary.style.setProperty('--result-accent', `hsl(${feedbackHue} 55% 42%)`);
  summary.replaceChildren(...freehandResultStats(attempt.result));

  panel.append(preview, feedback, summary);
  overlay.append(panel);
  overlay.addEventListener('click', onClose);
  return overlay;
}

function renderFreehandAttemptPreview(
  attempt: FreehandAttemptSnapshot,
  showCorrections: boolean,
): SVGSVGElement {
  const svg = createSvg('svg');
  svg.setAttribute('class', 'freehand-history-modal-canvas');
  svg.setAttribute('viewBox', '0 0 1000 620');
  svg.setAttribute('role', 'img');
  svg.setAttribute(
    'aria-label',
    `${freehandScoreLabel(attempt.result.kind)} attempt at original size`,
  );

  const frame = createSvg('rect');
  frame.setAttribute('x', '1');
  frame.setAttribute('y', '1');
  frame.setAttribute('width', '998');
  frame.setAttribute('height', '618');
  frame.setAttribute('rx', '18');
  frame.setAttribute('class', 'canvas-frame');
  svg.append(frame);

  const content = createSvg('g');
  if (showCorrections) {
    appendFreehandCorrection(content, attempt.result, false);
  }

  const stroke = createSvg('path');
  stroke.setAttribute('class', 'freehand-user-stroke');
  stroke.setAttribute('d', freehandPath(attempt.points));
  content.append(stroke);

  if (showCorrections && isClosedFreehandResult(attempt.result)) {
    const closureGap = createSvg('line');
    closureGap.setAttribute('class', 'freehand-closure-gap');
    const startTangent = createSvg('line');
    startTangent.setAttribute('class', 'freehand-join-tangent');
    const endTangent = createSvg('line');
    endTangent.setAttribute('class', 'freehand-join-tangent');
    showClosedShapeMarkers(attempt.points, closureGap, startTangent, endTangent);
    content.append(closureGap, startTangent, endTangent);
  }

  svg.append(content);
  return svg;
}

function appendFreehandCorrection(
  parent: SVGGElement,
  result: FreehandResult,
  isHistory: boolean,
): void {
  const classSuffix = isHistory ? ' freehand-history-correction' : '';

  if (result.kind === 'target-line') {
    const targetLine = createSvg('line');
    targetLine.setAttribute(
      'class',
      `freehand-fit-line freehand-target-correction-line${classSuffix}`,
    );
    targetLine.setAttribute('x1', result.target.start.x.toFixed(2));
    targetLine.setAttribute('y1', result.target.start.y.toFixed(2));
    targetLine.setAttribute('x2', result.target.end.x.toFixed(2));
    targetLine.setAttribute('y2', result.target.end.y.toFixed(2));
    parent.append(targetLine);
    appendFreehandTargetMarks(parent, result.target);
    return;
  }

  if (result.kind === 'line') {
    const fittedLine = createSvg('line');
    fittedLine.setAttribute('class', `freehand-fit-line${classSuffix}`);
    fittedLine.setAttribute('x1', result.fitStart.x.toFixed(2));
    fittedLine.setAttribute('y1', result.fitStart.y.toFixed(2));
    fittedLine.setAttribute('x2', result.fitEnd.x.toFixed(2));
    fittedLine.setAttribute('y2', result.fitEnd.y.toFixed(2));
    parent.append(fittedLine);
    return;
  }

  if (result.kind === 'target-circle') {
    const targetCircle = createSvg('circle');
    targetCircle.setAttribute(
      'class',
      `freehand-fit-circle freehand-target-correction-circle${classSuffix}`,
    );
    targetCircle.setAttribute('cx', result.target.center.x.toFixed(2));
    targetCircle.setAttribute('cy', result.target.center.y.toFixed(2));
    targetCircle.setAttribute('r', result.target.radius.toFixed(2));
    parent.append(targetCircle);
    appendFreehandTargetMarks(parent, result.target);
    return;
  }

  if (result.kind === 'target-ellipse') {
    const targetEllipse = createSvg('ellipse');
    targetEllipse.setAttribute(
      'class',
      `freehand-fit-ellipse freehand-target-correction-ellipse${classSuffix}`,
    );
    targetEllipse.setAttribute('cx', result.target.center.x.toFixed(2));
    targetEllipse.setAttribute('cy', result.target.center.y.toFixed(2));
    targetEllipse.setAttribute('rx', result.target.majorRadius.toFixed(2));
    targetEllipse.setAttribute('ry', result.target.minorRadius.toFixed(2));
    targetEllipse.setAttribute(
      'transform',
      `rotate(${radiansToDegrees(result.target.rotationRadians).toFixed(2)} ${result.target.center.x.toFixed(2)} ${result.target.center.y.toFixed(2)})`,
    );
    parent.append(targetEllipse);
    return;
  }

  if (result.kind === 'circle') {
    const fittedCircle = createSvg('circle');
    fittedCircle.setAttribute('class', `freehand-fit-circle${classSuffix}`);
    fittedCircle.setAttribute('cx', result.center.x.toFixed(2));
    fittedCircle.setAttribute('cy', result.center.y.toFixed(2));
    fittedCircle.setAttribute('r', result.radius.toFixed(2));
    parent.append(fittedCircle);
    return;
  }

  const fittedEllipse = createSvg('ellipse');
  fittedEllipse.setAttribute('class', `freehand-fit-ellipse${classSuffix}`);
  fittedEllipse.setAttribute('cx', result.center.x.toFixed(2));
  fittedEllipse.setAttribute('cy', result.center.y.toFixed(2));
  fittedEllipse.setAttribute('rx', result.majorRadius.toFixed(2));
  fittedEllipse.setAttribute('ry', result.minorRadius.toFixed(2));
  fittedEllipse.setAttribute(
    'transform',
    `rotate(${radiansToDegrees(result.rotationRadians).toFixed(2)} ${result.center.x.toFixed(2)} ${result.center.y.toFixed(2)})`,
  );
  parent.append(fittedEllipse);
}

function thumbnailTransformForAttempt(attempt: FreehandAttemptSnapshot): {
  offsetX: number;
  offsetY: number;
  scale: number;
} {
  const bounds = boundsForAttempt(attempt);
  const width = Math.max(bounds.maxX - bounds.minX, 1);
  const height = Math.max(bounds.maxY - bounds.minY, 1);
  const padding = 14;
  const scale = Math.min((180 - padding * 2) / width, (132 - padding * 2) / height);
  const offsetX = padding + (180 - padding * 2 - width * scale) / 2 - bounds.minX * scale;
  const offsetY = padding + (132 - padding * 2 - height * scale) / 2 - bounds.minY * scale;

  return { offsetX, offsetY, scale };
}

function boundsForAttempt(attempt: FreehandAttemptSnapshot): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  const bounds = attempt.points.reduce(
    (nextBounds, point) => ({
      minX: Math.min(nextBounds.minX, point.x),
      minY: Math.min(nextBounds.minY, point.y),
      maxX: Math.max(nextBounds.maxX, point.x),
      maxY: Math.max(nextBounds.maxY, point.y),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  );

  if (attempt.result.kind === 'line') {
    includePointInBounds(bounds, attempt.result.fitStart);
    includePointInBounds(bounds, attempt.result.fitEnd);
    return bounds;
  }

  if (attempt.result.kind === 'target-line') {
    includePointInBounds(bounds, attempt.result.target.start);
    includePointInBounds(bounds, attempt.result.target.end);
    return bounds;
  }

  if (attempt.result.kind === 'circle') {
    includePointInBounds(bounds, {
      x: attempt.result.center.x - attempt.result.radius,
      y: attempt.result.center.y - attempt.result.radius,
    });
    includePointInBounds(bounds, {
      x: attempt.result.center.x + attempt.result.radius,
      y: attempt.result.center.y + attempt.result.radius,
    });
    return bounds;
  }

  if (attempt.result.kind === 'target-circle') {
    includePointInBounds(bounds, {
      x: attempt.result.target.center.x - attempt.result.target.radius,
      y: attempt.result.target.center.y - attempt.result.target.radius,
    });
    includePointInBounds(bounds, {
      x: attempt.result.target.center.x + attempt.result.target.radius,
      y: attempt.result.target.center.y + attempt.result.target.radius,
    });
    return bounds;
  }

  if (attempt.result.kind === 'target-ellipse') {
    includeRotatedEllipseBounds(bounds, attempt.result.target);
    return bounds;
  }

  includeRotatedEllipseBounds(bounds, attempt.result);
  return bounds;
}

function includePointInBounds(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  point: { x: number; y: number },
): void {
  bounds.minX = Math.min(bounds.minX, point.x);
  bounds.minY = Math.min(bounds.minY, point.y);
  bounds.maxX = Math.max(bounds.maxX, point.x);
  bounds.maxY = Math.max(bounds.maxY, point.y);
}

function includeRotatedEllipseBounds(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  ellipse: {
    center: { x: number; y: number };
    majorRadius: number;
    minorRadius: number;
    rotationRadians: number;
  },
): void {
  const cos = Math.cos(ellipse.rotationRadians);
  const sin = Math.sin(ellipse.rotationRadians);
  const halfWidth = Math.hypot(ellipse.majorRadius * cos, ellipse.minorRadius * sin);
  const halfHeight = Math.hypot(ellipse.majorRadius * sin, ellipse.minorRadius * cos);
  includePointInBounds(bounds, {
    x: ellipse.center.x - halfWidth,
    y: ellipse.center.y - halfHeight,
  });
  includePointInBounds(bounds, {
    x: ellipse.center.x + halfWidth,
    y: ellipse.center.y + halfHeight,
  });
}

function freehandPointsFromPointerEvent(
  svg: SVGSVGElement,
  event: PointerEvent,
): FreehandPoint[] {
  const eventWithCoalesced = event as PointerEvent & {
    getCoalescedEvents?: () => PointerEvent[];
  };
  const coalescedEvents = eventWithCoalesced.getCoalescedEvents?.();
  const sourceEvents =
    coalescedEvents && coalescedEvents.length > 0 ? coalescedEvents : [event];
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
    kind: 'line',
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

function scoreFreehandCircle(
  points: FreehandPoint[],
): FreehandCircleResult | null {
  if (points.length < 12) {
    return null;
  }

  let strokeLengthPixels = 0;
  for (let index = 1; index < points.length; index += 1) {
    strokeLengthPixels += distanceBetween(points[index - 1], points[index]);
  }

  if (strokeLengthPixels < 180) {
    return null;
  }

  const fit = fitCircle(points);
  if (!fit || fit.radius < 35 || fit.radius > 420) {
    return null;
  }

  let totalErrorPixels = 0;
  let maxErrorPixels = 0;
  for (const point of points) {
    const radiusAtPoint = distanceBetween(point, fit.center);
    const radialError = Math.abs(radiusAtPoint - fit.radius);
    totalErrorPixels += radialError;
    maxErrorPixels = Math.max(maxErrorPixels, radialError);
  }

  const meanErrorPixels = totalErrorPixels / points.length;
  const closureGapPixels = distanceBetween(points[0], points[points.length - 1]);
  const joinAngleDegrees = closedShapeJoinAngleDegrees(points) ?? 180;
  const normalizedMeanError = meanErrorPixels / fit.radius;
  const normalizedMaxError = maxErrorPixels / fit.radius;
  const normalizedClosureGap = closureGapPixels / (Math.PI * 2 * fit.radius);
  const score = clampNumber(
    100 -
      (normalizedMeanError * 1200 +
        normalizedMaxError * 180 +
        normalizedClosureGap * 420 +
        joinAngleDegrees * 0.35),
    0,
    100,
  );

  return {
    kind: 'circle',
    score,
    meanErrorPixels,
    maxErrorPixels,
    strokeLengthPixels,
    pointCount: points.length,
    center: fit.center,
    radius: fit.radius,
    closureGapPixels,
    joinAngleDegrees,
  };
}

function fitCircle(
  points: FreehandPoint[],
): { center: { x: number; y: number }; radius: number } | null {
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumYY = 0;
  let sumXY = 0;
  let sumXXXPlusXYY = 0;
  let sumXXYPlusYYY = 0;
  let sumSquaredRadius = 0;

  for (const point of points) {
    const xx = point.x * point.x;
    const yy = point.y * point.y;
    const squaredRadius = xx + yy;

    sumX += point.x;
    sumY += point.y;
    sumXX += xx;
    sumYY += yy;
    sumXY += point.x * point.y;
    sumXXXPlusXYY += point.x * squaredRadius;
    sumXXYPlusYYY += point.y * squaredRadius;
    sumSquaredRadius += squaredRadius;
  }

  const solution = solveThreeByThree(
    [
      [sumXX, sumXY, sumX],
      [sumXY, sumYY, sumY],
      [sumX, sumY, points.length],
    ],
    [-sumXXXPlusXYY, -sumXXYPlusYYY, -sumSquaredRadius],
  );
  if (!solution) {
    return null;
  }

  const [linearX, linearY, constant] = solution;
  const center = { x: -linearX / 2, y: -linearY / 2 };
  const radiusSquared =
    center.x * center.x + center.y * center.y - constant;

  if (!Number.isFinite(radiusSquared) || radiusSquared <= 0) {
    return null;
  }

  return {
    center,
    radius: Math.sqrt(radiusSquared),
  };
}

function scoreFreehandEllipse(
  points: FreehandPoint[],
): FreehandEllipseResult | null {
  if (points.length < 12) {
    return null;
  }

  let strokeLengthPixels = 0;
  for (let index = 1; index < points.length; index += 1) {
    strokeLengthPixels += distanceBetween(points[index - 1], points[index]);
  }

  if (strokeLengthPixels < 180) {
    return null;
  }

  const fit = fitEllipse(points);
  if (
    !fit ||
    fit.majorRadius < 45 ||
    fit.majorRadius > 480 ||
    fit.minorRadius < 24 ||
    fit.minorRadius > 420 ||
    fit.majorRadius / fit.minorRadius > 8
  ) {
    return null;
  }

  let totalErrorPixels = 0;
  let maxErrorPixels = 0;
  for (const point of points) {
    const radialError = ellipseRadialErrorPixels(point, fit);
    totalErrorPixels += radialError;
    maxErrorPixels = Math.max(maxErrorPixels, radialError);
  }

  const meanErrorPixels = totalErrorPixels / points.length;
  const closureGapPixels = distanceBetween(points[0], points[points.length - 1]);
  const joinAngleDegrees = closedShapeJoinAngleDegrees(points) ?? 180;
  const referenceRadius = Math.sqrt(fit.majorRadius * fit.minorRadius);
  const normalizedMeanError = meanErrorPixels / referenceRadius;
  const normalizedMaxError = maxErrorPixels / referenceRadius;
  const normalizedClosureGap =
    closureGapPixels / ellipseCircumferenceApproximation(fit);
  const score = clampNumber(
    100 -
      (normalizedMeanError * 1250 +
        normalizedMaxError * 180 +
        normalizedClosureGap * 420 +
        joinAngleDegrees * 0.35),
    0,
    100,
  );

  return {
    kind: 'ellipse',
    score,
    meanErrorPixels,
    maxErrorPixels,
    strokeLengthPixels,
    pointCount: points.length,
    center: fit.center,
    majorRadius: fit.majorRadius,
    minorRadius: fit.minorRadius,
    rotationRadians: fit.rotationRadians,
    closureGapPixels,
    joinAngleDegrees,
  };
}

function fitEllipse(
  points: FreehandPoint[],
): {
  center: { x: number; y: number };
  majorRadius: number;
  minorRadius: number;
  rotationRadians: number;
} | null {
  const coefficients = Array.from({ length: 5 }, () => Array(5).fill(0));
  const constants = Array(5).fill(0);

  for (const point of points) {
    const row = [
      point.x * point.x,
      point.x * point.y,
      point.y * point.y,
      point.x,
      point.y,
    ];

    for (let rowIndex = 0; rowIndex < row.length; rowIndex += 1) {
      constants[rowIndex] += row[rowIndex];
      for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
        coefficients[rowIndex][columnIndex] +=
          row[rowIndex] * row[columnIndex];
      }
    }
  }

  const solution = solveLinearSystem(coefficients, constants);
  if (!solution) {
    return null;
  }

  const [a, b, c, d, e] = solution;
  const f = -1;
  const discriminant = b * b - 4 * a * c;
  if (discriminant >= 0) {
    return null;
  }

  const center = {
    x: (2 * c * d - b * e) / discriminant,
    y: (2 * a * e - b * d) / discriminant,
  };
  const centeredConstant =
    a * center.x * center.x +
    b * center.x * center.y +
    c * center.y * center.y +
    d * center.x +
    e * center.y +
    f;

  const crossTerm = b / 2;
  const trace = (a + c) / 2;
  const spread = Math.hypot((a - c) / 2, crossTerm);
  const firstEigenvalue = trace + spread;
  const secondEigenvalue = trace - spread;
  const firstRadiusSquared = -centeredConstant / firstEigenvalue;
  const secondRadiusSquared = -centeredConstant / secondEigenvalue;

  if (
    !Number.isFinite(firstRadiusSquared) ||
    !Number.isFinite(secondRadiusSquared) ||
    firstRadiusSquared <= 0 ||
    secondRadiusSquared <= 0
  ) {
    return null;
  }

  const firstRadius = Math.sqrt(firstRadiusSquared);
  const secondRadius = Math.sqrt(secondRadiusSquared);
  const firstAngle = eigenvectorAngle(a, crossTerm, c, firstEigenvalue);
  const secondAngle = eigenvectorAngle(a, crossTerm, c, secondEigenvalue);

  if (firstRadius >= secondRadius) {
    return {
      center,
      majorRadius: firstRadius,
      minorRadius: secondRadius,
      rotationRadians: firstAngle,
    };
  }

  return {
    center,
    majorRadius: secondRadius,
    minorRadius: firstRadius,
    rotationRadians: secondAngle,
  };
}

function ellipseRadialErrorPixels(
  point: FreehandPoint,
  ellipse: {
    center: { x: number; y: number };
    majorRadius: number;
    minorRadius: number;
    rotationRadians: number;
  },
): number {
  const cos = Math.cos(ellipse.rotationRadians);
  const sin = Math.sin(ellipse.rotationRadians);
  const dx = point.x - ellipse.center.x;
  const dy = point.y - ellipse.center.y;
  const localX = dx * cos + dy * sin;
  const localY = -dx * sin + dy * cos;
  const distanceFromCenter = Math.hypot(localX, localY);

  if (distanceFromCenter === 0) {
    return ellipse.minorRadius;
  }

  const directionCos = localX / distanceFromCenter;
  const directionSin = localY / distanceFromCenter;
  const fittedRadius =
    1 /
    Math.sqrt(
      (directionCos * directionCos) /
        (ellipse.majorRadius * ellipse.majorRadius) +
        (directionSin * directionSin) /
          (ellipse.minorRadius * ellipse.minorRadius),
    );

  return Math.abs(distanceFromCenter - fittedRadius);
}

function ellipseCircumferenceApproximation(ellipse: {
  majorRadius: number;
  minorRadius: number;
}): number {
  const h =
    ((ellipse.majorRadius - ellipse.minorRadius) *
      (ellipse.majorRadius - ellipse.minorRadius)) /
    ((ellipse.majorRadius + ellipse.minorRadius) *
      (ellipse.majorRadius + ellipse.minorRadius));
  return (
    Math.PI *
    (ellipse.majorRadius + ellipse.minorRadius) *
    (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)))
  );
}

function closedShapeJoinAngleDegrees(points: FreehandPoint[]): number | null {
  const tangents = closedShapeTangents(points);
  if (!tangents) {
    return null;
  }

  const dot =
    tangents.start.x * tangents.end.x + tangents.start.y * tangents.end.y;
  return radiansToDegrees(Math.acos(clampNumber(dot, -1, 1)));
}

function closedShapeTangents(
  points: FreehandPoint[],
): { start: { x: number; y: number }; end: { x: number; y: number } } | null {
  if (points.length < 6) {
    return null;
  }

  const sampleDistance = 36;
  const startSample = pointAtDistanceFromStart(points, sampleDistance);
  const endSample = pointAtDistanceFromEnd(points, sampleDistance);
  if (!startSample || !endSample) {
    return null;
  }

  const start = normalizedVector(points[0], startSample);
  const end = normalizedVector(endSample, points[points.length - 1]);
  if (!start || !end) {
    return null;
  }

  return { start, end };
}

function pointAtDistanceFromStart(
  points: FreehandPoint[],
  targetDistance: number,
): FreehandPoint | null {
  let walkedDistance = 0;

  for (let index = 1; index < points.length; index += 1) {
    const previousPoint = points[index - 1];
    const nextPoint = points[index];
    const segmentLength = distanceBetween(previousPoint, nextPoint);
    if (segmentLength === 0) {
      continue;
    }

    if (walkedDistance + segmentLength >= targetDistance) {
      const ratio = (targetDistance - walkedDistance) / segmentLength;
      return interpolatedPoint(previousPoint, nextPoint, ratio);
    }

    walkedDistance += segmentLength;
  }

  return null;
}

function pointAtDistanceFromEnd(
  points: FreehandPoint[],
  targetDistance: number,
): FreehandPoint | null {
  let walkedDistance = 0;

  for (let index = points.length - 2; index >= 0; index -= 1) {
    const previousPoint = points[index];
    const nextPoint = points[index + 1];
    const segmentLength = distanceBetween(previousPoint, nextPoint);
    if (segmentLength === 0) {
      continue;
    }

    if (walkedDistance + segmentLength >= targetDistance) {
      const ratio = 1 - (targetDistance - walkedDistance) / segmentLength;
      return interpolatedPoint(previousPoint, nextPoint, ratio);
    }

    walkedDistance += segmentLength;
  }

  return null;
}

function interpolatedPoint(
  firstPoint: FreehandPoint,
  secondPoint: FreehandPoint,
  ratio: number,
): FreehandPoint {
  return {
    x: firstPoint.x + (secondPoint.x - firstPoint.x) * ratio,
    y: firstPoint.y + (secondPoint.y - firstPoint.y) * ratio,
    time: firstPoint.time + (secondPoint.time - firstPoint.time) * ratio,
    pressure:
      firstPoint.pressure + (secondPoint.pressure - firstPoint.pressure) * ratio,
    pointerType: firstPoint.pointerType,
  };
}

function normalizedVector(
  firstPoint: { x: number; y: number },
  secondPoint: { x: number; y: number },
): { x: number; y: number } | null {
  const dx = secondPoint.x - firstPoint.x;
  const dy = secondPoint.y - firstPoint.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) {
    return null;
  }

  return { x: dx / length, y: dy / length };
}

function eigenvectorAngle(
  a: number,
  crossTerm: number,
  c: number,
  eigenvalue: number,
): number {
  if (Math.abs(crossTerm) > 1e-9) {
    return Math.atan2(eigenvalue - a, crossTerm);
  }

  return Math.abs(a - eigenvalue) <= Math.abs(c - eigenvalue)
    ? 0
    : Math.PI / 2;
}

function solveLinearSystem(
  coefficients: number[][],
  constants: number[],
): number[] | null {
  const matrix = coefficients.map((row, index) => [...row, constants[index]]);
  const size = constants.length;

  for (let column = 0; column < size; column += 1) {
    let pivotRow = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(matrix[row][column]) > Math.abs(matrix[pivotRow][column])) {
        pivotRow = row;
      }
    }

    const pivot = matrix[pivotRow][column];
    if (Math.abs(pivot) < 1e-9) {
      return null;
    }

    [matrix[column], matrix[pivotRow]] = [matrix[pivotRow], matrix[column]];

    for (let entry = column; entry <= size; entry += 1) {
      matrix[column][entry] /= pivot;
    }

    for (let row = 0; row < size; row += 1) {
      if (row === column) {
        continue;
      }

      const factor = matrix[row][column];
      for (let entry = column; entry <= size; entry += 1) {
        matrix[row][entry] -= factor * matrix[column][entry];
      }
    }
  }

  return matrix.map((row) => row[size]);
}

function solveThreeByThree(
  coefficients: [[number, number, number], [number, number, number], [number, number, number]],
  constants: [number, number, number],
): [number, number, number] | null {
  const matrix = coefficients.map((row, index) => [...row, constants[index]]);

  for (let column = 0; column < 3; column += 1) {
    let pivotRow = column;
    for (let row = column + 1; row < 3; row += 1) {
      if (Math.abs(matrix[row][column]) > Math.abs(matrix[pivotRow][column])) {
        pivotRow = row;
      }
    }

    const pivot = matrix[pivotRow][column];
    if (Math.abs(pivot) < 1e-9) {
      return null;
    }

    [matrix[column], matrix[pivotRow]] = [matrix[pivotRow], matrix[column]];

    for (let entry = column; entry < 4; entry += 1) {
      matrix[column][entry] /= pivot;
    }

    for (let row = 0; row < 3; row += 1) {
      if (row === column) {
        continue;
      }

      const factor = matrix[row][column];
      for (let entry = column; entry < 4; entry += 1) {
        matrix[row][entry] -= factor * matrix[column][entry];
      }
    }
  }

  return [matrix[0][3], matrix[1][3], matrix[2][3]];
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

function freehandResultStats(result: FreehandResult): HTMLElement[] {
  const stats = [
    resultStat('Score', result.score.toFixed(1)),
    resultStat('Mean drift', `${result.meanErrorPixels.toFixed(1)} px`),
    resultStat('Max drift', `${result.maxErrorPixels.toFixed(1)} px`),
    resultStat('Length', `${Math.round(result.strokeLengthPixels)} px`),
    resultStat('Samples', String(result.pointCount)),
  ];

  if (result.kind === 'circle') {
    stats.splice(
      3,
      0,
      resultStat('Radius', `${Math.round(result.radius)} px`),
      resultStat('Closure', `${Math.round(result.closureGapPixels)} px`),
      resultStat('Join', `${Math.round(result.joinAngleDegrees)} deg`),
    );
  } else if (result.kind === 'target-circle') {
    stats.splice(
      3,
      0,
      resultStat('Center miss', `${Math.round(result.centerErrorPixels)} px`),
      resultStat('Radius miss', `${Math.round(result.radiusErrorPixels)} px`),
      resultStat('Closure', `${Math.round(result.closureGapPixels)} px`),
      resultStat('Join', `${Math.round(result.joinAngleDegrees)} deg`),
    );
  } else if (result.kind === 'target-ellipse') {
    stats.splice(
      3,
      0,
      resultStat('Center miss', `${Math.round(result.centerErrorPixels)} px`),
      resultStat('Major miss', `${Math.round(result.majorRadiusErrorPixels)} px`),
      resultStat('Minor miss', `${Math.round(result.minorRadiusErrorPixels)} px`),
      resultStat('Rotation', `${Math.round(result.rotationErrorDegrees)} deg`),
      resultStat('Closure', `${Math.round(result.closureGapPixels)} px`),
      resultStat('Join', `${Math.round(result.joinAngleDegrees)} deg`),
    );
  } else if (result.kind === 'ellipse') {
    stats.splice(
      3,
      0,
      resultStat('Major', `${Math.round(result.majorRadius)} px`),
      resultStat('Minor', `${Math.round(result.minorRadius)} px`),
      resultStat('Closure', `${Math.round(result.closureGapPixels)} px`),
      resultStat('Join', `${Math.round(result.joinAngleDegrees)} deg`),
    );
  } else if (result.kind === 'target-line') {
    stats.splice(
      3,
      0,
      resultStat('Start miss', `${Math.round(result.startErrorPixels)} px`),
      resultStat('End miss', `${Math.round(result.endErrorPixels)} px`),
      resultStat('Angle miss', `${Math.round(result.angleErrorDegrees)} deg`),
    );
  }

  return stats;
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

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pointOnCircle(
  center: { x: number; y: number },
  radius: number,
  angle: number,
): { x: number; y: number } {
  return {
    x: center.x + Math.cos(angle) * radius,
    y: center.y + Math.sin(angle) * radius,
  };
}

function lineAngleDifferenceDegrees(
  firstStart: { x: number; y: number },
  firstEnd: { x: number; y: number },
  secondStart: { x: number; y: number },
  secondEnd: { x: number; y: number },
): number {
  const firstAngle = Math.atan2(firstEnd.y - firstStart.y, firstEnd.x - firstStart.x);
  const secondAngle = Math.atan2(secondEnd.y - secondStart.y, secondEnd.x - secondStart.x);
  const rawDifference = Math.abs(radiansToDegrees(firstAngle - secondAngle)) % 180;
  return rawDifference > 90 ? 180 - rawDifference : rawDifference;
}

function ellipseRotationDifferenceDegrees(
  firstRotationRadians: number,
  secondRotationRadians: number,
): number {
  const rawDifference =
    Math.abs(radiansToDegrees(firstRotationRadians - secondRotationRadians)) % 180;
  return rawDifference > 90 ? 180 - rawDifference : rawDifference;
}
