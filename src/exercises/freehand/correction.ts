/**
 * SVG overlay rendering for freehand corrections, target marks, and closed-shape
 * diagnostics (closure gap, join tangents). Also handles the in-history correction
 * thumbnails via appendFreehandCorrection.
 */
import { radiansToDegrees } from '../../geometry/primitives';
import { closedShapeTangents } from '../../geometry/strokeMath';
import { createSvg } from '../../render/svg';
import type { FreehandResult, FreehandTarget, TargetLine, TargetCircle } from './types';

export function isClosedFreehandResult(result: FreehandResult): boolean {
  return (
    result.kind === 'circle' ||
    result.kind === 'ellipse' ||
    result.kind === 'target-circle' ||
    result.kind === 'target-ellipse'
  );
}

export function applyFreehandCorrectionElements(
  result: FreehandResult,
  fittedLine: SVGLineElement,
  fittedCircle: SVGCircleElement,
  fittedEllipse: SVGEllipseElement,
): void {
  if (result.kind === 'target-line') {
    fittedLine.setAttribute('x1', result.target.start.x.toFixed(2));
    fittedLine.setAttribute('y1', result.target.start.y.toFixed(2));
    fittedLine.setAttribute('x2', result.target.end.x.toFixed(2));
    fittedLine.setAttribute('y2', result.target.end.y.toFixed(2));
    fittedLine.classList.add('freehand-target-correction-line');
    fittedLine.style.display = '';
    return;
  }
  if (result.kind === 'line') {
    fittedLine.classList.remove('freehand-target-correction-line');
    fittedLine.setAttribute('x1', result.fitStart.x.toFixed(2));
    fittedLine.setAttribute('y1', result.fitStart.y.toFixed(2));
    fittedLine.setAttribute('x2', result.fitEnd.x.toFixed(2));
    fittedLine.setAttribute('y2', result.fitEnd.y.toFixed(2));
    fittedLine.style.display = '';
    return;
  }
  if (result.kind === 'target-circle') {
    fittedCircle.setAttribute('cx', result.target.center.x.toFixed(2));
    fittedCircle.setAttribute('cy', result.target.center.y.toFixed(2));
    fittedCircle.setAttribute('r', result.target.radius.toFixed(2));
    fittedCircle.classList.add('freehand-target-correction-circle');
    fittedCircle.style.display = '';
    return;
  }
  if (result.kind === 'target-ellipse') {
    fittedEllipse.setAttribute('cx', result.target.center.x.toFixed(2));
    fittedEllipse.setAttribute('cy', result.target.center.y.toFixed(2));
    fittedEllipse.setAttribute('rx', result.target.majorRadius.toFixed(2));
    fittedEllipse.setAttribute('ry', result.target.minorRadius.toFixed(2));
    fittedEllipse.setAttribute(
      'transform',
      ellipseTransform(
        result.target.rotationRadians,
        result.target.center.x,
        result.target.center.y,
      ),
    );
    fittedEllipse.classList.add('freehand-target-correction-ellipse');
    fittedEllipse.style.display = '';
    return;
  }
  if (result.kind === 'circle') {
    fittedCircle.classList.remove('freehand-target-correction-circle');
    fittedCircle.setAttribute('cx', result.center.x.toFixed(2));
    fittedCircle.setAttribute('cy', result.center.y.toFixed(2));
    fittedCircle.setAttribute('r', result.radius.toFixed(2));
    fittedCircle.style.display = '';
    return;
  }
  // ellipse
  fittedEllipse.classList.remove('freehand-target-correction-ellipse');
  fittedEllipse.setAttribute('cx', result.center.x.toFixed(2));
  fittedEllipse.setAttribute('cy', result.center.y.toFixed(2));
  fittedEllipse.setAttribute('rx', result.majorRadius.toFixed(2));
  fittedEllipse.setAttribute('ry', result.minorRadius.toFixed(2));
  fittedEllipse.setAttribute(
    'transform',
    ellipseTransform(
      result.rotationRadians,
      result.center.x,
      result.center.y,
    ),
  );
  fittedEllipse.style.display = '';
}

export function hideFreehandCorrectionElements(
  fittedLine: SVGLineElement,
  fittedCircle: SVGCircleElement,
  fittedEllipse: SVGEllipseElement,
  closureGap: SVGLineElement,
  startTangent: SVGLineElement,
  endTangent: SVGLineElement,
): void {
  fittedLine.style.display = 'none';
  fittedCircle.style.display = 'none';
  fittedEllipse.style.display = 'none';
  closureGap.style.display = 'none';
  startTangent.style.display = 'none';
  endTangent.style.display = 'none';
}

