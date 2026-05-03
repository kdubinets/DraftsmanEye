/** Local daily curriculum statistics and aggregation helpers. */
import type { ExerciseId } from "../practice/catalog";

export type CurriculumDailyEntry = {
  activeSeconds: number;
  executions: number;
  firstScoreEma?: number;
  latestScoreEma?: number;
};

export type CurriculumStatsStore = {
  version: 1;
  days: Record<string, Partial<Record<ExerciseId, CurriculumDailyEntry>>>;
};

export type CurriculumStatsSummary = {
  activeSecondsToday: number | null;
  executionsToday: number | null;
  averageActiveSeconds7Days: number | null;
  averageExecutions7Days: number | null;
  practicedDays7: number;
  scoreDeltaTodayPercent: number | null;
  scoreDelta7DaysPercent: number | null;
};

const STORAGE_KEY = "draftsman-eye.curriculum-stats.v1";
const DAY_MS = 24 * 60 * 60 * 1000;
let cache: CurriculumStatsStore | null = null;

export function _resetCurriculumStatsCache(): void {
  cache = null;
}

export function getCurriculumStatsStore(): CurriculumStatsStore {
  if (cache) return cache;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return (cache = emptyStore());
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isCurriculumStatsStore(parsed)) {
      console.error("Ignoring malformed curriculum stats payload.");
      return (cache = emptyStore());
    }
    return (cache = parsed);
  } catch (error) {
    console.error("Failed to parse curriculum stats.", error);
    return (cache = emptyStore());
  }
}

export function recordCurriculumCompletion(
  exerciseId: ExerciseId,
  latestScoreEma: number,
  previousScoreEma?: number,
  now = new Date(),
): CurriculumStatsStore {
  const dayKey = localDateKey(now);
  const store = getCurriculumStatsStore();
  const day = store.days[dayKey] ?? {};
  const previous = day[exerciseId] ?? emptyEntry();
  const firstScoreEma =
    previous.firstScoreEma ?? previousScoreEma ?? latestScoreEma;
  const nextEntry: CurriculumDailyEntry = {
    ...previous,
    executions: previous.executions + 1,
    firstScoreEma,
    latestScoreEma,
  };
  return persist({
    version: 1,
    days: {
      ...store.days,
      [dayKey]: { ...day, [exerciseId]: nextEntry },
    },
  });
}

export function recordCurriculumActiveTime(
  exerciseId: ExerciseId,
  activeSeconds: number,
  now = new Date(),
): CurriculumStatsStore {
  if (!Number.isFinite(activeSeconds) || activeSeconds <= 0) {
    return getCurriculumStatsStore();
  }
  const roundedSeconds = Math.max(1, Math.round(activeSeconds));
  const dayKey = localDateKey(now);
  const store = getCurriculumStatsStore();
  const day = store.days[dayKey] ?? {};
  const previous = day[exerciseId] ?? emptyEntry();
  const nextEntry: CurriculumDailyEntry = {
    ...previous,
    activeSeconds: previous.activeSeconds + roundedSeconds,
  };
  return persist({
    version: 1,
    days: {
      ...store.days,
      [dayKey]: { ...day, [exerciseId]: nextEntry },
    },
  });
}

export function curriculumSummaryForExercise(
  store: CurriculumStatsStore,
  exerciseId: ExerciseId,
  now = new Date(),
): CurriculumStatsSummary {
  return curriculumSummaryForExercises(store, [exerciseId], now);
}

export function curriculumSummaryForExercises(
  store: CurriculumStatsStore,
  exerciseIds: readonly ExerciseId[],
  now = new Date(),
): CurriculumStatsSummary {
  const todayKey = localDateKey(now);
  const windowKeys = lastCalendarDayKeys(now, 7);
  const daySummaries = windowKeys
    .map((key) => daySummaryForExercises(store, key, exerciseIds))
    .filter((summary) => summary.practiced);
  const today = daySummaryForExercises(store, todayKey, exerciseIds);
  const childDeltas = exerciseIds.map((id) =>
    curriculumSummaryForSingleExercise(store, id, now),
  );

  return {
    activeSecondsToday:
      today.activeSeconds > 0 ? today.activeSeconds : null,
    executionsToday: today.executions > 0 ? today.executions : null,
    averageActiveSeconds7Days:
      daySummaries.length === 0
        ? null
        : sum(daySummaries.map((entry) => entry.activeSeconds)) /
          daySummaries.length,
    averageExecutions7Days:
      daySummaries.length === 0
        ? null
        : sum(daySummaries.map((entry) => entry.executions)) /
          daySummaries.length,
    practicedDays7: daySummaries.length,
    scoreDeltaTodayPercent: nullableAverage(
      childDeltas.map((summary) => summary.scoreDeltaTodayPercent),
    ),
    scoreDelta7DaysPercent: nullableAverage(
      childDeltas.map((summary) => summary.scoreDelta7DaysPercent),
    ),
  };
}

export function calendarAverageActiveSecondsForExercises(
  store: CurriculumStatsStore,
  exerciseIds: readonly ExerciseId[],
  dayCount = 7,
  now = new Date(),
): number {
  const windowKeys = lastCalendarDayKeys(now, dayCount);
  return (
    sum(
      windowKeys.map(
        (key) => daySummaryForExercises(store, key, exerciseIds).activeSeconds,
      ),
    ) / dayCount
  );
}

