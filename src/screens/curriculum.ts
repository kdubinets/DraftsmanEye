/** Curriculum screen: structured practice guide with per-drill daily statistics. */
import {
  getExerciseById,
  type ExerciseDefinition,
  type ExerciseId,
} from "../practice/catalog";
import {
  CURRICULUM_GROUPS,
  exerciseIdsForGroup,
  type CurriculumGroup,
  type CurriculumStage,
} from "../practice/curriculum";
import {
  calendarAverageActiveSecondsForExercises,
  curriculumSummaryForExercise,
  curriculumSummaryForExercises,
  getCurriculumStatsStore,
  type CurriculumStatsSummary,
} from "../storage/curriculumStats";
import { dailyTargetMinutesForGroup } from "../storage/curriculumTargets";
import {
  getCurriculumUiStore,
  setCurriculumExpandedGroup,
  setCurriculumSelectedStage,
} from "../storage/curriculumUi";
import { pageShell } from "../render/components";
import { h } from "../render/h";
import type { AppState } from "../app/state";

export function mountCurriculumScreen(
  root: HTMLElement,
  onNavigate: (next: AppState) => void,
): () => void {
  const ui = getCurriculumUiStore();
  let expandedGroupId =
    validGroupId(ui.expandedGroupId) ?? CURRICULUM_GROUPS[0]?.id;
  const selectedStageIds = { ...ui.selectedStageIds };
  const list = h("div", { class: "curriculum-group-list" });

  function render(): void {
    const statsStore = getCurriculumStatsStore();
    list.replaceChildren(
      ...CURRICULUM_GROUPS.map((group) =>
        renderGroup(
          group,
          group.id === expandedGroupId,
          selectedStageIds[group.id],
          statsStore,
          onNavigate,
          (nextGroupId) => {
            expandedGroupId = nextGroupId;
            setCurriculumExpandedGroup(nextGroupId);
            render();
          },
          (groupId, stageId) => {
            selectedStageIds[groupId] = stageId;
            setCurriculumSelectedStage(groupId, stageId);
            render();
          },
        ),
      ),
    );
  }

  render();

  root.append(
    pageShell(
      h("header", { class: "curriculum-header" }, [
        h("p", { class: "eyebrow" }, ["Draftsman Eye"]),
        h("h1", {}, ["Curriculum"]),
        h("p", { class: "hero-copy" }, [
          "Practice related drills in a progression, while keeping every exercise available as a direct choice.",
        ]),
        h("div", { class: "hero-link-row" }, [
          h(
            "button",
            {
              type: "button",
              class: "hero-settings-link",
              on: { click: () => onNavigate({ screen: "list" }) },
            },
            ["Exercise List"],
          ),
          h(
            "button",
            {
              type: "button",
              class: "hero-settings-link",
              on: { click: () => onNavigate({ screen: "settings" }) },
            },
            ["Settings"],
          ),
        ]),
      ]),
      list,
    ),
  );

  return () => {};
}

function renderGroup(
  group: CurriculumGroup,
  expanded: boolean,
  selectedStageId: string | undefined,
  statsStore: ReturnType<typeof getCurriculumStatsStore>,
  onNavigate: (next: AppState) => void,
  onExpand: (groupId: string) => void,
  onStageSelect: (groupId: string, stageId: string) => void,
): HTMLElement {
  const exerciseIds = exerciseIdsForGroup(group);
  const groupSummary = curriculumSummaryForExercises(statsStore, exerciseIds);
  const targetMinutes = dailyTargetMinutesForGroup(group.id);
  const targetSummary =
    targetMinutes === null
      ? null
      : curriculumTargetSummary(
          groupSummary.activeSecondsToday ?? 0,
          calendarAverageActiveSecondsForExercises(statsStore, exerciseIds),
          targetMinutes,
        );
  const body = h("div", { class: "curriculum-group-body" });
  if (expanded) {
    if (group.stages && group.stages.length > 0) {
      const selectedStage =
        group.stages.find((stage) => stage.id === selectedStageId) ??
        group.stages[0];
      body.append(
        renderStageTabs(group, selectedStage, onStageSelect),
        h("p", { class: "curriculum-stage-title" }, [selectedStage.title]),
        renderRows(selectedStage.exerciseIds, statsStore, onNavigate),
      );
    } else {
      body.append(renderRows(group.exerciseIds ?? [], statsStore, onNavigate));
    }
  }

  const toggle = h(
    "button",
    {
      type: "button",
      class: "curriculum-group-toggle",
      on: { click: () => onExpand(group.id) },
    },
    [
      h("span", { class: "curriculum-group-title" }, [
        h("span", { class: "curriculum-group-name" }, [group.title]),
        h("span", { class: "curriculum-group-count" }, [
          `${exerciseIds.length} drills`,
        ]),
      ]),
      targetSummary
        ? h("span", { class: "curriculum-target-summary" }, [targetSummary])
        : null,
    ],
  );
  toggle.setAttribute("aria-expanded", expanded ? "true" : "false");

  return h(
    "section",
    {
      class: expanded
        ? "curriculum-group is-expanded"
        : "curriculum-group",
    },
    [
      h("div", { class: "curriculum-group-summary" }, [
        toggle,
        ...renderStatCells(groupSummary),
      ]),
      body,
    ],
  );
}

