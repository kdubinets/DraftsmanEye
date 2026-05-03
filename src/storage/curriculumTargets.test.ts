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
  _resetCurriculumTargetsCache,
  dailyTargetMinutesForGroup,
  getCurriculumTargetsStore,
  setDailyTargetMinutesForGroup,
} from "./curriculumTargets";

const STORAGE_KEY = "draftsman-eye.curriculum-targets.v1";

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
  _resetCurriculumTargetsCache();
});

describe("curriculum target storage", () => {
  it("falls back to an empty store for malformed payloads", () => {
    store[STORAGE_KEY] = JSON.stringify({
      version: 1,
      dailyMinutesByGroupId: { division: -1 },
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(getCurriculumTargetsStore()).toEqual({
      version: 1,
      dailyMinutesByGroupId: {},
    });
    expect(consoleSpy).toHaveBeenCalledOnce();

    consoleSpy.mockRestore();
  });

  it("persists rounded positive target minutes by group", () => {
    setDailyTargetMinutesForGroup("division", 12.4);

    expect(dailyTargetMinutesForGroup("division")).toBe(12);
    expect(JSON.parse(store[STORAGE_KEY] ?? "{}")).toMatchObject({
      dailyMinutesByGroupId: { division: 12 },
    });
  });

  it("clears a target when the value is blank or zero-equivalent", () => {
    setDailyTargetMinutesForGroup("division", 15);
    setDailyTargetMinutesForGroup("division", null);

    expect(dailyTargetMinutesForGroup("division")).toBeNull();
    expect(JSON.parse(store[STORAGE_KEY] ?? "{}")).toMatchObject({
      dailyMinutesByGroupId: {},
    });
  });
});