function curriculumSummaryForSingleExercise(
  store: CurriculumStatsStore,
  exerciseId: ExerciseId,
  now: Date,
): CurriculumStatsSummary {
  const todayKey = localDateKey(now);
  const today = store.days[todayKey]?.[exerciseId];
  const windowKeys = lastCalendarDayKeys(now, 7);
  const practicedEntries = windowKeys
    .map((key) => store.days[key]?.[exerciseId])
    .filter(isPracticedEntry);
  const earliestScore = firstDefined(
    practicedEntries.map((entry) => entry.firstScoreEma),
  );
  const latestScore = lastDefined(
    practicedEntries.map((entry) => entry.latestScoreEma),
  );
  return {
    activeSecondsToday:
      today && today.activeSeconds > 0 ? today.activeSeconds : null,
    executionsToday: today && today.executions > 0 ? today.executions : null,
    averageActiveSeconds7Days: null,
    averageExecutions7Days: null,
    practicedDays7: practicedEntries.length,
    scoreDeltaTodayPercent:
      today?.firstScoreEma === undefined || today.latestScoreEma === undefined
        ? null
        : today.latestScoreEma - today.firstScoreEma,
    scoreDelta7DaysPercent:
      earliestScore === undefined || latestScore === undefined
        ? null
        : latestScore - earliestScore,
  };
}

function daySummaryForExercises(
  store: CurriculumStatsStore,
  dayKey: string,
  exerciseIds: readonly ExerciseId[],
): {
  activeSeconds: number;
  executions: number;
  practiced: boolean;
} {
  const entries = exerciseIds
    .map((id) => store.days[dayKey]?.[id])
    .filter((entry): entry is CurriculumDailyEntry => entry !== undefined);
  const activeSeconds = sum(entries.map((entry) => entry.activeSeconds));
  const executions = sum(entries.map((entry) => entry.executions));
  return {
    activeSeconds,
    executions,
    practiced: activeSeconds > 0 || executions > 0,
  };
}

export function aggregateCurriculumSummaries(
  summaries: CurriculumStatsSummary[],
): CurriculumStatsSummary {
  const practicedDays = Math.max(...summaries.map((s) => s.practicedDays7), 0);
  return {
    activeSecondsToday: nullableSum(
      summaries.map((summary) => summary.activeSecondsToday),
    ),
    executionsToday: nullableSum(
      summaries.map((summary) => summary.executionsToday),
    ),
    averageActiveSeconds7Days: nullableSum(
      summaries.map((summary) => summary.averageActiveSeconds7Days),
    ),
    averageExecutions7Days: nullableSum(
      summaries.map((summary) => summary.averageExecutions7Days),
    ),
    practicedDays7: practicedDays,
    scoreDeltaTodayPercent: nullableAverage(
      summaries.map((summary) => summary.scoreDeltaTodayPercent),
    ),
    scoreDelta7DaysPercent: nullableAverage(
      summaries.map((summary) => summary.scoreDelta7DaysPercent),
    ),
  };
}

export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function emptyStore(): CurriculumStatsStore {
  return { version: 1, days: {} };
}

function emptyEntry(): CurriculumDailyEntry {
  return { activeSeconds: 0, executions: 0 };
}

function persist(next: CurriculumStatsStore): CurriculumStatsStore {
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.error("Failed to persist curriculum stats.", error);
  }
  return next;
}

function isCurriculumStatsStore(
  value: unknown,
): value is CurriculumStatsStore {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const root = value as Record<string, unknown>;
  if (root.version !== 1) return false;
  if (!root.days || typeof root.days !== "object" || Array.isArray(root.days)) {
    return false;
  }
  for (const day of Object.values(root.days)) {
    if (!day || typeof day !== "object" || Array.isArray(day)) return false;
    for (const entry of Object.values(day as Record<string, unknown>)) {
      if (!isEntry(entry)) return false;
    }
  }
  return true;
}

function isEntry(value: unknown): value is CurriculumDailyEntry {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const entry = value as Record<string, unknown>;
  return (
    isNonNegativeNumber(entry.activeSeconds) &&
    isNonNegativeNumber(entry.executions) &&
    isOptionalNumber(entry.firstScoreEma) &&
    isOptionalNumber(entry.latestScoreEma)
  );
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isOptionalNumber(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === "number" && Number.isFinite(value));
}

function lastCalendarDayKeys(now: Date, count: number): string[] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const keys: string[] = [];
  for (let offset = count - 1; offset >= 0; offset--) {
    keys.push(localDateKey(new Date(start.getTime() - offset * DAY_MS)));
  }
  return keys;
}

function isPracticedEntry(
  entry: CurriculumDailyEntry | undefined,
): entry is CurriculumDailyEntry {
  return entry !== undefined && (entry.activeSeconds > 0 || entry.executions > 0);
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function nullableSum(values: (number | null)[]): number | null {
  const present = values.filter((value): value is number => value !== null);
  return present.length === 0 ? null : sum(present);
}

function nullableAverage(values: (number | null)[]): number | null {
  const present = values.filter((value): value is number => value !== null);
  return present.length === 0 ? null : sum(present) / present.length;
}

function firstDefined(values: (number | undefined)[]): number | undefined {
  return values.find((value) => value !== undefined);
}

function lastDefined(values: (number | undefined)[]): number | undefined {
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] !== undefined) return values[i];
  }
  return undefined;
}
