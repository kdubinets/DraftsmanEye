/** Explicit curriculum hierarchy for the structured practice page. */
import { EXERCISES, type ExerciseId } from "./catalog";

export type CurriculumStage = {
  id: string;
  label: string;
  title: string;
  exerciseIds: ExerciseId[];
};

export type CurriculumGroup = {
  id: string;
  title: string;
  stages?: CurriculumStage[];
  exerciseIds?: ExerciseId[];
};

export const CURRICULUM_GROUPS: CurriculumGroup[] = [
  {
    id: "division",
    title: "Division",
    stages: [
      {
        id: "horizontal",
        label: "H",
        title: "Horizontal",
        exerciseIds: [
          "division-horizontal-halves",
          "division-horizontal-thirds",
          "division-horizontal-quarters",
          "division-horizontal-fifths",
        ],
      },
      {
        id: "vertical",
        label: "V",
        title: "Vertical",
        exerciseIds: [
          "division-vertical-halves",
          "division-vertical-thirds",
          "division-vertical-quarters",
          "division-vertical-fifths",
        ],
      },
      {
        id: "random",
        label: "Random",
        title: "Random",
        exerciseIds: [
          "division-random-halves",
          "division-random-thirds",
          "division-random-quarters",
          "division-random-fifths",
        ],
      },
    ],
  },
  {
    id: "length",
    title: "Length",
    stages: [
      {
        id: "copy-1-1-horizontal",
        label: "1:1 H",
        title: "1 to 1 Horizontal",
        exerciseIds: ["copy-horizontal-horizontal"],
      },
      {
        id: "copy-1-1-horizontal-vertical",
        label: "1:1 H+V",
        title: "1 to 1 Horizontal plus 1 to 1 Vertical",
        exerciseIds: ["copy-horizontal-horizontal", "copy-vertical-vertical"],
      },
      {
        id: "copy-1-1-random",
        label: "1:1 Rand",
        title: "1 to 1 Random",
        exerciseIds: ["copy-random-random"],
      },
      {
        id: "copy-1-1-random-double-horizontal",
        label: "1:1 + 1:2 H",
        title: "1 to 1 Random plus 1 to 2 Horizontal",
        exerciseIds: ["copy-random-random", "double-horizontal-horizontal"],
      },
      {
        id: "copy-1-1-random-double-horizontal-vertical",
        label: "1:1 + 1:2 H+V",
        title: "1 to 1 Random plus 1 to 2 Horizontal plus 1 to 2 Vertical",
        exerciseIds: [
          "copy-random-random",
          "double-horizontal-horizontal",
          "double-vertical-vertical",
        ],
      },
      {
        id: "copy-1-1-random-double-random",
        label: "1:1 + 1:2 Rand",
        title: "1 to 1 Random plus 1 to 2 Random",
        exerciseIds: ["copy-random-random", "double-random-random"],
      },
    ],
  },
  {
    id: "angle",
    title: "Angle",
    stages: [
      {
        id: "aligned",
        label: "Aligned",
        title: "Aligned",
        exerciseIds: [
          "angle-copy-horizontal-aligned",
          "angle-copy-vertical-aligned",
          "angle-copy-arbitrary-aligned",
        ],
      },
      {
        id: "aligned-rotated",
        label: "Aligned + Rotated",
        title: "Aligned plus Rotated",
        exerciseIds: [
          "angle-copy-horizontal-aligned",
          "angle-copy-vertical-aligned",
          "angle-copy-arbitrary-aligned",
          "angle-copy-horizontal-rotated",
          "angle-copy-vertical-rotated",
        ],
      },
      {
        id: "aligned-random",
        label: "Aligned + Random",
        title: "Aligned plus Random",
        exerciseIds: [
          "angle-copy-horizontal-aligned",
          "angle-copy-vertical-aligned",
          "angle-copy-arbitrary-aligned",
          "angle-copy-horizontal-rotated",
          "angle-copy-vertical-rotated",
          "angle-copy-arbitrary-rotated",
        ],
      },
    ],
  },
  {
    id: "intersection",
    title: "Intersection",
    exerciseIds: ["intersection-random", "intersection-extrapolated"],
  },
  {
    id: "straight-line",
    title: "Straight Line Drawing",
    stages: [
      {
        id: "free",
        label: "Free",
        title: "Free drawing",
        exerciseIds: ["freehand-straight-line"],
      },
      {
        id: "trace",
        label: "Trace",
        title: "Trace",
        exerciseIds: ["trace-line"],
      },
      {
        id: "target",
        label: "Target",
        title: "Target",
        exerciseIds: ["target-line-two-points"],
      },
    ],
  },
];

const IMPLEMENTED_IDS = new Set(
  EXERCISES.filter((exercise) => exercise.implemented).map(
    (exercise) => exercise.id,
  ),
);

export function curriculumExerciseIds(): ExerciseId[] {
  const ids: ExerciseId[] = [];
  for (const group of CURRICULUM_GROUPS) {
    ids.push(...exerciseIdsForGroup(group));
  }
  return Array.from(new Set(ids));
}

export function exerciseIdsForGroup(group: CurriculumGroup): ExerciseId[] {
  if (group.exerciseIds) return group.exerciseIds;
  return Array.from(
    new Set(group.stages?.flatMap((stage) => stage.exerciseIds) ?? []),
  );
}

export function validateCurriculumConfig(): string[] {
  const errors: string[] = [];
  for (const group of CURRICULUM_GROUPS) {
    for (const id of exerciseIdsForGroup(group)) {
      if (!IMPLEMENTED_IDS.has(id)) {
        errors.push(`${group.id} references missing or unimplemented ${id}`);
      }
    }
  }
  return errors;
}
