/**
 * Pointer event reading, stroke point accumulation, and stroke SVG rendering.
 * The FREEHAND_CONFIG constants are candidates for a future user-facing settings screen;
 * they are kept here as a const until the settings store (PR 6) is in place.
 */
import { distanceBetween, clampNumber } from '../../geometry/primitives';
import { createSvg, localSvgPoint } from '../../render/svg';
import type { FreehandPoint } from './types';

export const FREEHAND_CONFIG = {
  allowTouchDrawing: false,
  visualizePressureWidth: true,
  visualizeSpeedColor: true,
  minPressureStrokeWidth: 3.25,
  maxPressureStrokeWidth: 8,
  defaultStrokeWidth: 5,
  slowSpeedPixelsPerSecond: 180,
  fastSpeedPixelsPerSecond: 1100,
} as const;

/** Shared canvas dimensions referenced in both the live canvas and the history modal. */
export const CANVAS_WIDTH = 1000;
export const CANVAS_HEIGHT = 620;

export function canStartFreehandStroke(event: PointerEvent): boolean {
  return FREEHAND_CONFIG.allowTouchDrawing || event.pointerType !== 'touch';
}

export function freehandPointsFromPointerEvent(
  svg: SVGSVGElement,
  event: PointerEvent,
): FreehandPoint[] {
  const ev = event as PointerEvent & {
    getCoalescedEvents?: () => PointerEvent[];
  };
  const coalesced = ev.getCoalescedEvents?.();
  const sources =
    coalesced && coalesced.length > 0 ? coalesced : [event];
  const pts: FreehandPoint[] = [];
  for (const e of sources) {
    const p = freehandPointFromEvent(svg, e);
    if (p) pts.push(p);
  }
  return pts;
}

export function freehandPointFromEvent(
  svg: SVGSVGElement,
  event: PointerEvent,
): FreehandPoint | null {
  const local = localSvgPoint(svg, event.clientX, event.clientY);
  if (!local) {
    return null;
  }
  return {
    x: clampNumber(local.x, 0, CANVAS_WIDTH),
    y: clampNumber(local.y, 0, CANVAS_HEIGHT),
    time: event.timeStamp,
    pressure: event.pressure,
    pointerType: event.pointerType,
  };
}

/** Rebuild the stroke layer from scratch. Called on every pointermove during drawing. */
export function renderFreehandStroke(
  parent: SVGGElement,
  points: FreehandPoint[],
  className: string,
): void {
  parent.replaceChildren();
  appendFreehandStroke(parent, points, className);
}

export function appendFreehandStroke(
  parent: SVGGElement,
  points: FreehandPoint[],
  className: string,
): void {
  if (points.length === 0) {
    return;
  }

  if (!usesSegmentedStroke()) {
    const path = createSvg('path');
    path.setAttribute('class', className);
    path.setAttribute('d', freehandPath(points));
    parent.append(path);
    return;
  }

  for (let i = 1; i < points.length; i += 1) {
    const s = points[i - 1];
    const e = points[i];
    if (s.x === e.x && s.y === e.y) continue;
    const seg = createSvg('line');
    seg.setAttribute('class', className);
    seg.setAttribute('x1', s.x.toFixed(2));
    seg.setAttribute('y1', s.y.toFixed(2));
    seg.setAttribute('x2', e.x.toFixed(2));
    seg.setAttribute('y2', e.y.toFixed(2));
    seg.style.strokeWidth = `${segmentStrokeWidth(s, e).toFixed(2)}px`;
    seg.style.stroke = segmentStrokeColor(s, e);
    parent.append(seg);
  }
}

function usesSegmentedStroke(): boolean {
  return (
    FREEHAND_CONFIG.visualizePressureWidth || FREEHAND_CONFIG.visualizeSpeedColor
  );
}

function segmentStrokeWidth(
  start: FreehandPoint,
  end: FreehandPoint,
): number {
  if (!FREEHAND_CONFIG.visualizePressureWidth) {
    return FREEHAND_CONFIG.defaultStrokeWidth;
  }
  const p = meaningfulPressure(start, end);
  if (p === null) {
    return FREEHAND_CONFIG.defaultStrokeWidth;
  }
  return (
    FREEHAND_CONFIG.minPressureStrokeWidth +
    p *
      (FREEHAND_CONFIG.maxPressureStrokeWidth -
        FREEHAND_CONFIG.minPressureStrokeWidth)
  );
}

function meaningfulPressure(
  start: FreehandPoint,
  end: FreehandPoint,
): number | null {
  const p = (start.pressure + end.pressure) / 2;
  if (
    start.pointerType === 'mouse' ||
    end.pointerType === 'mouse' ||
    !Number.isFinite(p) ||
    p <= 0
  ) {
    return null;
  }
  return clampNumber(p, 0, 1);
}

function segmentStrokeColor(
  start: FreehandPoint,
  end: FreehandPoint,
): string {
  if (!FREEHAND_CONFIG.visualizeSpeedColor) {
    return '#34261b';
  }
  const elapsed = Math.max((end.time - start.time) / 1000, 0.001);
  const speed = distanceBetween(start, end) / elapsed;
  const ratio = clampNumber(
    (speed - FREEHAND_CONFIG.slowSpeedPixelsPerSecond) /
      (FREEHAND_CONFIG.fastSpeedPixelsPerSecond -
        FREEHAND_CONFIG.slowSpeedPixelsPerSecond),
    0,
    1,
  );
  const hue = 205 - ratio * 185;
  const lightness = 32 + ratio * 8;
  return `hsl(${hue.toFixed(1)} 72% ${lightness.toFixed(1)}%)`;
}

function freehandPath(points: FreehandPoint[]): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  return [
    `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`,
    ...rest.map((p) => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`),
  ].join(' ');
}
