/** Freehand exercise screen used by Freehand Control, Target Drawing, and Trace Control. */
import type {
  ExerciseDefinition,
  ExerciseId,
  FreehandExerciseDefinition,
} from "../practice/catalog";
import { getStoredProgress, updateStoredProgress } from "../storage/progress";
import type {
  ProgressAttemptMetadata,
  ProgressStore,
} from "../storage/progress";
import { startActivePracticeTimer } from "../storage/activePracticeTimer";
import { recordCurriculumCompletion } from "../storage/curriculumStats";
import { getSettings } from "../storage/settings";
import {
  createDoubleTapCommitDetector,
  installSpaceCommitShortcut,
} from "../input/commitGestures";
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
  LINE_ANGLE_BUCKET_SIZE_DEGREES,
  lineAngleMetadataFromPoints,
  type LineAngleMetadata,
} from "../practice/lineAngles";
import {
  lineAngleTrackerModel,
  type LineAngleTrackerBucket,
} from "../practice/lineAngleTracker";
import {
  angleOpeningMetadataFromRadians,
  type AngleOpeningMetadata,
} from "../practice/angleOpenings";
import {
  angleOpeningTrackerModel,
  type AngleOpeningTrackerBucket,
} from "../practice/angleOpeningTracker";
import {
  angleEstimateMetadata,
  type AngleEstimateMetadata,
} from "../practice/angleEstimation";
import {
  angleEstimateTrackerModel,
  type AngleEstimateTrackerBucket,
} from "../practice/angleEstimationTracker";
import {
  closedShapeCanvasMetrics,
  circleRadiusMetadata,
  ellipseAngleMetadata,
  ellipseRatioMetadata,
  ellipseSizeMetadata,
  ellipseAngleTrackerModel,
  type CircleRadiusMetadata,
  type ClosedShapeCanvasMetrics,
  type ClosedShapeTrackerBucket,
  type EllipseAngleMetadata,
  type EllipseRatioMetadata,
  type EllipseSizeMetadata,
} from "../practice/closedShapeDimensions";
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
  source: "direct" | "auto" | "curriculum",
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
  const stopActiveTimer = startActivePracticeTimer(exercise.id, root);

  const isClosedShapeExercise = config.isClosedShape;

  const screen = pageShell();
  const header = exerciseHeader(exercise, source);
  const stage = h("section", { class: "exercise-stage freehand-stage" });

  const prompt = h("p", { class: "exercise-prompt" }, [
    promptTextForCurrentTarget(),
  ]);

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
  const hasManualCommit =
    inputMode === "unlimited-strokes" || inputMode === "adjustable-line";
  const canCommitPendingResult = (): boolean =>
    hasManualCommit &&
    result === null &&
    !commitBtn.hidden &&
    !commitBtn.disabled;
  const removeSpaceCommitShortcut = hasManualCommit
    ? installSpaceCommitShortcut({
        canCommit: canCommitPendingResult,
        onCommit: commitPendingResult,
      })
    : null;

  const resetLineBtn = actionButton("Reset", () => {
    resetAdjustableLine();
  });
  resetLineBtn.hidden = inputMode !== "adjustable-line";

  const fullBtn = fullscreenButton(stage);

  const backBtn = actionButton(
    source === "curriculum" ? "Back to Curriculum" : "Back to List",
    () => {
      onNavigate(
        source === "curriculum"
          ? { screen: "list", homeView: "curriculum" }
          : { screen: "list", listState },
      );
    },
  );

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
  const lineAngleWidget = isLineAngleTrackedExercise(exercise.id)
    ? h("button", {
        type: "button",
        class: "line-angle-widget",
        title: "Review line direction practice",
        on: {
          click: () => {
            document.body.append(
              renderLineAngleTrackerModal(getStoredProgress(), exercise.id),
            );
          },
        },
      })
    : null;
  const angleOpeningWidget = isAngleOpeningTrackedExercise(exercise.id)
    ? h("button", {
        type: "button",
        class: "angle-semicircle-widget",
        title: "Review angle opening practice",
        on: {
          click: () => {
            document.body.append(
              renderAngleOpeningTrackerModal(getStoredProgress(), exercise.id),
            );
          },
        },
      })
      : null;
  const angleEstimateWidget = isAngleConstructionExercise(exercise.id)
    ? h("button", {
        type: "button",
        class: "angle-semicircle-widget angle-estimate-widget",
        title: "Review angle estimation practice",
        on: {
          click: () => {
            document.body.append(
              renderAngleEstimateTrackerModal(getStoredProgress(), exercise.id),
            );
          },
        },
      })
    : null;
  const ellipseAngleWidget = isEllipseAngleTrackedExercise(exercise.id)
    ? h("button", {
        type: "button",
        class:
          "angle-opening-widget shape-dimension-widget ellipse-angle-widget",
        title: "Review ellipse orientation practice",
        on: {
          click: () => {
            document.body.append(
              renderEllipseAngleTrackerModal(getStoredProgress(), exercise.id),
            );
          },
        },
      })
    : null;
  if (lineAngleWidget) {
    lineAngleWidget.setAttribute(
      "aria-label",
      "Review line direction practice",
    );
    renderLineAngleWidget(lineAngleWidget, getStoredProgress(), exercise.id);
    toolbar.append(lineAngleWidget);
  }
  if (angleOpeningWidget) {
    angleOpeningWidget.setAttribute(
      "aria-label",
      "Review angle opening practice",
    );
    renderAngleOpeningWidget(
      angleOpeningWidget,
      getStoredProgress(),
      exercise.id,
    );
    toolbar.append(angleOpeningWidget);
  }
  if (angleEstimateWidget) {
    angleEstimateWidget.setAttribute(
      "aria-label",
      "Review angle estimation practice",
    );
    renderAngleEstimateWidget(
      angleEstimateWidget,
      getStoredProgress(),
      exercise.id,
    );
    toolbar.append(angleEstimateWidget);
  }
  if (ellipseAngleWidget) {
    ellipseAngleWidget.setAttribute(
      "aria-label",
      "Review ellipse orientation practice",
    );
    renderEllipseAngleWidget(
      ellipseAngleWidget,
      getStoredProgress(),
      exercise.id,
    );
    toolbar.append(ellipseAngleWidget);
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
  const doubleTapCommit = createDoubleTapCommitDetector({
    canCommit: canCommitPendingResult,
    isSafeCommitPoint: isSafeFreehandCommitTap,
    onCommit: commitPendingResult,
  });
  if (hasManualCommit) {
    svg.addEventListener("pointerdown", doubleTapCommit.onPointerDown);
    svg.addEventListener("pointerup", doubleTapCommit.onPointerUp);
    svg.addEventListener("pointercancel", doubleTapCommit.reset);
  }

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

  const finishAdjustableDrag = (event: PointerEvent): void => {
    if (adjustablePointerId !== event.pointerId) return;
    event.preventDefault();
    adjustablePointerId = null;
    window.removeEventListener("pointerup", finishAdjustableDrag);
    window.removeEventListener("pointercancel", finishAdjustableDrag);
    if (adjustableHandle.hasPointerCapture(event.pointerId)) {
      adjustableHandle.releasePointerCapture(event.pointerId);
    }
    if (event.type === "pointerup" && inputMode === "adjustable-line-1-shot") {
      commitPendingResult();
    }
  };

  adjustableHandle.addEventListener("pointerdown", (event) => {
    if (!isAdjustableLineMode || result) return;
    adjustablePointerId = event.pointerId;
    adjustableHandle.setPointerCapture(event.pointerId);
    window.addEventListener("pointerup", finishAdjustableDrag);
    window.addEventListener("pointercancel", finishAdjustableDrag);
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
    stopActiveTimer();
    removeSpaceCommitShortcut?.();
    window.removeEventListener("pointerup", finishAdjustableDrag);
    window.removeEventListener("pointercancel", finishAdjustableDrag);
    if (escapeListener !== null) {
      document.removeEventListener("keydown", escapeListener);
      escapeListener = null;
    }
  };

  function isSafeFreehandCommitTap(event: PointerEvent): boolean {
    const point = freehandPointFromEvent(svg, event);
    if (!point) return false;

    if (!isAdjustableLineMode) {
      const edgeMargin = 48;
      return (
        point.x < edgeMargin ||
        point.x > CANVAS_WIDTH - edgeMargin ||
        point.y < edgeMargin ||
        point.y > CANVAS_HEIGHT - edgeMargin
      );
    }

    const start = adjustableLinePoint("x1", "y1");
    const end = adjustableLinePoint("x2", "y2");
    return (
      distanceBetween(point, end) > 80 &&
      distanceToSegment(point, start, end) > 56
    );
  }

  function adjustableLinePoint(
    xAttribute: "x1" | "x2",
    yAttribute: "y1" | "y2",
  ): { x: number; y: number } {
    return {
      x: Number(adjustableLine.getAttribute(xAttribute)),
      y: Number(adjustableLine.getAttribute(yAttribute)),
    };
  }

  function distanceToSegment(
    point: { x: number; y: number },
    start: { x: number; y: number },
    end: { x: number; y: number },
  ): number {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) return distanceBetween(point, start);
    const ratio = Math.max(
      0,
      Math.min(
        1,
        ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
      ),
    );
    return distanceBetween(point, {
      x: start.x + dx * ratio,
      y: start.y + dy * ratio,
    });
  }

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
      doubleTapCommit.reset();
      points = adjustablePoints();
      renderFreehandStroke(strokeLayer, points, "freehand-user-stroke");
      adjustableLayer.style.display = "none";
      commitResult(next);
      return;
    }
    if (!pendingResult) return;
    doubleTapCommit.reset();
    commitResult(pendingResult);
  }

  function commitResult(next: FreehandResult): void {
    result = next;
    pendingResult = null;
    commitBtn.disabled = true;
    const previousProgress = getStoredProgress();
    const nextProgress = updateStoredProgress(
      exercise.id,
      result.score,
      0,
      progressMetadataForResult(exercise.id, result, points),
    );
    const nextAggregate = nextProgress.aggregates[exercise.id];
    if (nextAggregate) {
      recordCurriculumCompletion(
        exercise.id,
        nextAggregate.ema,
        previousProgress.aggregates[exercise.id]?.ema,
      );
    }
    if (lineAngleWidget) {
      renderLineAngleWidget(lineAngleWidget, nextProgress, exercise.id);
    }
    if (angleOpeningWidget) {
      renderAngleOpeningWidget(angleOpeningWidget, nextProgress, exercise.id);
    }
    if (angleEstimateWidget) {
      renderAngleEstimateWidget(angleEstimateWidget, nextProgress, exercise.id);
    }
    if (ellipseAngleWidget) {
      renderEllipseAngleWidget(ellipseAngleWidget, nextProgress, exercise.id);
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
    if (result.kind === "target-angle") {
      correctionLayer.append(
        s("line", {
          class: "freehand-fit-line freehand-angle-user-fit",
          x1: result.userRayStart.x,
          y1: result.userRayStart.y,
          x2: result.userRayEnd.x,
          y2: result.userRayEnd.y,
        }),
      );
    }
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
    doubleTapCommit.reset();
    target = config.createTarget();
    prompt.textContent = promptTextForCurrentTarget();
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
    prompt.textContent = promptTextForCurrentTarget();
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

  function promptTextForCurrentTarget(): string {
    return config.promptTextForTarget?.(target) ?? config.promptText;
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

function isAngleOpeningTrackedExercise(id: ExerciseId): boolean {
  return id.startsWith("angle-copy-");
}

function isAngleConstructionExercise(id: ExerciseId): boolean {
  return id.startsWith("angle-construct-");
}

function isCircleRadiusTrackedExercise(id: ExerciseId): boolean {
  return (
    id === "freehand-circle" ||
    id.startsWith("target-circle-") ||
    id === "trace-circle"
  );
}

function isEllipseAngleTrackedExercise(id: ExerciseId): boolean {
  return id === "freehand-ellipse" || id === "trace-ellipse";
}

function progressMetadataForResult(
  exerciseId: ExerciseId,
  result: FreehandResult,
  points: FreehandPoint[],
): ProgressAttemptMetadata | undefined {
  const canvas = closedShapeCanvasMetrics(CANVAS_WIDTH, CANVAS_HEIGHT);
  const metadata = {
    ...lineAngleMetadataForResult(exerciseId, result, points),
    ...angleOpeningMetadataForResult(exerciseId, result),
    ...angleEstimateMetadataForResult(exerciseId, result),
    ...circleRadiusMetadataForResult(exerciseId, result, canvas),
    ...ellipseAngleMetadataForResult(exerciseId, result),
    ...ellipseSizeMetadataForResult(exerciseId, result, canvas),
    ...ellipseRatioMetadataForResult(exerciseId, result),
  };
  return Object.keys(metadata).length === 0 ? undefined : metadata;
}

function lineAngleMetadataForResult(
  exerciseId: ExerciseId,
  result: FreehandResult,
  points: FreehandPoint[],
): LineAngleMetadata | undefined {
  if (!isLineAngleTrackedExercise(exerciseId)) return undefined;
  if (result.kind === "line") {
    return points.length >= 2
      ? lineAngleMetadataFromPoints(points[0], points[points.length - 1])
      : lineAngleMetadataFromPoints(result.fitStart, result.fitEnd);
  }
  if (result.kind === "target-line") {
    if (result.target.showDirectionCue) {
      return lineAngleMetadataFromPoints(
        result.target.start,
        result.target.end,
      );
    }
    return points.length >= 2
      ? lineAngleMetadataFromPoints(points[0], points[points.length - 1])
      : lineAngleMetadataFromPoints(result.fitStart, result.fitEnd);
  }
  return undefined;
}

function angleOpeningMetadataForResult(
  exerciseId: ExerciseId,
  result: FreehandResult,
): AngleOpeningMetadata | undefined {
  if (!isAngleOpeningTrackedExercise(exerciseId)) return undefined;
  if (result.kind !== "target-angle") return undefined;
  return angleOpeningMetadataFromRadians(result.target.openingRadians);
}

function angleEstimateMetadataForResult(
  exerciseId: ExerciseId,
  result: FreehandResult,
): AngleEstimateMetadata | undefined {
  if (!isAngleConstructionExercise(exerciseId)) return undefined;
  if (result.kind !== "target-angle") return undefined;
  return angleEstimateMetadata(
    result.target.requestedDegrees ??
      Math.round((Math.abs(result.target.openingRadians) * 180) / Math.PI),
  );
}

function circleRadiusMetadataForResult(
  exerciseId: ExerciseId,
  result: FreehandResult,
  canvas: ClosedShapeCanvasMetrics | null,
): CircleRadiusMetadata | undefined {
  if (!canvas) return undefined;
  if (!isCircleRadiusTrackedExercise(exerciseId)) return undefined;
  if (result.kind === "circle") {
    return circleRadiusMetadata(result.radius, canvas);
  }
  if (result.kind === "target-circle") {
    return circleRadiusMetadata(result.target.radius, canvas);
  }
  return undefined;
}

function ellipseAngleMetadataForResult(
  exerciseId: ExerciseId,
  result: FreehandResult,
): EllipseAngleMetadata | undefined {
  if (!isEllipseAngleTrackedExercise(exerciseId)) return undefined;
  if (result.kind === "ellipse") {
    return ellipseAngleMetadata(result.rotationRadians);
  }
  if (result.kind === "target-ellipse") {
    return ellipseAngleMetadata(result.target.rotationRadians);
  }
  return undefined;
}

function ellipseSizeMetadataForResult(
  exerciseId: ExerciseId,
  result: FreehandResult,
  canvas: ClosedShapeCanvasMetrics | null,
): EllipseSizeMetadata | undefined {
  if (!canvas) return undefined;
  if (!isEllipseAngleTrackedExercise(exerciseId)) return undefined;
  if (result.kind === "ellipse") {
    return ellipseSizeMetadata(result.majorRadius, canvas);
  }
  if (result.kind === "target-ellipse") {
    return ellipseSizeMetadata(result.target.majorRadius, canvas);
  }
  return undefined;
}

function ellipseRatioMetadataForResult(
  exerciseId: ExerciseId,
  result: FreehandResult,
): EllipseRatioMetadata | undefined {
  if (!isEllipseAngleTrackedExercise(exerciseId)) return undefined;
  if (result.kind === "ellipse") {
    return ellipseRatioMetadata(result.majorRadius, result.minorRadius);
  }
  if (result.kind === "target-ellipse") {
    return ellipseRatioMetadata(
      result.target.majorRadius,
      result.target.minorRadius,
    );
  }
  return undefined;
}

function renderLineAngleWidget(
  container: HTMLElement,
  progress: ProgressStore,
  exerciseId: ExerciseId,
): void {
  const model = lineAngleTrackerModel(progress, exerciseId);
  const chart = s("svg", {
    class: "line-angle-chart",
    viewBox: "0 0 120 120",
    role: "img",
    "aria-label": "Angle proficiency by line direction",
  });

  for (const bucket of model.buckets) {
    chart.append(angleSector(bucket.bucket, bucket.sectorFill));
  }
  for (const bucket of model.buckets) {
    if (bucket.todayOpacity <= 0) continue;
    chart.append(
      angleRingSector(
        bucket.bucket,
        `rgba(47, 85, 125, ${bucket.todayOpacity.toFixed(2)})`,
      ),
    );
  }
  chart.append(
    s("circle", {
      class: "line-angle-chart-core",
      cx: 60,
      cy: 60,
      r: 15,
      fill: model.centerFill,
    }),
  );

  container.replaceChildren(chart);
}

function renderAngleOpeningWidget(
  container: HTMLElement,
  progress: ProgressStore,
  exerciseId: ExerciseId,
): void {
  const model = angleOpeningTrackerModel(progress, exerciseId);
  container.replaceChildren(
    angleSemicircleChart(
      model.buckets,
      "Angle opening proficiency",
      (bucket) => bucket.bucket,
      (bucket) => bucket.cellFill,
      angleOpeningBucketSummary,
      "angle-semicircle-chart",
    ),
    angleOpeningTotalBar(model.todayTotal, model.todayProgress),
  );
}

function renderAngleEstimateWidget(
  container: HTMLElement,
  progress: ProgressStore,
  exerciseId: ExerciseId,
): void {
  const model = angleEstimateTrackerModel(progress, exerciseId);
  container.replaceChildren(
    angleSemicircleChart(
      model.buckets,
      "Angle estimation proficiency",
      (bucket) => bucket.bucket,
      (bucket) => bucket.cellFill,
      angleEstimateBucketSummary,
      "angle-semicircle-chart",
    ),
    angleOpeningTotalBar(model.todayTotal, model.todayProgress),
  );
}

function renderEllipseAngleWidget(
  container: HTMLElement,
  progress: ProgressStore,
  exerciseId: ExerciseId,
): void {
  const model = ellipseAngleTrackerModel(progress, exerciseId);
  renderClosedShapeStrip(
    container,
    model.buckets,
    model.todayTotal,
    model.todayProgress,
  );
}

function renderClosedShapeStrip(
  container: HTMLElement,
  buckets: ClosedShapeTrackerBucket[],
  todayTotal: number,
  todayProgress: number,
): void {
  const todayBars = h(
    "div",
    { class: "angle-opening-today-bars" },
    buckets.map(closedShapeTodayBar),
  );
  const cells = h(
    "div",
    { class: "angle-opening-cells" },
    buckets.map((bucket) =>
      h("span", {
        class: "angle-opening-cell",
        style: { background: bucket.cellFill },
      }),
    ),
  );
  const total = angleOpeningTotalBar(todayTotal, todayProgress);
  container.replaceChildren(todayBars, cells, total);
}

function renderLineAngleTrackerModal(
  progress: ProgressStore,
  exerciseId: ExerciseId,
): HTMLElement {
  const model = lineAngleTrackerModel(progress, exerciseId);
  let overlay: HTMLElement;
  const close = (): void => overlay.remove();
  const chart = s("svg", {
    class: "line-angle-chart line-angle-chart-large",
    viewBox: "0 0 120 120",
    role: "img",
    "aria-label": "Detailed angle proficiency by line direction",
  });
  for (const bucket of model.buckets) {
    const sector = angleSector(bucket.bucket, bucket.sectorFill);
    appendSvgTitle(sector, lineAngleBucketSummary(bucket));
    chart.append(sector);
  }
  for (const bucket of model.buckets) {
    if (bucket.todayOpacity <= 0) continue;
    const sector = angleRingSector(
      bucket.bucket,
      `rgba(47, 85, 125, ${bucket.todayOpacity.toFixed(2)})`,
    );
    appendSvgTitle(sector, lineAngleBucketSummary(bucket));
    chart.append(sector);
  }
  chart.append(
    s("circle", {
      class: "line-angle-chart-core",
      cx: 60,
      cy: 60,
      r: 15,
      fill: model.centerFill,
    }),
  );

  const populatedBuckets = model.buckets.filter(
    (bucket) => bucket.aggregate !== undefined || bucket.todayAttempts > 0,
  );
  const details = h("div", { class: "line-angle-modal-details" }, [
    h("p", {}, [`Today: ${model.todayTotal} line attempts`]),
    h("p", {}, [
      "Sector color ranks long-term proficiency for this drill. Outer ring shows attempts today.",
    ]),
    h(
      "ol",
      {},
      populatedBuckets.map((bucket) =>
        h("li", {}, [lineAngleBucketSummary(bucket)]),
      ),
    ),
  ]);

  const closeBtn = actionButton("Close", close);
  const panel = h(
    "div",
    {
      class: "line-angle-modal-panel",
      on: { click: (event) => event.stopPropagation() },
    },
    [
      h("div", { class: "line-angle-modal-header" }, [
        h("h2", {}, ["Line Direction Tracker"]),
        closeBtn,
      ]),
      chart,
      details,
    ],
  );
  overlay = h(
    "div",
    {
      class: "line-angle-modal",
      on: { click: close },
    },
    [panel],
  );
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Line direction tracker detail");
  return overlay;
}

function renderEllipseAngleTrackerModal(
  progress: ProgressStore,
  exerciseId: ExerciseId,
): HTMLElement {
  const model = ellipseAngleTrackerModel(progress, exerciseId);
  return renderClosedShapeTrackerModal({
    title: "Ellipse Orientation Tracker",
    ariaLabel: "Ellipse orientation tracker detail",
    todayLabel: "ellipse attempts",
    explanation:
      "Cell color ranks long-term proficiency for this drill. Top bars show attempts today.",
    buckets: model.buckets,
    todayTotal: model.todayTotal,
    todayProgress: model.todayProgress,
    summary: ellipseAngleBucketSummary,
  });
}

function renderClosedShapeTrackerModal(options: {
  title: string;
  ariaLabel: string;
  todayLabel: string;
  explanation: string;
  buckets: ClosedShapeTrackerBucket[];
  todayTotal: number;
  todayProgress: number;
  summary: (bucket: ClosedShapeTrackerBucket) => string;
}): HTMLElement {
  let overlay: HTMLElement;
  const close = (): void => overlay.remove();
  const strip = h(
    "div",
    {
      class: "angle-opening-detail-strip shape-dimension-detail-strip",
      style: {
        "--shape-bucket-count": String(options.buckets.length),
      } as unknown as Partial<CSSStyleDeclaration>,
    },
    [
      h(
        "div",
        { class: "angle-opening-today-bars" },
        options.buckets.map(closedShapeTodayBar),
      ),
      h(
        "div",
        { class: "angle-opening-cells" },
        options.buckets.map((bucket) =>
          h("span", {
            class: "angle-opening-cell",
            style: { background: bucket.cellFill },
            title: options.summary(bucket),
          }),
        ),
      ),
      angleOpeningTotalBar(options.todayTotal, options.todayProgress),
    ],
  );

  const populatedBuckets = options.buckets.filter(
    (bucket) => bucket.aggregate !== undefined || bucket.todayAttempts > 0,
  );
  const details = h("div", { class: "line-angle-modal-details" }, [
    h("p", {}, [`Today: ${options.todayTotal} ${options.todayLabel}`]),
    h("p", {}, [options.explanation]),
    h(
      "ol",
      {},
      populatedBuckets.map((bucket) => h("li", {}, [options.summary(bucket)])),
    ),
  ]);

  const closeBtn = actionButton("Close", close);
  const panel = h(
    "div",
    {
      class: "line-angle-modal-panel",
      on: { click: (event) => event.stopPropagation() },
    },
    [
      h("div", { class: "line-angle-modal-header" }, [
        h("h2", {}, [options.title]),
        closeBtn,
      ]),
      strip,
      details,
    ],
  );
  overlay = h(
    "div",
    {
      class: "line-angle-modal",
      on: { click: close },
    },
    [panel],
  );
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", options.ariaLabel);
  return overlay;
}

function renderAngleOpeningTrackerModal(
  progress: ProgressStore,
  exerciseId: ExerciseId,
): HTMLElement {
  const model = angleOpeningTrackerModel(progress, exerciseId);
  let overlay: HTMLElement;
  const close = (): void => overlay.remove();
  const strip = h("div", { class: "angle-opening-detail-strip" }, [
    angleSemicircleChart(
      model.buckets,
      "Angle opening proficiency",
      (bucket) => bucket.bucket,
      (bucket) => bucket.cellFill,
      angleOpeningBucketSummary,
      "angle-semicircle-chart-large",
    ),
    angleOpeningTotalBar(model.todayTotal, model.todayProgress),
  ]);

  const populatedBuckets = model.buckets.filter(
    (bucket) => bucket.aggregate !== undefined || bucket.todayAttempts > 0,
  );
  const details = h("div", { class: "line-angle-modal-details" }, [
    h("p", {}, [`Today: ${model.todayTotal} angle attempts`]),
    h("p", {}, [
      "Cell color ranks long-term proficiency for this drill. Top bars show attempts today.",
    ]),
    h(
      "ol",
      {},
      populatedBuckets.map((bucket) =>
        h("li", {}, [angleOpeningBucketSummary(bucket)]),
      ),
    ),
  ]);

  const closeBtn = actionButton("Close", close);
  const panel = h(
    "div",
    {
      class: "line-angle-modal-panel",
      on: { click: (event) => event.stopPropagation() },
    },
    [
      h("div", { class: "line-angle-modal-header" }, [
        h("h2", {}, ["Angle Opening Tracker"]),
        closeBtn,
      ]),
      strip,
      details,
    ],
  );
  overlay = h(
    "div",
    {
      class: "line-angle-modal",
      on: { click: close },
    },
    [panel],
  );
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Angle opening tracker detail");
  return overlay;
}

function renderAngleEstimateTrackerModal(
  progress: ProgressStore,
  exerciseId: ExerciseId,
): HTMLElement {
  const model = angleEstimateTrackerModel(progress, exerciseId);
  const strip = h("div", {
    class: "angle-opening-detail-strip angle-estimate-detail-strip",
  });
  strip.replaceChildren(
    angleSemicircleChart(
      model.buckets,
      "Angle estimation proficiency",
      (bucket) => bucket.bucket,
      (bucket) => bucket.cellFill,
      angleEstimateBucketSummary,
      "angle-semicircle-chart-large",
    ),
    angleOpeningTotalBar(model.todayTotal, model.todayProgress),
  );
  const populatedBuckets = model.buckets.filter(
    (bucket) => bucket.aggregate !== undefined || bucket.todayAttempts > 0,
  );
  const details = h("div", { class: "line-angle-modal-details" }, [
    h("p", {}, [
      "Cells rank 5-degree angle buckets. Edge buckets include 2-7deg and 173-178deg.",
    ]),
    h(
      "ul",
      {},
      populatedBuckets.length === 0
        ? [h("li", {}, ["No angle construction attempts yet."])]
        : populatedBuckets.map((bucket) =>
            h("li", {}, [angleEstimateBucketSummary(bucket)]),
          ),
    ),
  ]);
  const closeBtn = actionButton("Close", () => overlay.remove());
  const panel = h("section", { class: "line-angle-modal-panel" }, [
    h("div", { class: "line-angle-modal-header" }, [
      h("h2", {}, ["Angle Estimation Tracker"]),
      closeBtn,
    ]),
    strip,
    details,
  ]);
  const overlay = h("div", { class: "line-angle-modal" }, [panel]);
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Angle estimation tracker detail");
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) overlay.remove();
  });
  return overlay;
}

