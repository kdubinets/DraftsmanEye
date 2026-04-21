/**
 * History thumbnail grid and full-detail modal for freehand attempt inspection.
 * Thumbnail bounds computation is per-result-kind because each kind carries different
 * geometry fields; a polymorphic exercise definition (PR 4) would let each kind own
 * its bounding box computation instead.
 */
import {
  feedbackHueForError,
  feedbackBandClass,
  feedbackLabel,
} from "../../scoring/bands";
import { s, h } from "../../render/h";
import { appendFreehandStroke } from "./input";
import {
  appendFreehandCorrection,
  showClosedShapeMarkers,
  isClosedFreehandResult,
} from "./correction";
import {
  freehandResultLine,
  freehandScoreLabel,
  freehandResultStats,
} from "./stats";
import type { FreehandAttemptSnapshot } from "./types";

/** CANVAS_WIDTH/HEIGHT thumbnail viewport constants. */
const THUMB_W = 180;
const THUMB_H = 132;

export function renderFreehandAttemptThumbnail(
  attempt: FreehandAttemptSnapshot,
  showCorrections: boolean,
  onOpen: () => void,
): HTMLButtonElement {
  const transform = thumbnailTransform(attempt);
  const content = s("g", {
    transform: `translate(${transform.offsetX.toFixed(2)} ${transform.offsetY.toFixed(2)}) scale(${transform.scale.toFixed(4)})`,
  });
  if (showCorrections) appendFreehandCorrection(content, attempt.result, true);
  appendFreehandStroke(content, attempt.points, "freehand-history-stroke");

  const svg = s(
    "svg",
    {
      class: "freehand-history-canvas",
      viewBox: `0 0 ${THUMB_W} ${THUMB_H}`,
      role: "img",
      "aria-label": `${freehandScoreLabel(attempt.result.kind)} ${attempt.result.score.toFixed(1)}`,
    },
    [
      s("rect", {
        x: 1,
        y: 1,
        width: THUMB_W - 2,
        height: THUMB_H - 2,
        rx: 8,
        class: "freehand-history-frame",
      }),
      content,
    ],
  );

  return h(
    "button",
    { type: "button", class: "freehand-history-item", on: { click: onOpen } },
    [
      svg,
      h("p", { class: "freehand-history-score" }, [
        attempt.result.score.toFixed(1),
      ]),
    ],
  );
}

export function renderFreehandHistoryModal(
  attempt: FreehandAttemptSnapshot,
  options: {
    showCorrections: boolean;
    showResultString: boolean;
    showScoreBoxes: boolean;
    onClose: () => void;
  },
): HTMLElement {
  const feedbackError = 100 - attempt.result.score;
  const feedbackHue = feedbackHueForError(feedbackError);
  const feedbackCls = feedbackBandClass(feedbackError);
  const accent = `hsl(${feedbackHue} 55% 42%)`;

  const feedback = h(
    "p",
    {
      class: "feedback-banner",
      dataset: { tone: feedbackCls },
      style: {
        "--result-accent": accent,
      } as unknown as Partial<CSSStyleDeclaration>,
    },
    [freehandResultLine(attempt.result, feedbackLabel(feedbackError))],
  );
  feedback.hidden = !options.showResultString;

  const summary = h("div", {
    class: "result-summary",
    dataset: { tone: feedbackCls },
    style: {
      "--result-accent": accent,
    } as unknown as Partial<CSSStyleDeclaration>,
  });
  summary.replaceChildren(...freehandResultStats(attempt.result));
  summary.hidden = !options.showScoreBoxes;

  const panel = h("div", { class: "freehand-history-modal-panel" }, [
    renderAttemptPreview(attempt, options.showCorrections),
    feedback,
    summary,
  ]);

  const overlay = h(
    "div",
    {
      class: "freehand-history-modal",
      dataset: { testid: "freehand-history-modal" },
      on: { click: options.onClose },
    },
    [panel],
  );
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "History attempt detail");
  return overlay;
}

