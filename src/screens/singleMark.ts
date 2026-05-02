/**
 * Single-mark exercise screen used by all Division drills.
 * The SVG is rebuilt on result reveal rather than updated in-place; that's intentional
 * — the result overlay shares the same element pool as the pre-reveal canvas, so a
 * full rebuild is simpler than toggling visibility on many elements.
 */
import type {
  ExerciseId,
  SingleMarkExerciseDefinition,
  LineAxis,
  SingleMarkTrial,
  TrialLine,
  SingleMarkTrialResult,
} from "../practice/catalog";
import { getStoredProgress, updateStoredProgress } from "../storage/progress";
import type { ProgressStore } from "../storage/progress";
import { getSettings } from "../storage/settings";
import {
  DIVISION_DIRECTION_BUCKETS,
  divisionDirectionTrackerModel,
  divisionLengthTrackerModel,
  type DivisionTrackerModel,
} from "../practice/divisions";
import {
  transferAngleTrackerModel,
  transferLengthTrackerModel,
  type TransferTrackerModel,
} from "../practice/lengthTransfers";
import { localSvgPoint } from "../render/svg";
import { s, h } from "../render/h";
import {
  pageShell,
  exerciseHeader,
  resultStat,
  actionButton,
  exerciseToolbar,
  fullscreenButton,
  formatSignedValue,
  pendingResultSummary,
} from "../render/components";
import {
  feedbackHueForError,
  feedbackBandClass,
  feedbackLabel,
} from "../scoring/bands";
import type { AppState, ListFilterState } from "../app/state";

