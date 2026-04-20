/**
 * Single-mark exercise screen used by all Division drills.
 * The SVG is rebuilt on result reveal rather than updated in-place; that's intentional
 * — the result overlay shares the same element pool as the pre-reveal canvas, so a
 * full rebuild is simpler than toggling visibility on many elements.
 */
import { getAutoExercise } from "../practice/catalog";
import type {
  SingleMarkExerciseDefinition,
  LineAxis,
  TrialLine,
  SingleMarkTrialResult,
} from "../practice/catalog";
import { getStoredProgress, updateStoredProgress } from "../storage/progress";
import { localSvgPoint } from "../render/svg";
import { s, h } from "../render/h";
import {
  pageShell,
  exerciseHeader,
  resultStat,
  actionButton,
  formatSignedValue,
} from "../render/components";
import {
  feedbackHueForError,
  feedbackBandClass,
  feedbackLabel,
} from "../scoring/bands";
import type { AppState } from "../app/state";

export function mountSingleMarkScreen(
  root: HTMLElement,
  exercise: SingleMarkExerciseDefinition,
  source: "direct" | "auto",
  onNavigate: (next: AppState) => void,
): () => void {
  const trial = exercise.createTrial();
  let result: SingleMarkTrialResult | null = null;

  const screen = pageShell();
  const header = exerciseHeader(exercise, source);
  const stage = h("section", { class: "exercise-stage" });

  const prompt = h("p", { class: "exercise-prompt" }, [trial.prompt]);
  const feedback = h("p", { class: "feedback-banner" }, [
    "Place one mark on the line.",
  ]);
  const summary = h("div", { class: "result-summary" });
  summary.hidden = true;

  const actions = h("div", { class: "session-actions" });

  const againBtn = actionButton("Again", () => {
    onNavigate({ screen: "exercise", exerciseId: exercise.id, source });
  });
  againBtn.hidden = true;

  const backBtn = actionButton("Back to List", () => {
    onNavigate({ screen: "list" });
  });
  backBtn.hidden = true;

  const autoBtn = actionButton("Auto Next", () => {
    const { exercise: next } = getAutoExercise(getStoredProgress());
    onNavigate({ screen: "exercise", exerciseId: next.id, source: "auto" });
  });
  autoBtn.hidden = true;

  let svg = renderTrialSvg(trial, () => result, onSelect);

  actions.append(againBtn, backBtn, autoBtn);
  stage.append(prompt, svg, feedback, summary, actions);
  screen.append(header, stage);
  root.append(screen);
  return () => {};

  function onSelect(scalar: number): void {
    if (result) return;
    revealResult(trial.scoreSelection(scalar));
  }

  function rerenderSvg(): void {
    const next = renderTrialSvg(trial, () => result, onSelect);
    svg.replaceWith(next);
    svg = next;
  }

  function revealResult(next: SingleMarkTrialResult): void {
    result = next;
    updateStoredProgress(
      exercise.id,
      result.relativeAccuracyPercent,
      result.signedErrorPixels,
    );

    const hue = feedbackHueForError(result.relativeErrorPercent);
    const cls = feedbackBandClass(result.relativeErrorPercent);
    const accent = `hsl(${hue} 55% 42%)`;

    feedback.dataset.tone = cls;
    summary.dataset.tone = cls;
    feedback.style.setProperty("--result-accent", accent);
    summary.style.setProperty("--result-accent", accent);

    feedback.textContent =
      `${feedbackLabel(result.relativeErrorPercent)} · ` +
      `Error ${formatSignedValue(result.signedErrorPixels)} px · ` +
      `${result.relativeErrorPercent.toFixed(1)}% of line length`;

    summary.hidden = false;
    summary.replaceChildren(
      resultStat("Score", result.relativeAccuracyPercent.toFixed(1)),
      resultStat("Placed", `${Math.round(result.placedScalar)} px`),
      resultStat("Target", `${Math.round(result.targetScalar)} px`),
      resultStat(
        "Direction",
        result.signedErrorPixels === 0 ? "Exact" : result.directionLabel,
      ),
    );

    againBtn.hidden = false;
    backBtn.hidden = false;
    autoBtn.hidden = false;
    rerenderSvg();
  }
}

