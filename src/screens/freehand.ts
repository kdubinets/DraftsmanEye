/**
 * Freehand exercise screen used by Freehand Control, Target Drawing, and Trace Control.
 * The `resetTimer` / `currentRender` stale-closure guard remains here temporarily; it will
 * be eliminated by the Screen lifecycle refactor (PR 3), which cancels timers on unmount.
 */
import type { FreehandExerciseDefinition } from '../practice/catalog';
import { updateStoredProgress } from '../storage/progress';
import { createSvg } from '../render/svg';
import { pageShell, exerciseHeader, actionButton } from '../render/components';
import {
  feedbackHueForError,
  feedbackBandClass,
  feedbackLabel,
} from '../scoring/bands';
import { scoreFreehandLine } from '../scoring/line';
import { scoreFreehandCircle, scoreTargetCircle } from '../scoring/circle';
import { scoreFreehandEllipse, scoreTargetEllipse } from '../scoring/ellipse';
import { scoreTargetLine } from '../scoring/line';
import {
  canStartFreehandStroke,
  freehandPointFromEvent,
  freehandPointsFromPointerEvent,
  renderFreehandStroke,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from '../exercises/freehand/input';
import {
  applyFreehandCorrectionElements,
  hideFreehandCorrectionElements,
  showClosedShapeMarkers,
  isClosedFreehandResult,
  renderFreehandTargetMarks,
} from '../exercises/freehand/correction';
import {
  renderFreehandAttemptThumbnail,
  renderFreehandHistoryModal,
} from '../exercises/freehand/history';
import { createFreehandTarget } from '../exercises/freehand/targets';
import { freehandScoreLabel, freehandResultStats } from '../exercises/freehand/stats';
import type {
  FreehandPoint,
  FreehandResult,
  FreehandTarget,
  FreehandAttemptSnapshot,
} from '../exercises/freehand/types';
import type { AppState } from '../app/state';

export function renderFreehandExerciseScreen(
  exercise: FreehandExerciseDefinition,
  source: 'direct' | 'auto',
  onNavigate: (next: AppState) => void,
  currentRender: number,
  getRenderVersion: () => number,
): HTMLElement {
  let points: FreehandPoint[] = [];
  let drawingPointerId: number | null = null;
  let result: FreehandResult | null = null;
  let resetTimer: number | null = null;
  let nextAttemptId = 1;
  let target: FreehandTarget | null = createFreehandTarget(exercise.kind);
  const attempts: FreehandAttemptSnapshot[] = [];
  const MAX_ATTEMPTS = 36;

  const isClosedShapeExercise =
    exercise.kind === 'freehand-circle' ||
    exercise.kind === 'freehand-ellipse' ||
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
  prompt.textContent = promptText(exercise.kind);

  const fullscreenBtn = actionButton('Fullscreen', () => {
    void toggleFullscreen(stage, fullscreenBtn);
  });
  fullscreenBtn.classList.add('freehand-fullscreen-action');

  const backBtn = actionButton('Back to List', () => {
    if (resetTimer !== null) window.clearTimeout(resetTimer);
    onNavigate({ screen: 'list' });
  });

  toolbar.append(prompt, fullscreenBtn, backBtn);

  const feedback = document.createElement('p');
  feedback.className = 'feedback-banner';
  feedback.textContent = readyText(exercise.kind);

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

  const toggleLabel = document.createElement('label');
  toggleLabel.className = 'freehand-history-toggle';

  const correctionToggle = document.createElement('input');
  correctionToggle.type = 'checkbox';
  correctionToggle.checked = true;
  correctionToggle.addEventListener('change', renderHistory);

  const toggleText = document.createElement('span');
  toggleText.textContent = 'Show fitted shapes';
  toggleLabel.append(correctionToggle, toggleText);

  historyHeader.append(historyTitle, toggleLabel);

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
  svg.setAttribute('viewBox', `0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', canvasLabel(exercise.kind));
  svg.dataset.testid = 'freehand-canvas';

  const frame = createSvg('rect');
  frame.setAttribute('x', '1');
  frame.setAttribute('y', '1');
  frame.setAttribute('width', String(CANVAS_WIDTH - 2));
  frame.setAttribute('height', String(CANVAS_HEIGHT - 2));
  frame.setAttribute('rx', '18');
  frame.setAttribute('class', 'canvas-frame');

  const targetLayer = createSvg('g');
  targetLayer.setAttribute('class', 'freehand-target-layer');
  renderFreehandTargetMarks(targetLayer, target);

  const strokeLayer = createSvg('g');
  strokeLayer.setAttribute('class', 'freehand-user-stroke-layer');

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
    strokeLayer,
    closureGap,
    startTangent,
    endTangent,
  );

  svg.addEventListener('pointerdown', (event) => {
    if (drawingPointerId !== null || result) return;
    if (!canStartFreehandStroke(event)) {
      feedback.textContent = 'Use Apple Pencil or mouse to draw.';
      return;
    }
    const point = freehandPointFromEvent(svg, event);
    if (!point) return;
    drawingPointerId = event.pointerId;
    points = [point];
    renderFreehandStroke(strokeLayer, points, 'freehand-user-stroke');
    svg.setPointerCapture(event.pointerId);
    feedback.textContent = 'Keep the stroke continuous, then lift.';
  });

  svg.addEventListener('pointermove', (event) => {
    if (drawingPointerId !== event.pointerId || result) return;
    const next = freehandPointsFromPointerEvent(svg, event);
    if (next.length === 0) return;
    points.push(...next);
    renderFreehandStroke(strokeLayer, points, 'freehand-user-stroke');
  });

  const finishStroke = (event: PointerEvent): void => {
    if (drawingPointerId !== event.pointerId || result) return;
    points.push(...freehandPointsFromPointerEvent(svg, event));
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
    const next = scoreStroke(exercise.kind, points, target);
    if (!next) {
      points = [];
      strokeLayer.replaceChildren();
      feedback.textContent = retryText(exercise.kind);
      return;
    }

    result = next;
    updateStoredProgress(exercise.id, result.score, 0);
    attempts.unshift({
      id: nextAttemptId,
      points: points.map((p) => ({ ...p })),
      result,
      target,
    });
    nextAttemptId += 1;
    if (attempts.length > MAX_ATTEMPTS) attempts.length = MAX_ATTEMPTS;
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

    const errorPercent = 100 - result.score;
    const hue = feedbackHueForError(errorPercent);
    const cls = feedbackBandClass(errorPercent);
    const accent = `hsl(${hue} 55% 42%)`;

    feedback.dataset.tone = cls;
    summary.dataset.tone = cls;
    feedback.style.setProperty('--result-accent', accent);
    summary.style.setProperty('--result-accent', accent);
    feedback.textContent =
      `${feedbackLabel(errorPercent)} · ` +
      `${freehandScoreLabel(result.kind)} ${result.score.toFixed(1)} · ` +
      `Mean drift ${result.meanErrorPixels.toFixed(1)} px`;

    summary.hidden = false;
    summary.replaceChildren(...freehandResultStats(result));

    // Reset to a fresh trial after 1.5 s. The renderVersion guard prevents this
    // callback from mutating a screen that has already been replaced; it goes away
    // once the Screen lifecycle (PR 3) lets us cancel the timer on unmount.
    resetTimer = window.setTimeout(() => {
      if (getRenderVersion() !== currentRender) return;
      points = [];
      result = null;
      target = createFreehandTarget(exercise.kind);
      resetTimer = null;
      strokeLayer.replaceChildren();
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
      feedback.textContent = promptText(exercise.kind);
    }, 1500);
  }

  function renderHistory(): void {
    historySection.dataset.empty = attempts.length === 0 ? 'true' : 'false';
    historyGrid.replaceChildren(
      ...attempts.map((attempt) =>
        renderFreehandAttemptThumbnail(
          attempt,
          correctionToggle.checked,
          () => {
            openModal(attempt);
          },
        ),
      ),
    );
  }

  function openModal(attempt: FreehandAttemptSnapshot): void {
    const modal = renderFreehandHistoryModal(
      attempt,
      correctionToggle.checked,
      closeModal,
    );

    function closeModal(): void {
      document.removeEventListener('keydown', onEscape);
      modal.remove();
    }

    function onEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape') closeModal();
    }

    document.addEventListener('keydown', onEscape);
    // Modal is appended to the screen root so it sits above the exercise stage.
    // After the Screen lifecycle refactor (PR 3), each screen will own its root
    // container and this won't need to reach up to the document body.
    screen.append(modal);
  }
}

function scoreStroke(
  kind: FreehandExerciseDefinition['kind'],
  points: FreehandPoint[],
  target: FreehandTarget | null,
): FreehandResult | null {
  switch (kind) {
    case 'freehand-line':
      return scoreFreehandLine(points);
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
  }
}

async function toggleFullscreen(
  stage: HTMLElement,
  button: HTMLButtonElement,
): Promise<void> {
  const isMax = stage.classList.contains('is-maximized');
  try {
    if (isMax) {
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
    // Fullscreen can be blocked by the browser or OS; revert the CSS class
    // so is-maximized stays in sync with the actual fullscreen state.
    stage.classList.toggle('is-maximized', !!document.fullscreenElement);
    button.textContent = document.fullscreenElement
      ? 'Exit Fullscreen'
      : 'Fullscreen';
    console.error('Failed to toggle fullscreen mode.', error);
  }
}

function promptText(kind: FreehandExerciseDefinition['kind']): string {
  switch (kind) {
    case 'freehand-line':
      return 'Draw one straight line in the field.';
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
  }
}

function readyText(kind: FreehandExerciseDefinition['kind']): string {
  switch (kind) {
    case 'freehand-line':
      return 'Use Pencil, touch, or mouse to draw one line.';
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
  }
}

function retryText(kind: FreehandExerciseDefinition['kind']): string {
  switch (kind) {
    case 'freehand-line':
      return 'Stroke was too short. Draw a longer line.';
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
  }
}

function canvasLabel(kind: FreehandExerciseDefinition['kind']): string {
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