export function mountSingleMarkScreen(
  root: HTMLElement,
  exercise: SingleMarkExerciseDefinition,
  source: "direct" | "auto",
  onNavigate: (next: AppState) => void,
  listState?: ListFilterState,
): () => void {
  let cancelled = false;
  let trial: SingleMarkTrial = exercise.createTrial(getStoredProgress());
  let result: SingleMarkTrialResult | null = null;
  let candidateScalar: number | null = null;
  let candidatePoint: { x: number; y: number } | null = null;
  let resetTimer: number | null = null;
  let resetAnimation: number | null = null;
  let resetStartedAt = 0;
  let resetDurationMs = 0;
  let resetRemainingMs = 0;
  let isResultPaused = false;
  const settings = getSettings();
  const autoRepeatDelayMs = settings.autoRepeatDelayMs;
  const showResultString = settings.showResultString;
  const showScoreBoxes = settings.showScoreBoxes;

  const screen = pageShell();
  const header = exerciseHeader(exercise, source);
  const stage = h("section", { class: "exercise-stage" });

  const prompt = h("p", { class: "exercise-prompt" }, [trial.prompt]);

  const pauseBtn = actionButton("Pause", () => {
    if (!result || autoRepeatDelayMs === null) return;
    if (isResultPaused) {
      resumeAutoReset();
    } else {
      pauseAutoReset();
    }
  });
  pauseBtn.classList.add("auto-repeat-action");
  pauseBtn.disabled = true;
  pauseBtn.hidden = true;

  const againBtn = actionButton("Again", () => {
    resetToFreshTrial();
  });
  againBtn.hidden = true;

  const commitBtn = actionButton("Commit", () => {
    commitCandidate();
  });
  const isUnlimitedAdjustment = exercise.inputMode === "unlimited-adjustment";
  commitBtn.hidden = !isUnlimitedAdjustment;
  commitBtn.disabled = true;

  const fullBtn = fullscreenButton(stage);

  const backBtn = actionButton("Back to List", () => {
    onNavigate({ screen: "list", listState });
  });

  const toolbar = exerciseToolbar(
    prompt,
    commitBtn,
    pauseBtn,
    againBtn,
    fullBtn,
    backBtn,
  );
  const divisionLengthWidget = isDivisionExercise(exercise.id)
    ? h("button", {
        type: "button",
        class: divisionUsesRandomDirectionTracker(exercise.id, trial)
          ? "division-tracker-widget division-random-tracker-widget"
          : "division-tracker-widget",
        title: "Review division practice",
        on: {
          click: () => {
            const progress = getStoredProgress();
            document.body.append(
              divisionUsesRandomDirectionTracker(exercise.id, trial)
                ? renderDivisionRandomTrackerModal(progress, exercise.id)
                : renderDivisionTrackerModal(
                    "Division Length Tracker",
                    divisionLengthTrackerModel(progress, exercise.id),
                  ),
            );
          },
        },
      })
    : null;
  if (divisionLengthWidget) {
    divisionLengthWidget.setAttribute(
      "aria-label",
      "Review division practice",
    );
    renderDivisionPracticeWidget(
      divisionLengthWidget,
      getStoredProgress(),
      exercise.id,
      trial,
    );
    toolbar.append(divisionLengthWidget);
  }
  const transferLengthWidget = isTransferExercise(exercise.id)
    ? h("button", {
        type: "button",
        class: isRandomTransferExercise(exercise.id)
          ? "division-tracker-widget transfer-random-tracker-widget"
          : "division-tracker-widget",
        title: "Review length transfer practice",
        on: {
          click: () => {
            const progress = getStoredProgress();
            document.body.append(
              isRandomTransferExercise(exercise.id)
                ? renderTransferRandomTrackerModal(progress, exercise.id)
                : renderDivisionTrackerModal(
                    "Length Transfer Tracker",
                    transferLengthTrackerModel(progress, exercise.id),
                  ),
            );
          },
        },
      })
    : null;
  if (transferLengthWidget) {
    transferLengthWidget.setAttribute(
      "aria-label",
      "Review length transfer practice",
    );
    renderTransferPracticeWidget(
      transferLengthWidget,
      getStoredProgress(),
      exercise.id,
    );
    toolbar.append(transferLengthWidget);
  }

  const feedback = h("p", { class: "feedback-banner" }, [
    isUnlimitedAdjustment
      ? "Place a candidate mark, revise as needed, then commit."
      : trial.scorePoint
        ? "Place one mark in the field."
        : "Place one mark on the line.",
  ]);
  const summary = h("div", { class: "result-summary" });
  summary.classList.add("is-pending");
  summary.hidden = !showScoreBoxes;
  summary.replaceChildren(...pendingResultSummary());

  let svg = renderTrialSvg(
    trial,
    () => result,
    () => candidateScalar,
    () => candidatePoint,
    onSelect,
    onPointSelect,
  );

  stage.append(toolbar, svg, feedback, summary);
  screen.append(header, stage);
  root.append(screen);
  return () => {
    cancelled = true;
    clearAutoResetTimer();
  };

  function onSelect(scalar: number): void {
    if (result) {
      resetToFreshTrial();
      return;
    }
    if (isUnlimitedAdjustment) {
      candidateScalar = scalar;
      candidatePoint = null;
      commitBtn.disabled = false;
      feedback.hidden = false;
      feedback.textContent =
        "Candidate placed. Click again to revise, or commit.";
      rerenderSvg();
      return;
    }
    revealResult(trial.scoreSelection(scalar));
  }

  function onPointSelect(point: { x: number; y: number }): void {
    if (result) {
      resetToFreshTrial();
      return;
    }
    if (!trial.scorePoint) return;
    if (isUnlimitedAdjustment) {
      candidatePoint = point;
      candidateScalar = null;
      commitBtn.disabled = false;
      feedback.hidden = false;
      feedback.textContent =
        "Candidate placed. Click again to revise, or commit.";
      rerenderSvg();
      return;
    }
    const next = trial.scorePoint(point);
    if (!next) return;
    revealResult(next);
  }

  function rerenderSvg(): void {
    const next = renderTrialSvg(
      trial,
      () => result,
      () => candidateScalar,
      () => candidatePoint,
      onSelect,
      onPointSelect,
    );
    svg.replaceWith(next);
    svg = next;
  }

  function commitCandidate(): void {
    if (result) return;
    if (candidateScalar !== null) {
      revealResult(trial.scoreSelection(candidateScalar));
      return;
    }
    if (candidatePoint && trial.scorePoint) {
      const next = trial.scorePoint(candidatePoint);
      if (next) revealResult(next);
    }
  }

  function revealResult(next: SingleMarkTrialResult): void {
    const revealScrollX = window.scrollX;
    const revealScrollY = window.scrollY;
    result = next;
    updateStoredProgress(
      exercise.id,
      result.relativeAccuracyPercent,
      result.signedErrorPixels,
      trial.progressMetadata,
    );
    const nextProgress = getStoredProgress();
    if (divisionLengthWidget) {
      renderDivisionPracticeWidget(
        divisionLengthWidget,
        nextProgress,
        exercise.id,
        trial,
      );
    }
    if (transferLengthWidget) {
      renderTransferPracticeWidget(
        transferLengthWidget,
        nextProgress,
        exercise.id,
      );
    }

    const hue = feedbackHueForError(result.relativeErrorPercent);
    const cls = feedbackBandClass(result.relativeErrorPercent);
    const accent = `hsl(${hue} 55% 42%)`;

    feedback.dataset.tone = cls;
    summary.dataset.tone = cls;
    feedback.style.setProperty("--result-accent", accent);
    summary.style.setProperty("--result-accent", accent);

    feedback.textContent =
      result.distanceErrorPixels !== undefined
        ? `${feedbackLabel(result.relativeErrorPercent)} · ` +
          `Score ${result.relativeAccuracyPercent.toFixed(1)} · ` +
          `Error ${result.distanceErrorPixels.toFixed(1)} px`
        : result.angleErrorDegrees === undefined
          ? `${feedbackLabel(result.relativeErrorPercent)} · ` +
            `Score ${result.relativeAccuracyPercent.toFixed(1)} · ` +
            `Error ${formatSignedValue(result.signedErrorPixels)} px · ` +
            `${result.relativeErrorPercent.toFixed(1)}% of line length`
          : `${feedbackLabel(result.relativeErrorPercent)} · ` +
            `Score ${result.relativeAccuracyPercent.toFixed(1)} · ` +
            `Angle error ${result.angleErrorDegrees.toFixed(1)}° · ` +
            `Offset ${formatSignedValue(result.signedErrorPixels)} px`;
    feedback.hidden = !showResultString;

    summary.classList.remove("is-pending");
    summary.hidden = !showScoreBoxes;
    const resultStats =
      result.distanceErrorPixels !== undefined
        ? [
            resultStat("Score", result.relativeAccuracyPercent.toFixed(1)),
            resultStat("Error", `${result.distanceErrorPixels.toFixed(1)} px`),
            resultStat("Placed", formatPoint(result.placedPoint)),
            resultStat("Target", formatPoint(result.targetPoint)),
          ]
        : result.angleErrorDegrees === undefined
          ? [
              resultStat("Score", result.relativeAccuracyPercent.toFixed(1)),
              resultStat(
                "Error",
                `${formatSignedValue(result.signedErrorPixels)} px`,
              ),
              resultStat("Target", `${Math.round(result.targetScalar)} px`),
              resultStat(
                "Direction",
                result.signedErrorPixels === 0
                  ? "Exact"
                  : result.directionLabel,
              ),
            ]
          : [
              resultStat("Score", result.relativeAccuracyPercent.toFixed(1)),
              resultStat("Angle", `${result.angleErrorDegrees.toFixed(1)}°`),
              resultStat(
                "Offset",
                `${formatSignedValue(result.signedErrorPixels)} px`,
              ),
              resultStat(
                "Direction",
                result.signedErrorPixels === 0
                  ? "Exact"
                  : result.directionLabel,
              ),
            ];
    summary.replaceChildren(...resultStats);

    commitBtn.hidden = true;
    commitBtn.disabled = true;
    againBtn.hidden = false;
    backBtn.hidden = false;
    rerenderSvg();
    scheduleAutoReset();
    // Result controls can make the document taller; keep the canvas visually
    // stationary instead of letting scroll anchoring move the marked geometry.
    window.scrollTo(revealScrollX, revealScrollY);
  }

  function resetToFreshTrial(): void {
    if (cancelled) return;
    clearAutoResetTimer();
    trial = exercise.createTrial(getStoredProgress());
    result = null;
    candidateScalar = null;
    candidatePoint = null;
    prompt.textContent = trial.prompt;
    feedback.removeAttribute("data-tone");
    summary.removeAttribute("data-tone");
    feedback.hidden = false;
    feedback.textContent = isUnlimitedAdjustment
      ? "Place a candidate mark, revise as needed, then commit."
      : trial.scorePoint
        ? "Place one mark in the field."
        : "Place one mark on the line.";
    summary.classList.add("is-pending");
    summary.hidden = !showScoreBoxes;
    summary.replaceChildren(...pendingResultSummary());
    isResultPaused = false;
    pauseBtn.hidden = true;
    againBtn.hidden = true;
    commitBtn.hidden = !isUnlimitedAdjustment;
    commitBtn.disabled = true;
    updateAutoRepeatButton();
    rerenderSvg();
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
}

function isDivisionExercise(id: ExerciseId): boolean {
  return id.startsWith("division-");
}

function isTransferExercise(id: ExerciseId): boolean {
  return id.startsWith("copy-") || id.startsWith("double-");
}

function isRandomTransferExercise(id: ExerciseId): boolean {
  return id.startsWith("copy-random-random") || id.startsWith("double-random-random");
}

type LinearTrackerBucket = {
  bucket: string;
  label: string;
  aggregate?: { ema: number; attempts: number };
  todayAttempts: number;
  cellFill: string;
  todayOpacity: number;
  todayHeightPercent: number;
};

type LinearTrackerModel = DivisionTrackerModel | TransferTrackerModel;

function divisionUsesRandomDirectionTracker(
  id: ExerciseId,
  trial: SingleMarkTrial,
): boolean {
  return (
    id.startsWith("division-random-") &&
    trial.progressMetadata?.divisionDirectionBucket !== undefined
  );
}

function renderDivisionPracticeWidget(
  container: HTMLElement,
  progress: ProgressStore,
  exerciseId: ExerciseId,
  trial: SingleMarkTrial,
): void {
  const lengthModel = divisionLengthTrackerModel(progress, exerciseId);
  if (divisionUsesRandomDirectionTracker(exerciseId, trial)) {
    renderDivisionRandomTrackerWidget(
      container,
      lengthModel,
      divisionDirectionTrackerModel(
        progress,
        exerciseId,
        DIVISION_DIRECTION_BUCKETS,
      ),
    );
    return;
  }
  renderDivisionTrackerWidget(container, lengthModel);
}

function renderTransferPracticeWidget(
  container: HTMLElement,
  progress: ProgressStore,
  exerciseId: ExerciseId,
): void {
  const lengthModel = transferLengthTrackerModel(progress, exerciseId);
  if (isRandomTransferExercise(exerciseId)) {
    renderTransferRandomTrackerWidget(
      container,
      lengthModel,
      transferAngleTrackerModel(progress, exerciseId),
    );
    return;
  }
  renderDivisionTrackerWidget(container, lengthModel);
}

function renderDivisionTrackerWidget(
  container: HTMLElement,
  model: LinearTrackerModel,
): void {
  container.style.setProperty("--division-bucket-count", String(model.buckets.length));
  container.replaceChildren(...divisionTrackerStrip(model));
}

function renderTransferRandomTrackerWidget(
  container: HTMLElement,
  lengthModel: LinearTrackerModel,
  angleModel: LinearTrackerModel,
): void {
  container.style.setProperty("--division-bucket-count", String(lengthModel.buckets.length));
  container.replaceChildren(
    transferAngleChart(angleModel, "transfer-angle-chart"),
    divisionLengthCells(lengthModel),
    divisionTrackerTotalBar(lengthModel.todayTotal, lengthModel.todayProgress),
  );
}

function renderDivisionRandomTrackerWidget(
  container: HTMLElement,
  lengthModel: LinearTrackerModel,
  directionModel: LinearTrackerModel,
): void {
  container.style.setProperty("--division-bucket-count", String(lengthModel.buckets.length));
  container.replaceChildren(
    divisionDirectionChart(directionModel, "division-direction-chart"),
    divisionLengthCells(lengthModel),
    divisionTrackerTotalBar(lengthModel.todayTotal, lengthModel.todayProgress),
  );
}

function renderDivisionTrackerModal(
  title: string,
  model: LinearTrackerModel,
): HTMLElement {
  let overlay: HTMLElement;
  const close = (): void => overlay.remove();
  const strip = h("div", { class: "division-tracker-detail-strip" });
  strip.style.setProperty("--division-bucket-count", String(model.buckets.length));
  strip.replaceChildren(...divisionTrackerStrip(model));
  const populatedBuckets = model.buckets.filter(
    (bucket) => bucket.aggregate !== undefined || bucket.todayAttempts > 0,
  );
  const details = h("div", { class: "division-tracker-modal-details" }, [
    h("p", {}, [`Today: ${model.todayTotal} attempts`]),
    h("p", {}, [
      "Cell color ranks long-term proficiency for this drill. Top bars show attempts today.",
    ]),
    h(
      "ol",
      {},
      populatedBuckets.map((bucket) =>
        h("li", {}, [divisionTrackerBucketSummary(bucket)]),
      ),
    ),
  ]);
  const closeBtn = actionButton("Close", close);
  const panel = h(
    "div",
    {
      class: "division-tracker-modal-panel",
      on: { click: (event) => event.stopPropagation() },
    },
    [
      h("div", { class: "division-tracker-modal-header" }, [
        h("h2", {}, [title]),
        closeBtn,
      ]),
      strip,
      details,
    ],
  );
  overlay = h(
    "div",
    {
      class: "division-tracker-modal",
      on: { click: close },
    },
    [panel],
  );
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", title);
  return overlay;
}

function renderDivisionRandomTrackerModal(
  progress: ProgressStore,
  exerciseId: ExerciseId,
): HTMLElement {
  const lengthModel = divisionLengthTrackerModel(progress, exerciseId);
  const directionModel = divisionDirectionTrackerModel(
    progress,
    exerciseId,
    DIVISION_DIRECTION_BUCKETS,
  );
  let overlay: HTMLElement;
  const close = (): void => overlay.remove();
  const preview = h("div", { class: "division-random-detail" }, [
    divisionDirectionChart(directionModel, "division-direction-chart-large"),
    divisionLengthCells(lengthModel),
    divisionTrackerTotalBar(lengthModel.todayTotal, lengthModel.todayProgress),
  ]);
  preview.style.setProperty("--division-bucket-count", String(lengthModel.buckets.length));
  const details = h("div", { class: "division-tracker-modal-details" }, [
    h("p", {}, [`Today: ${lengthModel.todayTotal} attempts`]),
    h("p", {}, [
      "Circle sectors rank measurement direction. The strip ranks line length.",
    ]),
    h("h3", {}, ["Direction"]),
    divisionTrackerBucketList(directionModel),
    h("h3", {}, ["Length"]),
    divisionTrackerBucketList(lengthModel),
  ]);
  const closeBtn = actionButton("Close", close);
  const panel = h(
    "div",
    {
      class: "division-tracker-modal-panel",
      on: { click: (event) => event.stopPropagation() },
    },
    [
      h("div", { class: "division-tracker-modal-header" }, [
        h("h2", {}, ["Random Division Tracker"]),
        closeBtn,
      ]),
      preview,
      details,
    ],
  );
  overlay = h(
    "div",
    {
      class: "division-tracker-modal",
      on: { click: close },
    },
    [panel],
  );
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Random division tracker detail");
  return overlay;
}

function renderTransferRandomTrackerModal(
  progress: ProgressStore,
  exerciseId: ExerciseId,
): HTMLElement {
  const lengthModel = transferLengthTrackerModel(progress, exerciseId);
  const angleModel = transferAngleTrackerModel(progress, exerciseId);
  let overlay: HTMLElement;
  const close = (): void => overlay.remove();
  const preview = h("div", { class: "division-random-detail" }, [
    transferAngleChart(angleModel, "transfer-angle-chart-large"),
    divisionLengthCells(lengthModel),
    divisionTrackerTotalBar(lengthModel.todayTotal, lengthModel.todayProgress),
  ]);
  preview.style.setProperty("--division-bucket-count", String(lengthModel.buckets.length));
  const details = h("div", { class: "division-tracker-modal-details" }, [
    h("p", {}, [`Today: ${lengthModel.todayTotal} attempts`]),
    h("p", {}, [
      "Semicircle sectors rank reference-to-guide angle. The strip ranks target distance.",
    ]),
    h("h3", {}, ["Angle"]),
    divisionTrackerBucketList(angleModel),
    h("h3", {}, ["Length"]),
    divisionTrackerBucketList(lengthModel),
  ]);
  const closeBtn = actionButton("Close", close);
  const panel = h(
    "div",
    {
      class: "division-tracker-modal-panel",
      on: { click: (event) => event.stopPropagation() },
    },
    [
      h("div", { class: "division-tracker-modal-header" }, [
        h("h2", {}, ["Random Transfer Tracker"]),
        closeBtn,
      ]),
      preview,
      details,
    ],
  );
  overlay = h(
    "div",
    {
      class: "division-tracker-modal",
      on: { click: close },
    },
    [panel],
  );
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Random transfer tracker detail");
  return overlay;
}

function divisionTrackerStrip(model: LinearTrackerModel): HTMLElement[] {
  return [
    h(
      "div",
      { class: "division-tracker-today-bars" },
      model.buckets.map(divisionTrackerTodayBar),
    ),
    h(
      "div",
      { class: "division-tracker-cells" },
      model.buckets.map((bucket) =>
        h("span", {
          class: "division-tracker-cell",
          title: divisionTrackerBucketSummary(bucket),
          style: { background: bucket.cellFill },
        }),
      ),
    ),
    divisionTrackerTotalBar(model.todayTotal, model.todayProgress),
  ];
}

function divisionLengthCells(model: LinearTrackerModel): HTMLDivElement {
  return h(
    "div",
    { class: "division-tracker-cells" },
    model.buckets.map((bucket) =>
      h("span", {
        class: "division-tracker-cell",
        title: divisionTrackerBucketSummary(bucket),
        style: { background: bucket.cellFill },
      }),
    ),
  );
}

function divisionTrackerBucketList(model: LinearTrackerModel): HTMLOListElement {
  const populatedBuckets = model.buckets.filter(
    (bucket) => bucket.aggregate !== undefined || bucket.todayAttempts > 0,
  );
  return h(
    "ol",
    {},
    populatedBuckets.map((bucket) =>
      h("li", {}, [divisionTrackerBucketSummary(bucket)]),
    ),
  );
}

function divisionDirectionChart(
  model: LinearTrackerModel,
  className: string,
): SVGSVGElement {
  const chart = s("svg", {
    class: `division-direction-chart ${className}`,
    viewBox: "0 0 48 48",
    role: "img",
    "aria-label": "Division direction proficiency",
  });
  for (const bucket of model.buckets) {
    const sector = divisionDirectionSector(Number(bucket.bucket), bucket.cellFill);
    appendSvgTitle(sector, divisionTrackerBucketSummary(bucket));
    chart.append(sector);
  }
  chart.append(
    s("circle", {
      class: "division-direction-chart-core",
      cx: 24,
      cy: 24,
      r: 6,
    }),
  );
  return chart;
}

function transferAngleChart(
  model: LinearTrackerModel,
  className: string,
): SVGSVGElement {
  const chart = s("svg", {
    class: `transfer-angle-chart ${className}`,
    viewBox: "0 0 54 30",
    role: "img",
    "aria-label": "Transfer angle proficiency",
  });
  for (const bucket of model.buckets) {
    const sector = transferAngleSector(Number(bucket.bucket), bucket.cellFill);
    appendSvgTitle(sector, divisionTrackerBucketSummary(bucket));
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

function divisionDirectionSector(
  centerDegrees: number,
  fill: string,
): SVGPathElement {
  const half = 15;
  const start = polarPoint(24, 24, 22, centerDegrees - half);
  const end = polarPoint(24, 24, 22, centerDegrees + half);
  const path = s("path", {
    class: "division-direction-sector",
    d: `M 24 24 L ${start.x.toFixed(2)} ${start.y.toFixed(2)} A 22 22 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)} Z`,
  });
  path.style.fill = fill;
  return path;
}

function transferAngleSector(
  centerDegrees: number,
  fill: string,
): SVGPathElement {
  const startDegrees = 180 + centerDegrees;
  const endDegrees = startDegrees + 30;
  const start = polarPoint(27, 27, 24, startDegrees);
  const end = polarPoint(27, 27, 24, endDegrees);
  const path = s("path", {
    class: "division-direction-sector",
    d: `M 27 27 L ${start.x.toFixed(2)} ${start.y.toFixed(2)} A 24 24 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)} Z`,
  });
  path.style.fill = fill;
  return path;
}

function appendSvgTitle(element: SVGElement, text: string): void {
  const title = s("title");
  title.textContent = text;
  element.append(title);
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

function divisionTrackerTodayBar(
  bucket: LinearTrackerBucket,
): HTMLSpanElement {
  const bar = h("span", { class: "division-tracker-today-bar" });
  bar.style.setProperty("--today-height", `${bucket.todayHeightPercent}%`);
  bar.style.setProperty("--today-opacity", bucket.todayOpacity.toFixed(2));
  return bar;
}

function divisionTrackerTotalBar(
  todayTotal: number,
  todayProgress: number,
): HTMLDivElement {
  const total = h("div", {
    class: "division-tracker-total",
    title: `${todayTotal} attempts today`,
  });
  total.style.setProperty(
    "--today-progress-width",
    `${(todayProgress * 100).toFixed(1)}%`,
  );
  return total;
}

function divisionTrackerBucketSummary(
  bucket: LinearTrackerBucket,
): string {
  const score =
    bucket.aggregate === undefined
      ? "no proficiency score"
      : `EMA ${bucket.aggregate.ema.toFixed(1)}, ${bucket.aggregate.attempts} counted`;
  return `${bucket.label}: ${score}, ${bucket.todayAttempts} today`;
}

function renderTrialSvg(
  trial: SingleMarkTrial,
  getResult: () => SingleMarkTrialResult | null,
  getCandidateScalar: () => number | null,
  getCandidatePoint: () => { x: number; y: number } | null,
  onSelect: (scalar: number) => void,
  onPointSelect: (point: { x: number; y: number }) => void,
): SVGSVGElement {
  const frame = s("rect", {
    x: 1,
    y: 1,
    width: trial.viewport.width - 2,
    height: trial.viewport.height - 2,
    rx: 24,
    class: "canvas-frame",
  });

  const line = s("line", {
    x1: linePoint(trial.line, "start").x,
    y1: linePoint(trial.line, "start").y,
    x2: linePoint(trial.line, "end").x,
    y2: linePoint(trial.line, "end").y,
    class: "exercise-line",
  });
  const projectionLine = trial.projectionLine
    ? s("line", {
        x1: linePoint(trial.projectionLine, "start").x,
        y1: linePoint(trial.projectionLine, "start").y,
        x2: linePoint(trial.projectionLine, "end").x,
        y2: linePoint(trial.projectionLine, "end").y,
        class: "projection-line",
      })
    : null;

  // Invisible hit target. Point-selection drills use the whole field; line
  // drills use a narrow band so accidental off-line taps are ignored.
  const guide = trial.scorePoint
    ? createFieldClickGuide(trial.viewport.width, trial.viewport.height)
    : createClickGuide(trial.line);

  const startCap =
    trial.line.showEndpointTicks === false
      ? null
      : createTick(
          trial.line.axis,
          trial.line,
          trial.line.startScalar,
          "endpoint-tick",
        );
  const endCap =
    trial.line.showEndpointTicks === false
      ? null
      : createTick(
          trial.line.axis,
          trial.line,
          trial.line.endScalar,
          "endpoint-tick",
        );
  const reference = trial.referenceLine
    ? createReferenceLineGroup(trial.referenceLine)
    : null;
  const anchorTick =
    trial.anchorScalar === undefined
      ? null
      : createTick(
          trial.line.axis,
          trial.line,
          trial.anchorScalar,
          "anchor-tick",
        );
  const anchorDirectionCue =
    trial.anchorScalar === undefined || trial.anchorDirectionSign === undefined
      ? null
      : createAnchorDirectionCue(
          trial.line.axis,
          trial.line,
          trial.anchorScalar,
          trial.anchorDirectionSign,
        );

  const svg = s(
    "svg",
    {
      class: "exercise-canvas",
      viewBox: `0 0 ${trial.viewport.width} ${trial.viewport.height}`,
      role: "img",
      "aria-label": `${trial.label} practice canvas`,
    },
    [
      frame,
      reference,
      guide,
      line,
      projectionLine,
      startCap,
      endCap,
      anchorDirectionCue,
      anchorTick,
    ],
  );
  svg.dataset.testid = "exercise-canvas";
  svg.dataset.axis = trial.line.axis;

  svg.addEventListener("pointerdown", (event) => {
    const local = localSvgPoint(svg, event.clientX, event.clientY);
    if (!local) return;

    if (trial.scorePoint) {
      onPointSelect({ x: local.x, y: local.y });
      return;
    }

    const scalar = scalarFromPoint(trial.line, local);
    const crossDist = crossAxisDistance(trial.line.axis, trial.line, local);
    if (
      crossDist > 28 ||
      scalar < trial.line.startScalar - 12 ||
      scalar > trial.line.endScalar + 12
    ) {
      return;
    }
    onSelect(
      Math.max(trial.line.startScalar, Math.min(scalar, trial.line.endScalar)),
    );
  });

  const res = getResult();
  const candidateScalar = getCandidateScalar();
  const candidatePoint = getCandidatePoint();
  if (!res && candidateScalar !== null) {
    const candidateTick = createTick(
      trial.line.axis,
      trial.line,
      candidateScalar,
      "user-tick candidate-tick",
    );
    svg.append(candidateTick);
  }
  if (!res && candidatePoint !== null) {
    svg.append(
      createPointMark(candidatePoint, "user-point-mark candidate-point-mark"),
    );
  }

  if (res) {
    const accent = `hsl(${feedbackHueForError(res.relativeErrorPercent)} 55% 42%)`;
    if (res.placedPoint && res.targetPoint) {
      const gapEl = s("line", {
        x1: res.placedPoint.x,
        y1: res.placedPoint.y,
        x2: res.targetPoint.x,
        y2: res.targetPoint.y,
        class: "error-gap point-error-gap",
      });
      gapEl.style.stroke = accent;

      const resultOverlay: SVGElement[] = [
        gapEl,
        createProjectionResultRay(
          nearestLineEndpoint(trial.line, res.targetPoint),
          res.targetPoint,
        ),
      ];
      if (trial.projectionLine) {
        resultOverlay.push(
          createProjectionResultRay(
            nearestLineEndpoint(trial.projectionLine, res.targetPoint),
            res.targetPoint,
          ),
        );
      }
      resultOverlay.push(
        createPointMark(res.placedPoint, "user-point-mark", accent),
      );
      svg.append(...resultOverlay);
      return svg;
    }

    const gapA = gapPoint(trial.line.axis, trial.line, res.placedScalar);
    const gapB = gapPoint(trial.line.axis, trial.line, res.targetScalar);

    const gapEl = s("line", {
      x1: gapA.x,
      y1: gapA.y,
      x2: gapB.x,
      y2: gapB.y,
      class: "error-gap",
    });
    gapEl.style.stroke = accent;

    const projectionRay =
      trial.projectionOrigin && trial.projectionLine
        ? createProjectionResultRay(
            trial.projectionOrigin,
            linePointAtScalar(trial.line.axis, trial.line, res.targetScalar),
          )
        : null;

    const placedTick = createTick(
      trial.line.axis,
      trial.line,
      res.placedScalar,
      "user-tick",
    );
    placedTick.style.stroke = accent;

    const resultOverlay = [
      gapEl,
      placedTick,
      createTick(trial.line.axis, trial.line, res.targetScalar, "target-tick"),
    ];
    if (projectionRay) resultOverlay.splice(1, 0, projectionRay);
    svg.append(...resultOverlay);
  }

  return svg;
}

function formatPoint(point: { x: number; y: number } | undefined): string {
  if (!point) return "--";
  return `${Math.round(point.x)}, ${Math.round(point.y)}`;
}

function createProjectionResultRay(
  start: { x: number; y: number },
  end: { x: number; y: number },
): SVGLineElement {
  return s("line", {
    x1: start.x,
    y1: start.y,
    x2: end.x,
    y2: end.y,
    class: "projection-result-ray",
  });
}

function createReferenceLineGroup(line: TrialLine): SVGGElement {
  const referenceLine = s("line", {
    x1: linePoint(line, "start").x,
    y1: linePoint(line, "start").y,
    x2: linePoint(line, "end").x,
    y2: linePoint(line, "end").y,
    class: "reference-line",
  });
  return s("g", { class: "reference-line-group" }, [
    referenceLine,
    createTick(line.axis, line, line.startScalar, "reference-endpoint-tick"),
    createTick(line.axis, line, line.endScalar, "reference-endpoint-tick"),
  ]);
}

function createFieldClickGuide(width: number, height: number): SVGRectElement {
  return s("rect", {
    x: 0,
    y: 0,
    width,
    height,
    class: "click-guide",
  });
}

function createPointMark(
  point: { x: number; y: number },
  className: string,
  stroke?: string,
): SVGGElement {
  const mark = s("g", { class: className }, [
    s("line", {
      x1: point.x - 7,
      y1: point.y - 7,
      x2: point.x + 7,
      y2: point.y + 7,
    }),
    s("line", {
      x1: point.x - 7,
      y1: point.y + 7,
      x2: point.x + 7,
      y2: point.y - 7,
    }),
  ]);
  if (stroke) mark.style.stroke = stroke;
  return mark;
}

function nearestLineEndpoint(
  line: TrialLine,
  point: { x: number; y: number },
): { x: number; y: number } {
  const start = linePoint(line, "start");
  const end = linePoint(line, "end");
  return Math.hypot(point.x - start.x, point.y - start.y) <
    Math.hypot(point.x - end.x, point.y - end.y)
    ? start
    : end;
}

function createClickGuide(line: TrialLine): SVGElement {
  if (line.axis === "horizontal") {
    return s("rect", {
      x: line.startScalar,
      y: line.anchorY - 22,
      width: line.endScalar - line.startScalar,
      height: 44,
      class: "click-guide",
    });
  }
  if (line.axis === "vertical") {
    return s("rect", {
      x: line.anchorX - 22,
      y: line.startScalar,
      width: 44,
      height: line.endScalar - line.startScalar,
      class: "click-guide",
    });
  }
  const start = linePoint(line, "start");
  const end = linePoint(line, "end");
  const normal = lineNormal(line);
  const halfWidth = 22;
  return s("polygon", {
    points: [
      `${(start.x + normal.x * halfWidth).toFixed(2)},${(start.y + normal.y * halfWidth).toFixed(2)}`,
      `${(end.x + normal.x * halfWidth).toFixed(2)},${(end.y + normal.y * halfWidth).toFixed(2)}`,
      `${(end.x - normal.x * halfWidth).toFixed(2)},${(end.y - normal.y * halfWidth).toFixed(2)}`,
      `${(start.x - normal.x * halfWidth).toFixed(2)},${(start.y - normal.y * halfWidth).toFixed(2)}`,
    ].join(" "),
    class: "click-guide",
  });
}

function createAnchorDirectionCue(
  axis: LineAxis,
  line: TrialLine,
  anchorScalar: number,
  directionSign: -1 | 1,
): SVGGElement {
  const startScalar = anchorScalar + directionSign * 12;
  const endScalar = anchorScalar + directionSign * 50;
  const unit = lineUnit(line);
  const normal = lineNormal(line);
  const offset = 28;
  const baseStart = linePointAtScalar(axis, line, startScalar);
  const baseEnd = linePointAtScalar(axis, line, endScalar);
  const start = {
    x: baseStart.x + normal.x * offset,
    y: baseStart.y + normal.y * offset,
  };
  const end = {
    x: baseEnd.x + normal.x * offset,
    y: baseEnd.y + normal.y * offset,
  };
  const headBase = {
    x: end.x - unit.x * directionSign * 8,
    y: end.y - unit.y * directionSign * 8,
  };
  const headA = { x: headBase.x + normal.x * 5, y: headBase.y + normal.y * 5 };
  const headB = { x: headBase.x - normal.x * 5, y: headBase.y - normal.y * 5 };

  return s("g", { class: "anchor-direction-cue" }, [
    s("line", { x1: start.x, y1: start.y, x2: end.x, y2: end.y }),
    s("line", { x1: end.x, y1: end.y, x2: headA.x, y2: headA.y }),
    s("line", { x1: end.x, y1: end.y, x2: headB.x, y2: headB.y }),
  ]);
}

function createTick(
  axis: LineAxis,
  line: TrialLine,
  scalar: number,
  className: string,
): SVGLineElement {
  const len = tickLength(className);
  const point = linePointAtScalar(axis, line, scalar);
  const normal = lineNormal(line);
  return s("line", {
    x1: point.x - normal.x * len,
    y1: point.y - normal.y * len,
    x2: point.x + normal.x * len,
    y2: point.y + normal.y * len,
    class: className,
  });
}

function tickLength(className: string): number {
  if (className === "endpoint-tick") return 18;
  if (className === "reference-endpoint-tick") return 14;
  if (className === "anchor-tick") return 20;
  return 30;
}

function linePoint(
  line: TrialLine,
  edge: "start" | "end",
): { x: number; y: number } {
  const sc = edge === "start" ? line.startScalar : line.endScalar;
  return linePointAtScalar(line.axis, line, sc);
}

function linePointAtScalar(
  axis: LineAxis,
  line: TrialLine,
  scalar: number,
): { x: number; y: number } {
  if (axis === "horizontal") return { x: scalar, y: line.anchorY };
  if (axis === "vertical") return { x: line.anchorX, y: scalar };
  const start = line.startPoint;
  if (!start) return { x: 0, y: 0 };
  const unit = lineUnit(line);
  return {
    x: start.x + unit.x * scalar,
    y: start.y + unit.y * scalar,
  };
}

function gapPoint(
  axis: LineAxis,
  line: TrialLine,
  scalar: number,
): { x: number; y: number } {
  const offset = 34;
  const point = linePointAtScalar(axis, line, scalar);
  const normal = lineNormal(line);
  return {
    x: point.x - normal.x * offset,
    y: point.y - normal.y * offset,
  };
}

function scalarFromPoint(line: TrialLine, point: DOMPoint | SVGPoint): number {
  if (line.axis === "horizontal") return point.x;
  if (line.axis === "vertical") return point.y;
  const start = line.startPoint;
  if (!start) return 0;
  const unit = lineUnit(line);
  return (point.x - start.x) * unit.x + (point.y - start.y) * unit.y;
}

function crossAxisDistance(
  axis: LineAxis,
  line: TrialLine,
  point: DOMPoint | SVGPoint,
): number {
  if (axis === "horizontal") return Math.abs(point.y - line.anchorY);
  if (axis === "vertical") return Math.abs(point.x - line.anchorX);
  const start = line.startPoint;
  if (!start) return Infinity;
  const normal = lineNormal(line);
  return Math.abs(
    (point.x - start.x) * normal.x + (point.y - start.y) * normal.y,
  );
}

function lineUnit(line: TrialLine): { x: number; y: number } {
  if (line.axis === "horizontal") return { x: 1, y: 0 };
  if (line.axis === "vertical") return { x: 0, y: 1 };
  const start = line.startPoint;
  const end = line.endPoint;
  if (!start || !end) return { x: 1, y: 0 };
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return { x: 1, y: 0 };
  return { x: dx / length, y: dy / length };
}

function lineNormal(line: TrialLine): { x: number; y: number } {
  const unit = lineUnit(line);
  return { x: -unit.y, y: unit.x };
}
