/**
 * Binds each exercise definition to its screen mount function.
 * Keeps catalog.ts free of screen/state dependencies by doing the wiring here.
 */
import {
  EXERCISES,
  getExerciseById,
  getAutoExercise,
  isSolidExercise,
} from "../practice/catalog";
import type {
  ExerciseDefinition,
  ExerciseId,
  FreehandExerciseDefinition,
  SolidExerciseDefinition,
} from "../practice/catalog";
import { mountSingleMarkScreen } from "../screens/singleMark";
import { mountFreehandScreen } from "../screens/freehand";
import { mountSolidsScreen } from "../screens/solids";
import { scoreFreehandLine, scoreTargetLine } from "../scoring/line";
import { scoreFreehandCircle, scoreTargetCircle } from "../scoring/circle";
import { scoreFreehandEllipse, scoreTargetEllipse } from "../scoring/ellipse";
import { scoreTargetAngle } from "../scoring/angle";
import {
  scoreLoopChainFreehand,
  scoreLoopChainLinear,
  scoreLoopChainCircular,
  scoreLoopChainWedge,
} from "../scoring/loopChain";
import { scoreTraceSpiral } from "../scoring/spiral";
import { getStoredProgress } from "../storage/progress";
import { getSettings } from "../storage/settings";
import { selectLineAngleBucket } from "../practice/lineAngles";
import { selectAngleOpeningBucket } from "../practice/angleOpenings";
import {
  createFreehandTarget,
  createLoopChainLinearTarget,
  createLoopChainCircularTarget,
  createLoopChainWedgeTarget,
} from "./freehand/targets";
import { renderLoopChainReview } from "./freehand/correction";
import type {
  FreehandExerciseConfig,
  FreehandPoint,
  FreehandTarget,
  FreehandResult,
  LoopChainScoredResult,
} from "./freehand/types";
import type { AppState, ListFilterState } from "../app/state";

export type MountableExercise = ExerciseDefinition & {
  mount(
    root: HTMLElement,
    source: "direct" | "auto" | "curriculum",
    onNavigate: (next: AppState) => void,
    listState?: ListFilterState,
  ): () => void;
};

type FreehandKind = FreehandExerciseDefinition["kind"];

function freehandConfig(
  exercise: FreehandExerciseDefinition,
): FreehandExerciseConfig {
  const config = FREEHAND_CONFIGS[exercise.kind];
  const configWithTarget =
    exercise.kind.startsWith("angle-copy-")
      ? {
          ...config,
          createTarget: () =>
            createFreehandTarget(exercise.kind, {
              angleOpeningBucket: selectAngleOpeningBucket(
                getStoredProgress(),
                exercise.id,
              ),
            }),
        }
      : config;
  if (exercise.inputMode === "unlimited-strokes") {
    return {
      ...configWithTarget,
      readyText: "Draw a ray. Redraw freely before committing.",
      promptText: "Draw the missing ray; commit when it looks right.",
    };
  }
  if (
    exercise.inputMode === "adjustable-line" ||
    exercise.inputMode === "adjustable-line-1-shot"
  ) {
    return {
      ...configWithTarget,
      readyText: "Drag the free end of the vertical segment.",
      promptText:
        exercise.inputMode === "adjustable-line-1-shot"
          ? "Drag the free end of the segment once."
          : "Drag the free end of the segment; commit when it looks right.",
      canvasLabel: "Angle copy adjustable line field",
    };
  }
  return configWithTarget;
}

