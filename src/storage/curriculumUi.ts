/** Local UI preferences for the Curriculum page. */
export type CurriculumUiStore = {
  version: 1;
  expandedGroupId?: string;
  selectedStageIds: Record<string, string>;
};

const STORAGE_KEY = "draftsman-eye.curriculum-ui.v1";

export function getCurriculumUiStore(): CurriculumUiStore {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyStore();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isCurriculumUiStore(parsed)) {
      console.error("Ignoring malformed curriculum UI payload.");
      return emptyStore();
    }
    return parsed;
  } catch (error) {
    console.error("Failed to parse curriculum UI state.", error);
    return emptyStore();
  }
}

export function setCurriculumExpandedGroup(groupId: string): void {
  persist({ ...getCurriculumUiStore(), expandedGroupId: groupId });
}

export function setCurriculumSelectedStage(
  groupId: string,
  stageId: string,
): void {
  const current = getCurriculumUiStore();
  persist({
    ...current,
    selectedStageIds: {
      ...current.selectedStageIds,
      [groupId]: stageId,
    },
  });
}

function emptyStore(): CurriculumUiStore {
  return { version: 1, selectedStageIds: {} };
}

function persist(next: CurriculumUiStore): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.error("Failed to persist curriculum UI state.", error);
  }
}

function isCurriculumUiStore(value: unknown): value is CurriculumUiStore {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const root = value as Record<string, unknown>;
  return (
    root.version === 1 &&
    (root.expandedGroupId === undefined ||
      typeof root.expandedGroupId === "string") &&
    !!root.selectedStageIds &&
    typeof root.selectedStageIds === "object" &&
    !Array.isArray(root.selectedStageIds) &&
    Object.values(root.selectedStageIds).every(
      (value) => typeof value === "string",
    )
  );
}
