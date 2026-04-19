/**
 * History thumbnail grid and full-detail modal for freehand attempt inspection.
 * Thumbnail bounds computation is per-result-kind because each kind carries different
 * geometry fields; a polymorphic exercise definition (PR 4) would let each kind own
 * its bounding box computation instead.
 */
import { feedbackHueForError, feedbackBandClass, feedbackLabel } from '../../scoring/bands';
import { createSvg } from '../../render/svg';
import { appendFreehandStroke } from './input';
import {
  appendFreehandCorrection,
  showClosedShapeMarkers,
  isClosedFreehandResult,
} from './correction';
import { freehandScoreLabel, freehandResultStats } from './stats';
import type { FreehandAttemptSnapshot } from './types';

/** CANVAS_WIDTH/HEIGHT thumbnail viewport constants. */
const THUMB_W = 180;
const THUMB_H = 132;

export function renderFreehandAttemptThumbnail(
  attempt: FreehandAttemptSnapshot,
  showCorrections: boolean,
  onOpen: () => void,
): HTMLButtonElement {
  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'freehand-history-item';
  item.addEventListener('click', onOpen);

  const svg = createSvg('svg');
  svg.setAttribute('class', 'freehand-history-canvas');
  svg.setAttribute('viewBox', `0 0 ${THUMB_W} ${THUMB_H}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute(
    'aria-label',
    `${freehandScoreLabel(attempt.result.kind)} ${attempt.result.score.toFixed(1)}`,
  );

  const frame = createSvg('rect');
  frame.setAttribute('x', '1');
  frame.setAttribute('y', '1');
  frame.setAttribute('width', String(THUMB_W - 2));
  frame.setAttribute('height', String(THUMB_H - 2));
  frame.setAttribute('rx', '8');
  frame.setAttribute('class', 'freehand-history-frame');

  const transform = thumbnailTransform(attempt);
  const content = createSvg('g');
  content.setAttribute(
    'transform',
    `translate(${transform.offsetX.toFixed(2)} ${transform.offsetY.toFixed(2)}) scale(${transform.scale.toFixed(4)})`,
  );

  if (showCorrections) {
    appendFreehandCorrection(content, attempt.result, true);
  }
  appendFreehandStroke(content, attempt.points, 'freehand-history-stroke');

  svg.append(frame, content);

  const score = document.createElement('p');
  score.className = 'freehand-history-score';
  score.textContent = attempt.result.score.toFixed(1);

  item.append(svg, score);
  return item;
}

export function renderFreehandHistoryModal(
  attempt: FreehandAttemptSnapshot,
  showCorrections: boolean,
  onClose: () => void,
): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'freehand-history-modal';
  overlay.dataset.testid = 'freehand-history-modal';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'History attempt detail');

  const panel = document.createElement('div');
  panel.className = 'freehand-history-modal-panel';

  const preview = renderAttemptPreview(attempt, showCorrections);

  const feedbackError = 100 - attempt.result.score;
  const feedbackHue = feedbackHueForError(feedbackError);
  const feedbackCls = feedbackBandClass(feedbackError);

  const feedback = document.createElement('p');
  feedback.className = 'feedback-banner';
  feedback.dataset.tone = feedbackCls;
  feedback.style.setProperty('--result-accent', `hsl(${feedbackHue} 55% 42%)`);
  feedback.textContent =
    `${feedbackLabel(feedbackError)} · ` +
    `${freehandScoreLabel(attempt.result.kind)} ${attempt.result.score.toFixed(1)} · ` +
    `Mean drift ${attempt.result.meanErrorPixels.toFixed(1)} px`;

  const summary = document.createElement('div');
  summary.className = 'result-summary';
  summary.dataset.tone = feedbackCls;
  summary.style.setProperty('--result-accent', `hsl(${feedbackHue} 55% 42%)`);
  summary.replaceChildren(...freehandResultStats(attempt.result));

  panel.append(preview, feedback, summary);
  overlay.append(panel);
  overlay.addEventListener('click', onClose);
  return overlay;
}

function renderAttemptPreview(
  attempt: FreehandAttemptSnapshot,
  showCorrections: boolean,
): SVGSVGElement {
  const svg = createSvg('svg');
  svg.setAttribute('class', 'freehand-history-modal-canvas');
  svg.setAttribute('viewBox', '0 0 1000 620');
  svg.setAttribute('role', 'img');
  svg.setAttribute(
    'aria-label',
    `${freehandScoreLabel(attempt.result.kind)} attempt at original size`,
  );

  const frame = createSvg('rect');
  frame.setAttribute('x', '1');
  frame.setAttribute('y', '1');
  frame.setAttribute('width', '998');
  frame.setAttribute('height', '618');
  frame.setAttribute('rx', '18');
  frame.setAttribute('class', 'canvas-frame');
  svg.append(frame);

  const content = createSvg('g');
  if (showCorrections) {
    appendFreehandCorrection(content, attempt.result, false);
  }
  appendFreehandStroke(content, attempt.points, 'freehand-user-stroke');

  if (showCorrections && isClosedFreehandResult(attempt.result)) {
    const closureGap = createSvg('line');
    closureGap.setAttribute('class', 'freehand-closure-gap');
    const startTangent = createSvg('line');
    startTangent.setAttribute('class', 'freehand-join-tangent');
    const endTangent = createSvg('line');
    endTangent.setAttribute('class', 'freehand-join-tangent');
    showClosedShapeMarkers(attempt.points, closureGap, startTangent, endTangent);
    content.append(closureGap, startTangent, endTangent);
  }

  svg.append(content);
  return svg;
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
  const scale = Math.min(
    (THUMB_W - pad * 2) / w,
    (THUMB_H - pad * 2) / h,
  );
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

  if (attempt.result.kind === 'line') {
    extendBounds(b, attempt.result.fitStart);
    extendBounds(b, attempt.result.fitEnd);
    return b;
  }
  if (attempt.result.kind === 'target-line') {
    extendBounds(b, attempt.result.target.start);
    extendBounds(b, attempt.result.target.end);
    return b;
  }
  if (attempt.result.kind === 'circle') {
    extendCircleBounds(b, attempt.result.center, attempt.result.radius);
    return b;
  }
  if (attempt.result.kind === 'target-circle') {
    extendCircleBounds(
      b,
      attempt.result.target.center,
      attempt.result.target.radius,
    );
    return b;
  }
  if (attempt.result.kind === 'target-ellipse') {
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
