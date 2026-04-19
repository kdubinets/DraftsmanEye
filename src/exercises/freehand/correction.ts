/**
 * SVG overlay rendering for freehand corrections, target marks, and closed-shape
 * diagnostics (closure gap, join tangents). Also handles the in-history correction
 * thumbnails via appendFreehandCorrection.
 */
import { radiansToDegrees } from '../../geometry/primitives';
import { closedShapeTangents } from '../../geometry/strokeMath';
import { s } from '../../render/h';
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
    setLineAttrs(fittedLine, result.target.start, result.target.end);
    fittedLine.classList.add('freehand-target-correction-line');
    fittedLine.style.display = '';
    return;
  }
  if (result.kind === 'line') {
    fittedLine.classList.remove('freehand-target-correction-line');
    setLineAttrs(fittedLine, result.fitStart, result.fitEnd);
    fittedLine.style.display = '';
    return;
  }
  if (result.kind === 'target-circle') {
    setCircleAttrs(fittedCircle, result.target.center, result.target.radius);
    fittedCircle.classList.add('freehand-target-correction-circle');
    fittedCircle.style.display = '';
    return;
  }
  if (result.kind === 'target-ellipse') {
    setEllipseAttrs(fittedEllipse, result.target.center, result.target.majorRadius, result.target.minorRadius, result.target.rotationRadians);
    fittedEllipse.classList.add('freehand-target-correction-ellipse');
    fittedEllipse.style.display = '';
    return;
  }
  if (result.kind === 'circle') {
    fittedCircle.classList.remove('freehand-target-correction-circle');
    setCircleAttrs(fittedCircle, result.center, result.radius);
    fittedCircle.style.display = '';
    return;
  }
  // ellipse
  fittedEllipse.classList.remove('freehand-target-correction-ellipse');
  setEllipseAttrs(fittedEllipse, result.center, result.majorRadius, result.minorRadius, result.rotationRadians);
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
  setLineAttrs(closureGap, first, last);
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
    parent.append(
      s('line', { class: `freehand-fit-line freehand-target-correction-line${suffix}`, x1: result.target.start.x, y1: result.target.start.y, x2: result.target.end.x, y2: result.target.end.y }),
    );
    appendTargetMarks(parent, result.target);
    return;
  }
  if (result.kind === 'line') {
    parent.append(
      s('line', { class: `freehand-fit-line${suffix}`, x1: result.fitStart.x, y1: result.fitStart.y, x2: result.fitEnd.x, y2: result.fitEnd.y }),
    );
    return;
  }
  if (result.kind === 'target-circle') {
    parent.append(
      s('circle', { class: `freehand-fit-circle freehand-target-correction-circle${suffix}`, cx: result.target.center.x, cy: result.target.center.y, r: result.target.radius }),
    );
    appendTargetMarks(parent, result.target);
    return;
  }
  if (result.kind === 'target-ellipse') {
    parent.append(
      s('ellipse', { class: `freehand-fit-ellipse freehand-target-correction-ellipse${suffix}`, cx: result.target.center.x, cy: result.target.center.y, rx: result.target.majorRadius, ry: result.target.minorRadius, transform: ellipseTransform(result.target.rotationRadians, result.target.center.x, result.target.center.y) }),
    );
    return;
  }
  if (result.kind === 'circle') {
    parent.append(
      s('circle', { class: `freehand-fit-circle${suffix}`, cx: result.center.x, cy: result.center.y, r: result.radius }),
    );
    return;
  }
  // ellipse
  parent.append(
    s('ellipse', { class: `freehand-fit-ellipse${suffix}`, cx: result.center.x, cy: result.center.y, rx: result.majorRadius, ry: result.minorRadius, transform: ellipseTransform(result.rotationRadians, result.center.x, result.center.y) }),
  );
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

function setLineAttrs(
  el: SVGLineElement,
  a: { x: number; y: number },
  b: { x: number; y: number },
): void {
  el.setAttribute('x1', a.x.toFixed(2));
  el.setAttribute('y1', a.y.toFixed(2));
  el.setAttribute('x2', b.x.toFixed(2));
  el.setAttribute('y2', b.y.toFixed(2));
}

function setCircleAttrs(
  el: SVGCircleElement,
  center: { x: number; y: number },
  radius: number,
): void {
  el.setAttribute('cx', center.x.toFixed(2));
  el.setAttribute('cy', center.y.toFixed(2));
  el.setAttribute('r', radius.toFixed(2));
}

function setEllipseAttrs(
  el: SVGEllipseElement,
  center: { x: number; y: number },
  majorRadius: number,
  minorRadius: number,
  rotationRadians: number,
): void {
  el.setAttribute('cx', center.x.toFixed(2));
  el.setAttribute('cy', center.y.toFixed(2));
  el.setAttribute('rx', majorRadius.toFixed(2));
  el.setAttribute('ry', minorRadius.toFixed(2));
  el.setAttribute('transform', ellipseTransform(rotationRadians, center.x, center.y));
}

function setTangentMarker(
  marker: SVGLineElement,
  anchor: { x: number; y: number },
  direction: { x: number; y: number },
): void {
  const len = 42;
  setLineAttrs(
    marker,
    { x: anchor.x - direction.x * len, y: anchor.y - direction.y * len },
    { x: anchor.x + direction.x * len, y: anchor.y + direction.y * len },
  );
  marker.style.display = '';
}

function createTraceLineGuide(target: TargetLine): SVGLineElement {
  return s('line', { class: 'freehand-trace-guide', x1: target.start.x, y1: target.start.y, x2: target.end.x, y2: target.end.y });
}

function createTraceCircleGuide(target: TargetCircle): SVGCircleElement {
  return s('circle', { class: 'freehand-trace-guide', cx: target.center.x, cy: target.center.y, r: target.radius });
}

function createTraceEllipseGuide(target: {
  center: { x: number; y: number };
  majorRadius: number;
  minorRadius: number;
  rotationRadians: number;
}): SVGEllipseElement {
  return s('ellipse', { class: 'freehand-trace-guide', cx: target.center.x, cy: target.center.y, rx: target.majorRadius, ry: target.minorRadius, transform: ellipseTransform(target.rotationRadians, target.center.x, target.center.y) });
}

function createPlusMark(
  point: { x: number; y: number },
  className: string,
): SVGElement {
  return s('g', { class: className }, [
    s('line', { x1: point.x - 7, y1: point.y, x2: point.x + 7, y2: point.y }),
    s('line', { x1: point.x, y1: point.y - 7, x2: point.x, y2: point.y + 7 }),
  ]);
}

function createDotMark(
  point: { x: number; y: number },
  className: string,
): SVGCircleElement {
  return s('circle', { class: className, cx: point.x, cy: point.y, r: 4 });
}

function ellipseTransform(
  rotationRadians: number,
  cx: number,
  cy: number,
): string {
  return `rotate(${radiansToDegrees(rotationRadians).toFixed(2)} ${cx.toFixed(2)} ${cy.toFixed(2)})`;
}
