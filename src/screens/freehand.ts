/** Freehand exercise screen used by Freehand Control, Target Drawing, and Trace Control. */
import type { ExerciseDefinition } from '../practice/catalog';
import { updateStoredProgress } from '../storage/progress';
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
  let escapeListener: ((e: KeyboardEvent) => void) | null = null;
  let nextAttemptId = 1;
  let target: FreehandTarget | null = config.createTarget();
  const attempts: FreehandAttemptSnapshot[] = [];
  const MAX_ATTEMPTS = 36;

  const isClosedShapeExercise = config.isClosedShape;

  const screen = pageShell();
  const header = exerciseHeader(exercise, source);
  const stage = h('section', { class: 'exercise-stage freehand-stage' });

  const toolbar = h('div', { class: 'freehand-toolbar' });
  const prompt = h('p', { class: 'exercise-prompt' }, [config.promptText]);

  const fullscreenBtn = actionButton('Fullscreen', () => {
    void toggleFullscreen(stage, fullscreenBtn);
  });
  fullscreenBtn.classList.add('freehand-fullscreen-action');

  const backBtn = actionButton('Back to List', () => {
    onNavigate({ screen: 'list' });
  });

  toolbar.append(prompt, fullscreenBtn, backBtn);

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
    if (resetTimer !== null) window.clearTimeout(resetTimer);
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

    // Reset to a fresh trial after 1.5 s. The cancelled flag is set by cleanup on unmount.
    resetTimer = window.setTimeout(() => {
      if (cancelled) return;
      points = [];
      result = null;
      target = config.createTarget();
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
      feedback.textContent = config.promptText;
    }, 1500);
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
    screen.append(modal);
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