function renderAttemptPreview(
  attempt: FreehandAttemptSnapshot,
  showCorrections: boolean,
): SVGSVGElement {
  const content = s("g");
  if (showCorrections) appendFreehandCorrection(content, attempt.result, false);
  appendFreehandStroke(content, attempt.points, "freehand-user-stroke");

  if (showCorrections && isClosedFreehandResult(attempt.result)) {
    const closureGap = s("line", { class: "freehand-closure-gap" });
    const startTangent = s("line", { class: "freehand-join-tangent" });
    const endTangent = s("line", { class: "freehand-join-tangent" });
    showClosedShapeMarkers(
      attempt.points,
      closureGap,
      startTangent,
      endTangent,
    );
    content.append(closureGap, startTangent, endTangent);
  }

  return s(
    "svg",
    {
      class: "freehand-history-modal-canvas",
      viewBox: "0 0 1000 620",
      role: "img",
      "aria-label": `${freehandScoreLabel(attempt.result.kind)} attempt at original size`,
    },
    [
      s("rect", {
        x: 1,
        y: 1,
        width: 998,
        height: 618,
        rx: 18,
        class: "canvas-frame",
      }),
      content,
    ],
  );
}

function thumbnailTransform(attempt: FreehandAttemptSnapshot): {
  offsetX: number;
  offsetY: number;
  scale: number;
} {
  const b = boundsForAttempt(attempt);
  const w = Math.max(b.maxX - b.minX, 1);
  const h = Math.max(b.maxY - b.minY, 1);
  const pad = 14;
  const scale = Math.min((THUMB_W - pad * 2) / w, (THUMB_H - pad * 2) / h);
  const offsetX = pad + (THUMB_W - pad * 2 - w * scale) / 2 - b.minX * scale;
  const offsetY = pad + (THUMB_H - pad * 2 - h * scale) / 2 - b.minY * scale;
  return { offsetX, offsetY, scale };
}

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

function boundsForAttempt(attempt: FreehandAttemptSnapshot): Bounds {
  const b = attempt.points.reduce<Bounds>(
    (acc, p) => ({
      minX: Math.min(acc.minX, p.x),
      minY: Math.min(acc.minY, p.y),
      maxX: Math.max(acc.maxX, p.x),
      maxY: Math.max(acc.maxY, p.y),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );

  if (attempt.result.kind === "line") {
    extendBounds(b, attempt.result.fitStart);
    extendBounds(b, attempt.result.fitEnd);
    return b;
  }
  if (attempt.result.kind === "target-line") {
    extendBounds(b, attempt.result.target.start);
    extendBounds(b, attempt.result.target.end);
    return b;
  }
  if (attempt.result.kind === "target-angle") {
    extendBounds(b, attempt.result.target.reference.vertex);
    extendBounds(b, attempt.result.target.reference.baseEnd);
    extendBounds(b, attempt.result.target.reference.angleEnd);
    extendBounds(b, attempt.result.target.target.vertex);
    extendBounds(b, attempt.result.target.target.baseEnd);
    extendBounds(b, attempt.result.target.target.correctEnd);
    extendBounds(b, attempt.result.userRayStart);
    extendBounds(b, attempt.result.userRayEnd);
    return b;
  }
  if (attempt.result.kind === "circle") {
    extendCircleBounds(b, attempt.result.center, attempt.result.radius);
    return b;
  }
  if (attempt.result.kind === "target-circle") {
    extendCircleBounds(
      b,
      attempt.result.target.center,
      attempt.result.target.radius,
    );
    return b;
  }
  if (attempt.result.kind === "target-ellipse") {
    extendEllipseBounds(b, attempt.result.target);
    return b;
  }
  // ellipse
  extendEllipseBounds(b, attempt.result);
  return b;
}

function extendBounds(b: Bounds, p: { x: number; y: number }): void {
  b.minX = Math.min(b.minX, p.x);
  b.minY = Math.min(b.minY, p.y);
  b.maxX = Math.max(b.maxX, p.x);
  b.maxY = Math.max(b.maxY, p.y);
}

function extendCircleBounds(
  b: Bounds,
  center: { x: number; y: number },
  radius: number,
): void {
  extendBounds(b, { x: center.x - radius, y: center.y - radius });
  extendBounds(b, { x: center.x + radius, y: center.y + radius });
}

function extendEllipseBounds(
  b: Bounds,
  ellipse: {
    center: { x: number; y: number };
    majorRadius: number;
    minorRadius: number;
    rotationRadians: number;
  },
): void {
  const cos = Math.cos(ellipse.rotationRadians);
  const sin = Math.sin(ellipse.rotationRadians);
  const hw = Math.hypot(ellipse.majorRadius * cos, ellipse.minorRadius * sin);
  const hh = Math.hypot(ellipse.majorRadius * sin, ellipse.minorRadius * cos);
  extendBounds(b, { x: ellipse.center.x - hw, y: ellipse.center.y - hh });
  extendBounds(b, { x: ellipse.center.x + hw, y: ellipse.center.y + hh });
}