function renderTrialSvg(
  trial: import("../practice/catalog").SingleMarkTrial,
  getResult: () => SingleMarkTrialResult | null,
  onSelect: (scalar: number) => void,
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

  // Invisible hit-rect wider than the line so taps near the ends still register.
  const guide =
    trial.line.axis === "horizontal"
      ? s("rect", {
          x: trial.line.startScalar,
          y: trial.line.anchorY - 22,
          width: trial.line.endScalar - trial.line.startScalar,
          height: 44,
          class: "click-guide",
        })
      : s("rect", {
          x: trial.line.anchorX - 22,
          y: trial.line.startScalar,
          width: 44,
          height: trial.line.endScalar - trial.line.startScalar,
          class: "click-guide",
        });

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

    const scalar = scalarFromPoint(trial.line.axis, local);
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
  if (res) {
    const accent = `hsl(${feedbackHueForError(res.relativeErrorPercent)} 55% 42%)`;
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

    const placedTick = createTick(
      trial.line.axis,
      trial.line,
      res.placedScalar,
      "user-tick",
    );
    placedTick.style.stroke = accent;

    svg.append(
      gapEl,
      placedTick,
      createTick(trial.line.axis, trial.line, res.targetScalar, "target-tick"),
    );
  }

  return svg;
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

function createAnchorDirectionCue(
  axis: LineAxis,
  line: TrialLine,
  anchorScalar: number,
  directionSign: -1 | 1,
): SVGGElement {
  const startScalar = anchorScalar + directionSign * 14;
  const endScalar = anchorScalar + directionSign * 52;
  const start = linePointAtScalar(axis, line, startScalar);
  const end = linePointAtScalar(axis, line, endScalar);
  const headA =
    axis === "horizontal"
      ? { x: end.x - directionSign * 10, y: end.y - 7 }
      : { x: end.x - 7, y: end.y - directionSign * 10 };
  const headB =
    axis === "horizontal"
      ? { x: end.x - directionSign * 10, y: end.y + 7 }
      : { x: end.x + 7, y: end.y - directionSign * 10 };

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
  const len = 30;
  return axis === "horizontal"
    ? s("line", {
        x1: scalar,
        y1: line.anchorY - len,
        x2: scalar,
        y2: line.anchorY + len,
        class: className,
      })
    : s("line", {
        x1: line.anchorX - len,
        y1: scalar,
        x2: line.anchorX + len,
        y2: scalar,
        class: className,
      });
}

function linePoint(
  line: TrialLine,
  edge: "start" | "end",
): { x: number; y: number } {
  const sc = edge === "start" ? line.startScalar : line.endScalar;
  return line.axis === "horizontal"
    ? { x: sc, y: line.anchorY }
    : { x: line.anchorX, y: sc };
}

function linePointAtScalar(
  axis: LineAxis,
  line: TrialLine,
  scalar: number,
): { x: number; y: number } {
  return axis === "horizontal"
    ? { x: scalar, y: line.anchorY }
    : { x: line.anchorX, y: scalar };
}

function gapPoint(
  axis: LineAxis,
  line: TrialLine,
  scalar: number,
): { x: number; y: number } {
  const offset = 34;
  return axis === "horizontal"
    ? { x: scalar, y: line.anchorY - offset }
    : { x: line.anchorX - offset, y: scalar };
}

function scalarFromPoint(axis: LineAxis, point: DOMPoint | SVGPoint): number {
  return axis === "horizontal" ? point.x : point.y;
}

function crossAxisDistance(
  axis: LineAxis,
  line: TrialLine,
  point: DOMPoint | SVGPoint,
): number {
  return axis === "horizontal"
    ? Math.abs(point.y - line.anchorY)
    : Math.abs(point.x - line.anchorX);
}
