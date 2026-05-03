import { describe, expect, it } from "vitest";
import { EXERCISES } from "./catalog";
import {
  CURRICULUM_GROUPS,
  curriculumExerciseIds,
  validateCurriculumConfig,
} from "./curriculum";

describe("curriculum config", () => {
  it("references only implemented exercises", () => {
    expect(validateCurriculumConfig()).toEqual([]);
  });

  it("keeps the first curriculum slice explicit", () => {
    expect(CURRICULUM_GROUPS.map((group) => group.title)).toEqual([
      "Division",
      "Length",
      "Angle",
      "Intersection",
      "Straight Line Drawing",
    ]);
  });

  it("does not include 1-shot variants", () => {
    expect(curriculumExerciseIds().some((id) => id.endsWith("-1-shot"))).toBe(
      false,
    );
  });

  it("uses known catalog ids", () => {
    const knownIds = new Set(EXERCISES.map((exercise) => exercise.id));
    expect(curriculumExerciseIds().every((id) => knownIds.has(id))).toBe(true);
  });
});
