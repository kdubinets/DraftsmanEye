/** Solids exercise screen: vertex-edge graph editing with a live reference panel. */
import type { SolidExerciseDefinition } from "../practice/catalog";
import { createFlatShapeReference } from "../geometry/flatShapes";
import { CUBE_SOLID, projectSolid } from "../geometry/project3d";
import type { ProjectedSolid } from "../geometry/project3d";
import { localSvgPoint } from "../render/svg";
import { h, s } from "../render/h";
import {
  actionButton,
  exerciseHeader,
  exerciseToolbar,
  fullscreenButton,
  pageShell,
  resultStat,
} from "../render/components";
import {
  feedbackBandClass,
  feedbackHueForError,
  feedbackLabel,
} from "../scoring/bands";
import {
  scoreSolidGraph,
  topologyWarning,
} from "../scoring/solids";
import type {
  SolidGraphEdge,
  SolidGraphVertex,
  SolidReferenceGraph,
  SolidScoreResult,
} from "../scoring/solids";
import { updateStoredProgress } from "../storage/progress";
import { getSettings } from "../storage/settings";
import type { AppState, ListFilterState } from "../app/state";

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 620;
const REFERENCE_WIDTH = 360;
const REFERENCE_HEIGHT = 260;
const HIT_RADIUS = 18;
const VERTEX_RADIUS = 4;
const DRAG_THRESHOLD = 5;

type SolidTrial = {
  rotationYRadians: number;
  rotationXRadians: number;
  reference: SolidReferenceGraph;
  referenceProjection: ProjectedSolid;
};

type GraphState = {
  vertices: SolidGraphVertex[];
  edges: SolidGraphEdge[];
  nextId: number;
};

type DragState = {
  id: number;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  originalX: number;
  originalY: number;
  moved: boolean;
};

type GraphDragState = {
  pointerId: number;
  start: { x: number; y: number };
  originalVertices: SolidGraphVertex[];
};