export function showClosedShapeMarkers(
  points: { x: number; y: number }[],
  closureGap: SVGLineElement,
  startTangent: SVGLineElement,
  endTangent: SVGLineElement,
): void {
  const first = points[0];
  const last = points[points.length - 1];
  closureGap.setAttribute('x1', first.x.toFixed(2));
  closureGap.setAttribute('y1', first.y.toFixed(2));
  closureGap.setAttribute('x2', last.x.toFixed(2));
  closureGap.setAttribute('y2', last.y.toFixed(2));
  closureGap.style.display = '';

  const tangents = closedShapeTangents(points);
  if (!tangents) {
    startTangent.style.display = 'none';
    endTangent.style.display = 'none';
    return;
  }
  setTangentMarker(startTangent, first, tangents.start);
  setTangentMarker(endTangent, last, tangents.end);
}

/** Append target marks and/or the fitted correction shape into a history SVG group. */
export function appendFreehandCorrection(
  parent: SVGGElement,
  result: FreehandResult,
  isHistory: boolean,
): void {
  const suffix = isHistory ? ' freehand-history-correction' : '';

  if (result.kind === 'target-line') {
    const el = createSvg('line');
    el.setAttribute(
      'class',
      `freehand-fit-line freehand-target-correction-line${suffix}`,
    );
    el.setAttribute('x1', result.target.start.x.toFixed(2));
    el.setAttribute('y1', result.target.start.y.toFixed(2));
    el.setAttribute('x2', result.target.end.x.toFixed(2));
    el.setAttribute('y2', result.target.end.y.toFixed(2));
    parent.append(el);
    appendTargetMarks(parent, result.target);
    return;
  }
  if (result.kind === 'line') {
    const el = createSvg('line');
    el.setAttribute('class', `freehand-fit-line${suffix}`);
    el.setAttribute('x1', result.fitStart.x.toFixed(2));
    el.setAttribute('y1', result.fitStart.y.toFixed(2));
    el.setAttribute('x2', result.fitEnd.x.toFixed(2));
    el.setAttribute('y2', result.fitEnd.y.toFixed(2));
    parent.append(el);
    return;
  }
  if (result.kind === 'target-circle') {
    const el = createSvg('circle');
    el.setAttribute(
      'class',
      `freehand-fit-circle freehand-target-correction-circle${suffix}`,
    );
    el.setAttribute('cx', result.target.center.x.toFixed(2));
    el.setAttribute('cy', result.target.center.y.toFixed(2));
    el.setAttribute('r', result.target.radius.toFixed(2));
    parent.append(el);
    appendTargetMarks(parent, result.target);
    return;
  }
  if (result.kind === 'target-ellipse') {
    const el = createSvg('ellipse');
    el.setAttribute(
      'class',
      `freehand-fit-ellipse freehand-target-correction-ellipse${suffix}`,
    );
    el.setAttribute('cx', result.target.center.x.toFixed(2));
    el.setAttribute('cy', result.target.center.y.toFixed(2));
    el.setAttribute('rx', result.target.majorRadius.toFixed(2));
    el.setAttribute('ry', result.target.minorRadius.toFixed(2));
    el.setAttribute(
      'transform',
      ellipseTransform(
        result.target.rotationRadians,
        result.target.center.x,
        result.target.center.y,
      ),
    );
    parent.append(el);
    return;
  }
  if (result.kind === 'circle') {
    const el = createSvg('circle');
    el.setAttribute('class', `freehand-fit-circle${suffix}`);
    el.setAttribute('cx', result.center.x.toFixed(2));
    el.setAttribute('cy', result.center.y.toFixed(2));
    el.setAttribute('r', result.radius.toFixed(2));
    parent.append(el);
    return;
  }
  // ellipse
  const el = createSvg('ellipse');
  el.setAttribute('class', `freehand-fit-ellipse${suffix}`);
  el.setAttribute('cx', result.center.x.toFixed(2));
  el.setAttribute('cy', result.center.y.toFixed(2));
  el.setAttribute('rx', result.majorRadius.toFixed(2));
  el.setAttribute('ry', result.minorRadius.toFixed(2));
  el.setAttribute(
    'transform',
    ellipseTransform(result.rotationRadians, result.center.x, result.center.y),
  );
  parent.append(el);
}

export function renderFreehandTargetMarks(
  layer: SVGGElement,
  target: FreehandTarget | null,
): void {
  layer.replaceChildren();
  if (!target) return;
  appendFreehandTargetMarks(layer, target);
}

