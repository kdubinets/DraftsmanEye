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
      "Straight Lines",
      "Circle / Ellipse / Loopy Figures",
    ]);
  });

  it("orders straight-line drawing from freehand through trace to target", () => {
    const group = CURRICULUM_GROUPS.find(
      (candidate) => candidate.id === "straight-lines",
    );
    expect(group?.stages?.map((stage) => stage.title)).toEqual([
      "Freehand straight lines",
      "Trace straight lines",
      "Target drawing through 2 points",
    ]);
    expect(group?.stages?.map((stage) => stage.exerciseIds)).toEqual([
      ["freehand-straight-line"],
      ["trace-line"],
      ["target-line-two-points"],
    ]);
  });

  it("groups circle, ellipse, loops, and spirals into the requested progression", () => {
    const group = CURRICULUM_GROUPS.find(
      (candidate) => candidate.id === "circle-ellipse-loops",
    );
    expect(group?.stages?.map((stage) => stage.exerciseIds)).toEqual([
      ["freehand-circle", "freehand-ellipse", "loop-chain-freehand"],
      [
        "trace-circle",
        "trace-ellipse",
        "loop-chain-linear",
        "loop-chain-circular",
        "loop-chain-wedge",
        "trace-spiral-archimedean-right",
        "trace-spiral-archimedean-left",
        "trace-spiral-logarithmic-right",
        "trace-spiral-logarithmic-left",
      ],
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
