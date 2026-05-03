/** Solids exercise screen: vertex-edge graph editing with a live reference panel. */
import type { SolidExerciseDefinition } from "../practice/catalog";
import { createFlatShapeReference } from "../geometry/flatShapes";
import {
  CUBE_SOLID,
  SQUARE_PYRAMID_SOLID,
  TRIANGULAR_PRISM_LYING_SOLID,
  TRIANGULAR_PRISM_STANDING_SOLID,
  TRIANGULAR_PYRAMID_SOLID,
  cuboidSolid,
  projectSolid,
} from "../geometry/project3d";
import type { ProjectedSolid, SolidModel } from "../geometry/project3d";
import { localSvgPoint } from "../render/svg";
import { h, s } from "../render/h";
import {
  actionButton,
  exerciseHeader,
  exerciseToolbar,
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
import { scoreSolidGraph, topologyWarning } from "../scoring/solids";
import type {
  SolidGraphEdge,
  SolidGraphVertex,
  SolidReferenceGraph,
  SolidScoreResult,
} from "../scoring/solids";
import { getStoredProgress, updateStoredProgress } from "../storage/progress";
import { startActivePracticeTimer } from "../storage/activePracticeTimer";
import { recordCurriculumCompletion } from "../storage/curriculumStats";
import { getSettings } from "../storage/settings";
import type { AppState, ListFilterState } from "../app/state";

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 620;
const REFERENCE_WIDTH = 360;
const REFERENCE_HEIGHT = 260;
const HIT_RADIUS = 18;
const VERTEX_RADIUS = 4;
const DRAG_THRESHOLD = 5;
const SOLID_CANDIDATE_COUNT = 12;

type SolidTrial = {
  rotationYRadians: number;
  rotationXRadians: number;
  reference: SolidReferenceGraph;
  referenceProjection: ProjectedSolid;
};

type SolidPosePreset = {
  model: SolidModel;
  yawDegrees: readonly [number, number];
  pitchDegrees: readonly [number, number];
  pitchDirection?: -1 | 1 | "either";
  rollDegrees?: readonly [number, number];
  rollDirection?: -1 | 1 | "either";
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

type ProjectedSolidKind = Exclude<
  SolidExerciseDefinition["kind"],
  "flat-triangle" | "flat-quadrilateral" | "flat-pentagon" | "flat-hexagon"
>;

export function mountSolidsScreen(
  root: HTMLElement,
  exercise: SolidExerciseDefinition,
  source: "direct" | "auto" | "curriculum",
  onNavigate: (next: AppState) => void,
  listState?: ListFilterState,
): () => void {
  let cancelled = false;
  const projectedKind = isProjectedSolidKind(exercise.kind)
    ? exercise.kind
    : null;
  const useChooser = projectedKind !== null;
  let candidates = projectedKind ? createSolidCandidates(projectedKind) : [];
  let trial = useChooser ? candidates[0] : createTrial(exercise);
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
  const stopActiveTimer = startActivePracticeTimer(exercise.id, root);

  const screen = pageShell();
  const header = exerciseHeader(exercise, source);
  const chooserGrid = h("div", { class: "solids-chooser-grid" });
  const chooser = h("section", { class: "solids-chooser" }, [
    h("div", { class: "solids-chooser-header" }, [
      h("div", {}, [
        h("h2", {}, ["Choose a reference"]),
        h("p", {}, [
          "Pick one generated figure for this attempt, or regenerate the set.",
        ]),
      ]),
      actionButton("Regenerate", regenerateCandidates),
    ]),
    chooserGrid,
  ]);
  chooser.hidden = !useChooser;

  const stage = h("section", { class: "exercise-stage solids-stage" });
  stage.hidden = useChooser;
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
  summary.classList.add("is-pending");
  summary.hidden = !settings.showScoreBoxes;
  summary.replaceChildren(...pendingResultSummary());

  stage.append(toolbar, workspace, feedback, summary);
  screen.append(header, chooser, stage);
  root.append(screen);

  svg.addEventListener("pointerdown", handlePointerDown);
  svg.addEventListener("pointermove", handlePointerMove);
  svg.addEventListener("pointerup", handlePointerUp);
  svg.addEventListener("lostpointercapture", handleLostPointerCapture);
  svg.addEventListener("contextmenu", handleContextMenu);
  document.addEventListener("keydown", handleKeyDown);
  referenceResizeHandle.addEventListener("pointerdown", handleReferenceResize);

  if (useChooser) {
    renderChooser();
  } else {
    renderReference();
    renderGraph();
  }

  return () => {
    cancelled = true;
    stopActiveTimer();
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
        selectedId = hasExpectedEdgeCount() ? null : newId;
      }
    } else {
      selectedId = hasExpectedEdgeCount() ? null : newId;
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
        selectedId = hasExpectedEdgeCount() ? null : tappedId;
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
    if (
      (event.key === "z" || event.key === "Z") &&
      (event.ctrlKey || event.metaKey)
    ) {
      event.preventDefault();
      doUndo();
    }
    if (
      (event.key === "Delete" || event.key === "Backspace") &&
      selectedId !== null
    ) {
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
        Math.min(
          Math.max(startWidth + moveEvent.clientX - startX, 170),
          workspaceWidth * 0.48,
        ),
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
    const warning = topologyWarning(
      trial.reference,
      state.vertices,
      state.edges,
    );
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
    const previousProgress = getStoredProgress();
    const nextProgress = updateStoredProgress(exercise.id, next.score, 0);
    const nextAggregate = nextProgress.aggregates[exercise.id];
    if (nextAggregate) {
      recordCurriculumCompletion(
        exercise.id,
        nextAggregate.ema,
        previousProgress.aggregates[exercise.id]?.ema,
      );
    }

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

    summary.classList.remove("is-pending");
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
    resetDrawingState();
    renderReference();
    renderGraph();
  }

  function resetDrawingState(): void {
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
    summary.removeAttribute("data-tone");
    summary.style.removeProperty("--result-accent");
    summary.classList.add("is-pending");
    summary.hidden = !settings.showScoreBoxes;
    summary.replaceChildren(...pendingResultSummary());
    doneBtn.hidden = false;
    againBtn.hidden = true;
  }

  function regenerateCandidates(): void {
    if (!projectedKind) return;
    candidates = createSolidCandidates(projectedKind);
    renderChooser();
  }

  function selectCandidate(candidate: SolidTrial): void {
    trial = candidate;
    resetDrawingState();
    chooser.hidden = true;
    stage.hidden = false;
    renderReference();
    renderGraph();
  }

  function renderChooser(): void {
    chooserGrid.replaceChildren(
      ...candidates.map((candidate, index) =>
        solidCandidateButton(candidate, index, () =>
          selectCandidate(candidate),
        ),
      ),
    );
  }

  function solidCandidateButton(
    candidate: SolidTrial,
    index: number,
    onSelect: () => void,
  ): HTMLButtonElement {
    const thumbnail = s(
      "svg",
      {
        class: "solids-chooser-svg",
        viewBox: `0 0 ${REFERENCE_WIDTH} ${REFERENCE_HEIGHT}`,
        "aria-hidden": "true",
      },
      [
        ...candidateFaceElements(candidate),
        ...candidate.referenceProjection.visibleEdges.map(([a, b]) =>
          s("line", {
            class: "solids-reference-edge",
            x1: candidate.referenceProjection.points[a].x,
            y1: candidate.referenceProjection.points[a].y,
            x2: candidate.referenceProjection.points[b].x,
            y2: candidate.referenceProjection.points[b].y,
          }),
        ),
      ],
    );
    return h(
      "button",
      {
        type: "button",
        class: "solids-chooser-option",
        on: { click: onSelect },
      },
      [
        thumbnail,
        h("span", { class: "solids-chooser-option-label" }, [
          `Reference ${index + 1}`,
        ]),
      ],
    );
  }

  function candidateFaceElements(candidate: SolidTrial): SVGElement[] {
    if (settings.solidReferenceStyle !== "shaded") return [];
    return candidate.referenceProjection.visibleFaces.map((face) =>
      s("polygon", {
        class: "solids-reference-face",
        points: face.points
          .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
          .join(" "),
        fill: shadedFaceFill(face.normal),
      }),
    );
  }

  function renderReference(): void {
    referenceSvg.replaceChildren(
      ...referenceFaceElements(),
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

  function referenceFaceElements(): SVGElement[] {
    if (settings.solidReferenceStyle !== "shaded") return [];
    return trial.referenceProjection.visibleFaces.map((face) =>
      s("polygon", {
        class: "solids-reference-face",
        points: face.points
          .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
          .join(" "),
        fill: shadedFaceFill(face.normal),
      }),
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
      selectedId !== null &&
      cursorPoint &&
      !dragging &&
      !result &&
      !hasExpectedEdgeCount()
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
    const edgeScore = result.edgeScores.find(
      (edge) => edge.userEdgeId === edgeId,
    );
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
      (state.vertices.length === 0 && state.edges.length === 0) ||
      result !== null;
    doneBtn.disabled = result !== null;
  }

  function hasExpectedEdgeCount(): boolean {
    return state.edges.length >= trial.reference.edges.length;
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
    if ((state.vertices.length === 0 && state.edges.length === 0) || result)
      return;
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
    state.edges = state.edges.filter(
      (edge) => edge.v1 !== id && edge.v2 !== id,
    );
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
  return createProjectedSolidTrial(randomSolidPose(exercise.kind));
}

function createSolidCandidates(kind: ProjectedSolidKind): SolidTrial[] {
  return Array.from({ length: SOLID_CANDIDATE_COUNT }, () =>
    createProjectedSolidTrial(randomSolidPose(kind)),
  );
}

function isProjectedSolidKind(
  kind: SolidExerciseDefinition["kind"],
): kind is ProjectedSolidKind {
  return (
    kind === "solid-cube-2pt" ||
    kind === "solid-box-2pt" ||
    kind === "solid-triangular-prism-2pt" ||
    kind === "solid-square-pyramid-2pt" ||
    kind === "solid-triangular-pyramid-2pt" ||
    kind === "solid-cube-3pt" ||
    kind === "solid-box-3pt" ||
    kind === "solid-triangular-prism-3pt" ||
    kind === "solid-square-pyramid-3pt" ||
    kind === "solid-triangular-pyramid-3pt"
  );
}

function createProjectedSolidTrial(preset: SolidPosePreset): SolidTrial {
  const rotationYRadians = randomSignedDegrees(preset.yawDegrees);
  const rotationXRadians = randomDegrees(
    preset.pitchDegrees,
    preset.pitchDirection ?? "either",
  );
  const rotationZRadians = preset.rollDegrees
    ? randomDegrees(preset.rollDegrees, preset.rollDirection ?? "either")
    : 0;
  const referenceProjection = projectSolid(preset.model, {
    width: REFERENCE_WIDTH,
    height: REFERENCE_HEIGHT,
    rotationYRadians,
    rotationXRadians,
    rotationZRadians,
    focalLength: Math.min(REFERENCE_WIDTH, REFERENCE_HEIGHT) * 0.48,
    cameraDistance: 5.2,
    fitMargin: 24,
  });
  const scoringProjection = projectSolid(preset.model, {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    rotationYRadians,
    rotationXRadians,
    rotationZRadians,
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

function randomSolidPose(
  kind: SolidExerciseDefinition["kind"],
): SolidPosePreset {
  const presets: SolidPosePreset[] =
    kind === "solid-box-2pt"
      ? boxPosePresets()
      : kind === "solid-triangular-prism-2pt"
        ? triangularPrismPosePresets()
        : kind === "solid-square-pyramid-2pt"
          ? squarePyramidPosePresets()
          : kind === "solid-triangular-pyramid-2pt"
            ? triangularPyramidPosePresets()
            : kind === "solid-cube-3pt"
              ? cubePosePresets3pt()
              : kind === "solid-box-3pt"
                ? boxPosePresets3pt()
                : kind === "solid-triangular-prism-3pt"
                  ? triangularPrismPosePresets3pt()
                  : kind === "solid-square-pyramid-3pt"
                    ? squarePyramidPosePresets3pt()
                    : kind === "solid-triangular-pyramid-3pt"
                      ? triangularPyramidPosePresets3pt()
                      : cubePosePresets();
  return presets[Math.floor(Math.random() * presets.length)];
}

function cubePosePresets(): SolidPosePreset[] {
  return [
    { model: CUBE_SOLID, yawDegrees: [25, 65], pitchDegrees: [10, 30] },
    { model: CUBE_SOLID, yawDegrees: [20, 70], pitchDegrees: [4, 12] },
    { model: CUBE_SOLID, yawDegrees: [28, 58], pitchDegrees: [30, 42] },
    {
      model: CUBE_SOLID,
      yawDegrees: [24, 62],
      pitchDegrees: [10, 28],
      rollDegrees: [18, 38],
      rollDirection: "either",
    },
    {
      model: CUBE_SOLID,
      yawDegrees: [28, 62],
      pitchDegrees: [14, 30],
      rollDegrees: [48, 72],
      rollDirection: "either",
    },
  ];
}

function boxPosePresets(): SolidPosePreset[] {
  return [
    {
      model: cuboidSolid(2.8, 1.45, 1.45),
      yawDegrees: [24, 64],
      pitchDegrees: [8, 26],
    },
    {
      model: cuboidSolid(2.8, 1.45, 1.45),
      yawDegrees: [26, 64],
      pitchDegrees: [10, 26],
      rollDegrees: [20, 42],
      rollDirection: "either",
    },
    {
      model: cuboidSolid(1.45, 2.8, 1.45),
      yawDegrees: [24, 60],
      pitchDegrees: [8, 24],
    },
    {
      model: cuboidSolid(1.45, 2.8, 1.45),
      yawDegrees: [26, 58],
      pitchDegrees: [10, 24],
      rollDegrees: [14, 28],
      rollDirection: "either",
    },
    {
      model: cuboidSolid(2.7, 0.9, 1.8),
      yawDegrees: [22, 66],
      pitchDegrees: [10, 28],
    },
    {
      model: cuboidSolid(2.7, 0.9, 1.8),
      yawDegrees: [28, 64],
      pitchDegrees: [12, 28],
      rollDegrees: [48, 74],
      rollDirection: "either",
    },
    {
      model: cuboidSolid(1.55, 1.4, 2.8),
      yawDegrees: [28, 68],
      pitchDegrees: [6, 22],
    },
    {
      model: cuboidSolid(1.55, 1.4, 2.8),
      yawDegrees: [30, 66],
      pitchDegrees: [10, 26],
      rollDegrees: [88, 112],
      rollDirection: "either",
    },
  ];
}

function triangularPrismPosePresets(): SolidPosePreset[] {
  return [
    {
      model: TRIANGULAR_PRISM_LYING_SOLID,
      yawDegrees: [24, 66],
      pitchDegrees: [8, 26],
      pitchDirection: "either",
    },
    {
      model: TRIANGULAR_PRISM_LYING_SOLID,
      yawDegrees: [24, 62],
      pitchDegrees: [10, 24],
      pitchDirection: "either",
      rollDegrees: [46, 70],
      rollDirection: "either",
    },
    {
      model: TRIANGULAR_PRISM_LYING_SOLID,
      yawDegrees: [30, 68],
      pitchDegrees: [14, 30],
      pitchDirection: "either",
      rollDegrees: [95, 125],
      rollDirection: "either",
    },
    {
      model: TRIANGULAR_PRISM_STANDING_SOLID,
      yawDegrees: [22, 58],
      pitchDegrees: [24, 36],
      pitchDirection: -1,
    },
    {
      model: TRIANGULAR_PRISM_STANDING_SOLID,
      yawDegrees: [30, 62],
      pitchDegrees: [18, 28],
      pitchDirection: -1,
    },
    {
      model: TRIANGULAR_PRISM_STANDING_SOLID,
      yawDegrees: [24, 58],
      pitchDegrees: [12, 22],
      pitchDirection: 1,
    },
    {
      model: TRIANGULAR_PRISM_STANDING_SOLID,
      yawDegrees: [28, 58],
      pitchDegrees: [12, 24],
      pitchDirection: -1,
      rollDegrees: [10, 18],
      rollDirection: "either",
    },
  ];
}

function squarePyramidPosePresets(): SolidPosePreset[] {
  return [
    {
      model: SQUARE_PYRAMID_SOLID,
      yawDegrees: [24, 64],
      pitchDegrees: [8, 28],
    },
    {
      model: SQUARE_PYRAMID_SOLID,
      yawDegrees: [30, 58],
      pitchDegrees: [28, 40],
    },
    {
      model: SQUARE_PYRAMID_SOLID,
      yawDegrees: [26, 62],
      pitchDegrees: [10, 28],
      rollDegrees: [16, 32],
      rollDirection: "either",
    },
    {
      model: SQUARE_PYRAMID_SOLID,
      yawDegrees: [28, 60],
      pitchDegrees: [14, 30],
      rollDegrees: [180, 180],
      rollDirection: 1,
    },
    {
      model: SQUARE_PYRAMID_SOLID,
      yawDegrees: [30, 58],
      pitchDegrees: [24, 36],
      rollDegrees: [180, 180],
      rollDirection: 1,
    },
  ];
}

function triangularPyramidPosePresets(): SolidPosePreset[] {
  return [
    {
      model: TRIANGULAR_PYRAMID_SOLID,
      yawDegrees: [24, 60],
      pitchDegrees: [10, 26],
    },
    {
      model: TRIANGULAR_PYRAMID_SOLID,
      yawDegrees: [30, 58],
      pitchDegrees: [22, 34],
      pitchDirection: -1,
    },
    {
      model: TRIANGULAR_PYRAMID_SOLID,
      yawDegrees: [28, 60],
      pitchDegrees: [12, 26],
      rollDegrees: [18, 34],
      rollDirection: "either",
    },
    {
      model: TRIANGULAR_PYRAMID_SOLID,
      yawDegrees: [28, 58],
      pitchDegrees: [14, 28],
      rollDegrees: [180, 180],
      rollDirection: 1,
    },
  ];
}

function cubePosePresets3pt(): SolidPosePreset[] {
  return [
    {
      model: CUBE_SOLID,
      yawDegrees: [20, 70],
      pitchDegrees: [40, 60],
      pitchDirection: "either",
    },
    {
      model: CUBE_SOLID,
      yawDegrees: [25, 65],
      pitchDegrees: [44, 62],
      pitchDirection: "either",
    },
    {
      model: CUBE_SOLID,
      yawDegrees: [24, 62],
      pitchDegrees: [40, 58],
      pitchDirection: "either",
      rollDegrees: [18, 38],
      rollDirection: "either",
    },
    {
      model: CUBE_SOLID,
      yawDegrees: [28, 62],
      pitchDegrees: [42, 60],
      pitchDirection: "either",
      rollDegrees: [48, 72],
      rollDirection: "either",
    },
  ];
}

function boxPosePresets3pt(): SolidPosePreset[] {
  return [
    {
      model: cuboidSolid(2.8, 1.45, 1.45),
      yawDegrees: [24, 64],
      pitchDegrees: [38, 58],
      pitchDirection: "either",
    },
    {
      model: cuboidSolid(2.8, 1.45, 1.45),
      yawDegrees: [26, 64],
      pitchDegrees: [40, 58],
      pitchDirection: "either",
      rollDegrees: [20, 42],
      rollDirection: "either",
    },
    {
      model: cuboidSolid(1.45, 2.8, 1.45),
      yawDegrees: [24, 60],
      pitchDegrees: [38, 56],
      pitchDirection: "either",
    },
    {
      model: cuboidSolid(1.45, 2.8, 1.45),
      yawDegrees: [26, 58],
      pitchDegrees: [40, 58],
      pitchDirection: "either",
      rollDegrees: [14, 28],
      rollDirection: "either",
    },
    {
      model: cuboidSolid(2.7, 0.9, 1.8),
      yawDegrees: [22, 66],
      pitchDegrees: [40, 58],
      pitchDirection: "either",
    },
    {
      model: cuboidSolid(1.55, 1.4, 2.8),
      yawDegrees: [28, 68],
      pitchDegrees: [38, 56],
      pitchDirection: "either",
    },
  ];
}

function triangularPrismPosePresets3pt(): SolidPosePreset[] {
  return [
    {
      model: TRIANGULAR_PRISM_LYING_SOLID,
      yawDegrees: [24, 66],
      pitchDegrees: [40, 58],
      pitchDirection: "either",
    },
    {
      model: TRIANGULAR_PRISM_LYING_SOLID,
      yawDegrees: [24, 62],
      pitchDegrees: [42, 58],
      pitchDirection: "either",
      rollDegrees: [46, 70],
      rollDirection: "either",
    },
    {
      model: TRIANGULAR_PRISM_STANDING_SOLID,
      yawDegrees: [22, 58],
      pitchDegrees: [40, 58],
      pitchDirection: "either",
    },
    {
      model: TRIANGULAR_PRISM_STANDING_SOLID,
      yawDegrees: [28, 58],
      pitchDegrees: [40, 56],
      pitchDirection: "either",
      rollDegrees: [10, 18],
      rollDirection: "either",
    },
  ];
}

function squarePyramidPosePresets3pt(): SolidPosePreset[] {
  return [
    {
      model: SQUARE_PYRAMID_SOLID,
      yawDegrees: [24, 64],
      pitchDegrees: [38, 58],
      pitchDirection: "either",
    },
    {
      model: SQUARE_PYRAMID_SOLID,
      yawDegrees: [30, 58],
      pitchDegrees: [42, 60],
      pitchDirection: "either",
    },
    {
      model: SQUARE_PYRAMID_SOLID,
      yawDegrees: [26, 62],
      pitchDegrees: [38, 56],
      pitchDirection: "either",
      rollDegrees: [16, 32],
      rollDirection: "either",
    },
    {
      model: SQUARE_PYRAMID_SOLID,
      yawDegrees: [28, 60],
      pitchDegrees: [40, 58],
      pitchDirection: "either",
      rollDegrees: [180, 180],
      rollDirection: 1,
    },
  ];
}

function triangularPyramidPosePresets3pt(): SolidPosePreset[] {
  return [
    {
      model: TRIANGULAR_PYRAMID_SOLID,
      yawDegrees: [24, 60],
      pitchDegrees: [40, 58],
      pitchDirection: "either",
    },
    {
      model: TRIANGULAR_PYRAMID_SOLID,
      yawDegrees: [30, 58],
      pitchDegrees: [42, 60],
      pitchDirection: "either",
    },
    {
      model: TRIANGULAR_PYRAMID_SOLID,
      yawDegrees: [28, 60],
      pitchDegrees: [40, 56],
      pitchDirection: "either",
      rollDegrees: [18, 34],
      rollDirection: "either",
    },
    {
      model: TRIANGULAR_PYRAMID_SOLID,
      yawDegrees: [28, 58],
      pitchDegrees: [40, 58],
      pitchDirection: "either",
      rollDegrees: [180, 180],
      rollDirection: 1,
    },
  ];
}

function randomSignedDegrees(range: readonly [number, number]): number {
  return randomDegrees(range, "either");
}

function randomDegrees(
  range: readonly [number, number],
  direction: -1 | 1 | "either",
): number {
  const sign = Math.random() < 0.5 ? -1 : 1;
  const degrees = range[0] + Math.random() * (range[1] - range[0]);
  const directedSign = direction === "either" ? sign : direction;
  return (directedSign * degrees * Math.PI) / 180;
}

function shadedFaceFill(normal: { x: number; y: number; z: number }): string {
  const light = normalizeVector({ x: -0.45, y: 0.72, z: -0.54 });
  const n = normalizeVector(normal);
  const lambert = Math.max(0, n.x * light.x + n.y * light.y + n.z * light.z);
  const lightness = 72 + lambert * 16;
  const saturation = 24 + lambert * 10;
  return `hsl(35 ${saturation.toFixed(1)}% ${lightness.toFixed(1)}%)`;
}

function normalizeVector(vector: { x: number; y: number; z: number }): {
  x: number;
  y: number;
  z: number;
} {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  if (length === 0) return { x: 0, y: 0, z: 0 };
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  };
}

function sameEdge(edge: SolidGraphEdge, v1: number, v2: number): boolean {
  return (
    (edge.v1 === v1 && edge.v2 === v2) || (edge.v1 === v2 && edge.v2 === v1)
  );
}

function distanceToSegment(
  point: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number },
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0)
    return Math.hypot(point.x - start.x, point.y - start.y);
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
