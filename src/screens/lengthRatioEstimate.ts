/** Numeric length-ratio estimation screen with log slider input and SVG feedback. */
import type { LengthRatioEstimateExerciseDefinition } from "../practice/catalog";
import type { AppState, ListFilterState } from "../app/state";
import { getAutoExercise } from "../practice/catalog";
import { startActivePracticeTimer } from "../storage/activePracticeTimer";
import { recordCurriculumCompletion } from "../storage/curriculumStats";
import { getSettings } from "../storage/settings";
import { installSpaceCommitShortcut } from "../input/commitGestures";
import { getStoredProgress, updateStoredProgress } from "../storage/progress";
import {
  LENGTH_RATIO_LOG_MAX,
  LENGTH_RATIO_LOG_MIN,
  createLengthRatioTrial,
  parseLengthRatioInput,
  scoreLengthRatioEstimate,
  type LengthRatioResult,
  type LengthRatioSegment,
} from "../practice/lengthRatioEstimation";
import {
  formatRatio,
  lengthRatioTrackerModel,
  type LengthRatioTrackerBucket,
  type LengthRatioTrackerModel,
} from "../practice/lengthRatioEstimationTracker";
import { h, s } from "../render/h";
import {
  actionButton,
  exerciseHeader,
  exerciseToolbar,
  formatSignedValue,
  fullscreenButton,
  pageShell,
  pendingResultSummary,
  resultStat,
} from "../render/components";
import {
  feedbackBandClass,
  feedbackHueForError,
  feedbackLabel,
} from "../scoring/bands";

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 620;
const SLIDER_SCALE = 100;
const DEFAULT_RATIO = 1;

