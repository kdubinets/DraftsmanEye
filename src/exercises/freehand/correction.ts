/**
 * SVG overlay rendering for freehand corrections, target marks, and closed-shape
 * diagnostics (closure gap, join tangents). Also handles the in-history correction
 * thumbnails via appendFreehandCorrection.
 */
import { radiansToDegrees } from "../../geometry/primitives";
import { closedShapeTangents } from "../../geometry/strokeMath";
import { spiralPathData } from "../../geometry/spiral";
import { s } from "../../render/h";
import type {
  FreehandResult,
  FreehandTarget,
  LoopChainScoredResult,
  TargetLine,
  TargetCircle,
  TargetAngle,
  TargetLoopChainLinear,
  TargetLoopChainCircular,
  TargetLoopChainWedge,
  LoopChainLoopDeviation,
  TargetSpiral,
} from "./types";

export function isClosedFreehandResult(result: FreehandResult): boolean {
  return (
    result.kind === "circle" ||
    result.kind === "ellipse" ||
    result.kind === "target-circle" ||
    result.kind === "target-ellipse"
  );
}

export function applyFreehandCorrectionElements(
  result: FreehandResult,
  fittedLine: SVGLineElement,
  fittedCircle: SVGCircleElement,
  fittedEllipse: SVGEllipseElement,
): void {
  if (result.kind === "target-angle") {
    setLineAttrs(
      fittedLine,
      result.target.target.vertex,
      result.target.target.correctEnd,
    );
    fittedLine.classList.add("freehand-target-correction-line");
    fittedLine.style.display = "";
    return;
  }
  if (result.kind === "target-line") {
    setLineAttrs(fittedLine, result.target.start, result.target.end);
    fittedLine.classList.add("freehand-target-correction-line");
    fittedLine.style.display = "";
    return;
  }
  if (result.kind === "line") {
    fittedLine.classList.remove("freehand-target-correction-line");
    setLineAttrs(fittedLine, result.fitStart, result.fitEnd);
    fittedLine.style.display = "";
    return;
  }
  if (result.kind === "target-circle") {
    setCircleAttrs(fittedCircle, result.target.center, result.target.radius);
    fittedCircle.classList.add("freehand-target-correction-circle");
    fittedCircle.style.display = "";
    return;
  }
  if (result.kind === "target-ellipse") {
    setEllipseAttrs(
      fittedEllipse,
      result.target.center,
      result.target.majorRadius,
      result.target.minorRadius,
      result.target.rotationRadians,
    );
    fittedEllipse.classList.add("freehand-target-correction-ellipse");
    fittedEllipse.style.display = "";
    return;
  }
  if (result.kind === "circle") {
    fittedCircle.classList.remove("freehand-target-correction-circle");
    setCircleAttrs(fittedCircle, result.center, result.radius);
    fittedCircle.style.display = "";
    return;
  }
  if (
    result.kind === "loop-chain-band" ||
    result.kind === "loop-chain-scored" ||
    result.kind === "trace-spiral"
  ) {
    return;
  }
  // ellipse
  fittedEllipse.classList.remove("freehand-target-correction-ellipse");
  setEllipseAttrs(
    fittedEllipse,
    result.center,
    result.majorRadius,
    result.minorRadius,
    result.rotationRadians,
  );
  fittedEllipse.style.display = "";
}