export function appendFreehandTargetMarks(
  layer: SVGGElement,
  target: FreehandTarget,
): void {
  if (target.kind === 'line') {
    if (target.trace) {
      layer.append(createTraceLineGuide(target));
      return;
    }
    layer.append(
      createPlusMark(target.start, 'freehand-target-mark'),
      createPlusMark(target.end, 'freehand-target-mark'),
    );
    return;
  }
  if (target.kind === 'ellipse') {
    layer.append(createTraceEllipseGuide(target));
    return;
  }
  if (target.trace) {
    layer.append(createTraceCircleGuide(target));
    return;
  }
  if (target.showCenter) {
    layer.append(createDotMark(target.center, 'freehand-target-center'));
  }
  layer.append(
    ...target.marks.map((m) => createPlusMark(m, 'freehand-target-mark')),
  );
}

function appendTargetMarks(
  parent: SVGGElement,
  target: TargetLine | TargetCircle,
): void {
  if (target.kind === 'line') {
    parent.append(
      createPlusMark(target.start, 'freehand-target-mark'),
      createPlusMark(target.end, 'freehand-target-mark'),
    );
    return;
  }
  if (target.showCenter) {
    parent.append(createDotMark(target.center, 'freehand-target-center'));
  }
  parent.append(
    ...target.marks.map((m) => createPlusMark(m, 'freehand-target-mark')),
  );
}

function setTangentMarker(
  marker: SVGLineElement,
  anchor: { x: number; y: number },
  direction: { x: number; y: number },
): void {
  const len = 42;
  marker.setAttribute('x1', (anchor.x - direction.x * len).toFixed(2));
  marker.setAttribute('y1', (anchor.y - direction.y * len).toFixed(2));
  marker.setAttribute('x2', (anchor.x + direction.x * len).toFixed(2));
  marker.setAttribute('y2', (anchor.y + direction.y * len).toFixed(2));
  marker.style.display = '';
}

function createTraceLineGuide(target: TargetLine): SVGLineElement {
  const el = createSvg('line');
  el.setAttribute('class', 'freehand-trace-guide');
  el.setAttribute('x1', target.start.x.toFixed(2));
  el.setAttribute('y1', target.start.y.toFixed(2));
  el.setAttribute('x2', target.end.x.toFixed(2));
  el.setAttribute('y2', target.end.y.toFixed(2));
  return el;
}

function createTraceCircleGuide(
  target: TargetCircle,
): SVGCircleElement {
  const el = createSvg('circle');
  el.setAttribute('class', 'freehand-trace-guide');
  el.setAttribute('cx', target.center.x.toFixed(2));
  el.setAttribute('cy', target.center.y.toFixed(2));
  el.setAttribute('r', target.radius.toFixed(2));
  return el;
}

function createTraceEllipseGuide(target: {
  center: { x: number; y: number };
  majorRadius: number;
  minorRadius: number;
  rotationRadians: number;
}): SVGEllipseElement {
  const el = createSvg('ellipse');
  el.setAttribute('class', 'freehand-trace-guide');
  el.setAttribute('cx', target.center.x.toFixed(2));
  el.setAttribute('cy', target.center.y.toFixed(2));
  el.setAttribute('rx', target.majorRadius.toFixed(2));
  el.setAttribute('ry', target.minorRadius.toFixed(2));
  el.setAttribute(
    'transform',
    ellipseTransform(
      target.rotationRadians,
      target.center.x,
      target.center.y,
    ),
  );
  return el;
}

function createPlusMark(
  point: { x: number; y: number },
  className: string,
): SVGElement {
  const g = createSvg('g');
  g.setAttribute('class', className);
  const h = createSvg('line');
  h.setAttribute('x1', (point.x - 7).toFixed(2));
  h.setAttribute('y1', point.y.toFixed(2));
  h.setAttribute('x2', (point.x + 7).toFixed(2));
  h.setAttribute('y2', point.y.toFixed(2));
  const v = createSvg('line');
  v.setAttribute('x1', point.x.toFixed(2));
  v.setAttribute('y1', (point.y - 7).toFixed(2));
  v.setAttribute('x2', point.x.toFixed(2));
  v.setAttribute('y2', (point.y + 7).toFixed(2));
  g.append(h, v);
  return g;
}

function createDotMark(
  point: { x: number; y: number },
  className: string,
): SVGElement {
  const dot = createSvg('circle');
  dot.setAttribute('class', className);
  dot.setAttribute('cx', point.x.toFixed(2));
  dot.setAttribute('cy', point.y.toFixed(2));
  dot.setAttribute('r', '4');
  return dot;
}

function ellipseTransform(
  rotationRadians: number,
  cx: number,
  cy: number,
): string {
  return `rotate(${radiansToDegrees(rotationRadians).toFixed(2)} ${cx.toFixed(2)} ${cy.toFixed(2)})`;
}