export function mountLengthRatioEstimateScreen(
  root: HTMLElement,
  exercise: LengthRatioEstimateExerciseDefinition,
  source: "direct" | "auto" | "curriculum",
  onNavigate: (next: AppState) => void,
  listState?: ListFilterState,
): () => void {
  let trial = createLengthRatioTrial(exercise.id, getStoredProgress());
  let result: LengthRatioResult | null = null;
  let estimateRatio = DEFAULT_RATIO;
  let resetTimer: number | null = null;
  let resetAnimation: number | null = null;
  let resetStartedAt = 0;
  let resetDurationMs = 0;
  let resetRemainingMs = 0;
  let isResultPaused = false;
  const settings = getSettings();
  const autoRepeatDelayMs = settings.autoRepeatDelayMs;
  const stopActiveTimer = startActivePracticeTimer(exercise.id, root);
  const removeSpaceShortcut = installSpaceCommitShortcut({
    allowInteractiveTargets: true,
    canCommit: () => true,
    onCommit: () => {
      if (result) {
        resetToFreshTrial();
        return;
      }
      commitEstimate();
    },
  });

  const screen = pageShell();
  const header = exerciseHeader(exercise, source);
  const stage = h("section", {
    class: "exercise-stage length-ratio-estimate-stage",
  });
  const prompt = h("p", { class: "exercise-prompt" }, [
    "Estimate target/source length ratio.",
  ]);
  const commitBtn = actionButton("Commit", commitEstimate);
  const pauseBtn = actionButton("Pause", () => {
    if (!result || autoRepeatDelayMs === null) return;
    if (isResultPaused) resumeAutoReset();
    else pauseAutoReset();
  });
  pauseBtn.classList.add("auto-repeat-action");
  pauseBtn.hidden = true;
  const againBtn = actionButton("Again", resetToFreshTrial);
  againBtn.hidden = true;
  const autoNextBtn = actionButton("Auto Next", () => {
    const auto = getAutoExercise(getStoredProgress());
    onNavigate({
      screen: "exercise",
      exerciseId: auto.exercise.id,
      source: "auto",
      listState,
    });
  });
  autoNextBtn.hidden = true;
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
  const trackerWidget = h("button", {
    type: "button",
    class: "division-tracker-widget length-ratio-widget",
    title: "Review length ratio estimation practice",
    on: {
      click: () => {
        document.body.append(
          renderLengthRatioTrackerModal(getStoredProgress(), exercise.id),
        );
      },
    },
  });
  trackerWidget.setAttribute(
    "aria-label",
    "Review length ratio estimation practice",
  );
  renderLengthRatioWidget(trackerWidget, getStoredProgress(), exercise.id);

  const toolbar = exerciseToolbar(
    prompt,
    commitBtn,
    pauseBtn,
    againBtn,
    autoNextBtn,
    fullBtn,
    backBtn,
  );
  toolbar.append(trackerWidget);

  const svg = s("svg", {
    class: "length-ratio-estimate-canvas",
    viewBox: `0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`,
    role: "img",
    "aria-label": "Length ratio estimation field",
  });
  svg.dataset.testid = "length-ratio-estimate-canvas";

  const feedback = h("p", { class: "feedback-banner" }, [
    "Set your estimate, then commit.",
  ]);
  const summary = h("div", { class: "result-summary is-pending" });
  summary.hidden = !settings.showScoreBoxes;
  summary.replaceChildren(...pendingResultSummary());
  const controls = lengthRatioControls();

  renderSvg();
  stage.append(toolbar, svg, controls, feedback, summary);
  screen.append(header, stage);
  root.append(screen);

  return () => {
    clearAutoResetTimer();
    removeSpaceShortcut();
    stopActiveTimer();
  };

  function lengthRatioControls(): HTMLElement {
    const smallerBtn = h(
      "button",
      {
        type: "button",
        class: "angle-step-button",
        on: { click: () => setEstimateFromRatio(estimateRatio / 2 ** 0.1) },
      },
      ["/1.1"],
    );
    const largerBtn = h(
      "button",
      {
        type: "button",
        class: "angle-step-button",
        on: { click: () => setEstimateFromRatio(estimateRatio * 2 ** 0.1) },
      },
      ["x1.1"],
    );
    const slider = h("input", {
      type: "range",
      min: String(LENGTH_RATIO_LOG_MIN * SLIDER_SCALE),
      max: String(LENGTH_RATIO_LOG_MAX * SLIDER_SCALE),
      step: "1",
      value: String(logSliderValue(estimateRatio)),
      class: "length-ratio-slider",
      on: {
        input: (event) =>
          setEstimateFromRatio(
            2 **
              (Number((event.currentTarget as HTMLInputElement).value) /
                SLIDER_SCALE),
          ),
      },
    });
    slider.dataset.testid = "length-ratio-slider";
    const numberInput = h("input", {
      type: "text",
      inputMode: "decimal",
      value: formatRatioInput(estimateRatio),
      class: "length-ratio-number",
      on: {
        input: (event) => {
          const parsed = parseLengthRatioInput(
            (event.currentTarget as HTMLInputElement).value,
          );
          if (parsed !== null) setEstimateFromRatio(parsed, false);
        },
        change: (event) => {
          const input = event.currentTarget as HTMLInputElement;
          const parsed = parseLengthRatioInput(input.value);
          if (parsed === null) {
            input.value = formatRatioInput(estimateRatio);
            return;
          }
          setEstimateFromRatio(parsed);
        },
      },
    });
    numberInput.dataset.testid = "length-ratio-number";

    function setEstimateFromRatio(next: number, syncInput = true): void {
      estimateRatio = Math.min(4, Math.max(0.25, next));
      slider.value = String(logSliderValue(estimateRatio));
      if (syncInput) numberInput.value = formatRatioInput(estimateRatio);
    }

    return h("div", { class: "length-ratio-controls" }, [
      smallerBtn,
      h("label", { class: "angle-estimate-slider-wrap" }, [
        h("span", { class: "angle-estimate-control-label" }, ["Ratio"]),
        slider,
      ]),
      largerBtn,
      h("label", { class: "angle-estimate-number-wrap" }, [
        h("span", { class: "angle-estimate-control-label" }, ["Estimate"]),
        numberInput,
      ]),
    ]);
  }

  function commitEstimate(): void {
    if (result) return;
    const numberInput = controls.querySelector<HTMLInputElement>(
      "[data-testid='length-ratio-number']",
    );
    const parsed =
      numberInput === null ? estimateRatio : parseLengthRatioInput(numberInput.value);
    if (parsed === null) {
      feedback.textContent = "Enter a positive decimal or fraction.";
      feedback.hidden = false;
      return;
    }
    estimateRatio = parsed;
    result = scoreLengthRatioEstimate(
      trial.ratio,
      estimateRatio,
      trial.source.length,
      trial.target.length,
    );
    const previousProgress = getStoredProgress();
    const nextProgress = updateStoredProgress(
      exercise.id,
      result.score,
      result.signedLogRatioError,
      result.metadata,
    );
    const nextAggregate = nextProgress.aggregates[exercise.id];
    if (nextAggregate) {
      recordCurriculumCompletion(
        exercise.id,
        nextAggregate.ema,
        previousProgress.aggregates[exercise.id]?.ema,
      );
    }
    renderLengthRatioWidget(trackerWidget, nextProgress, exercise.id);

    const errorPercent = 100 - result.score;
    const hue = feedbackHueForError(errorPercent);
    const cls = feedbackBandClass(errorPercent);
    const accent = `hsl(${hue} 55% 42%)`;
    feedback.dataset.tone = cls;
    summary.dataset.tone = cls;
    feedback.style.setProperty("--result-accent", accent);
    summary.style.setProperty("--result-accent", accent);
    feedback.textContent =
      `${feedbackLabel(errorPercent)} · ` +
      `Score ${result.score.toFixed(1)} · ` +
      `Actual ${formatRatio(result.targetRatio)} · ` +
      `Estimate ${formatRatio(result.estimatedRatio)} · ` +
      `Error ${formatLengthRatioError(result.signedLogRatioError)}`;
    feedback.hidden = !settings.showResultString;
    summary.classList.remove("is-pending");
    summary.hidden = !settings.showScoreBoxes;
    summary.replaceChildren(
      resultStat("Score", result.score.toFixed(1)),
      resultStat("Actual", formatRatio(result.targetRatio)),
      resultStat("Estimate", formatRatio(result.estimatedRatio)),
      resultStat("Log Error", formatSignedValue(result.signedLogRatioError)),
      resultStat("Source", `${Math.round(result.sourceLengthPixels)}px`),
      resultStat("Target", `${Math.round(result.targetLengthPixels)}px`),
    );

    commitBtn.hidden = true;
    commitBtn.blur();
    againBtn.hidden = false;
    autoNextBtn.hidden = false;
    renderSvg();
    scheduleAutoReset();
  }

  function resetToFreshTrial(): void {
    clearAutoResetTimer();
    trial = createLengthRatioTrial(exercise.id, getStoredProgress());
    result = null;
    estimateRatio = DEFAULT_RATIO;
    commitBtn.hidden = false;
    pauseBtn.hidden = true;
    pauseBtn.disabled = true;
    againBtn.hidden = true;
    autoNextBtn.hidden = true;
    feedback.removeAttribute("data-tone");
    summary.removeAttribute("data-tone");
    feedback.textContent = "Set your estimate, then commit.";
    feedback.hidden = false;
    summary.classList.add("is-pending");
    summary.hidden = !settings.showScoreBoxes;
    summary.replaceChildren(...pendingResultSummary());
    const slider = controls.querySelector<HTMLInputElement>(
      "[data-testid='length-ratio-slider']",
    );
    const numberInput = controls.querySelector<HTMLInputElement>(
      "[data-testid='length-ratio-number']",
    );
    if (slider) slider.value = String(logSliderValue(estimateRatio));
    if (numberInput) numberInput.value = formatRatioInput(estimateRatio);
    renderSvg();
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

  function renderSvg(): void {
    const children: SVGElement[] = [
      segmentElement(trial.source, "length-ratio-source-segment"),
      segmentElement(trial.target, "length-ratio-target-segment"),
      endpoint(trial.source.start, "length-ratio-source-endpoint"),
      endpoint(trial.source.end, "length-ratio-source-endpoint"),
      endpoint(trial.target.start, "length-ratio-target-endpoint"),
      endpoint(trial.target.end, "length-ratio-target-endpoint"),
      segmentLabel(trial.source),
      segmentLabel(trial.target),
    ];
    if (result) {
      children.push(ratioBadge(result.targetRatio, result.estimatedRatio));
    }
    svg.replaceChildren(...children);
  }
}

function logSliderValue(ratio: number): number {
  return Math.round(Math.log2(ratio) * SLIDER_SCALE);
}

function formatRatioInput(ratio: number): string {
  return ratio >= 2 ? ratio.toFixed(2) : ratio.toFixed(3);
}

function formatLengthRatioError(signedLogRatioError: number): string {
  if (Math.abs(signedLogRatioError) < 0.005) return "exact";
  const factor = 2 ** Math.abs(signedLogRatioError);
  return `${factor.toFixed(2)}x ${signedLogRatioError > 0 ? "high" : "low"}`;
}

function segmentElement(
  segment: LengthRatioSegment,
  className: string,
): SVGLineElement {
  return s("line", {
    class: className,
    x1: segment.start.x,
    y1: segment.start.y,
    x2: segment.end.x,
    y2: segment.end.y,
  });
}

function endpoint(
  point: { x: number; y: number },
  className: string,
): SVGCircleElement {
  return s("circle", { class: className, cx: point.x, cy: point.y, r: 6 });
}

function segmentLabel(segment: LengthRatioSegment): SVGTextElement {
  const label = s("text", {
    class:
      segment.label === "Source"
        ? "length-ratio-source-label"
        : "length-ratio-target-label",
    x: (segment.start.x + segment.end.x) / 2,
    y: (segment.start.y + segment.end.y) / 2 - 28,
    "text-anchor": "middle",
  });
  label.textContent = segment.label;
  return label;
}

function ratioBadge(
  targetRatio: number,
  estimatedRatio: number,
): SVGTextElement {
  const label = s("text", {
    class: "length-ratio-result-badge",
    x: CANVAS_WIDTH / 2,
    y: 72,
    "text-anchor": "middle",
  });
  label.textContent = `Actual ${formatRatio(targetRatio)} · Estimate ${formatRatio(
    estimatedRatio,
  )}`;
  return label;
}

function renderLengthRatioWidget(
  container: HTMLElement,
  progress: ReturnType<typeof getStoredProgress>,
  exerciseId: LengthRatioEstimateExerciseDefinition["id"],
): void {
  const model = lengthRatioTrackerModel(progress, exerciseId);
  container.replaceChildren(...lengthRatioTrackerStrip(model));
}

function lengthRatioTrackerStrip(model: LengthRatioTrackerModel): Node[] {
  const cells = h("span", {
    class: "division-tracker-cells length-ratio-cells",
  });
  cells.style.setProperty("--division-bucket-count", String(model.buckets.length));
  cells.append(...model.buckets.map(lengthRatioCell));
  const bar = h("span", {
    class: "division-tracker-total",
    title: `${model.todayTotal} length-ratio attempts today`,
  });
  bar.style.setProperty(
    "--today-progress-width",
    `${(model.todayProgress * 100).toFixed(1)}%`,
  );
  return [cells, bar];
}

function lengthRatioCell(bucket: LengthRatioTrackerBucket): HTMLSpanElement {
  const cell = h("span", {
    class: "division-tracker-cell",
    title: lengthRatioBucketSummary(bucket),
  });
  cell.style.background = bucket.cellFill;
  cell.style.setProperty("--today-opacity", bucket.todayOpacity.toFixed(2));
  cell.style.setProperty(
    "--today-height",
    `${bucket.todayHeightPercent.toFixed(1)}%`,
  );
  return cell;
}

function renderLengthRatioTrackerModal(
  progress: ReturnType<typeof getStoredProgress>,
  exerciseId: LengthRatioEstimateExerciseDefinition["id"],
): HTMLElement {
  const model = lengthRatioTrackerModel(progress, exerciseId);
  const strip = h("div", {
    class: "division-tracker-detail-strip length-ratio-detail-strip",
  });
  strip.replaceChildren(...lengthRatioTrackerStrip(model));
  const populatedBuckets = model.buckets.filter(
    (bucket) => bucket.aggregate !== undefined || bucket.todayAttempts > 0,
  );
  const details = h("div", { class: "division-tracker-modal-details" }, [
    h("p", {}, [
      "Cells rank log-spaced target/source ratio buckets from 0.25 to 4.0.",
    ]),
    h(
      "ul",
      {},
      populatedBuckets.length === 0
        ? [h("li", {}, ["No length ratio attempts yet."])]
        : populatedBuckets.map((bucket) =>
            h("li", {}, [lengthRatioBucketSummary(bucket)]),
          ),
    ),
  ]);
  const closeBtn = actionButton("Close", () => overlay.remove());
  const panel = h("section", { class: "division-tracker-modal-panel" }, [
    h("div", { class: "division-tracker-modal-header" }, [
      h("h2", {}, ["Length ratio estimation practice"]),
      closeBtn,
    ]),
    strip,
    details,
  ]);
  const overlay = h("div", { class: "division-tracker-modal" }, [panel]);
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Length ratio estimation tracker detail");
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) overlay.remove();
  });
  return overlay;
}

function lengthRatioBucketSummary(bucket: LengthRatioTrackerBucket): string {
  const score =
    bucket.aggregate === undefined
      ? "no proficiency score"
      : `EMA ${bucket.aggregate.ema.toFixed(1)}, ${bucket.aggregate.attempts} counted`;
  return `${bucket.label}: ${score}, ${bucket.todayAttempts} today`;
}
