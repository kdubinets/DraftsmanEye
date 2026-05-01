/** Freehand exercise screen used by Freehand Control, Target Drawing, and Trace Control. */
import type {
  ExerciseDefinition,
  ExerciseId,
  FreehandExerciseDefinition,
} from "../practice/catalog";
import { getStoredProgress, updateStoredProgress } from "../storage/progress";
import type { ProgressStore } from "../storage/progress";
import { getSettings } from "../storage/settings";
import { distanceBetween } from "../geometry/primitives";
import { s, h } from "../render/h";
import {
  pageShell,
  exerciseHeader,
  actionButton,
  exerciseToolbar,
  fullscreenButton,
  pendingResultSummary,
} from "../render/components";
import {
  feedbackHueForError,
  feedbackBandClass,
  feedbackLabel,
} from "../scoring/bands";
import {
  LINE_ANGLE_BUCKETS,
  LINE_ANGLE_BUCKET_SIZE_DEGREES,
  lineAngleMetadataFromPoints,
  type LineAngleMetadata,
} from "../practice/lineAngles";
import {
  canStartFreehandStroke,
  freehandPointFromEvent,
  freehandPointsFromPointerEvent,
  renderFreehandStroke,
  appendIncrementalSegments,
  appendFreehandStroke,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from "../exercises/freehand/input";
import {
  applyFreehandCorrectionElements,
  hideFreehandCorrectionElements,
  showClosedShapeMarkers,
  isClosedFreehandResult,
  renderFreehandTargetMarks,
} from "../exercises/freehand/correction";
import {
  renderFreehandAttemptThumbnail,
  renderFreehandHistoryModal,
} from "../exercises/freehand/history";
import {
  freehandResultLine,
  freehandResultStats,
} from "../exercises/freehand/stats";
import type {
  FreehandPoint,
  FreehandResult,
  FreehandTarget,
  FreehandAttemptSnapshot,
  FreehandExerciseConfig,
} from "../exercises/freehand/types";
import type { AppState, ListFilterState } from "../app/state";

export function mountFreehandScreen(
  root: HTMLElement,
  exercise: ExerciseDefinition,
  config: FreehandExerciseConfig,
  source: "direct" | "auto",
  onNavigate: (next: AppState) => void,
  listState?: ListFilterState,
): () => void {
  let cancelled = false;
  let points: FreehandPoint[] = [];
  let drawingPointerId: number | null = null;
  let adjustablePointerId: number | null = null;
  let result: FreehandResult | null = null;
  let pendingResult: FreehandResult | null = null;
  let resetTimer: number | null = null;
  let resetAnimation: number | null = null;
  let resetStartedAt = 0;
  let resetDurationMs = 0;
  let resetRemainingMs = 0;
  let isResultPaused = false;
  let escapeListener: ((e: KeyboardEvent) => void) | null = null;
  let nextAttemptId = 1;
  let target: FreehandTarget | null = config.createTarget();
  const settings = getSettings();
  const autoRepeatDelayMs = settings.autoRepeatDelayMs;
  const showResultString = settings.showResultString;
  const showScoreBoxes = settings.showScoreBoxes;
  const attempts: FreehandAttemptSnapshot[] = [];
  const MAX_ATTEMPTS = 36;
  const inputMode =
    (exercise as FreehandExerciseDefinition).inputMode ?? "single-stroke";
  const isAdjustableLineMode =
    inputMode === "adjustable-line" || inputMode === "adjustable-line-1-shot";

  const isClosedShapeExercise = config.isClosedShape;

  const screen = pageShell();
  const header = exerciseHeader(exercise, source);
  const stage = h("section", { class: "exercise-stage freehand-stage" });

  const prompt = h("p", { class: "exercise-prompt" }, [config.promptText]);

  const pauseBtn = actionButton("Pause", () => {
    if (!result || autoRepeatDelayMs === null) return;
    if (isResultPaused) {
      resumeAutoReset();
    } else {
      pauseAutoReset();
    }
  });
  pauseBtn.classList.add("auto-repeat-action");
  pauseBtn.hidden = true;

  const againBtn = actionButton("Again", () => {
    resetToFreshTrial();
  });
  againBtn.hidden = true;

  const commitBtn = actionButton("Commit", () => {
    commitPendingResult();
  });
  commitBtn.hidden =
    inputMode === "single-stroke" || inputMode === "adjustable-line-1-shot";
  commitBtn.disabled = true;

  const resetLineBtn = actionButton("Reset", () => {
    resetAdjustableLine();
  });
  resetLineBtn.hidden = inputMode !== "adjustable-line";

  const fullBtn = fullscreenButton(stage);

  const backBtn = actionButton("Back to List", () => {
    onNavigate({ screen: "list", listState });
  });

  const toolbar = exerciseToolbar(
    prompt,
    commitBtn,
    resetLineBtn,
    pauseBtn,
    againBtn,
    fullBtn,
    backBtn,
  );

  const feedback = h("p", { class: "feedback-banner" }, [config.readyText]);
  const summary = h("div", { class: "result-summary" });
  summary.classList.add("is-pending");
  summary.hidden = !showScoreBoxes;
  summary.replaceChildren(...pendingResultSummary());
  const lineAngleWidget =
    isLineAngleTrackedExercise(exercise.id)
      ? h("section", { class: "line-angle-widget" })
      : null;
  if (lineAngleWidget) {
    renderLineAngleWidget(lineAngleWidget, getStoredProgress(), exercise.id);
    toolbar.append(lineAngleWidget);
  }

  const historySection = h("section", {
    class: "freehand-history",
    dataset: { empty: "true" },
  });

  const correctionToggle = h("input", {
    type: "checkbox",
    checked: true,
    on: { change: renderHistory },
  });

  const historyHeader = h("div", { class: "freehand-history-header" }, [
    h("h2", {}, ["History"]),
    h("label", { class: "freehand-history-toggle" }, [
      correctionToggle,
      h("span", {}, ["Show fitted shapes"]),
    ]),
  ]);

  const historyGrid = h("div", {
    class: "freehand-history-grid",
    dataset: {
      testid: "freehand-history",
      variant: isClosedShapeExercise ? "closed" : "line",
    },
  });
  const historyEmpty = h("p", { class: "freehand-history-empty" }, [
    "Completed attempts will collect here.",
  ]);

  historySection.append(historyHeader, historyEmpty, historyGrid);

  const targetLayer = s("g", { class: "freehand-target-layer" });
  renderFreehandTargetMarks(targetLayer, target);

  const ghostLayer = s("g", { class: "freehand-ghost-result-layer" });
  const correctionLayer = s("g", { class: "freehand-correction-layer" });

  const adjustableLayer = s("g", { class: "freehand-adjustable-layer" });
  const adjustableLine = s("line", { class: "freehand-adjustable-line" });
  const adjustableAnchor = s("circle", {
    class: "freehand-adjustable-anchor",
    r: 5,
  });
  const adjustableHandle = s("circle", {
    class: "freehand-adjustable-handle",
    r: 10,
    tabindex: 0,
  });
  adjustableLayer.append(adjustableLine, adjustableAnchor, adjustableHandle);
  adjustableLayer.style.display = "none";

  const strokeLayer = s("g", { class: "freehand-user-stroke-layer" });

  const fittedLine = s("line", { class: "freehand-fit-line" });
  fittedLine.style.display = "none";

  const fittedCircle = s("circle", { class: "freehand-fit-circle" });
  fittedCircle.style.display = "none";

  const fittedEllipse = s("ellipse", { class: "freehand-fit-ellipse" });
  fittedEllipse.style.display = "none";

  const closureGap = s("line", { class: "freehand-closure-gap" });
  closureGap.style.display = "none";

  const startTangent = s("line", { class: "freehand-join-tangent" });
  startTangent.style.display = "none";

  const endTangent = s("line", { class: "freehand-join-tangent" });
  endTangent.style.display = "none";

  const svg = s(
    "svg",
    {
      class: "freehand-canvas",
      viewBox: `0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`,
      role: "img",
      "aria-label": config.canvasLabel,
    },
    [
      s("rect", {
        x: 1,
        y: 1,
        width: CANVAS_WIDTH - 2,
        height: CANVAS_HEIGHT - 2,
        rx: 18,
        class: "canvas-frame",
      }),
      targetLayer,
      ghostLayer,
      correctionLayer,
      adjustableLayer,
      fittedLine,
      fittedCircle,
      fittedEllipse,
      strokeLayer,
      closureGap,
      startTangent,
      endTangent,
    ],
  );
  svg.dataset.testid = "freehand-canvas";

  svg.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (isAdjustableLineMode) return;
    if (drawingPointerId !== null) return;
    if (result) {
      startEarlyNextAttempt(event);
      return;
    }
    if (!canStartFreehandStroke(event)) {
      feedback.hidden = false;
      feedback.textContent = "Use Apple Pencil or mouse to draw.";
      return;
    }
    const point = freehandPointFromEvent(svg, event);
    if (!point) return;
    pendingResult = null;
    commitBtn.disabled = true;
    hideFreehandCorrectionElements(
      fittedLine,
      fittedCircle,
      fittedEllipse,
      closureGap,
      startTangent,
      endTangent,
    );
    drawingPointerId = event.pointerId;
    points = [point];
    renderFreehandStroke(strokeLayer, points, "freehand-user-stroke");
    svg.setPointerCapture(event.pointerId);
    feedback.hidden = false;
    feedback.textContent = "Keep the stroke continuous, then lift.";
  });

  svg.addEventListener("pointermove", (event) => {
    if (drawingPointerId !== event.pointerId || result) return;
    event.preventDefault();
    const next = freehandPointsFromPointerEvent(svg, event);
    if (next.length === 0) return;
    const tail = points[points.length - 1];
    points.push(...next);
    appendIncrementalSegments(strokeLayer, tail, next, "freehand-user-stroke");
  });

  const finishStroke = (event: PointerEvent): void => {
    if (drawingPointerId !== event.pointerId || result) return;
    event.preventDefault();
    points.push(...freehandPointsFromPointerEvent(svg, event));
    drawingPointerId = null;
    if (svg.hasPointerCapture(event.pointerId)) {
      svg.releasePointerCapture(event.pointerId);
    }
    if (inputMode === "unlimited-strokes") {
      previewFreehandResult();
      return;
    }
    revealFreehandResult();
  };

  svg.addEventListener("pointerup", finishStroke);
  svg.addEventListener("pointercancel", finishStroke);

  adjustableHandle.addEventListener("pointerdown", (event) => {
    if (!isAdjustableLineMode || result) return;
    adjustablePointerId = event.pointerId;
    adjustableHandle.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  });

  adjustableHandle.addEventListener("pointermove", (event) => {
    if (adjustablePointerId !== event.pointerId || result) return;
    const point = freehandPointFromEvent(svg, event);
    if (!point) return;
    setAdjustableEndpoint(point);
    event.preventDefault();
  });

  const finishAdjustableDrag = (event: PointerEvent): void => {
    if (adjustablePointerId !== event.pointerId) return;
    adjustablePointerId = null;
    if (adjustableHandle.hasPointerCapture(event.pointerId)) {
      adjustableHandle.releasePointerCapture(event.pointerId);
    }
    if (event.type === "pointerup" && inputMode === "adjustable-line-1-shot") {
      commitPendingResult();
    }
  };
  adjustableHandle.addEventListener("pointerup", finishAdjustableDrag);
  adjustableHandle.addEventListener("pointercancel", finishAdjustableDrag);

  if (isAdjustableLineMode) {
    resetAdjustableLine();
  }

  stage.append(toolbar, svg, feedback, summary);
  screen.append(header, stage, historySection);
  root.append(screen);

  return () => {
    cancelled = true;
    clearAutoResetTimer();
    if (escapeListener !== null) {
      document.removeEventListener("keydown", escapeListener);
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

    commitResult(next);
  }

  function previewFreehandResult(): void {
    const next = config.scoreStroke(points, target);
    if (!next) {
      points = [];
      pendingResult = null;
      strokeLayer.replaceChildren();
      commitBtn.disabled = true;
      hideFreehandCorrectionElements(
        fittedLine,
        fittedCircle,
        fittedEllipse,
        closureGap,
        startTangent,
        endTangent,
      );
      feedback.textContent = config.retryText;
      return;
    }

    pendingResult = next;
    renderCandidateResult(next);
    commitBtn.disabled = false;
    feedback.hidden = false;
    feedback.textContent =
      "Candidate ready. Draw again to replace it, or commit.";
  }

  function commitPendingResult(): void {
    if (isAdjustableLineMode) {
      const next = scoreAdjustableLine();
      if (!next) {
        feedback.hidden = false;
        feedback.textContent = config.retryText;
        return;
      }
      points = adjustablePoints();
      renderFreehandStroke(strokeLayer, points, "freehand-user-stroke");
      adjustableLayer.style.display = "none";
      commitResult(next);
      return;
    }
    if (!pendingResult) return;
    commitResult(pendingResult);
  }

  function commitResult(next: FreehandResult): void {
    result = next;
    pendingResult = null;
    commitBtn.disabled = true;
    const nextProgress = updateStoredProgress(
      exercise.id,
      result.score,
      0,
      lineAngleMetadataForResult(exercise.id, result),
    );
    if (lineAngleWidget) {
      renderLineAngleWidget(lineAngleWidget, nextProgress, exercise.id);
    }
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
    fittedLine.classList.remove("freehand-angle-user-fit");
    applyFreehandCorrectionElements(
      result,
      fittedLine,
      fittedCircle,
      fittedEllipse,
    );
    correctionLayer.replaceChildren();
    config.renderCorrection?.(correctionLayer, result);
    if (isClosedFreehandResult(result)) {
      showClosedShapeMarkers(points, closureGap, startTangent, endTangent);
    }

    const errorPercent = 100 - result.score;
    const hue = feedbackHueForError(errorPercent);
    const cls = feedbackBandClass(errorPercent);
    const accent = `hsl(${hue} 55% 42%)`;

    feedback.dataset.tone = cls;
    summary.dataset.tone = cls;
    feedback.style.setProperty("--result-accent", accent);
    summary.style.setProperty("--result-accent", accent);
    feedback.textContent = freehandResultLine(
      result,
      feedbackLabel(errorPercent),
    );
    feedback.hidden = !showResultString;

    summary.classList.remove("is-pending");
    summary.hidden = !showScoreBoxes;
    summary.replaceChildren(...freehandResultStats(result));

    againBtn.hidden = false;
    resetLineBtn.hidden = true;
    adjustableLayer.style.display = "none";
    scheduleAutoReset();
  }

  function resetToFreshTrial(): void {
    if (cancelled) return;
    clearAutoResetTimer();
    points = [];
    result = null;
    pendingResult = null;
    drawingPointerId = null;
    adjustablePointerId = null;
    target = config.createTarget();
    ghostLayer.replaceChildren();
    correctionLayer.replaceChildren();
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
    summary.classList.add("is-pending");
    summary.hidden = !showScoreBoxes;
    summary.replaceChildren(...pendingResultSummary());
    feedback.removeAttribute("data-tone");
    summary.removeAttribute("data-tone");
    feedback.hidden = false;
    feedback.textContent = config.readyText;
    againBtn.hidden = true;
    commitBtn.disabled = true;
    commitBtn.hidden =
      inputMode === "single-stroke" || inputMode === "adjustable-line-1-shot";
    resetLineBtn.hidden = inputMode !== "adjustable-line";
    if (isAdjustableLineMode) {
      resetAdjustableLine();
    } else {
      adjustableLayer.style.display = "none";
    }
    updateAutoRepeatButton();
  }

  function startEarlyNextAttempt(event: PointerEvent): void {
    if (!canStartFreehandStroke(event)) {
      feedback.hidden = false;
      feedback.textContent = "Use Apple Pencil or mouse to draw.";
      return;
    }
    const point = freehandPointFromEvent(svg, event);
    if (!point) return;

    renderGhostResult();
    clearAutoResetTimer();
    result = null;
    pendingResult = null;
    points = [point];
    target = config.createTarget();
    drawingPointerId = event.pointerId;
    strokeLayer.replaceChildren();
    correctionLayer.replaceChildren();
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
    feedback.removeAttribute("data-tone");
    summary.removeAttribute("data-tone");
    feedback.hidden = false;
    feedback.textContent = "Keep the stroke continuous, then lift.";
    againBtn.hidden = true;
    commitBtn.disabled = true;
    updateAutoRepeatButton();
    renderFreehandStroke(strokeLayer, points, "freehand-user-stroke");
    svg.setPointerCapture(event.pointerId);
  }

  function renderCandidateResult(next: FreehandResult): void {
    hideFreehandCorrectionElements(
      fittedLine,
      fittedCircle,
      fittedEllipse,
      closureGap,
      startTangent,
      endTangent,
    );
    fittedLine.classList.remove("freehand-target-correction-line");
    fittedLine.classList.add("freehand-angle-user-fit");
    if (next.kind === "target-angle") {
      fittedLine.setAttribute("x1", next.userRayStart.x.toFixed(2));
      fittedLine.setAttribute("y1", next.userRayStart.y.toFixed(2));
      fittedLine.setAttribute("x2", next.userRayEnd.x.toFixed(2));
      fittedLine.setAttribute("y2", next.userRayEnd.y.toFixed(2));
      fittedLine.style.display = "";
      return;
    }
    if (next.kind === "line" || next.kind === "target-line") {
      fittedLine.setAttribute("x1", next.fitStart.x.toFixed(2));
      fittedLine.setAttribute("y1", next.fitStart.y.toFixed(2));
      fittedLine.setAttribute("x2", next.fitEnd.x.toFixed(2));
      fittedLine.setAttribute("y2", next.fitEnd.y.toFixed(2));
      fittedLine.style.display = "";
    }
  }

  function resetAdjustableLine(): void {
    if (target?.kind !== "angle") {
      adjustableLayer.style.display = "none";
      return;
    }
    setAdjustableEndpoint(initialAdjustableEndpoint(target));
    adjustableLayer.style.display = "";
    commitBtn.disabled = false;
    feedback.hidden = false;
    feedback.textContent =
      inputMode === "adjustable-line-1-shot"
        ? "Drag the free end once."
        : "Drag the free end, then commit.";
  }

  function setAdjustableEndpoint(endpoint: { x: number; y: number }): void {
    if (target?.kind !== "angle") return;
    const vertex = target.target.vertex;
    adjustableLine.setAttribute("x1", vertex.x.toFixed(2));
    adjustableLine.setAttribute("y1", vertex.y.toFixed(2));
    adjustableLine.setAttribute("x2", endpoint.x.toFixed(2));
    adjustableLine.setAttribute("y2", endpoint.y.toFixed(2));
    adjustableAnchor.setAttribute("cx", vertex.x.toFixed(2));
    adjustableAnchor.setAttribute("cy", vertex.y.toFixed(2));
    adjustableHandle.setAttribute("cx", endpoint.x.toFixed(2));
    adjustableHandle.setAttribute("cy", endpoint.y.toFixed(2));
  }

  function scoreAdjustableLine(): FreehandResult | null {
    return config.scoreStroke(adjustablePoints(), target);
  }

  function adjustablePoints(): FreehandPoint[] {
    if (target?.kind !== "angle") return [];
    const vertex = target.target.vertex;
    const end = {
      x: Number(adjustableHandle.getAttribute("cx")),
      y: Number(adjustableHandle.getAttribute("cy")),
    };
    return Array.from({ length: 24 }, (_, index) => {
      const ratio = index / 23;
      return {
        x: vertex.x + (end.x - vertex.x) * ratio,
        y: vertex.y + (end.y - vertex.y) * ratio,
        time: index,
        pressure: 0.5,
        pointerType: "mouse",
      };
    });
  }

  function renderGhostResult(): void {
    const previous = attempts[0];
    if (!previous) return;
    ghostLayer.replaceChildren();
    appendFreehandStroke(ghostLayer, previous.points, "freehand-ghost-stroke");
    appendGhostCorrection(ghostLayer, previous.result);
  }

  function scheduleAutoReset(
    durationMs: number | null = autoRepeatDelayMs,
  ): void {
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
    pauseBtn.style.setProperty("--timer-progress", remainingRatio.toFixed(3));
    if (remainingRatio > 0) {
      resetAnimation = window.requestAnimationFrame(renderTimerProgress);
    }
  }

  function updateAutoRepeatButton(): void {
    pauseBtn.hidden = result === null || autoRepeatDelayMs === null;
    pauseBtn.disabled = pauseBtn.hidden;
    pauseBtn.textContent = isResultPaused ? "Resume" : "Pause";
    pauseBtn.classList.toggle(
      "is-running",
      resetTimer !== null && !isResultPaused,
    );
    pauseBtn.classList.toggle("is-paused", isResultPaused);
    if (resetTimer === null || isResultPaused) {
      pauseBtn.style.removeProperty("--timer-progress");
    }
  }

  function renderHistory(): void {
    historySection.dataset.empty = attempts.length === 0 ? "true" : "false";
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
    const modal = renderFreehandHistoryModal(attempt, {
      showCorrections: correctionToggle.checked,
      showResultString,
      showScoreBoxes,
      onClose: closeModal,
    });

    function closeModal(): void {
      if (escapeListener !== null) {
        document.removeEventListener("keydown", escapeListener);
        escapeListener = null;
      }
      modal.remove();
    }

    escapeListener = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeModal();
    };
    document.addEventListener("keydown", escapeListener);
    document.body.append(modal);
  }
}