function closedShapeTodayBar(
  bucket: ClosedShapeTrackerBucket,
): HTMLSpanElement {
  const bar = h("span", { class: "angle-opening-today-bar" });
  bar.style.setProperty("--today-height", `${bucket.todayHeightPercent}%`);
  bar.style.setProperty("--today-opacity", bucket.todayOpacity.toFixed(2));
  return bar;
}

function angleOpeningTotalBar(
  todayTotal: number,
  todayProgress: number,
): HTMLDivElement {
  const total = h("div", {
    class: "angle-opening-total",
    title: `${todayTotal} angle attempts today`,
  });
  total.style.setProperty(
    "--today-progress-width",
    `${(todayProgress * 100).toFixed(1)}%`,
  );
  return total;
}

function angleSemicircleChart<T>(
  buckets: T[],
  ariaLabel: string,
  bucketCenter: (bucket: T) => number,
  bucketFill: (bucket: T) => string,
  bucketTitle: (bucket: T) => string,
  className: string,
): SVGSVGElement {
  const chart = s("svg", {
    class: `angle-semicircle-chart ${className}`,
    viewBox: "0 0 54 30",
    role: "img",
    "aria-label": ariaLabel,
  });
  const centers = buckets.map(bucketCenter).sort((a, b) => a - b);
  const half =
    centers.length > 1 ? Math.abs(centers[1] - centers[0]) / 2 : 5;
  for (const bucket of buckets) {
    const sector = angleSemicircleSector(
      bucketCenter(bucket),
      half,
      bucketFill(bucket),
    );
    appendSvgTitle(sector, bucketTitle(bucket));
    chart.append(sector);
  }
  chart.append(
    s("circle", {
      class: "division-direction-chart-core",
      cx: 27,
      cy: 27,
      r: 5,
    }),
  );
  return chart;
}

