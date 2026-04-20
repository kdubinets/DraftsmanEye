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
    const revealScrollX = window.scrollX;
    const revealScrollY = window.scrollY;
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
      result.angleErrorDegrees === undefined
        ? `${feedbackLabel(result.relativeErrorPercent)} · ` +
          `Error ${formatSignedValue(result.signedErrorPixels)} px · ` +
          `${result.relativeErrorPercent.toFixed(1)}% of line length`
        : `${feedbackLabel(result.relativeErrorPercent)} · ` +
          `Angle error ${result.angleErrorDegrees.toFixed(1)}° · ` +
          `Offset ${formatSignedValue(result.signedErrorPixels)} px`;

    summary.hidden = false;
    const resultStats =
      result.angleErrorDegrees === undefined
        ? [
            resultStat("Score", result.relativeAccuracyPercent.toFixed(1)),
            resultStat("Placed", `${Math.round(result.placedScalar)} px`),
            resultStat("Target", `${Math.round(result.targetScalar)} px`),
            resultStat(
              "Direction",
              result.signedErrorPixels === 0 ? "Exact" : result.directionLabel,
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
              result.signedErrorPixels === 0 ? "Exact" : result.directionLabel,
            ),
          ];
    summary.replaceChildren(...resultStats);

    againBtn.hidden = false;
    backBtn.hidden = false;
    autoBtn.hidden = false;
    rerenderSvg();
    // Result controls can make the document taller; keep the canvas visually
    // stationary instead of letting scroll anchoring move the marked geometry.
    window.scrollTo(revealScrollX, revealScrollY);
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
  const projectionLine = trial.projectionLine
    ? s("line", {
        x1: linePoint(trial.projectionLine, "start").x,
        y1: linePoint(trial.projectionLine, "start").y,
        x2: linePoint(trial.projectionLine, "end").x,
        y2: linePoint(trial.projectionLine, "end").y,
        class: "projection-line",
      })
    : null;

  // Invisible hit-rect wider than the line so taps near the ends still register.
  const guide = createClickGuide(trial.line);

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