const FREEHAND_CONFIGS = {
  "freehand-line": {
    isClosedShape: false,
    createTarget: () => null,
    scoreStroke: (points) => scoreFreehandLine(points),
    promptText: "Draw one straight line in the field.",
    readyText: "Use Pencil, touch, or mouse to draw one line.",
    retryText: "Stroke was too short. Draw a longer line.",
    canvasLabel: "Straight line drawing field",
  },
  "freehand-circle": {
    isClosedShape: true,
    createTarget: () => null,
    scoreStroke: (points) => scoreFreehandCircle(points),
    promptText: "Draw one circle in the field.",
    readyText: "Use Pencil, touch, or mouse to draw one circle.",
    retryText: "Stroke was too short. Draw a larger circle.",
    canvasLabel: "Circle drawing field",
  },
  "freehand-ellipse": {
    isClosedShape: true,
    createTarget: () => null,
    scoreStroke: (points) => scoreFreehandEllipse(points),
    promptText: "Draw one ellipse in the field.",
    readyText: "Use Pencil, touch, or mouse to draw one ellipse.",
    retryText: "Stroke was too short. Draw a larger ellipse.",
    canvasLabel: "Ellipse drawing field",
  },
  "target-line-two-points": {
    isClosedShape: false,
    createTarget: () => {
      const directional = getSettings().directionalLineGuides;
      return createFreehandTarget("target-line-two-points", {
        lineAngleBucket: directional
          ? selectLineAngleBucket(getStoredProgress(), "target-line-two-points")
          : undefined,
        showDirectionCue: directional,
      });
    },
    scoreStroke: (points: FreehandPoint[], target: FreehandTarget | null) =>
      target?.kind === "line"
        ? scoreTargetLine(points, target, {
            requireDirection: getSettings().directionalLineGuides,
          })
        : null,
    promptText: "Draw one straight line connecting the two marks.",
    readyText: "Use Pencil, touch, or mouse to connect the two marks.",
    retryText: "Stroke was too short. Connect the two marks.",
    canvasLabel: "Straight line drawing field",
  },
  "target-circle-center-point": {
    isClosedShape: true,
    createTarget: () => createFreehandTarget("target-circle-center-point"),
    scoreStroke: (points: FreehandPoint[], target: FreehandTarget | null) =>
      target?.kind === "circle" ? scoreTargetCircle(points, target) : null,
    promptText: "Draw a circle using the center and radius point.",
    readyText: "Use Pencil, touch, or mouse to draw the target circle.",
    retryText: "Stroke was too short. Draw a larger circle.",
    canvasLabel: "Circle drawing field",
  },
  "target-circle-three-points": {
    isClosedShape: true,
    createTarget: () => createFreehandTarget("target-circle-three-points"),
    scoreStroke: (points: FreehandPoint[], target: FreehandTarget | null) =>
      target?.kind === "circle" ? scoreTargetCircle(points, target) : null,
    promptText: "Draw a circle through the three marks.",
    readyText: "Use Pencil, touch, or mouse to pass through the three marks.",
    retryText: "Stroke was too short. Draw a larger circle.",
    canvasLabel: "Circle drawing field",
  },
  "trace-line": {
    isClosedShape: false,
    createTarget: () => {
      const directional = getSettings().directionalLineGuides;
      return createFreehandTarget("trace-line", {
        lineAngleBucket: directional
          ? selectLineAngleBucket(getStoredProgress(), "trace-line")
          : undefined,
        showDirectionCue: directional,
      });
    },
    scoreStroke: (points: FreehandPoint[], target: FreehandTarget | null) =>
      target?.kind === "line"
        ? scoreTargetLine(points, target, {
            requireDirection: getSettings().directionalLineGuides,
          })
        : null,
    promptText: "Trace the faint straight guide.",
    readyText: "Use Pencil, touch, or mouse to trace the faint guide.",
    retryText: "Stroke was too short. Trace more of the line.",
    canvasLabel: "Straight line drawing field",
  },
  "trace-circle": {
    isClosedShape: true,
    createTarget: () => createFreehandTarget("trace-circle"),
    scoreStroke: (points: FreehandPoint[], target: FreehandTarget | null) =>
      target?.kind === "circle" ? scoreTargetCircle(points, target) : null,
    promptText: "Trace the faint circle guide.",
    readyText: "Use Pencil, touch, or mouse to trace the faint guide.",
    retryText: "Stroke was too short. Draw a larger circle.",
    canvasLabel: "Circle drawing field",
  },
  "trace-ellipse": {
    isClosedShape: true,
    createTarget: () => createFreehandTarget("trace-ellipse"),
    scoreStroke: (points: FreehandPoint[], target: FreehandTarget | null) =>
      target?.kind === "ellipse" ? scoreTargetEllipse(points, target) : null,
    promptText: "Trace the faint ellipse guide.",
    readyText: "Use Pencil, touch, or mouse to trace the faint guide.",
    retryText: "Stroke was too short. Draw a larger ellipse.",
    canvasLabel: "Ellipse drawing field",
  },
  "angle-copy-horizontal-aligned": angleCopyConfig(
    "angle-copy-horizontal-aligned",
  ),
  "angle-copy-vertical-aligned": angleCopyConfig("angle-copy-vertical-aligned"),
  "angle-copy-horizontal-rotated": angleCopyConfig(
    "angle-copy-horizontal-rotated",
  ),
  "angle-copy-vertical-rotated": angleCopyConfig("angle-copy-vertical-rotated"),
  "angle-copy-arbitrary-aligned": angleCopyConfig(
    "angle-copy-arbitrary-aligned",
  ),
  "angle-copy-arbitrary-rotated": angleCopyConfig(
    "angle-copy-arbitrary-rotated",
  ),
  "loop-chain-freehand": {
    isClosedShape: false,
    createTarget: () => null,
    scoreStroke: (points: FreehandPoint[]) => scoreLoopChainFreehand(points),
    promptText: "Draw a continuous chain of small loops across the canvas.",
    readyText: "Use Pencil, touch, or mouse to draw looping chains.",
    retryText: "Stroke was too short. Draw a longer looping chain.",
    canvasLabel: "Loop chain drawing field",
  },
  "loop-chain-linear": {
    isClosedShape: false,
    createTarget: () => createLoopChainLinearTarget(),
    scoreStroke: (points: FreehandPoint[], target: FreehandTarget | null) =>
      target?.kind === "loop-chain-linear"
        ? scoreLoopChainLinear(points, target)
        : null,
    promptText:
      "Draw a chain of loops between the guide lines. Touch both edges and stay consistent.",
    readyText:
      "Use Pencil, touch, or mouse to draw looping chains inside the band.",
    retryText: "Stroke was too short. Draw a longer looping chain.",
    canvasLabel: "Loop chain linear drawing field",
    renderCorrection: (_layer: SVGGElement, result: FreehandResult) => {
      if (result.kind !== "loop-chain-scored") return;
      renderLoopChainReview(_layer, result as LoopChainScoredResult);
    },
  },
  "loop-chain-linear-scored": {
    isClosedShape: false,
    createTarget: () => createLoopChainLinearTarget(),
    scoreStroke: (points: FreehandPoint[], target: FreehandTarget | null) =>
      target?.kind === "loop-chain-linear"
        ? scoreLoopChainLinear(points, target)
        : null,
    promptText:
      "Draw a chain of loops between the guide lines. Stay consistent.",
    readyText:
      "Use Pencil, touch, or mouse to draw looping chains inside the band.",
    retryText: "Stroke was too short. Draw a longer looping chain.",
    canvasLabel: "Loop chain linear scored drawing field",
    renderCorrection: (_layer: SVGGElement, result: FreehandResult) => {
      if (result.kind !== "loop-chain-scored") return;
      renderLoopChainReview(_layer, result as LoopChainScoredResult);
    },
  },
  "loop-chain-circular": {
    isClosedShape: false,
    createTarget: () => createLoopChainCircularTarget(),
    scoreStroke: (points: FreehandPoint[], target: FreehandTarget | null) =>
      target?.kind === "loop-chain-circular"
        ? scoreLoopChainCircular(points, target)
        : null,
    promptText:
      "Draw a chain of loops following the circular band. Touch both ring edges and stay consistent.",
    readyText:
      "Use Pencil, touch, or mouse to draw looping chains inside the ring.",
    retryText: "Stroke was too short. Draw a longer looping chain.",
    canvasLabel: "Loop chain circular drawing field",
    renderCorrection: (_layer: SVGGElement, result: FreehandResult) => {
      if (result.kind !== "loop-chain-scored") return;
      renderLoopChainReview(_layer, result as LoopChainScoredResult);
    },
  },
  "loop-chain-circular-scored": {
    isClosedShape: false,
    createTarget: () => createLoopChainCircularTarget(),
    scoreStroke: (points: FreehandPoint[], target: FreehandTarget | null) =>
      target?.kind === "loop-chain-circular"
        ? scoreLoopChainCircular(points, target)
        : null,
    promptText:
      "Draw a chain of loops following the circular guide. Stay consistent.",
    readyText:
      "Use Pencil, touch, or mouse to draw looping chains inside the ring.",
    retryText: "Stroke was too short. Draw a longer looping chain.",
    canvasLabel: "Loop chain circular scored drawing field",
    renderCorrection: (_layer: SVGGElement, result: FreehandResult) => {
      if (result.kind !== "loop-chain-scored") return;
      renderLoopChainReview(_layer, result as LoopChainScoredResult);
    },
  },
  "loop-chain-wedge": {
    isClosedShape: false,
    createTarget: () => createLoopChainWedgeTarget(),
    scoreStroke: (points: FreehandPoint[], target: FreehandTarget | null) =>
      target?.kind === "loop-chain-wedge"
        ? scoreLoopChainWedge(points, target)
        : null,
    promptText:
      "Draw a chain of loops between the wedge guides. Touch both edges and stay consistent.",
    readyText:
      "Use Pencil, touch, or mouse to draw looping chains inside the wedge.",
    retryText: "Stroke was too short. Draw a longer looping chain.",
    canvasLabel: "Loop chain wedge drawing field",
    renderCorrection: (_layer: SVGGElement, result: FreehandResult) => {
      if (result.kind !== "loop-chain-scored") return;
      renderLoopChainReview(_layer, result as LoopChainScoredResult);
    },
  },
  "trace-spiral-archimedean-right": {
    isClosedShape: false,
    createTarget: () => createFreehandTarget("trace-spiral-archimedean-right"),
    scoreStroke: (points: FreehandPoint[], target: FreehandTarget | null) =>
      target?.kind === "spiral" ? scoreTraceSpiral(points, target) : null,
    promptText: "Trace the faint right-winding Archimedean spiral.",
    readyText: "Use Pencil, touch, or mouse to trace the faint spiral guide.",
    retryText: "Stroke was too short. Trace more of the spiral.",
    canvasLabel: "Archimedean spiral tracing field",
  },
  "trace-spiral-archimedean-left": {
    isClosedShape: false,
    createTarget: () => createFreehandTarget("trace-spiral-archimedean-left"),
    scoreStroke: (points: FreehandPoint[], target: FreehandTarget | null) =>
      target?.kind === "spiral" ? scoreTraceSpiral(points, target) : null,
    promptText: "Trace the faint left-winding Archimedean spiral.",
    readyText: "Use Pencil, touch, or mouse to trace the faint spiral guide.",
    retryText: "Stroke was too short. Trace more of the spiral.",
    canvasLabel: "Archimedean spiral tracing field",
  },
  "trace-spiral-logarithmic-right": {
    isClosedShape: false,
    createTarget: () => createFreehandTarget("trace-spiral-logarithmic-right"),
    scoreStroke: (points: FreehandPoint[], target: FreehandTarget | null) =>
      target?.kind === "spiral" ? scoreTraceSpiral(points, target) : null,
    promptText: "Trace the faint right-winding logarithmic spiral.",
    readyText: "Use Pencil, touch, or mouse to trace the faint spiral guide.",
    retryText: "Stroke was too short. Trace more of the spiral.",
    canvasLabel: "Logarithmic spiral tracing field",
  },
  "trace-spiral-logarithmic-left": {
    isClosedShape: false,
    createTarget: () => createFreehandTarget("trace-spiral-logarithmic-left"),
    scoreStroke: (points: FreehandPoint[], target: FreehandTarget | null) =>
      target?.kind === "spiral" ? scoreTraceSpiral(points, target) : null,
    promptText: "Trace the faint left-winding logarithmic spiral.",
    readyText: "Use Pencil, touch, or mouse to trace the faint spiral guide.",
    retryText: "Stroke was too short. Trace more of the spiral.",
    canvasLabel: "Logarithmic spiral tracing field",
  },
  "loop-chain-wedge-scored": {
    isClosedShape: false,
    createTarget: () => createLoopChainWedgeTarget(),
    scoreStroke: (points: FreehandPoint[], target: FreehandTarget | null) =>
      target?.kind === "loop-chain-wedge"
        ? scoreLoopChainWedge(points, target)
        : null,
    promptText:
      "Draw a chain of loops between the wedge guides. Stay consistent.",
    readyText:
      "Use Pencil, touch, or mouse to draw looping chains inside the wedge.",
    retryText: "Stroke was too short. Draw a longer looping chain.",
    canvasLabel: "Loop chain wedge scored drawing field",
    renderCorrection: (_layer: SVGGElement, result: FreehandResult) => {
      if (result.kind !== "loop-chain-scored") return;
      renderLoopChainReview(_layer, result as LoopChainScoredResult);
    },
  },
} satisfies Record<FreehandKind, FreehandExerciseConfig>;

