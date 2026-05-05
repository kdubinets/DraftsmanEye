/** Numeric angle-estimation exercise screen with slider input and SVG feedback. */
import type { AngleEstimateExerciseDefinition } from "../practice/catalog";
import type { AppState, ListFilterState } from "../app/state";
import { startActivePracticeTimer } from "../storage/activePracticeTimer";
import { recordCurriculumCompletion } from "../storage/curriculumStats";
import { getSettings } from "../storage/settings";
import { installSpaceCommitShortcut } from "../input/commitGestures";
import { getStoredProgress, updateStoredProgress } from "../storage/progress";
import {
  ANGLE_ESTIMATE_MAX_DEGREES,
  ANGLE_ESTIMATE_MIN_DEGREES,
  createAngleEstimateTrial,
  scoreAngleEstimate,
  type AngleEstimateResult,
  type AngleEstimateTrial,
} from "../practice/angleEstimation";
import {
  angleEstimateTrackerModel,
  type AngleEstimateTrackerBucket,
  type AngleEstimateTrackerModel,
} from "../practice/angleEstimationTracker";
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
const VERTEX = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
const RAY_LENGTH = 230;

export function mountAngleEstimateScreen(
  root: HTMLElement,
  exercise: AngleEstimateExerciseDefinition,
  source: "direct" | "auto" | "curriculum",
  onNavigate: (next: AppState) => void,
  listState?: ListFilterState,
): () => void {
  let trial = createAngleEstimateTrial(exercise.id, getStoredProgress());
  let result: AngleEstimateResult | null = null;
  let estimateDegrees = 90;
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
    class: "exercise-stage angle-estimate-stage",
  });
  const prompt = h("p", { class: "exercise-prompt" }, [
    "Estimate the opening angle in degrees.",
  ]);

  const commitBtn = actionButton("Commit", commitEstimate);
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
  const againBtn = actionButton("Again", resetToFreshTrial);
  againBtn.hidden = true;
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
    class: "angle-semicircle-widget angle-estimate-widget",
    title: "Review angle estimation practice",
    on: {
      click: () => {
        document.body.append(
          renderAngleEstimateTrackerModal(getStoredProgress(), exercise.id),
        );
      },
    },
  });
  trackerWidget.setAttribute("aria-label", "Review angle estimation practice");
  renderAngleEstimateWidget(trackerWidget, getStoredProgress(), exercise.id);

  const toolbar = exerciseToolbar(
    prompt,
    commitBtn,
    pauseBtn,
    againBtn,
    fullBtn,
    backBtn,
  );
  toolbar.append(trackerWidget);

  const svg = s("svg", {
    class: "angle-estimate-canvas",
    viewBox: `0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`,
    role: "img",
    "aria-label": "Angle estimation field",
  });
  svg.dataset.testid = "angle-estimate-canvas";

  const feedback = h("p", { class: "feedback-banner" }, [
    "Set your estimate, then commit.",
  ]);
  const summary = h("div", { class: "result-summary is-pending" });
  summary.hidden = !settings.showScoreBoxes;
  summary.replaceChildren(...pendingResultSummary());

  const controls = angleEstimateControls();

  renderSvg();
  stage.append(toolbar, svg, controls, feedback, summary);
  screen.append(header, stage);
  root.append(screen);

  return () => {
    clearAutoResetTimer();
    removeSpaceShortcut();
    stopActiveTimer();
  };

  function angleEstimateControls(): HTMLElement {
    const minusBtn = h(
      "button",
      {
        type: "button",
        class: "angle-step-button",
        on: { click: () => setEstimate(estimateDegrees - 1) },
      },
      ["-1"],
    );
    const plusBtn = h(
      "button",
      {
        type: "button",
        class: "angle-step-button",
        on: { click: () => setEstimate(estimateDegrees + 1) },
      },
      ["+1"],
    );
    const slider = h("input", {
      type: "range",
      min: String(ANGLE_ESTIMATE_MIN_DEGREES),
      max: String(ANGLE_ESTIMATE_MAX_DEGREES),
      step: "1",
      value: String(estimateDegrees),
      class: "angle-estimate-slider",
      on: {
        input: (event) =>
          setEstimate(Number((event.currentTarget as HTMLInputElement).value)),
      },
    });
    slider.dataset.testid = "angle-estimate-slider";
    const numberInput = h("input", {
      type: "number",
      min: String(ANGLE_ESTIMATE_MIN_DEGREES),
      max: String(ANGLE_ESTIMATE_MAX_DEGREES),
      step: "1",
      value: String(estimateDegrees),
      class: "angle-estimate-number",
      on: {
        input: (event) =>
          setEstimate(Number((event.currentTarget as HTMLInputElement).value)),
        change: (event) =>
          setEstimate(Number((event.currentTarget as HTMLInputElement).value)),
      },
    });
    numberInput.dataset.testid = "angle-estimate-number";

    function setEstimate(next: number): void {
      if (!Number.isFinite(next)) next = ANGLE_ESTIMATE_MIN_DEGREES;
      estimateDegrees = Math.min(
        ANGLE_ESTIMATE_MAX_DEGREES,
        Math.max(ANGLE_ESTIMATE_MIN_DEGREES, Math.round(next)),
      );
      slider.value = String(estimateDegrees);
      numberInput.value = String(estimateDegrees);
    }

    return h("div", { class: "angle-estimate-controls" }, [
      minusBtn,
      h("label", { class: "angle-estimate-slider-wrap" }, [
        h("span", { class: "angle-estimate-control-label" }, ["Degrees"]),
        slider,
      ]),
      plusBtn,
      h("label", { class: "angle-estimate-number-wrap" }, [
        h("span", { class: "angle-estimate-control-label" }, ["Estimate"]),
        numberInput,
      ]),
    ]);
  }

  function commitEstimate(): void {
    if (result) return;
    result = scoreAngleEstimate(trial.targetDegrees, estimateDegrees);
    const previousProgress = getStoredProgress();
    const nextProgress = updateStoredProgress(
      exercise.id,
      result.score,
      result.signedErrorDegrees,
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
    renderAngleEstimateWidget(trackerWidget, nextProgress, exercise.id);

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
      `Correct ${result.targetDegrees}° · ` +
      `Estimate ${result.estimatedDegrees}° · ` +
      `Error ${formatSignedValue(result.signedErrorDegrees)}°`;
    feedback.hidden = !settings.showResultString;
    summary.classList.remove("is-pending");
    summary.hidden = !settings.showScoreBoxes;
    summary.replaceChildren(
      resultStat("Score", result.score.toFixed(1)),
      resultStat("Correct", `${result.targetDegrees}°`),
      resultStat("Estimate", `${result.estimatedDegrees}°`),
      resultStat("Error", `${formatSignedValue(result.signedErrorDegrees)}°`),
    );

    commitBtn.hidden = true;
    commitBtn.blur();
    againBtn.hidden = false;
    renderSvg();
    scheduleAutoReset();
  }

  function resetToFreshTrial(): void {
    clearAutoResetTimer();
    trial = createAngleEstimateTrial(exercise.id, getStoredProgress());
    result = null;
    estimateDegrees = 90;
    commitBtn.hidden = false;
    pauseBtn.hidden = true;
    pauseBtn.disabled = true;
    againBtn.hidden = true;
    feedback.removeAttribute("data-tone");
    summary.removeAttribute("data-tone");
    feedback.textContent = "Set your estimate, then commit.";
    feedback.hidden = false;
    summary.classList.add("is-pending");
    summary.hidden = !settings.showScoreBoxes;
    summary.replaceChildren(...pendingResultSummary());
    const slider = controls.querySelector<HTMLInputElement>(
      "[data-testid='angle-estimate-slider']",
    );
    const numberInput = controls.querySelector<HTMLInputElement>(
      "[data-testid='angle-estimate-number']",
    );
    if (slider) slider.value = String(estimateDegrees);
    if (numberInput) numberInput.value = String(estimateDegrees);
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
    const baseEnd = rayEnd(trial.baseRadians);
    const targetEnd = rayEnd(targetRadians(trial, trial.targetDegrees));
    const children: SVGElement[] = [
      s("line", {
        class: "angle-estimate-base-ray",
        x1: VERTEX.x,
        y1: VERTEX.y,
        x2: baseEnd.x,
        y2: baseEnd.y,
      }),
      s("line", {
        class: "angle-estimate-target-ray",
        x1: VERTEX.x,
        y1: VERTEX.y,
        x2: targetEnd.x,
        y2: targetEnd.y,
      }),
      s("circle", {
        class: "angle-estimate-vertex",
        cx: VERTEX.x,
        cy: VERTEX.y,
        r: 8,
      }),
    ];
    children.push(angleArc(trial, trial.targetDegrees, "angle-estimate-arc"));
    if (result) {
      const estimateEnd = rayEnd(targetRadians(trial, result.estimatedDegrees));
      children.push(
        s("line", {
          class: "angle-estimate-user-ray",
          x1: VERTEX.x,
          y1: VERTEX.y,
          x2: estimateEnd.x,
          y2: estimateEnd.y,
        }),
        angleArc(trial, result.estimatedDegrees, "angle-estimate-user-arc"),
      );
    }
    svg.replaceChildren(...children);
  }
}