function angleSemicircleSector(
  centerDegrees: number,
  halfDegrees: number,
  fill: string,
): SVGPathElement {
  const startDegrees = 180 + centerDegrees - halfDegrees;
  const endDegrees = 180 + centerDegrees + halfDegrees;
  const start = polarPoint(27, 27, 24, startDegrees);
  const end = polarPoint(27, 27, 24, endDegrees);
  const path = s("path", {
    class: "division-direction-sector",
    d: `M 27 27 L ${start.x.toFixed(2)} ${start.y.toFixed(2)} A 24 24 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)} Z`,
  });
  path.style.fill = fill;
  return path;
}

function angleSector(centerDegrees: number, fill: string): SVGPathElement {
  const half = LINE_ANGLE_BUCKET_SIZE_DEGREES / 2;
  const start = polarPoint(60, 60, 46, centerDegrees - half);
  const end = polarPoint(60, 60, 46, centerDegrees + half);
  const path = s("path", {
    class: "line-angle-chart-sector",
    d: `M 60 60 L ${start.x.toFixed(2)} ${start.y.toFixed(2)} A 46 46 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)} Z`,
  });
  path.style.fill = fill;
  return path;
}

function angleRingSector(centerDegrees: number, fill: string): SVGPathElement {
  const half = LINE_ANGLE_BUCKET_SIZE_DEGREES / 2;
  const outerStart = polarPoint(60, 60, 58, centerDegrees - half);
  const outerEnd = polarPoint(60, 60, 58, centerDegrees + half);
  const innerStart = polarPoint(60, 60, 49, centerDegrees - half);
  const innerEnd = polarPoint(60, 60, 49, centerDegrees + half);
  const path = s("path", {
    class: "line-angle-chart-today-sector",
    d: [
      `M ${outerStart.x.toFixed(2)} ${outerStart.y.toFixed(2)}`,
      `A 58 58 0 0 1 ${outerEnd.x.toFixed(2)} ${outerEnd.y.toFixed(2)}`,
      `L ${innerEnd.x.toFixed(2)} ${innerEnd.y.toFixed(2)}`,
      `A 49 49 0 0 0 ${innerStart.x.toFixed(2)} ${innerStart.y.toFixed(2)}`,
      "Z",
    ].join(" "),
  });
  path.style.fill = fill;
  return path;
}