function appendGhostCorrection(
  parent: SVGGElement,
  result: FreehandResult,
): void {
  if (result.kind === "line" || result.kind === "target-line") {
    const start =
      result.kind === "target-line" ? result.target.start : result.fitStart;
    const end =
      result.kind === "target-line" ? result.target.end : result.fitEnd;
    parent.append(
      s("line", {
        class: "freehand-ghost-correction",
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
      }),
    );
    return;
  }
  if (result.kind === "target-angle") {
    parent.append(
      s("line", {
        class: "freehand-ghost-correction",
        x1: result.target.target.vertex.x,
        y1: result.target.target.vertex.y,
        x2: result.target.target.correctEnd.x,
        y2: result.target.target.correctEnd.y,
      }),
      s("line", {
        class: "freehand-ghost-correction freehand-ghost-user-fit",
        x1: result.userRayStart.x,
        y1: result.userRayStart.y,
        x2: result.userRayEnd.x,
        y2: result.userRayEnd.y,
      }),
    );
    return;
  }
  if (result.kind === "circle" || result.kind === "target-circle") {
    const center =
      result.kind === "target-circle" ? result.target.center : result.center;
    const radius =
      result.kind === "target-circle" ? result.target.radius : result.radius;
    parent.append(
      s("circle", {
        class: "freehand-ghost-correction",
        cx: center.x,
        cy: center.y,
        r: radius,
      }),
    );
    return;
  }
  if (result.kind === "ellipse" || result.kind === "target-ellipse") {
    const center =
      result.kind === "target-ellipse" ? result.target.center : result.center;
    const majorRadius =
      result.kind === "target-ellipse"
        ? result.target.majorRadius
        : result.majorRadius;
    const minorRadius =
      result.kind === "target-ellipse"
        ? result.target.minorRadius
        : result.minorRadius;
    const rotationRadians =
      result.kind === "target-ellipse"
        ? result.target.rotationRadians
        : result.rotationRadians;
    parent.append(
      s("ellipse", {
        class: "freehand-ghost-correction",
        cx: center.x,
        cy: center.y,
        rx: majorRadius,
        ry: minorRadius,
        transform: `rotate(${((rotationRadians * 180) / Math.PI).toFixed(3)} ${center.x.toFixed(2)} ${center.y.toFixed(2)})`,
      }),
    );
  }
}

