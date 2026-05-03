import { beforeEach, describe, expect, it, vi } from "vitest";

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    for (const key of Object.keys(store)) delete store[key];
  }),
};

vi.stubGlobal("window", { localStorage: localStorageMock });

import {
  _resetCurriculumStatsCache,
  aggregateCurriculumSummaries,
  curriculumSummaryForExercise,
  curriculumSummaryForExercises,
  getCurriculumStatsStore,
  recordCurriculumActiveTime,
  recordCurriculumCompletion,
} from "./curriculumStats";

const STORAGE_KEY = "draftsman-eye.curriculum-stats.v1";

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
  _resetCurriculumStatsCache();
});

describe("curriculum stats storage", () => {
  it("falls back to an empty store for malformed payloads", () => {
    store[STORAGE_KEY] = "{bad";
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(getCurriculumStatsStore()).toEqual({ version: 1, days: {} });
    expect(consoleSpy).toHaveBeenCalledOnce();

    consoleSpy.mockRestore();
  });

  it("updates daily active time and executions", () => {
    const now = new Date(2026, 4, 3, 10);

    recordCurriculumActiveTime("division-horizontal-halves", 12.2, now);
    recordCurriculumActiveTime("division-horizontal-halves", 3.1, now);
    recordCurriculumCompletion("division-horizontal-halves", 80, 70, now);
    recordCurriculumCompletion("division-horizontal-halves", 83, 80, now);

    const summary = curriculumSummaryForExercise(
      getCurriculumStatsStore(),
      "division-horizontal-halves",
      now,
    );
    expect(summary.activeSecondsToday).toBe(15);
    expect(summary.executionsToday).toBe(2);
    expect(summary.scoreDeltaTodayPercent).toBe(13);
  });

  it("averages the last seven calendar days over practiced days only", () => {
    recordCurriculumActiveTime(
      "division-horizontal-halves",
      30,
      new Date(2026, 3, 29),
    );
    recordCurriculumCompletion(
      "division-horizontal-halves",
      70,
      undefined,
      new Date(2026, 3, 29),
    );
    recordCurriculumActiveTime(
      "division-horizontal-halves",
      90,
      new Date(2026, 4, 3),
    );
    recordCurriculumCompletion(
      "division-horizontal-halves",
      82,
      76,
      new Date(2026, 4, 3),
    );

    const summary = curriculumSummaryForExercise(
      getCurriculumStatsStore(),
      "division-horizontal-halves",
      new Date(2026, 4, 3),
    );
    expect(summary.practicedDays7).toBe(2);
    expect(summary.averageActiveSeconds7Days).toBe(60);
    expect(summary.averageExecutions7Days).toBe(1);
    expect(summary.scoreDelta7DaysPercent).toBe(12);
  });

  it("aggregates count-like stats by sum and score deltas by average", () => {
    const aggregate = aggregateCurriculumSummaries([
      {
        activeSecondsToday: 20,
        executionsToday: 1,
        averageActiveSeconds7Days: 20,
        averageExecutions7Days: 1,
        practicedDays7: 1,
        scoreDeltaTodayPercent: 10,
        scoreDelta7DaysPercent: 6,
      },
      {
        activeSecondsToday: 40,
        executionsToday: 2,
        averageActiveSeconds7Days: 30,
        averageExecutions7Days: 1.5,
        practicedDays7: 3,
        scoreDeltaTodayPercent: null,
        scoreDelta7DaysPercent: 2,
      },
    ]);

    expect(aggregate.activeSecondsToday).toBe(60);
    expect(aggregate.executionsToday).toBe(3);
    expect(aggregate.averageActiveSeconds7Days).toBe(50);
    expect(aggregate.averageExecutions7Days).toBe(2.5);
    expect(aggregate.practicedDays7).toBe(3);
    expect(aggregate.scoreDeltaTodayPercent).toBe(10);
    expect(aggregate.scoreDelta7DaysPercent).toBe(4);
  });

  it("aggregates multiple exercises by practiced-day union", () => {
    recordCurriculumActiveTime(
      "division-horizontal-halves",
      30,
      new Date(2026, 3, 29),
    );
    recordCurriculumActiveTime(
      "division-horizontal-thirds",
      90,
      new Date(2026, 4, 3),
    );

    const summary = curriculumSummaryForExercises(
      getCurriculumStatsStore(),
      ["division-horizontal-halves", "division-horizontal-thirds"],
      new Date(2026, 4, 3),
    );

    expect(summary.practicedDays7).toBe(2);
    expect(summary.averageActiveSeconds7Days).toBe(60);
  });
});