function angleCopyConfig(
  kind: Extract<FreehandKind, `angle-copy-${string}`>,
): FreehandExerciseConfig {
  return {
    isClosedShape: false,
    createTarget: () => createFreehandTarget(kind),
    scoreStroke: (points: FreehandPoint[], target: FreehandTarget | null) =>
      target?.kind === "angle" ? scoreTargetAngle(points, target) : null,
    promptText: "Draw the missing ray from the target vertex.",
    readyText: "Start near the target vertex and draw one ray.",
    retryText: "Start closer to the target vertex and draw a longer ray.",
    canvasLabel: "Angle copy drawing field",
  };
}

function toMountable(exercise: ExerciseDefinition): MountableExercise {
  if (!exercise.implemented) {
    return {
      ...exercise,
      mount(_root, _source, onNavigate, listState) {
        console.error(
          `Exercise "${exercise.id}" is not implemented; falling back to list.`,
        );
        queueMicrotask(() => onNavigate({ screen: "list", listState }));
        return () => {};
      },
    };
  }

  if (exercise.kind === "single-mark") {
    return {
      ...exercise,
      mount(root, source, onNavigate, listState) {
        return mountSingleMarkScreen(
          root,
          exercise,
          source,
          onNavigate,
          listState,
        );
      },
    };
  }

  if (isSolidExercise(exercise)) {
    return {
      ...exercise,
      mount(root, source, onNavigate, listState) {
        return mountSolidsScreen(root, exercise, source, onNavigate, listState);
      },
    };
  }

  const config = freehandConfig(exercise);
  return {
    ...exercise,
    mount(root, source, onNavigate, listState) {
      return mountFreehandScreen(
        root,
        exercise,
        config,
        source,
        onNavigate,
        listState,
      );
    },
  };
}


export const MOUNTABLE_EXERCISES: MountableExercise[] =
  EXERCISES.map(toMountable);

const MOUNTABLE_MAP = new Map<ExerciseId, MountableExercise>(
  MOUNTABLE_EXERCISES.map((e) => [e.id, e]),
);

export function getMountableById(exerciseId: ExerciseId): MountableExercise {
  const exercise = MOUNTABLE_MAP.get(exerciseId);
  if (!exercise) {
    throw new Error(`Unknown exercise id: ${exerciseId}`);
  }
  return exercise;
}

export { getExerciseById, getAutoExercise, EXERCISES };