const LINE_ANGLE_TRACKED_EXERCISES = new Set<ExerciseId>([
  "freehand-straight-line",
  "target-line-two-points",
  "trace-line",
]);

function isLineAngleTrackedExercise(id: ExerciseId): boolean {
  return LINE_ANGLE_TRACKED_EXERCISES.has(id);
}

function lineAngleMetadataForResult(
  exerciseId: ExerciseId,
  result: FreehandResult,
): LineAngleMetadata | undefined {
  if (!isLineAngleTrackedExercise(exerciseId)) return undefined;
  if (result.kind === "line") {
    return lineAngleMetadataFromPoints(result.fitStart, result.fitEnd);
  }
  if (result.kind === "target-line") {
    return lineAngleMetadataFromPoints(result.target.start, result.target.end);
  }
  return undefined;
}

function renderLineAngleWidget(
  container: HTMLElement,
  progress: ProgressStore,
  exerciseId: ExerciseId,
): void {
  const buckets = progress.dimensions.lineAngleBuckets[exerciseId] ?? {};
  const chart = s("svg", {
    class: "line-angle-chart",
    viewBox: "0 0 120 120",
    role: "img",
    "aria-label": "Angle proficiency by line direction",
  });

  for (const bucket of LINE_ANGLE_BUCKETS) {
    const aggregate = buckets[String(bucket)];
    const fill =
      aggregate === undefined
        ? "rgba(103, 103, 103, 0.16)"
        : `hsl(${feedbackHueForError(100 - aggregate.ema)} 55% 42%)`;
    chart.append(
      angleSector(bucket, fill),
      angleSector(bucket + 180, fill),
    );
  }
  chart.append(
    s("circle", {
      class: "line-angle-chart-core",
      cx: 60,
      cy: 60,
      r: 15,
    }),
  );

  container.replaceChildren(chart);
}