function appendSvgTitle(element: SVGElement, text: string): void {
  const title = s("title");
  title.textContent = text;
  element.append(title);
}

function lineAngleBucketSummary(bucket: LineAngleTrackerBucket): string {
  const score =
    bucket.aggregate === undefined
      ? "no proficiency score"
      : `EMA ${bucket.aggregate.ema.toFixed(1)}, ${bucket.aggregate.attempts} counted`;
  return `${bucket.bucket}deg: ${score}, ${bucket.todayAttempts} today`;
}

function angleOpeningBucketSummary(bucket: AngleOpeningTrackerBucket): string {
  const score =
    bucket.aggregate === undefined
      ? "no proficiency score"
      : `EMA ${bucket.aggregate.ema.toFixed(1)}, ${bucket.aggregate.attempts} counted`;
  return `${bucket.bucket}deg: ${score}, ${bucket.todayAttempts} today`;
}

function angleEstimateBucketSummary(bucket: AngleEstimateTrackerBucket): string {
  const score =
    bucket.aggregate === undefined
      ? "no proficiency score"
      : `EMA ${bucket.aggregate.ema.toFixed(1)}, ${bucket.aggregate.attempts} counted`;
  return `${bucket.bucket}deg: ${score}, ${bucket.todayAttempts} today`;
}

function ellipseAngleBucketSummary(bucket: ClosedShapeTrackerBucket): string {
  const score =
    bucket.aggregate === undefined
      ? "no proficiency score"
      : `EMA ${bucket.aggregate.ema.toFixed(1)}, ${bucket.aggregate.attempts} counted`;
  return `${bucket.bucket}deg: ${score}, ${bucket.todayAttempts} today`;
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
