import { describe, it, expect } from "vitest";
import { EXERCISES, getExerciseById, getAutoExercise } from "./catalog";
import type { ExerciseId, SingleMarkExerciseDefinition } from "./catalog";
import type { ProgressStore } from "../storage/progress";

function emptyProgress(): ProgressStore {
  return { version: 2, attempts: [], aggregates: {} };
}

describe("EXERCISES registry", () => {
  it("every id is reachable via getExerciseById", () => {
    for (const ex of EXERCISES) {
      expect(() => getExerciseById(ex.id)).not.toThrow();
      expect(getExerciseById(ex.id).id).toBe(ex.id);
    }
  });

  it("getExerciseById throws for unknown id", () => {
    expect(() => getExerciseById("not-a-real-id" as ExerciseId)).toThrow();
  });

  it("no duplicate ids", () => {
    const ids = EXERCISES.map((e) => e.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("every exercise id begins with its family slug", () => {
    const familyToPrefix: Record<string, string> = {
      Division: "division-",
      "Freehand Control": "freehand-",
      "Target Drawing": "target-",
      "Trace Control": "trace-",
      "Angle Copy": "angle-copy-",
      Intersection: "intersection-",
    };
    for (const ex of EXERCISES) {
      const prefix = familyToPrefix[ex.family];
      if (prefix !== undefined) {
        expect(ex.id).toMatch(new RegExp(`^${prefix}`));
      }
    }
  });
});

describe("getAutoExercise", () => {
  it("with empty progress returns a deterministic first pick", () => {
    const first = getAutoExercise(emptyProgress());
    const second = getAutoExercise(emptyProgress());
    expect(first.exercise.id).toBe(second.exercise.id);
  });

  it("only returns implemented drills", () => {
    const { exercise } = getAutoExercise(emptyProgress());
    expect(exercise.implemented).toBe(true);
  });

  it("never returns an unimplemented drill even if given low-score progress for it", () => {
    const notImplemented = EXERCISES.find((e) => !e.implemented);
    if (!notImplemented) return; // all implemented — skip

    const progress: ProgressStore = {
      version: 2,
      attempts: [],
      aggregates: {
        [notImplemented.id]: { ema: 0, attempts: 0, lastPracticedAt: 0 },
      },
    };
    const { exercise } = getAutoExercise(progress);
    expect(exercise.implemented).toBe(true);
    expect(exercise.id).not.toBe(notImplemented.id);
  });

  it("picks a never-played drill over a recently-played one with a higher score", () => {
    const implemented = EXERCISES.filter((e) => e.implemented);
    const recentMs = Date.now() - 5 * 60 * 1000; // 5 min ago
    const aggregates: ProgressStore["aggregates"] = {};
    for (const ex of implemented.slice(0, -1)) {
      aggregates[ex.id] = { ema: 90, attempts: 5, lastPracticedAt: recentMs };
    }
    // Last drill has never been played — no entry
    const neverPlayed = implemented[implemented.length - 1];
    const progress: ProgressStore = { version: 2, attempts: [], aggregates };
    const { exercise } = getAutoExercise(progress);
    expect(exercise.id).toBe(neverPlayed.id);
  });

  it("picks the drill with the lowest EMA when all were practiced equally long ago", () => {
    const implemented = EXERCISES.filter((e) => e.implemented);
    const oldMs = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days ago
    const aggregates: ProgressStore["aggregates"] = {};
    for (const ex of implemented) {
      aggregates[ex.id] = { ema: 80, attempts: 5, lastPracticedAt: oldMs };
    }
    const weakDrill = implemented[3];
    aggregates[weakDrill.id] = { ema: 10, attempts: 5, lastPracticedAt: oldMs };

    const progress: ProgressStore = { version: 2, attempts: [], aggregates };
    const { exercise } = getAutoExercise(progress);
    expect(exercise.id).toBe(weakDrill.id);
  });

  it("returns a non-empty reason string", () => {
    const { reason } = getAutoExercise(emptyProgress());
    expect(typeof reason).toBe("string");
    expect(reason.length).toBeGreaterThan(0);
  });

  it("tie-break is stable: same result on repeated calls with equal progress", () => {
    const implemented = EXERCISES.filter((e) => e.implemented);
    const oldMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const aggregates: ProgressStore["aggregates"] = {};
    for (const ex of implemented) {
      aggregates[ex.id] = { ema: 75, attempts: 3, lastPracticedAt: oldMs };
    }
    const progress: ProgressStore = { version: 2, attempts: [], aggregates };
    const first = getAutoExercise(progress).exercise.id;
    const second = getAutoExercise(progress).exercise.id;
    // Tie-breaking must be deterministic (no randomness breaks it across calls
    // with identical inputs — jitter, if any, should be bounded enough that the
    // top pick is stable when all scores are equal)
    expect(first).toBe(second);
  });
});

describe("single-mark scoreSelection", () => {
  function singleMarkExercises(): SingleMarkExerciseDefinition[] {
    return EXERCISES.filter(
      (e): e is SingleMarkExerciseDefinition =>
        e.implemented && "createTrial" in e,
    );
  }

  it("placing above target (lower scalar on vertical axis) gives negative signedError", () => {
    const vertical = EXERCISES.find(
      (e): e is SingleMarkExerciseDefinition =>
        e.implemented &&
        "createTrial" in e &&
        e.id.startsWith("division-vertical-"),
    );
    if (!vertical) return;
    const trial = vertical.createTrial();
    // On a vertical axis, scalar is y. Placing above target = smaller y = negative signed error.
    // Force a placement above the midpoint (smaller scalar than target)
    const aboveTarget = trial.line.startScalar;
    const result = trial.scoreSelection(aboveTarget);
    expect(result.signedErrorPixels).toBeLessThan(0);
  });

  it("placing below target (larger scalar on vertical axis) gives positive signedError", () => {
    const vertical = EXERCISES.find(
      (e): e is SingleMarkExerciseDefinition =>
        e.implemented &&
        "createTrial" in e &&
        e.id.startsWith("division-vertical-"),
    );
    if (!vertical) return;
    const trial = vertical.createTrial();
    const result = trial.scoreSelection(trial.line.endScalar);
    expect(result.signedErrorPixels).toBeGreaterThan(0);
  });

  it('exact placement gives signedErrorPixels=0 and directionLabel="Exact"', () => {
    for (const ex of singleMarkExercises()) {
      const trial = ex.createTrial();
      // Compute where the target scalar is: score(placed) returns signedError=placed-target,
      // so target = placed - signedError. Find it by trial and binary search isn't needed —
      // we can derive it from two probe placements.
      const r0 = trial.scoreSelection(trial.line.startScalar);
      // target = startScalar - r0.signedErrorPixels
      const target = trial.line.startScalar - r0.signedErrorPixels;
      const exact = trial.scoreSelection(target);
      expect(exact.signedErrorPixels).toBe(0);
      expect(exact.directionLabel).toBe("Exact");
      break; // one exercise is sufficient to prove the invariant
    }
  });

  it("trial line endpoints stay within viewport bounds across many generations", () => {
    const horizontal = EXERCISES.find(
      (e): e is SingleMarkExerciseDefinition =>
        e.implemented &&
        "createTrial" in e &&
        e.id.startsWith("division-horizontal-"),
    )!;
    for (let i = 0; i < 200; i++) {
      const trial = horizontal.createTrial();
      const { startScalar, endScalar, anchorY } = trial.line;
      expect(startScalar).toBeGreaterThanOrEqual(0);
      expect(endScalar).toBeLessThanOrEqual(trial.viewport.width);
      expect(anchorY).toBeGreaterThanOrEqual(0);
      expect(anchorY).toBeLessThanOrEqual(trial.viewport.height);
    }
  });

  it("transfer drills include a separate reference segment and anchor on the guide", () => {
    const transfer = EXERCISES.filter(
      (e): e is SingleMarkExerciseDefinition =>
        e.implemented &&
        "createTrial" in e &&
        (e.id.startsWith("copy-") || e.id.startsWith("double-")),
    );
    expect(transfer).toHaveLength(20);

    for (const ex of transfer) {
      const trial = ex.createTrial();
      expect(trial.referenceLine).toBeDefined();
      expect(trial.anchorScalar).toBeDefined();
      expect(
        trial.anchorDirectionSign === -1 || trial.anchorDirectionSign === 1,
      ).toBe(true);
      expect(trial.line.showEndpointTicks).toBe(false);

      const probe = trial.scoreSelection(trial.line.startScalar);
      const target = trial.line.startScalar - probe.signedErrorPixels;
      expect(target).toBeCloseTo(
        trial.anchorScalar! +
          trial.anchorDirectionSign! *
            (trial.referenceLine!.endScalar -
              trial.referenceLine!.startScalar) *
            (ex.id.startsWith("double-") ? 2 : 1),
      );
      expect(target).toBeLessThanOrEqual(trial.line.endScalar);
      expect(target).toBeGreaterThanOrEqual(trial.line.startScalar);
    }
  });

  it("division drills include an indicated end and random variants use free lines", () => {
    const division = EXERCISES.filter(
      (e): e is SingleMarkExerciseDefinition =>
        e.implemented && "createTrial" in e && e.id.startsWith("division-"),
    );
    expect(division).toHaveLength(24);

    for (const ex of division) {
      const trial = ex.createTrial();
      if (ex.id.includes("-halves")) {
        expect(trial.anchorScalar).toBeUndefined();
        expect(trial.anchorDirectionSign).toBeUndefined();
      } else {
        expect(trial.anchorScalar).toBeDefined();
        expect(
          trial.anchorDirectionSign === -1 || trial.anchorDirectionSign === 1,
        ).toBe(true);
      }
      if (ex.id.startsWith("division-random-")) {
        expect(trial.line.axis).toBe("free");
        expect(trial.line.startPoint).toBeDefined();
        expect(trial.line.endPoint).toBeDefined();
      }
    }
  });

  it("transfer drills randomly include both guide directions", () => {
    const drill = EXERCISES.find(
      (e): e is SingleMarkExerciseDefinition =>
        e.id === "copy-horizontal-horizontal" &&
        e.implemented &&
        "createTrial" in e,
    )!;
    const seen = new Set<number>();
    for (let i = 0; i < 100; i += 1) {
      seen.add(drill.createTrial().anchorDirectionSign!);
    }
    expect(seen.has(-1)).toBe(true);
    expect(seen.has(1)).toBe(true);
  });

  it("transfer reference endpoints are not aligned with guide anchor or target", () => {
    const transfer = EXERCISES.filter(
      (e): e is SingleMarkExerciseDefinition =>
        e.implemented &&
        "createTrial" in e &&
        (e.id.startsWith("copy-") || e.id.startsWith("double-")),
    );

    for (const ex of transfer) {
      for (let i = 0; i < 50; i += 1) {
        const trial = ex.createTrial();
        if (
          trial.referenceLine!.axis === "free" ||
          trial.line.axis === "free"
        ) {
          continue;
        }
        const reference = trial.referenceLine!;
        const probe = trial.scoreSelection(trial.line.startScalar);
        const target = trial.line.startScalar - probe.signedErrorPixels;
        const referenceScalars = [reference.startScalar, reference.endScalar];
        for (const scalar of referenceScalars) {
          expect(Math.abs(scalar - trial.anchorScalar!)).toBeGreaterThan(28);
          expect(Math.abs(scalar - target)).toBeGreaterThan(28);
        }
      }
    }
  });

  it("double drills score relative to doubled target distance", () => {
    const drill = EXERCISES.find(
      (e): e is SingleMarkExerciseDefinition =>
        e.id === "double-horizontal-horizontal" &&
        e.implemented &&
        "createTrial" in e,
    )!;
    const trial = drill.createTrial();
    const referenceLength =
      trial.referenceLine!.endScalar - trial.referenceLine!.startScalar;
    const target =
      trial.anchorScalar! + trial.anchorDirectionSign! * referenceLength * 2;
    const result = trial.scoreSelection(target + 10);
    expect(result.relativeErrorPercent).toBeCloseTo(
      (10 / (referenceLength * 2)) * 100,
    );
  });

  it("intersection drill uses a separate pointing segment and angle scoring", () => {
    const drill = EXERCISES.find(
      (e): e is SingleMarkExerciseDefinition =>
        e.id === "intersection-random" && e.implemented && "createTrial" in e,
    )!;

    for (let i = 0; i < 50; i += 1) {
      const trial = drill.createTrial();
      expect(trial.line.axis).toBe("free");
      expect(trial.projectionLine).toBeDefined();
      expect(trial.projectionOrigin).toBeDefined();
      expect(trial.line.endScalar - trial.line.startScalar).toBeGreaterThan(
        480,
      );
      expect(
        trial.projectionLine!.endScalar - trial.projectionLine!.startScalar,
      ).toBeLessThan(150);

      const probe = trial.scoreSelection(trial.line.startScalar);
      const target = trial.line.startScalar - probe.signedErrorPixels;
      expect(target).toBeGreaterThan(trial.line.startScalar + 70);
      expect(target).toBeLessThan(trial.line.endScalar - 70);

      const exact = trial.scoreSelection(target);
      expect(exact.angleErrorDegrees).toBeCloseTo(0, 10);
      expect(exact.relativeAccuracyPercent).toBe(100);
    }
  });

  it("intersection drills include default adjustment and 1-shot variants", () => {
    const intersection = EXERCISES.filter(
      (e): e is SingleMarkExerciseDefinition =>
        e.implemented && "createTrial" in e && e.id.startsWith("intersection-"),
    );

    expect(intersection.map((e) => e.id)).toEqual([
      "intersection-random",
      "intersection-random-1-shot",
      "intersection-extrapolated",
      "intersection-extrapolated-1-shot",
    ]);
    expect(
      intersection.filter((e) => e.inputMode === "unlimited-adjustment"),
    ).toHaveLength(2);
  });

  it("extrapolated intersection drill scores a free canvas point", () => {
    const drill = EXERCISES.find(
      (e): e is SingleMarkExerciseDefinition =>
        e.id === "intersection-extrapolated" &&
        e.implemented &&
        "createTrial" in e,
    )!;

    for (let i = 0; i < 50; i += 1) {
      const trial = drill.createTrial();
      expect(trial.scorePoint).toBeDefined();
      expect(trial.line.axis).toBe("free");
      expect(trial.projectionLine).toBeDefined();
      expect(trial.line.endScalar).toBeGreaterThan(140);
      expect(trial.projectionLine!.endScalar).toBeGreaterThan(140);

      const target = trial.projectionOrigin!;
      expect(target.x).toBeGreaterThanOrEqual(0);
      expect(target.x).toBeLessThanOrEqual(trial.viewport.width);
      expect(target.y).toBeGreaterThanOrEqual(0);
      expect(target.y).toBeLessThanOrEqual(trial.viewport.height);

      const exact = trial.scorePoint!(target);
      expect(exact).not.toBeNull();
      expect(exact!.distanceErrorPixels).toBe(0);
      expect(exact!.relativeAccuracyPercent).toBe(100);

      const near = trial.scorePoint!({ x: target.x + 12, y: target.y + 5 });
      expect(near).not.toBeNull();
      expect(near!.distanceErrorPixels).toBeCloseTo(13);

      const far = trial.scorePoint!({
        x: target.x + trial.viewport.width,
        y: target.y + trial.viewport.height,
      });
      expect(far).toBeNull();
    }
  });
});
