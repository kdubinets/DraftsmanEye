/** Local per-curriculum-group daily practice targets. */
export type CurriculumTargetsStore = {
  version: 1;
  dailyMinutesByGroupId: Record<string, number>;
};

const STORAGE_KEY = "draftsman-eye.curriculum-targets.v1";
const MAX_DAILY_TARGET_MINUTES = 24 * 60;
let cache: CurriculumTargetsStore | null = null;

export function _resetCurriculumTargetsCache(): void {
  cache = null;
}

export function getCurriculumTargetsStore(): CurriculumTargetsStore {
  if (cache) return cache;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return (cache = emptyStore());
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isCurriculumTargetsStore(parsed)) {
      console.error("Ignoring malformed curriculum targets payload.");
      return (cache = emptyStore());
    }
    return (cache = parsed);
  } catch (error) {
    console.error("Failed to parse curriculum targets.", error);
    return (cache = emptyStore());
  }
}

export function dailyTargetMinutesForGroup(groupId: string): number | null {
  return getCurriculumTargetsStore().dailyMinutesByGroupId[groupId] ?? null;
}

export function setDailyTargetMinutesForGroup(
  groupId: string,
  minutes: number | null,
): void {
  const current = getCurriculumTargetsStore();
  const dailyMinutesByGroupId = { ...current.dailyMinutesByGroupId };
  if (minutes === null || minutes <= 0) {
    delete dailyMinutesByGroupId[groupId];
  } else {
    dailyMinutesByGroupId[groupId] = clampDailyTarget(minutes);
  }
  persist({ version: 1, dailyMinutesByGroupId });
}

function emptyStore(): CurriculumTargetsStore {
  return { version: 1, dailyMinutesByGroupId: {} };
}

function persist(next: CurriculumTargetsStore): void {
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.error("Failed to persist curriculum targets.", error);
  }
}

function isCurriculumTargetsStore(
  value: unknown,
): value is CurriculumTargetsStore {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const root = value as Record<string, unknown>;
  return (
    root.version === 1 &&
    !!root.dailyMinutesByGroupId &&
    typeof root.dailyMinutesByGroupId === "object" &&
    !Array.isArray(root.dailyMinutesByGroupId) &&
    Object.values(root.dailyMinutesByGroupId).every(isValidTargetMinutes)
  );
}

function isValidTargetMinutes(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= MAX_DAILY_TARGET_MINUTES
  );
}

function clampDailyTarget(minutes: number): number {
  return Math.min(
    MAX_DAILY_TARGET_MINUTES,
    Math.max(1, Math.round(minutes)),
  );
}