function rayEnd(radians: number): { x: number; y: number } {
  return {
    x: VERTEX.x + Math.cos(radians) * RAY_LENGTH,
    y: VERTEX.y + Math.sin(radians) * RAY_LENGTH,
  };
}

function targetRadians(trial: AngleEstimateTrial, degrees: number): number {
  return trial.baseRadians + trial.sideSign * ((degrees * Math.PI) / 180);
}

function angleArc(
  trial: AngleEstimateTrial,
  degrees: number,
  className: string,
): SVGPathElement {
  const radius = 78;
  const start = {
    x: VERTEX.x + Math.cos(trial.baseRadians) * radius,
    y: VERTEX.y + Math.sin(trial.baseRadians) * radius,
  };
  const endRadians = targetRadians(trial, degrees);
  const end = {
    x: VERTEX.x + Math.cos(endRadians) * radius,
    y: VERTEX.y + Math.sin(endRadians) * radius,
  };
  const sweep = trial.sideSign > 0 ? 1 : 0;
  return s("path", {
    class: className,
    d: `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${
      degrees > 180 ? 1 : 0
    } ${sweep} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
  });
}

function renderAngleEstimateWidget(
  container: HTMLElement,
  progress: ReturnType<typeof getStoredProgress>,
  exerciseId: AngleEstimateExerciseDefinition["id"],
): void {
  const model = angleEstimateTrackerModel(progress, exerciseId);
  container.replaceChildren(...angleEstimateTrackerStrip(model));
}

function angleEstimateTrackerStrip(
  model: AngleEstimateTrackerModel,
): Node[] {
  return [
    angleEstimateSemicircleChart(
      model.buckets,
      "Angle estimation proficiency",
      "angle-semicircle-chart",
    ),
    angleEstimateTotalBar(model),
  ];
}

function angleEstimateTotalBar(
  model: AngleEstimateTrackerModel,
): HTMLSpanElement {
  const bar = h("span", {
      class: "angle-opening-total",
      title: `${model.todayTotal} angle-estimation attempts today`,
    });
  bar.style.setProperty(
    "--today-progress-width",
    `${(model.todayProgress * 100).toFixed(1)}%`,
  );
  return bar;
}

function renderAngleEstimateTrackerModal(
  progress: ReturnType<typeof getStoredProgress>,
  exerciseId: AngleEstimateExerciseDefinition["id"],
): HTMLElement {
  const model = angleEstimateTrackerModel(progress, exerciseId);
  const strip = h("div", {
    class: "angle-opening-detail-strip angle-estimate-detail-strip",
  });
  strip.replaceChildren(
    angleEstimateSemicircleChart(
      model.buckets,
      "Angle estimation proficiency",
      "angle-semicircle-chart-large",
    ),
    angleEstimateTotalBar(model),
  );
  const populatedBuckets = model.buckets.filter(
    (bucket) => bucket.aggregate !== undefined || bucket.todayAttempts > 0,
  );
  const details = h("div", { class: "division-tracker-modal-details" }, [
    h("p", {}, [
      "Cells rank 5-degree opening buckets. Edge buckets include 2-7deg and 173-178deg.",
    ]),
    h(
      "ul",
      {},
      populatedBuckets.length === 0
        ? [h("li", {}, ["No angle estimation attempts yet."])]
        : populatedBuckets.map((bucket) =>
            h("li", {}, [angleEstimateBucketSummary(bucket)]),
          ),
    ),
  ]);
  const closeBtn = actionButton("Close", () => overlay.remove());
  const panel = h("section", { class: "division-tracker-modal-panel" }, [
    h("div", { class: "division-tracker-modal-header" }, [
      h("h2", {}, ["Angle estimation practice"]),
      closeBtn,
    ]),
    strip,
    details,
  ]);
  const overlay = h("div", { class: "division-tracker-modal" }, [panel]);
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Angle estimation tracker detail");
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) overlay.remove();
  });
  return overlay;
}

function angleEstimateBucketSummary(bucket: AngleEstimateTrackerBucket): string {
  const score =
    bucket.aggregate === undefined
      ? "no proficiency score"
      : `EMA ${bucket.aggregate.ema.toFixed(1)}, ${bucket.aggregate.attempts} counted`;
  return `${bucket.bucket}deg: ${score}, ${bucket.todayAttempts} today`;
}

function angleEstimateSemicircleChart(
  buckets: AngleEstimateTrackerBucket[],
  ariaLabel: string,
  className: string,
): SVGSVGElement {
  const chart = s("svg", {
    class: `angle-semicircle-chart ${className}`,
    viewBox: "0 0 54 30",
    role: "img",
    "aria-label": ariaLabel,
  });
  for (const bucket of buckets) {
    const sector = angleEstimateSemicircleSector(bucket.bucket, bucket.cellFill);
    appendSvgTitle(sector, angleEstimateBucketSummary(bucket));
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

function angleEstimateSemicircleSector(
  centerDegrees: number,
  fill: string,
): SVGPathElement {
  const halfDegrees = 2.5;
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