export function mountSolidsScreen(
  root: HTMLElement,
  exercise: SolidExerciseDefinition,
  source: "direct" | "auto",
  onNavigate: (next: AppState) => void,
  listState?: ListFilterState,
): () => void {
  let cancelled = false;
  let trial = createTrial(exercise);
  let state: GraphState = { vertices: [], edges: [], nextId: 1 };
  let history: GraphState[] = [];
  let selectedId: number | null = null;
  let hoveredId: number | null = null;
  let dragging: DragState | null = null;
  let graphDragging: GraphDragState | null = null;
  let cursorPoint: { x: number; y: number } | null = null;
  let result: SolidScoreResult | null = null;
  let transformMode = false;
  let referencePanelWidth = 260;
  const settings = getSettings();

  const screen = pageShell();
  const header = exerciseHeader(exercise, source);
  const stage = h("section", { class: "exercise-stage solids-stage" });
  const prompt = h("p", { class: "exercise-prompt" }, [
    "Place corners, connect edges, then adjust the graph to match the reference.",
  ]);

  const undoBtn = actionButton("Undo", doUndo);
  const transformBtn = actionButton("Move", toggleTransformMode);
  transformBtn.title = "Move drawing";
  const smallerBtn = actionButton("-", () => scaleGraph(0.92));
  smallerBtn.title = "Scale drawing down";
  const biggerBtn = actionButton("+", () => scaleGraph(1.08));
  biggerBtn.title = "Scale drawing up";
  const deleteBtn = actionButton("Delete", deleteSelectedVertex);
  deleteBtn.title = "Delete selected vertex";
  const clearBtn = actionButton("Clear", clearGraph);
  const doneBtn = actionButton("Done", revealResult);
  const againBtn = actionButton("Again", resetToFreshTrial);
  againBtn.hidden = true;
  const fullBtn = fullscreenButton(stage);
  const backBtn = actionButton("Back to List", () => {
    onNavigate({ screen: "list", listState });
  });

  const toolbar = exerciseToolbar(
    prompt,
    undoBtn,
    transformBtn,
    smallerBtn,
    biggerBtn,
    deleteBtn,
    clearBtn,
    doneBtn,
    againBtn,
    fullBtn,
    backBtn,
  );

  const edgeLayer = s("g", { class: "solids-edge-layer" });
  const resultLayer = s("g", { class: "solids-result-layer" });
  const previewLayer = s("g", { class: "solids-preview-layer" });
  const vertexLayer = s("g", { class: "solids-vertex-layer" });
  const svg = s(
    "svg",
    {
      class: "solids-canvas",
      viewBox: `0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`,
      role: "img",
      "aria-label": `${exercise.label} vertex-edge drawing field`,
    },
    [edgeLayer, resultLayer, previewLayer, vertexLayer],
  );

  const referenceSvg = s("svg", {
    class: "solids-reference-svg",
    viewBox: `0 0 ${REFERENCE_WIDTH} ${REFERENCE_HEIGHT}`,
    "aria-label": `Reference for ${exercise.label}`,
  });
  const referenceResizeHandle = h("div", {
    class: "solids-reference-resize",
    title: "Resize reference",
  });
  const referencePanel = h("div", { class: "solids-reference-panel" }, [
    h("div", { class: "solids-reference-header" }, [
      h("span", {}, ["Reference"]),
    ]),
    referenceSvg,
    referenceResizeHandle,
  ]);
  referencePanel.style.width = `${referencePanelWidth}px`;

  const workspace = h("div", { class: "solids-workspace" }, [
    svg,
    referencePanel,
  ]);
  const feedback = h("p", { class: "feedback-banner" }, [
    "Click empty space to place the first vertex.",
  ]);
  const summary = h("div", { class: "result-summary" });
  summary.hidden = true;

  stage.append(toolbar, workspace, feedback, summary);
  screen.append(header, stage);
  root.append(screen);

  svg.addEventListener("pointerdown", handlePointerDown);
  svg.addEventListener("pointermove", handlePointerMove);
  svg.addEventListener("pointerup", handlePointerUp);
  svg.addEventListener("lostpointercapture", handleLostPointerCapture);
  svg.addEventListener("contextmenu", handleContextMenu);
  document.addEventListener("keydown", handleKeyDown);
  referenceResizeHandle.addEventListener("pointerdown", handleReferenceResize);

  renderReference();
  renderGraph();

  return () => {
    cancelled = true;
    svg.removeEventListener("pointerdown", handlePointerDown);
    svg.removeEventListener("pointermove", handlePointerMove);
    svg.removeEventListener("pointerup", handlePointerUp);
    svg.removeEventListener("lostpointercapture", handleLostPointerCapture);
    svg.removeEventListener("contextmenu", handleContextMenu);
    document.removeEventListener("keydown", handleKeyDown);
    referenceResizeHandle.removeEventListener(
      "pointerdown",
      handleReferenceResize,
    );
  };

  function handlePointerDown(event: PointerEvent): void {
    if (result || event.button !== 0) return;
    event.preventDefault();
    const point = svgPointFromEvent(event);
    if (!point) return;

    if (transformMode && state.vertices.length > 0) {
      snapshot();
      graphDragging = {
        pointerId: event.pointerId,
        start: point,
        originalVertices: state.vertices.map((vertex) => ({ ...vertex })),
      };
      selectedId = null;
      svg.setPointerCapture(event.pointerId);
      renderGraph();
      return;
    }

    const hit = findVertex(point);
    if (hit !== null) {
      const vertex = vertexById(hit);
      if (!vertex) return;
      dragging = {
        id: hit,
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        originalX: vertex.x,
        originalY: vertex.y,
        moved: false,
      };
      svg.setPointerCapture(event.pointerId);
      return;
    }

    if (state.vertices.length >= trial.reference.vertices.length) {
      feedback.dataset.tone = "bad";
      feedback.textContent =
        "All reference vertices are placed. Rearrange them or connect existing vertices.";
      return;
    }

    snapshot();
    const newId = addVertex(point.x, point.y);
    if (selectedId !== null) {
      if (addEdge(selectedId, newId)) {
        selectedId = newId;
      }
    }
    renderGraph();
  }

  function handlePointerMove(event: PointerEvent): void {
    const point = svgPointFromEvent(event);
    if (!point) return;
    cursorPoint = point;

    if (result) return;

    if (graphDragging) {
      const dx = point.x - graphDragging.start.x;
      const dy = point.y - graphDragging.start.y;
      state.vertices = graphDragging.originalVertices.map((vertex) => ({
        ...vertex,
        x: vertex.x + dx,
        y: vertex.y + dy,
      }));
      renderGraph();
      return;
    }

    if (dragging) {
      const dx = event.clientX - dragging.startClientX;
      const dy = event.clientY - dragging.startClientY;
      if (
        !dragging.moved &&
        (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)
      ) {
        dragging.moved = true;
        snapshot();
      }
      if (dragging.moved) {
        const vertex = vertexById(dragging.id);
        if (!vertex) return;
        vertex.x = dragging.originalX + dx;
        vertex.y = dragging.originalY + dy;
        renderGraph();
        return;
      }
    }

    const hit = findVertex(point);
    if (hit !== hoveredId || selectedId !== null) {
      hoveredId = hit;
      renderGraph();
    }
  }

  function handlePointerUp(): void {
    if (graphDragging) {
      graphDragging = null;
      renderGraph();
      return;
    }
    if (result || !dragging) return;

    if (!dragging.moved) {
      const tappedId = dragging.id;
      if (selectedId === null) {
        selectedId = tappedId;
      } else if (selectedId === tappedId) {
        selectedId = null;
      } else {
        snapshot();
        addEdge(selectedId, tappedId);
        selectedId = tappedId;
      }
    }

    dragging = null;
    renderGraph();
  }

  function handleLostPointerCapture(): void {
    dragging = null;
    graphDragging = null;
    renderGraph();
  }

  function handleContextMenu(event: MouseEvent): void {
    event.preventDefault();
    if (result) return;
    const point = svgPointFromEvent(event);
    if (!point) return;
    const hit = findVertex(point);

    if (hit !== null) {
      snapshot();
      deleteVertex(hit);
      if (selectedId === hit) selectedId = null;
      renderGraph();
      return;
    }

    const edgeId = findEdgeNear(point);
    if (edgeId !== null) {
      snapshot();
      state.edges = state.edges.filter((edge) => edge.id !== edgeId);
      renderGraph();
    }
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (cancelled || result) return;
    if (event.key === "Escape" && selectedId !== null) {
      selectedId = null;
      renderGraph();
    }
    if ((event.key === "z" || event.key === "Z") && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      doUndo();
    }
    if ((event.key === "Delete" || event.key === "Backspace") && selectedId !== null) {
      event.preventDefault();
      deleteSelectedVertex();
    }
  }

  function handleReferenceResize(event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = referencePanelWidth;
    referenceResizeHandle.setPointerCapture(event.pointerId);

    const move = (moveEvent: PointerEvent): void => {
      const workspaceWidth = workspace.getBoundingClientRect().width;
      referencePanelWidth = Math.round(
        Math.min(Math.max(startWidth + moveEvent.clientX - startX, 170), workspaceWidth * 0.48),
      );
      referencePanel.style.width = `${referencePanelWidth}px`;
    };
    const up = (upEvent: PointerEvent): void => {
      referenceResizeHandle.releasePointerCapture(upEvent.pointerId);
      referenceResizeHandle.removeEventListener("pointermove", move);
      referenceResizeHandle.removeEventListener("pointerup", up);
      referenceResizeHandle.removeEventListener("pointercancel", up);
    };

    referenceResizeHandle.addEventListener("pointermove", move);
    referenceResizeHandle.addEventListener("pointerup", up);
    referenceResizeHandle.addEventListener("pointercancel", up);
  }

  function revealResult(): void {
    if (result) return;
    const warning = topologyWarning(trial.reference, state.vertices, state.edges);
    if (warning) {
      feedback.dataset.tone = "bad";
      feedback.textContent =
        `Reference needs ${warning.expectedVertices} vertices and ` +
        `${warning.expectedEdges} edges. You have ${warning.actualVertices} ` +
        `vertices and ${warning.actualEdges} edges.`;
      return;
    }

    const next = scoreSolidGraph(trial.reference, state.vertices, state.edges);
    if (!next) {
      feedback.dataset.tone = "bad";
      feedback.textContent = "Complete the reference graph before finishing.";
      return;
    }
    if (
      next.missingReferenceEdges.length > 0 ||
      next.extraUserEdgeIds.length > 0
    ) {
      feedback.dataset.tone = "bad";
      feedback.textContent =
        `The graph topology does not match the reference: ` +
        `${next.missingReferenceEdges.length} expected edge(s) missing and ` +
        `${next.extraUserEdgeIds.length} extra edge(s).`;
      return;
    }

    result = next;
    updateStoredProgress(exercise.id, next.score, 0);

    const hue = feedbackHueForError(next.relativeErrorPercent);
    const cls = feedbackBandClass(next.relativeErrorPercent);
    const accent = `hsl(${hue} 55% 42%)`;
    feedback.dataset.tone = cls;
    summary.dataset.tone = cls;
    feedback.style.setProperty("--result-accent", accent);
    summary.style.setProperty("--result-accent", accent);
    feedback.textContent =
      `${feedbackLabel(next.relativeErrorPercent)} · Score ${next.score.toFixed(1)} · ` +
      `${next.expectedEdges} edges · Mean angle ${next.meanEdgeAngleErrorDegrees.toFixed(1)}° · ` +
      `Worst edge ${next.worstEdgeErrorPercent.toFixed(1)}`;
    feedback.hidden = !settings.showResultString;

    summary.hidden = !settings.showScoreBoxes;
    summary.replaceChildren(
      resultStat("Score", next.score.toFixed(1)),
      resultStat("Mean angle", `${next.meanEdgeAngleErrorDegrees.toFixed(1)}°`),
      resultStat(
        "Length error",
        `${(next.meanLengthRatioError * 100).toFixed(1)}%`,
      ),
      resultStat("Worst edge", next.worstEdgeErrorPercent.toFixed(1)),
      resultStat("Edges", `${next.matchedEdges}/${next.expectedEdges}`),
    );

    doneBtn.hidden = true;
    againBtn.hidden = false;
    renderGraph();
  }

  function resetToFreshTrial(): void {
    trial = createTrial(exercise);
    state = { vertices: [], edges: [], nextId: 1 };
    history = [];
    selectedId = null;
    hoveredId = null;
    dragging = null;
    graphDragging = null;
    cursorPoint = null;
    result = null;
    transformMode = false;
    feedback.hidden = false;
    feedback.removeAttribute("data-tone");
    feedback.style.removeProperty("--result-accent");
    feedback.textContent = "Click empty space to place the first vertex.";
    summary.hidden = true;
    summary.replaceChildren();
    summary.removeAttribute("data-tone");
    summary.style.removeProperty("--result-accent");
    doneBtn.hidden = false;
    againBtn.hidden = true;
    renderReference();
    renderGraph();
  }

  function renderReference(): void {
    referenceSvg.replaceChildren(
      ...trial.referenceProjection.visibleEdges.map(([a, b]) =>
        s("line", {
          class: "solids-reference-edge",
          x1: trial.referenceProjection.points[a].x,
          y1: trial.referenceProjection.points[a].y,
          x2: trial.referenceProjection.points[b].x,
          y2: trial.referenceProjection.points[b].y,
        }),
      ),
    );
  }

  function renderGraph(): void {
    edgeLayer.replaceChildren(
      ...state.edges.flatMap((edge) => {
        const a = vertexById(edge.v1);
        const b = vertexById(edge.v2);
        if (!a || !b) return [];
        return [
          s("line", {
            class: ["solids-edge", resultEdgeClass(edge.id)]
              .filter(Boolean)
              .join(" "),
            x1: a.x,
            y1: a.y,
            x2: b.x,
            y2: b.y,
          }),
        ];
      }),
    );

    resultLayer.replaceChildren(...renderResultOverlay());

    const preview =
      selectedId !== null && cursorPoint && !dragging && !result
        ? renderPreviewLine(selectedId, cursorPoint)
        : null;
    previewLayer.replaceChildren(...(preview ? [preview] : []));

    vertexLayer.replaceChildren(
      ...state.vertices.flatMap((vertex) => renderVertex(vertex)),
    );
    updateControls();
    updateHint();
  }

  function renderResultOverlay(): SVGElement[] {
    if (!result) return [];
    const elements: SVGElement[] = [];
    for (const [a, b] of result.transformedReference.edges) {
      const start = result.transformedReference.vertices.find(
        (vertex) => vertex.index === a,
      );
      const end = result.transformedReference.vertices.find(
        (vertex) => vertex.index === b,
      );
      if (!start || !end) continue;
      const missing = result.missingReferenceEdges.some(
        ([x, y]) => (x === a && y === b) || (x === b && y === a),
      );
      elements.push(
        s("line", {
          class: missing
            ? "solids-reference-correction is-missing"
            : "solids-reference-correction",
          x1: start.point.x,
          y1: start.point.y,
          x2: end.point.x,
          y2: end.point.y,
        }),
      );
    }
    for (const vertex of result.transformedReference.vertices) {
      elements.push(
        s("circle", {
          class: "solids-reference-vertex",
          cx: vertex.point.x,
          cy: vertex.point.y,
          r: 5,
        }),
      );
    }
    return elements;
  }

  function renderPreviewLine(
    vertexId: number,
    point: { x: number; y: number },
  ): SVGElement | null {
    const vertex = vertexById(vertexId);
    if (!vertex) return null;
    return s("line", {
      class: "solids-preview-edge",
      x1: vertex.x,
      y1: vertex.y,
      x2: point.x,
      y2: point.y,
    });
  }

  function renderVertex(vertex: SolidGraphVertex): SVGElement[] {
    const selected = vertex.id === selectedId;
    const hovered = vertex.id === hoveredId && !dragging;
    const elements: SVGElement[] = [];
    if (selected) {
      elements.push(
        s("circle", {
          class: "solids-vertex-ring",
          cx: vertex.x,
          cy: vertex.y,
          r: VERTEX_RADIUS + 5,
        }),
      );
    }
    elements.push(
      s("circle", {
        class: [
          "solids-vertex",
          selected ? "is-selected" : "",
          hovered ? "is-hovered" : "",
        ]
          .filter(Boolean)
          .join(" "),
        cx: vertex.x,
        cy: vertex.y,
        r: selected || hovered ? VERTEX_RADIUS + 1.5 : VERTEX_RADIUS,
      }),
    );
    return elements;
  }

  function resultEdgeClass(edgeId: number): string {
    if (!result) return "";
    const edgeScore = result.edgeScores.find((edge) => edge.userEdgeId === edgeId);
    if (!edgeScore) {
      return result.extraUserEdgeIds.includes(edgeId) ? "is-bad" : "";
    }
    const band = feedbackBandClass(edgeScore.combinedErrorPercent);
    if (band === "excellent" || band === "good") return "is-good";
    if (band === "ok") return "is-ok";
    return "is-bad";
  }

  function updateHint(): void {
    if (result) return;
    feedback.removeAttribute("data-tone");
    feedback.style.removeProperty("--result-accent");
    if (transformMode) {
      feedback.textContent =
        "Drag in the field to move the whole drawing, or use - and +.";
      return;
    }
    if (state.vertices.length === 0) {
      feedback.textContent = "Click empty space to place the first vertex.";
      return;
    }
    if (selectedId !== null) {
      feedback.textContent =
        "Click another vertex to connect, or click empty space to place and connect.";
      return;
    }
    feedback.textContent =
      "Click a vertex to select, drag a vertex to move it, or right-click to delete.";
  }

  function updateControls(): void {
    undoBtn.disabled = history.length === 0 || result !== null;
    transformBtn.disabled = result !== null;
    transformBtn.classList.toggle("is-active", transformMode);
    transformBtn.setAttribute("aria-pressed", transformMode ? "true" : "false");
    smallerBtn.disabled = state.vertices.length === 0 || result !== null;
    biggerBtn.disabled = state.vertices.length === 0 || result !== null;
    deleteBtn.disabled = selectedId === null || result !== null;
    clearBtn.disabled =
      (state.vertices.length === 0 && state.edges.length === 0) || result !== null;
    doneBtn.disabled = result !== null;
  }

  function snapshot(): void {
    history.push({
      vertices: state.vertices.map((vertex) => ({ ...vertex })),
      edges: state.edges.map((edge) => ({ ...edge })),
      nextId: state.nextId,
    });
    if (history.length > 80) history.shift();
  }

  function doUndo(): void {
    if (history.length === 0 || result) return;
    const previous = history.pop();
    if (!previous) return;
    state = previous;
    selectedId = null;
    hoveredId = null;
    renderGraph();
  }

  function clearGraph(): void {
    if ((state.vertices.length === 0 && state.edges.length === 0) || result) return;
    snapshot();
    state.vertices = [];
    state.edges = [];
    selectedId = null;
    hoveredId = null;
    renderGraph();
  }

  function toggleTransformMode(): void {
    if (result) return;
    transformMode = !transformMode;
    selectedId = null;
    hoveredId = null;
    renderGraph();
  }

  function scaleGraph(factor: number): void {
    if (result || state.vertices.length === 0) return;
    snapshot();
    const center = graphCenter(state.vertices);
    state.vertices = state.vertices.map((vertex) => ({
      ...vertex,
      x: center.x + (vertex.x - center.x) * factor,
      y: center.y + (vertex.y - center.y) * factor,
    }));
    renderGraph();
  }

  function deleteSelectedVertex(): void {
    if (selectedId === null || result) return;
    snapshot();
    deleteVertex(selectedId);
    selectedId = null;
    renderGraph();
  }

  function addVertex(x: number, y: number): number {
    const id = state.nextId;
    state.nextId += 1;
    state.vertices.push({ id, x, y });
    return id;
  }

  function addEdge(v1: number, v2: number): boolean {
    if (v1 === v2 || state.edges.some((edge) => sameEdge(edge, v1, v2))) {
      return false;
    }
    if (state.edges.length >= trial.reference.edges.length) {
      feedback.dataset.tone = "bad";
      feedback.textContent =
        "All reference edges are placed. Rearrange the existing drawing.";
      return false;
    }
    const id = state.nextId;
    state.nextId += 1;
    state.edges.push({ id, v1, v2 });
    return true;
  }

  function deleteVertex(id: number): void {
    state.vertices = state.vertices.filter((vertex) => vertex.id !== id);
    state.edges = state.edges.filter((edge) => edge.v1 !== id && edge.v2 !== id);
  }

  function findVertex(point: { x: number; y: number }): number | null {
    let bestId: number | null = null;
    let bestDistance = HIT_RADIUS;
    for (const vertex of state.vertices) {
      const distance = Math.hypot(vertex.x - point.x, vertex.y - point.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestId = vertex.id;
      }
    }
    return bestId;
  }

  function findEdgeNear(point: { x: number; y: number }): number | null {
    for (let i = state.edges.length - 1; i >= 0; i -= 1) {
      const edge = state.edges[i];
      const a = vertexById(edge.v1);
      const b = vertexById(edge.v2);
      if (a && b && distanceToSegment(point, a, b) < 8) return edge.id;
    }
    return null;
  }

  function vertexById(id: number): SolidGraphVertex | null {
    return state.vertices.find((vertex) => vertex.id === id) ?? null;
  }

  function svgPointFromEvent(event: MouseEvent | PointerEvent): {
    x: number;
    y: number;
  } | null {
    const point = localSvgPoint(svg, event.clientX, event.clientY);
    return point ? { x: point.x, y: point.y } : null;
  }
}