export function hideFreehandCorrectionElements(
  fittedLine: SVGLineElement,
  fittedCircle: SVGCircleElement,
  fittedEllipse: SVGEllipseElement,
  closureGap: SVGLineElement,
  startTangent: SVGLineElement,
  endTangent: SVGLineElement,
): void {
  fittedLine.style.display = "none";
  fittedCircle.style.display = "none";
  fittedEllipse.style.display = "none";
  closureGap.style.display = "none";
  startTangent.style.display = "none";
  endTangent.style.display = "none";
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
  closureGap.style.display = "";

  const tangents = closedShapeTangents(points);
  if (!tangents) {
    startTangent.style.display = "none";
    endTangent.style.display = "none";
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
  const suffix = isHistory ? " freehand-history-correction" : "";

  if (result.kind === "target-line") {
    parent.append(
      s("line", {
        class: `freehand-fit-line freehand-target-correction-line${suffix}`,
        x1: result.target.start.x,
        y1: result.target.start.y,
        x2: result.target.end.x,
        y2: result.target.end.y,
      }),
    );
    appendTargetMarks(parent, result.target);
    return;
  }
  if (result.kind === "target-angle") {
    parent.append(
      s("line", {
        class: `freehand-fit-line freehand-target-correction-line${suffix}`,
        x1: result.target.target.vertex.x,
        y1: result.target.target.vertex.y,
        x2: result.target.target.correctEnd.x,
        y2: result.target.target.correctEnd.y,
      }),
      s("line", {
        class: `freehand-fit-line freehand-angle-user-fit${suffix}`,
        x1: result.userRayStart.x,
        y1: result.userRayStart.y,
        x2: result.userRayEnd.x,
        y2: result.userRayEnd.y,
      }),
    );
    appendTargetMarks(parent, result.target);
    return;
  }
  if (result.kind === "line") {
    parent.append(
      s("line", {
        class: `freehand-fit-line${suffix}`,
        x1: result.fitStart.x,
        y1: result.fitStart.y,
        x2: result.fitEnd.x,
        y2: result.fitEnd.y,
      }),
    );
    return;
  }
  if (result.kind === "target-circle") {
    parent.append(
      s("circle", {
        class: `freehand-fit-circle freehand-target-correction-circle${suffix}`,
        cx: result.target.center.x,
        cy: result.target.center.y,
        r: result.target.radius,
      }),
    );
    appendTargetMarks(parent, result.target);
    return;
  }
  if (result.kind === "target-ellipse") {
    parent.append(
      s("ellipse", {
        class: `freehand-fit-ellipse freehand-target-correction-ellipse${suffix}`,
        cx: result.target.center.x,
        cy: result.target.center.y,
        rx: result.target.majorRadius,
        ry: result.target.minorRadius,
        transform: ellipseTransform(
          result.target.rotationRadians,
          result.target.center.x,
          result.target.center.y,
        ),
      }),
    );
    return;
  }
  if (result.kind === "circle") {
    parent.append(
      s("circle", {
        class: `freehand-fit-circle${suffix}`,
        cx: result.center.x,
        cy: result.center.y,
        r: result.radius,
      }),
    );
    return;
  }
  if (result.kind === "loop-chain-scored") {
    renderLoopChainReview(parent, result);
    return;
  }
  if (result.kind === "loop-chain-band") {
    return;
  }
  if (result.kind === "trace-spiral") {
    parent.append(
      createTraceSpiralGuide(
        result.target,
        `freehand-trace-guide freehand-target-correction-spiral${isHistory ? " freehand-history-correction" : ""}`,
      ),
    );
    return;
  }
  // ellipse
  parent.append(
    s("ellipse", {
      class: `freehand-fit-ellipse${suffix}`,
      cx: result.center.x,
      cy: result.center.y,
      rx: result.majorRadius,
      ry: result.minorRadius,
      transform: ellipseTransform(
        result.rotationRadians,
        result.center.x,
        result.center.y,
      ),
    }),
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
  if (target.kind === "loop-chain-linear") {
    layer.append(...createLoopChainLinearGuides(target));
    return;
  }
  if (target.kind === "loop-chain-circular") {
    layer.append(...createLoopChainCircularGuides(target));
    return;
  }
  if (target.kind === "loop-chain-wedge") {
    layer.append(...createLoopChainWedgeGuides(target));
    return;
  }
  if (target.kind === "spiral") {
    layer.append(createTraceSpiralGuide(target, "freehand-trace-guide"));
    return;
  }
  if (target.kind === "line") {
    if (target.trace) {
      layer.append(
        createTraceLineGuide(target),
        ...(target.showDirectionCue ? [createLineDirectionCue(target)] : []),
      );
      return;
    }
    layer.append(
      createPlusMark(
        target.start,
        "freehand-target-mark freehand-target-source-mark",
        target.showDirectionCue ? 9 : 7,
      ),
      createPlusMark(target.end, "freehand-target-mark"),
      ...(target.showDirectionCue ? [createLineDirectionCue(target)] : []),
    );
    return;
  }
  if (target.kind === "angle") {
    appendAngleTargetMarks(layer, target);
    return;
  }
  if (target.kind === "ellipse") {
    layer.append(createTraceEllipseGuide(target));
    return;
  }
  if (target.trace) {
    layer.append(createTraceCircleGuide(target));
    return;
  }
  if (target.showCenter) {
    layer.append(createDotMark(target.center, "freehand-target-center"));
  }
  layer.append(
    ...target.marks.map((m) => createPlusMark(m, "freehand-target-mark")),
  );
}

function appendTargetMarks(
  parent: SVGGElement,
  target: TargetLine | TargetCircle | TargetAngle,
): void {
  if (target.kind === "line") {
    parent.append(
      createPlusMark(
        target.start,
        "freehand-target-mark freehand-target-source-mark",
        target.showDirectionCue ? 9 : 7,
      ),
      createPlusMark(target.end, "freehand-target-mark"),
    );
    return;
  }
  if (target.kind === "angle") {
    appendAngleTargetMarks(parent, target);
    return;
  }
  if (target.showCenter) {
    parent.append(createDotMark(target.center, "freehand-target-center"));
  }
  parent.append(
    ...target.marks.map((m) => createPlusMark(m, "freehand-target-mark")),
  );
}

function appendAngleTargetMarks(
  parent: SVGGElement,
  target: TargetAngle,
): void {
  parent.append(
    s("line", {
      class: "freehand-angle-reference-ray",
      x1: target.reference.vertex.x,
      y1: target.reference.vertex.y,
      x2: target.reference.baseEnd.x,
      y2: target.reference.baseEnd.y,
    }),
    s("line", {
      class: "freehand-angle-reference-ray",
      x1: target.reference.vertex.x,
      y1: target.reference.vertex.y,
      x2: target.reference.angleEnd.x,
      y2: target.reference.angleEnd.y,
    }),
    createDotMark(target.reference.vertex, "freehand-angle-reference-vertex"),
    s("line", {
      class: "freehand-angle-target-base",
      x1: target.target.vertex.x,
      y1: target.target.vertex.y,
      x2: target.target.baseEnd.x,
      y2: target.target.baseEnd.y,
    }),
    createAngleDirectionCue(target),
    createDotMark(target.target.vertex, "freehand-angle-target-vertex"),
  );
}

function createAngleDirectionCue(target: TargetAngle): SVGGElement {
  const radius = 42;
  const sweepRadians = (26 * Math.PI) / 180;
  const baseAngle = Math.atan2(
    target.target.baseEnd.y - target.target.vertex.y,
    target.target.baseEnd.x - target.target.vertex.x,
  );
  const startAngle = baseAngle + target.openingSign * 0.08;
  const endAngle = baseAngle + target.openingSign * sweepRadians;
  const start = pointFromAngle(target.target.vertex, radius, startAngle);
  const end = pointFromAngle(target.target.vertex, radius, endAngle);
  const largeArc = 0;
  const sweepFlag = target.openingSign > 0 ? 1 : 0;
  const tangentAngle = endAngle + (target.openingSign * Math.PI) / 2;
  const backAngle = tangentAngle + Math.PI;
  const arrowLeft = pointFromAngle(
    end,
    9,
    backAngle + target.openingSign * 0.55,
  );
  const arrowRight = pointFromAngle(
    end,
    9,
    backAngle - target.openingSign * 0.55,
  );

  return s("g", { class: "freehand-angle-direction-cue" }, [
    s("path", {
      d: `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} ${sweepFlag} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
    }),
    s("line", {
      x1: end.x,
      y1: end.y,
      x2: arrowLeft.x,
      y2: arrowLeft.y,
    }),
    s("line", {
      x1: end.x,
      y1: end.y,
      x2: arrowRight.x,
      y2: arrowRight.y,
    }),
  ]);
}

function pointFromAngle(
  origin: { x: number; y: number },
  length: number,
  angle: number,
): { x: number; y: number } {
  return {
    x: origin.x + Math.cos(angle) * length,
    y: origin.y + Math.sin(angle) * length,
  };
}

function setLineAttrs(
  el: SVGLineElement,
  a: { x: number; y: number },
  b: { x: number; y: number },
): void {
  el.setAttribute("x1", a.x.toFixed(2));
  el.setAttribute("y1", a.y.toFixed(2));
  el.setAttribute("x2", b.x.toFixed(2));
  el.setAttribute("y2", b.y.toFixed(2));
}

function setCircleAttrs(
  el: SVGCircleElement,
  center: { x: number; y: number },
  radius: number,
): void {
  el.setAttribute("cx", center.x.toFixed(2));
  el.setAttribute("cy", center.y.toFixed(2));
  el.setAttribute("r", radius.toFixed(2));
}

function setEllipseAttrs(
  el: SVGEllipseElement,
  center: { x: number; y: number },
  majorRadius: number,
  minorRadius: number,
  rotationRadians: number,
): void {
  el.setAttribute("cx", center.x.toFixed(2));
  el.setAttribute("cy", center.y.toFixed(2));
  el.setAttribute("rx", majorRadius.toFixed(2));
  el.setAttribute("ry", minorRadius.toFixed(2));
  el.setAttribute(
    "transform",
    ellipseTransform(rotationRadians, center.x, center.y),
  );
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
  marker.style.display = "";
}

function createTraceLineGuide(target: TargetLine): SVGLineElement {
  return s("line", {
    class: "freehand-trace-guide",
    x1: target.start.x,
    y1: target.start.y,
    x2: target.end.x,
    y2: target.end.y,
  });
}

function createLineDirectionCue(target: TargetLine): SVGGElement {
  const dx = target.end.x - target.start.x;
  const dy = target.end.y - target.start.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return s("g", { class: "freehand-line-direction-cue" });
  const unit = { x: dx / length, y: dy / length };
  const normal = { x: -unit.y, y: unit.x };
  const cueLength = Math.min(76, length * 0.24);
  const startDistance = Math.min(42, length * 0.18);
  const offset = target.trace ? 16 : 18;
  const start = {
    x: target.start.x + unit.x * startDistance + normal.x * offset,
    y: target.start.y + unit.y * startDistance + normal.y * offset,
  };
  const end = {
    x: start.x + unit.x * cueLength,
    y: start.y + unit.y * cueLength,
  };
  const headBase = {
    x: end.x - unit.x * 13,
    y: end.y - unit.y * 13,
  };
  const headA = {
    x: headBase.x + normal.x * 6,
    y: headBase.y + normal.y * 6,
  };
  const headB = {
    x: headBase.x - normal.x * 6,
    y: headBase.y - normal.y * 6,
  };
  return s("g", { class: "freehand-line-direction-cue" }, [
    s("line", { x1: start.x, y1: start.y, x2: end.x, y2: end.y }),
    s("line", { x1: end.x, y1: end.y, x2: headA.x, y2: headA.y }),
    s("line", { x1: end.x, y1: end.y, x2: headB.x, y2: headB.y }),
  ]);
}

function createTraceCircleGuide(target: TargetCircle): SVGCircleElement {
  return s("circle", {
    class: "freehand-trace-guide",
    cx: target.center.x,
    cy: target.center.y,
    r: target.radius,
  });
}

function createTraceEllipseGuide(target: {
  center: { x: number; y: number };
  majorRadius: number;
  minorRadius: number;
  rotationRadians: number;
}): SVGEllipseElement {
  return s("ellipse", {
    class: "freehand-trace-guide",
    cx: target.center.x,
    cy: target.center.y,
    rx: target.majorRadius,
    ry: target.minorRadius,
    transform: ellipseTransform(
      target.rotationRadians,
      target.center.x,
      target.center.y,
    ),
  });
}

function createPlusMark(
  point: { x: number; y: number },
  className: string,
  size = 7,
): SVGElement {
  return s("g", { class: className }, [
    s("line", {
      x1: point.x - size,
      y1: point.y,
      x2: point.x + size,
      y2: point.y,
    }),
    s("line", {
      x1: point.x,
      y1: point.y - size,
      x2: point.x,
      y2: point.y + size,
    }),
  ]);
}

function createDotMark(
  point: { x: number; y: number },
  className: string,
): SVGCircleElement {
  return s("circle", { class: className, cx: point.x, cy: point.y, r: 4 });
}

function ellipseTransform(
  rotationRadians: number,
  cx: number,
  cy: number,
): string {
  return `rotate(${radiansToDegrees(rotationRadians).toFixed(2)} ${cx.toFixed(2)} ${cy.toFixed(2)})`;
}

function createTraceSpiralGuide(
  target: TargetSpiral,
  className: string,
): SVGPathElement {
  const ySign = target.direction === "right" ? 1 : -1;
  const d = spiralPathData(
    target.center.x,
    target.center.y,
    target.innerRadius,
    target.outerRadius,
    target.turns,
    target.spiralKind,
    ySign,
  );
  return s("path", { class: className, d, fill: "none" });
}

export function createLoopChainLinearGuides(
  target: TargetLoopChainLinear,
): SVGElement[] {
  const y1 = target.centerY - target.bandHalf;
  const y2 = target.centerY + target.bandHalf;
  return [
    s("line", { class: "loop-chain-guide", x1: 0, y1, x2: 1000, y2: y1 }),
    s("line", { class: "loop-chain-guide", x1: 0, y1: y2, x2: 1000, y2: y2 }),
  ];
}

export function createLoopChainWedgeGuides(
  target: TargetLoopChainWedge,
): SVGElement[] {
  const { centerY, bandHalfLeft, bandHalfRight } = target;
  return [
    s("line", {
      class: "loop-chain-guide",
      x1: 0,
      y1: centerY - bandHalfLeft,
      x2: 1000,
      y2: centerY - bandHalfRight,
    }),
    s("line", {
      class: "loop-chain-guide",
      x1: 0,
      y1: centerY + bandHalfLeft,
      x2: 1000,
      y2: centerY + bandHalfRight,
    }),
  ];
}

export function createLoopChainCircularGuides(
  target: TargetLoopChainCircular,
): SVGElement[] {
  const { center, innerRadius, outerRadius } = target;
  return [
    s("circle", {
      class: "loop-chain-guide",
      cx: center.x,
      cy: center.y,
      r: innerRadius,
    }),
    s("circle", {
      class: "loop-chain-guide",
      cx: center.x,
      cy: center.y,
      r: outerRadius,
    }),
  ];
}

export function renderLoopChainCenterPath(
  layer: SVGGElement,
  loopCenters: { x: number; y: number }[],
  loopDeviations: LoopChainLoopDeviation[] = [],
): void {
  if (loopCenters.length === 0) return;

  for (let index = 0; index < loopCenters.length; index += 1) {
    const c = loopCenters[index];
    const deviation = loopDeviations[index];
    layer.append(
      s("circle", {
        class: "loop-chain-center-dot",
        cx: c.x,
        cy: c.y,
        r: 4,
      }),
    );
    if (deviation) {
      layer.append(loopDeviationTick(loopCenters, index, deviation));
    }
  }

  if (loopCenters.length >= 2) {
    const pts = loopCenters
      .map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`)
      .join(" ");
    layer.append(
      s("polyline", { class: "loop-chain-center-path", points: pts }),
    );
  }
}

export function renderLoopChainReview(
  layer: SVGGElement,
  result: LoopChainScoredResult,
): void {
  renderLoopChainIdealTrace(layer, result);
  renderLoopChainCenterPath(layer, result.loopCenters, result.loopDeviations);
}

function renderLoopChainIdealTrace(
  layer: SVGGElement,
  result: LoopChainScoredResult,
): void {
  const loops = idealLoopTraceGeometry(result);
  if (loops.length === 0) return;
  const d =
    loops.length === 1
      ? closedLoopPath(loops[0])
      : localizedTrochoidPath(loops);
  layer.append(s("path", { class: "loop-chain-ideal-trace", d }));
}

type IdealLoop = { center: { x: number; y: number }; radius: number };

function closedLoopPath(loop: IdealLoop): string {
  const { center, radius } = loop;
  return (
    `M ${(center.x + radius).toFixed(2)} ${center.y.toFixed(2)} ` +
    `A ${radius.toFixed(2)} ${radius.toFixed(2)} 0 1 1 ${(center.x - radius).toFixed(2)} ${center.y.toFixed(2)} ` +
    `A ${radius.toFixed(2)} ${radius.toFixed(2)} 0 1 1 ${(center.x + radius).toFixed(2)} ${center.y.toFixed(2)}`
  );
}

function localizedTrochoidPath(loops: IdealLoop[]): string {
  const samples: string[] = [];
  const sampleCount = Math.max(36, Math.ceil((loops.length - 1) * 32));

  for (let sample = 0; sample <= sampleCount; sample += 1) {
    const u = (sample / sampleCount) * (loops.length - 1);
    const point = localizedTrochoidPoint(loops, u);
    samples.push(
      `${sample === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
    );
  }

  return samples.join(" ");
}

function localizedTrochoidPoint(
  loops: IdealLoop[],
  u: number,
): { x: number; y: number } {
  const index = Math.max(0, Math.min(loops.length - 2, Math.floor(u)));
  const t = Math.max(0, Math.min(1, u - index));
  const center = interpolatePoint(
    loops[index].center,
    loops[index + 1].center,
    t,
  );
  const tangent = localTangent(loops, u);
  const normal = { x: -tangent.y, y: tangent.x };
  const pitch = localPitch(loops, u);
  const radius = localRadius(loops, u);
  const phase = u * Math.PI * 2;
  const tangentAmplitude = Math.max(
    radius * 0.72,
    (pitch / (Math.PI * 2)) * 1.35,
  );

  return {
    x:
      center.x -
      tangent.x * tangentAmplitude * Math.sin(phase) -
      normal.x * radius * Math.cos(phase),
    y:
      center.y -
      tangent.y * tangentAmplitude * Math.sin(phase) -
      normal.y * radius * Math.cos(phase),
  };
}

function localTangent(loops: IdealLoop[], u: number): { x: number; y: number } {
  const index = Math.round(Math.max(0, Math.min(loops.length - 1, u)));
  const before = loops[Math.max(0, index - 1)].center;
  const after = loops[Math.min(loops.length - 1, index + 1)].center;
  const dx = after.x - before.x;
  const dy = after.y - before.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

function localPitch(loops: IdealLoop[], u: number): number {
  const index = Math.round(Math.max(0, Math.min(loops.length - 1, u)));
  const distances: number[] = [];
  for (
    let segment = Math.max(0, index - 1);
    segment <= Math.min(loops.length - 2, index + 1);
    segment += 1
  ) {
    distances.push(
      distanceBetweenPoints(loops[segment].center, loops[segment + 1].center),
    );
  }
  return distances.reduce((sum, value) => sum + value, 0) / distances.length;
}

function localRadius(loops: IdealLoop[], u: number): number {
  const index = Math.max(0, Math.min(loops.length - 2, Math.floor(u)));
  const t = Math.max(0, Math.min(1, u - index));
  const raw =
    loops[index].radius + (loops[index + 1].radius - loops[index].radius) * t;
  const before = loops[Math.max(0, index - 1)].radius;
  const after = loops[Math.min(loops.length - 1, index + 2)].radius;
  return (before + raw * 2 + after) / 4;
}

function interpolatePoint(
  a: { x: number; y: number },
  b: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function distanceBetweenPoints(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function idealLoopTraceGeometry(result: LoopChainScoredResult): IdealLoop[] {
  if (result.loopCenters.length === 0 || result.meanLoopRadius <= 0) return [];
  const target = result.target;

  if (target?.kind === "loop-chain-linear") {
    return result.loopCenters.map((center) => ({
      center: { x: center.x, y: target.centerY },
      radius: target.bandHalf,
    }));
  }

  if (target?.kind === "loop-chain-circular") {
    const midRadius = (target.innerRadius + target.outerRadius) / 2;
    const loopRadius = (target.outerRadius - target.innerRadius) / 2;
    return result.loopCenters.map((center) => {
      const angle = Math.atan2(
        center.y - target.center.y,
        center.x - target.center.x,
      );
      return {
        center: {
          x: target.center.x + Math.cos(angle) * midRadius,
          y: target.center.y + Math.sin(angle) * midRadius,
        },
        radius: loopRadius,
      };
    });
  }

  if (target?.kind === "loop-chain-wedge") {
    return result.loopCenters.map((center) => ({
      center: { x: center.x, y: target.centerY },
      radius: loopChainWedgeHalfBandAtX(target, center.x),
    }));
  }

  return result.loopCenters.map((center) => ({
    center,
    radius: result.meanLoopRadius,
  }));
}

function loopChainWedgeHalfBandAtX(
  target: TargetLoopChainWedge,
  x: number,
): number {
  const t = Math.max(0, Math.min(1, x / 1000));
  return target.bandHalfLeft + (target.bandHalfRight - target.bandHalfLeft) * t;
}

function loopDeviationTick(
  loopCenters: { x: number; y: number }[],
  index: number,
  deviation: LoopChainLoopDeviation,
): SVGLineElement {
  const center = loopCenters[index];
  const before = loopCenters[Math.max(0, index - 1)];
  const after = loopCenters[Math.min(loopCenters.length - 1, index + 1)];
  const dx = after.x - before.x;
  const dy = after.y - before.y;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  const half = 7;
  const tick = s("line", {
    class: "loop-chain-deviation-tick",
    x1: center.x - nx * half,
    y1: center.y - ny * half,
    x2: center.x + nx * half,
    y2: center.y + ny * half,
  });
  tick.dataset.severity =
    deviation.deviationPercent < 8
      ? "low"
      : deviation.deviationPercent < 18
        ? "medium"
        : "high";
  return tick;
}