function renderStageTabs(
  group: CurriculumGroup,
  selectedStage: CurriculumStage,
  onStageSelect: (groupId: string, stageId: string) => void,
): HTMLElement {
  return h(
    "div",
    { class: "curriculum-stage-tabs" },
    group.stages!.map((stage) => {
      const button = h(
        "button",
        {
          type: "button",
          class:
            stage.id === selectedStage.id
              ? "curriculum-stage-tab is-active"
              : "curriculum-stage-tab",
          on: { click: () => onStageSelect(group.id, stage.id) },
        },
        [stage.label],
      );
      button.setAttribute(
        "aria-pressed",
        stage.id === selectedStage.id ? "true" : "false",
      );
      button.title = stage.title;
      return button;
    }),
  );
}

function renderRows(
  exerciseIds: readonly ExerciseId[],
  statsStore: ReturnType<typeof getCurriculumStatsStore>,
  onNavigate: (next: AppState) => void,
): HTMLElement {
  return h("div", { class: "curriculum-table" }, [
    renderHeaderRow(),
    ...exerciseIds.map((id) => {
      const exercise = getExerciseById(id);
      return renderExerciseRow(
        exercise,
        curriculumSummaryForExercise(statsStore, exercise.id),
        onNavigate,
      );
    }),
  ]);
}

function renderHeaderRow(): HTMLElement {
  return h("div", { class: "curriculum-row curriculum-row-header" }, [
    h("span", {}, ["Exercise"]),
    h("span", {}, ["Today"]),
    h("span", {}, ["Runs"]),
    h("span", {}, ["Avg Time"]),
    h("span", {}, ["Avg Runs"]),
    h("span", {}, ["Days"]),
    h("span", {}, ["Today Δ"]),
    h("span", {}, ["7d Δ"]),
  ]);
}

function renderExerciseRow(
  exercise: ExerciseDefinition,
  summary: CurriculumStatsSummary,
  onNavigate: (next: AppState) => void,
): HTMLElement {
  return h("div", { class: "curriculum-row" }, [
    h(
      "button",
      {
        type: "button",
        class: "curriculum-exercise-action",
        on: {
          click: () =>
            onNavigate({
              screen: "exercise",
              exerciseId: exercise.id,
              source: "curriculum",
            }),
        },
      },
      [exercise.label],
    ),
    ...renderStatCells(summary),
  ]);
}

function renderStatCells(summary: CurriculumStatsSummary): HTMLElement[] {
  return [
    statCell(formatDuration(summary.activeSecondsToday)),
    statCell(formatNumber(summary.executionsToday)),
    statCell(formatDuration(summary.averageActiveSeconds7Days)),
    statCell(formatAverage(summary.averageExecutions7Days)),
    statCell(summary.practicedDays7 === 0 ? "—" : String(summary.practicedDays7)),
    statCell(formatDelta(summary.scoreDeltaTodayPercent)),
    statCell(formatDelta(summary.scoreDelta7DaysPercent)),
  ];
}

function statCell(value: string): HTMLElement {
  return h("span", { class: value === "—" ? "curriculum-stat is-empty" : "curriculum-stat" }, [
    value,
  ]);
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return remainder === 0 ? `${minutes}m` : `${minutes}m ${remainder}s`;
}

function formatNumber(value: number | null): string {
  return value === null ? "—" : String(Math.round(value));
}

function formatAverage(value: number | null): string {
  return value === null ? "—" : value.toFixed(value < 10 ? 1 : 0);
}

function formatDelta(value: number | null): string {
  if (value === null) return "—";
  const rounded = Math.round(value * 10) / 10;
  return rounded > 0 ? `+${rounded}%` : `${rounded}%`;
}

function curriculumTargetSummary(
  activeSecondsToday: number,
  averageActiveSeconds7Days: number,
  targetMinutes: number,
): string {
  const targetSeconds = targetMinutes * 60;
  const remainingSeconds = Math.max(0, targetSeconds - activeSecondsToday);
  const averageDeltaSeconds = averageActiveSeconds7Days - targetSeconds;
  const averageStatus =
    averageDeltaSeconds >= 0
      ? `${formatDuration(averageDeltaSeconds)} above 7d target`
      : `${formatDuration(Math.abs(averageDeltaSeconds))} below 7d target`;
  return `Need ${formatDuration(remainingSeconds)} today · ${averageStatus}`;
}

function validGroupId(value: string | undefined): string | undefined {
  return CURRICULUM_GROUPS.some((group) => group.id === value)
    ? value
    : undefined;
}