function createTrial(exercise: SolidExerciseDefinition): SolidTrial {
  if (exercise.kind === "flat-triangle") {
    return createFlatTrial("triangle");
  }
  if (exercise.kind === "flat-quadrilateral") {
    return createFlatTrial("quadrilateral");
  }
  if (exercise.kind === "flat-pentagon") {
    return createFlatTrial("pentagon");
  }
  if (exercise.kind === "flat-hexagon") {
    return createFlatTrial("hexagon");
  }
  return createCubeTrial();
}

function createCubeTrial(): SolidTrial {
  const { rotationYRadians, rotationXRadians } = cubeAngles();
  const referenceProjection = projectSolid(CUBE_SOLID, {
    width: REFERENCE_WIDTH,
    height: REFERENCE_HEIGHT,
    rotationYRadians,
    rotationXRadians,
    focalLength: Math.min(REFERENCE_WIDTH, REFERENCE_HEIGHT) * 0.48,
    cameraDistance: 5.2,
    fitMargin: 24,
  });
  const scoringProjection = projectSolid(CUBE_SOLID, {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    rotationYRadians,
    rotationXRadians,
    focalLength: Math.min(CANVAS_WIDTH, CANVAS_HEIGHT) * 0.48,
    cameraDistance: 5.2,
    fitMargin: 84,
  });

  return {
    rotationYRadians,
    rotationXRadians,
    referenceProjection,
    reference: {
      vertices: scoringProjection.visibleVertexIndices.map((index) => ({
        index,
        point: scoringProjection.points[index],
      })),
      edges: scoringProjection.visibleEdges,
    },
  };
}