function angleSector(centerDegrees: number, fill: string): SVGPathElement {
  const half = LINE_ANGLE_BUCKET_SIZE_DEGREES / 2;
  const start = polarPoint(60, 60, 54, centerDegrees - half);
  const end = polarPoint(60, 60, 54, centerDegrees + half);
  const path = s("path", {
    class: "line-angle-chart-sector",
    d: `M 60 60 L ${start.x.toFixed(2)} ${start.y.toFixed(2)} A 54 54 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)} Z`,
  });
  path.style.fill = fill;
  return path;
}

function polarPoint(
  cx: number,
  cy: number,
  radius: number,
  degrees: number,
): { x: number; y: number } {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: cx + Math.cos(radians) * radius,
    y: cy + Math.sin(radians) * radius,
  };
}

function initialAdjustableEndpoint(target: {
  target: {
    vertex: { x: number; y: number };
    baseEnd: { x: number; y: number };
    correctEnd: { x: number; y: number };
  };
}): { x: number; y: number } {
  const length = distanceBetween(
    target.target.vertex,
    target.target.correctEnd,
  );
  const vertex = target.target.vertex;
  const correctAngle = Math.atan2(
    target.target.correctEnd.y - vertex.y,
    target.target.correctEnd.x - vertex.x,
  );
  const baseAngle = Math.atan2(
    target.target.baseEnd.y - vertex.y,
    target.target.baseEnd.x - vertex.x,
  );
  const candidateAngles = [
    -Math.PI / 2,
    Math.PI / 2,
    0,
    Math.PI,
    baseAngle,
    correctAngle + Math.PI / 2,
    correctAngle - Math.PI / 2,
  ];

  for (const angle of candidateAngles) {
    const endpoint = {
      x: vertex.x + Math.cos(angle) * length,
      y: vertex.y + Math.sin(angle) * length,
    };
    if (pointInsideCanvas(endpoint, 18)) return endpoint;
  }

  // The target base ray is generated inside the canvas, so this remains usable
  // even if every neutral starting angle is clipped by a narrow placement.
  return target.target.baseEnd;
}

function pointInsideCanvas(
  point: { x: number; y: number },
  padding: number,
): boolean {
  return (
    point.x >= padding &&
    point.x <= CANVAS_WIDTH - padding &&
    point.y >= padding &&
    point.y <= CANVAS_HEIGHT - padding
  );
}
