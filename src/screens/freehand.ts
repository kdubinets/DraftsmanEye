/** Freehand exercise screen used by Freehand Control, Target Drawing, and Trace Control. */
import type { ExerciseDefinition } from '../practice/catalog';
import { updateStoredProgress } from '../storage/progress';
import { getSettings } from '../storage/settings';
import { s, h } from '../render/h';
import { pageShell, exerciseHeader, actionButton } from '../render/components';
import {
  feedbackHueForError,
  feedbackBandClass,
  feedbackLabel,
} from '../scoring/bands';
import {
  canStartFreehandStroke,
  freehandPointFromEvent,
  freehandPointsFromPointerEvent,
  renderFreehandStroke,
  appendIncrementalSegments,
  appendFreehandStroke,
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
import { freehandScoreLabel, freehandResultStats } from '../exercises/freehand/stats';
import type {
  FreehandPoint,
  FreehandResult,
  FreehandTarget,
  FreehandAttemptSnapshot,
  FreehandExerciseConfig,
} from '../exercises/freehand/types';
import type { AppState } from '../app/state';

export function mountFreehandScreen(
  root: HTMLElement,
  exercise: ExerciseDefinition,
  config: FreehandExerciseConfig,
  source: 'direct' | 'auto',
  onNavigate: (next: AppState) => void,
): () => void {
  let cancelled = false;
  let points: FreehandPoint[] = [];
  let drawingPointerId: number | null = null;
  let result: FreehandResult | null = null;
  let resetTimer: number | null = null;
  let resetAnimation: number | null = null;
  let resetStartedAt = 0;
  let resetDurationMs = 0;
  let resetRemainingMs = 0;
  let isResultPaused = false;
  let escapeListener: ((e: KeyboardEvent) => void) | null = null;
  let nextAttemptId = 1;
  let target: FreehandTarget | null = config.createTarget();
  const autoRepeatDelayMs = getSettings().autoRepeatDelayMs;
  const attempts: FreehandAttemptSnapshot[] = [];
  const MAX_ATTEMPTS = 36;

  const isClosedShapeExercise = config.isClosedShape;

  const screen = pageShell();
  const header = exerciseHeader(exercise, source);
  const stage = h('section', { class: 'exercise-stage freehand-stage' });

  const toolbar = h('div', { class: 'freehand-toolbar' });
  const prompt = h('p', { class: 'exercise-prompt' }, [config.promptText]);

  const pauseBtn = actionButton('Pause', () => {
    if (!result || autoRepeatDelayMs === null) return;
    if (isResultPaused) {
      resumeAutoReset();
    } else {
      pauseAutoReset();
    }
  });
  pauseBtn.classList.add('auto-repeat-action');
  pauseBtn.disabled = true;

  const fullscreenBtn = actionButton('Fullscreen', () => {
    void toggleFullscreen(stage, fullscreenBtn);
  });
  fullscreenBtn.classList.add('freehand-fullscreen-action');

  const backBtn = actionButton('Back to List', () => {
    onNavigate({ screen: 'list' });
  });

  toolbar.append(prompt, pauseBtn, fullscreenBtn, backBtn);

  const feedback = h('p', { class: 'feedback-banner' }, [config.readyText]);
  const summary = h('div', { class: 'result-summary' });
  summary.hidden = true;

  const historySection = h('section', { class: 'freehand-history', dataset: { empty: 'true' } });

  const correctionToggle = h('input', { type: 'checkbox', checked: true, on: { change: renderHistory } });

  const historyHeader = h('div', { class: 'freehand-history-header' }, [
    h('h2', {}, ['History']),
    h('label', { class: 'freehand-history-toggle' }, [
      correctionToggle,
      h('span', {}, ['Show fitted shapes']),
    ]),
  ]);

  const historyGrid = h('div', { class: 'freehand-history-grid', dataset: { testid: 'freehand-history', variant: isClosedShapeExercise ? 'closed' : 'line' } });
  const historyEmpty = h('p', { class: 'freehand-history-empty' }, ['Completed attempts will collect here.']);

  historySection.append(historyHeader, historyEmpty, historyGrid);

  const targetLayer = s('g', { class: 'freehand-target-layer' });
  renderFreehandTargetMarks(targetLayer, target);

  const ghostLayer = s('g', { class: 'freehand-ghost-result-layer' });

  const strokeLayer = s('g', { class: 'freehand-user-stroke-layer' });

  const fittedLine = s('line', { class: 'freehand-fit-line' });
  fittedLine.style.display = 'none';

  const fittedCircle = s('circle', { class: 'freehand-fit-circle' });
  fittedCircle.style.display = 'none';

  const fittedEllipse = s('ellipse', { class: 'freehand-fit-ellipse' });
  fittedEllipse.style.display = 'none';

  const closureGap = s('line', { class: 'freehand-closure-gap' });
  closureGap.style.display = 'none';

  const startTangent = s('line', { class: 'freehand-join-tangent' });
  startTangent.style.display = 'none';

  const endTangent = s('line', { class: 'freehand-join-tangent' });
  endTangent.style.display = 'none';

  const svg = s('svg', {
    class: 'freehand-canvas',
    viewBox: `0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`,
    role: 'img',
    'aria-label': config.canvasLabel,
  }, [
    s('rect', { x: 1, y: 1, width: CANVAS_WIDTH - 2, height: CANVAS_HEIGHT - 2, rx: 18, class: 'canvas-frame' }),
    targetLayer,
    ghostLayer,
    fittedLine,
    fittedCircle,
    fittedEllipse,
    strokeLayer,
    closureGap,
    startTangent,
    endTangent,
  ]);
  svg.dataset.testid = 'freehand-canvas';

  svg.addEventListener('pointerdown', (event) => {
    if (drawingPointerId !== null) return;
    if (result) {
      if (!isUnguidedResult(result)) return;
      startEarlyNextAttempt(event);
      return;
    }
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
    const tail = points[points.length - 1];
    points.push(...next);
    appendIncrementalSegments(strokeLayer, tail, next, 'freehand-user-stroke');
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
  root.append(screen);

  return () => {
    cancelled = true;
    clearAutoResetTimer();
    if (escapeListener !== null) {
      document.removeEventListener('keydown', escapeListener);
      escapeListener = null;
    }
  };

  function revealFreehandResult(): void {
    const next = config.scoreStroke(points, target);
    if (!next) {
      points = [];
      strokeLayer.replaceChildren();
      feedback.textContent = config.retryText;
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
    ghostLayer.replaceChildren();

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

    scheduleAutoReset();
  }

  function resetToFreshTrial(): void {
    if (cancelled) return;
    clearAutoResetTimer();
    points = [];
    result = null;
    target = config.createTarget();
    ghostLayer.replaceChildren();
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
    feedback.textContent = config.promptText;
    updateAutoRepeatButton();
  }

  function startEarlyNextAttempt(event: PointerEvent): void {
    if (!canStartFreehandStroke(event)) {
      feedback.textContent = 'Use Apple Pencil or mouse to draw.';
      return;
    }
    const point = freehandPointFromEvent(svg, event);
    if (!point) return;

    renderGhostResult();
    clearAutoResetTimer();
    result = null;
    points = [point];
    target = null;
    drawingPointerId = event.pointerId;
    strokeLayer.replaceChildren();
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
    feedback.textContent = 'Keep the stroke continuous, then lift.';
    updateAutoRepeatButton();
    renderFreehandStroke(strokeLayer, points, 'freehand-user-stroke');
    svg.setPointerCapture(event.pointerId);
  }

  function renderGhostResult(): void {
    const previous = attempts[0];
    if (!previous || !isUnguidedResult(previous.result)) return;
    ghostLayer.replaceChildren();
    appendFreehandStroke(ghostLayer, previous.points, 'freehand-ghost-stroke');
    appendUnguidedGhostCorrection(ghostLayer, previous.result);
  }

  function scheduleAutoReset(durationMs: number | null = autoRepeatDelayMs): void {
    clearAutoResetTimer();
    if (durationMs === null) {
      updateAutoRepeatButton();
      return;
    }

    resetStartedAt = performance.now();
    resetDurationMs = durationMs;
    resetRemainingMs = durationMs;
    isResultPaused = false;

    resetTimer = window.setTimeout(resetToFreshTrial, durationMs);
    updateAutoRepeatButton();
    renderTimerProgress();
  }

  function pauseAutoReset(): void {
    if (resetTimer === null || result === null) return;
    const elapsed = performance.now() - resetStartedAt;
    resetRemainingMs = Math.max(0, resetDurationMs - elapsed);
    clearAutoResetTimer();
    isResultPaused = true;
    updateAutoRepeatButton();
  }

  function resumeAutoReset(): void {
    if (result === null || autoRepeatDelayMs === null) return;
    scheduleAutoReset(Math.max(resetRemainingMs, 250));
  }

  function clearAutoResetTimer(): void {
    if (resetTimer !== null) {
      window.clearTimeout(resetTimer);
      resetTimer = null;
    }
    if (resetAnimation !== null) {
      window.cancelAnimationFrame(resetAnimation);
      resetAnimation = null;
    }
  }

  function renderTimerProgress(): void {
    if (resetTimer === null || resetDurationMs <= 0) return;
    const elapsed = performance.now() - resetStartedAt;
    const remainingRatio = Math.max(0, 1 - elapsed / resetDurationMs);
    pauseBtn.style.setProperty('--timer-progress', remainingRatio.toFixed(3));
    if (remainingRatio > 0) {
      resetAnimation = window.requestAnimationFrame(renderTimerProgress);
    }
  }

  function updateAutoRepeatButton(): void {
    pauseBtn.disabled = result === null || autoRepeatDelayMs === null;
    pauseBtn.textContent = isResultPaused ? 'Resume' : 'Pause';
    pauseBtn.classList.toggle('is-running', resetTimer !== null && !isResultPaused);
    pauseBtn.classList.toggle('is-paused', isResultPaused);
    if (resetTimer === null || isResultPaused) {
      pauseBtn.style.removeProperty('--timer-progress');
    }
  }

  function renderHistory(): void {
    historySection.dataset.empty = attempts.length === 0 ? 'true' : 'false';
    historyGrid.replaceChildren(
      ...attempts.map((attempt) =>
        renderFreehandAttemptThumbnail(
          attempt,
          correctionToggle.checked,
          () => { openModal(attempt); },
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
      if (escapeListener !== null) {
        document.removeEventListener('keydown', escapeListener);
        escapeListener = null;
      }
      modal.remove();
    }

    escapeListener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', escapeListener);
    document.body.append(modal);
  }
}

function isUnguidedResult(result: FreehandResult): boolean {
  return result.kind === 'line' || result.kind === 'circle' || result.kind === 'ellipse';
}

function appendUnguidedGhostCorrection(
  parent: SVGGElement,
  result: FreehandResult,
): void {
  if (result.kind === 'line') {
    parent.append(s('line', {
      class: 'freehand-ghost-correction',
      x1: result.fitStart.x,
      y1: result.fitStart.y,
      x2: result.fitEnd.x,
      y2: result.fitEnd.y,
    }));
    return;
  }
  if (result.kind === 'circle') {
    parent.append(s('circle', {
      class: 'freehand-ghost-correction',
      cx: result.center.x,
      cy: result.center.y,
      r: result.radius,
    }));
    return;
  }
  if (result.kind === 'ellipse') {
    parent.append(s('ellipse', {
      class: 'freehand-ghost-correction',
      cx: result.center.x,
      cy: result.center.y,
      rx: result.majorRadius,
      ry: result.minorRadius,
      transform: `rotate(${(result.rotationRadians * 180 / Math.PI).toFixed(3)} ${result.center.x.toFixed(2)} ${result.center.y.toFixed(2)})`,
    }));
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