function createFlatTrial(
  kind: "triangle" | "quadrilateral" | "pentagon" | "hexagon",
): SolidTrial {
  const { reference, projection } = createFlatShapeReference(
    kind,
    { width: REFERENCE_WIDTH, height: REFERENCE_HEIGHT },
    { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
  );
  return {
    rotationYRadians: 0,
    rotationXRadians: 0,
    reference,
    referenceProjection: projection,
  };
}

function cubeAngles(): {
  rotationYRadians: number;
  rotationXRadians: number;
} {
  const sign = Math.random() < 0.5 ? -1 : 1;
  return {
    rotationYRadians: (sign * (34 + Math.random() * 24) * Math.PI) / 180,
    rotationXRadians: ((14 + Math.random() * 14) * Math.PI) / 180,
  };
}

function sameEdge(edge: SolidGraphEdge, v1: number, v2: number): boolean {
  return (edge.v1 === v1 && edge.v2 === v2) || (edge.v1 === v2 && edge.v2 === v1);
}

function distanceToSegment(
  point: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number },
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
    ),
  );
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function graphCenter(vertices: SolidGraphVertex[]): { x: number; y: number } {
  const sum = vertices.reduce(
    (acc, vertex) => ({ x: acc.x + vertex.x, y: acc.y + vertex.y }),
    { x: 0, y: 0 },
  );
  return { x: sum.x / vertices.length, y: sum.y / vertices.length };
}
