/**
 * List screen: app home page showing either the exercise grid or curriculum hierarchy.
 */
import { EXERCISES } from "../practice/catalog";
import type { ExerciseDefinition } from "../practice/catalog";
import { getStoredProgress, filterStaleAggregates } from "../storage/progress";
import type { ProgressStore } from "../storage/progress";
import { getSettings, updateSetting, type HomeView } from "../storage/settings";
import { pageShell, formatScore, actionButton } from "../render/components";
import { h } from "../render/h";
import type { AppState, ListFilterState } from "../app/state";
import { curriculumView } from "./curriculum";

const FAMILY_ORDER = [
  "Division",
  "Length Transfer",
  "Angle",
  "Intersection",
  "Flat Shapes",
  "Solids",
  "Freehand Control",
  "Trace Control",
  "Target Drawing",
  "Loop Chain",
];

export function mountListScreen(
  root: HTMLElement,
  onNavigate: (next: AppState) => void,
  initialListState?: ListFilterState,
  initialHomeView?: HomeView,
): () => void {
  const knownIds = new Set(EXERCISES.map((e) => e.id));
  const progress = filterStaleAggregates(getStoredProgress(), knownIds);
  let homeView = initialHomeView ?? getSettings().lastHomeView;
  if (initialHomeView) {
    updateSetting("lastHomeView", initialHomeView);
  }
  let activeFamily: string | null = initialListState?.activeFamily ?? null;
  const activeSubfilters = cloneSubfilters(initialListState?.activeSubfilters);
  const familyNav = h("div", { class: "exercise-filter-list" });
  const groupedList = h("div", { class: "exercise-group-list" });
  const shell = pageShell();

  function currentListState(): ListFilterState {
    return {
      activeFamily,
      activeSubfilters: cloneSubfilters(activeSubfilters),
    };
  }

  function renderExerciseIndex(): void {
    familyNav.replaceChildren(
      ...familyFilterButtons(activeFamily, (nextFamily) => {
        activeFamily = nextFamily;
        renderExerciseIndex();
      }),
    );
    groupedList.replaceChildren(
      ...visibleFamilies(activeFamily).map((family) => {
        const allExercises = exercisesByFamily(family);
        const visibleExercises = applySubfilters(
          family,
          allExercises,
          activeSubfilters[family] ?? {},
        );
        return exerciseFamilySection(
          family,
          allExercises.length,
          visibleExercises,
          progress,
          onNavigate,
          currentListState,
          activeSubfilters[family] ?? {},
          (facetId, optionId) => {
            toggleSubfilter(activeSubfilters, family, facetId, optionId);
            renderExerciseIndex();
          },
        );
      }),
    );
  }

  function setHomeView(next: HomeView): void {
    homeView = next;
    updateSetting("lastHomeView", next);
    renderHome();
  }

  function renderHome(): void {
    if (homeView === "curriculum") {
      shell.replaceChildren(
        headerBlock(homeView, setHomeView, onNavigate),
        curriculumView(onNavigate),
      );
      return;
    }

    renderExerciseIndex();
    shell.replaceChildren(
      headerBlock(homeView, setHomeView, onNavigate),
      exerciseIndex(familyNav, groupedList),
    );
  }

  renderHome();

  root.append(shell);
  return () => {};
}

function headerBlock(
  homeView: HomeView,
  onViewChange: (next: HomeView) => void,
  onNavigate: (next: AppState) => void,
): HTMLElement {
  const img = h("img", { class: "hero-image", alt: "" });
  img.setAttribute("src", "/title-image.webp");
  const nextHomeView =
    homeView === "curriculum" ? "exercise-list" : "curriculum";
  return h("header", { class: "hero" }, [
    h("div", { class: "hero-content" }, [
      h("p", { class: "eyebrow" }, ["Draftsman Eye"]),
      h("h1", {}, [
        homeView === "curriculum"
          ? "Follow a practice path."
          : "Choose a drill and keep the loop short.",
      ]),
      h("p", { class: "hero-copy" }, [
        homeView === "curriculum"
          ? "Practice related drills in a progression."
          : "Practice one skill at a time, review the result immediately, then repeat or return to the list.",
      ]),
      h("div", { class: "hero-link-row" }, [
        h(
          "button",
          {
            type: "button",
            class: "hero-settings-link",
            on: { click: () => onViewChange(nextHomeView) },
          },
          [homeView === "curriculum" ? "Exercise List" : "Curriculum"],
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
    img,
  ]);
}

function exerciseIndex(
  familyNav: HTMLElement,
  groupedList: HTMLElement,
): HTMLElement {
  return h("section", { class: "exercise-section" }, [
    h("h2", {}, ["Exercises"]),
    familyNav,
    groupedList,
  ]);
}

function familyFilterButtons(
  activeFamily: string | null,
  onSelect: (family: string | null) => void,
): HTMLButtonElement[] {
  return [
    familyFilterButton("All", EXERCISES.length, activeFamily === null, () =>
      onSelect(null),
    ),
    ...FAMILY_ORDER.map((family) =>
      familyFilterButton(
        family,
        exercisesByFamily(family).length,
        activeFamily === family,
        () => onSelect(family),
      ),
    ),
  ];
}

function familyFilterButton(
  label: string,
  count: number,
  active: boolean,
  onClick: () => void,
): HTMLButtonElement {
  const button = h(
    "button",
    {
      type: "button",
      class: active ? "exercise-filter is-active" : "exercise-filter",
      on: { click: onClick },
    },
    [
      h("span", {}, [label]),
      h("span", { class: "exercise-filter-count" }, [String(count)]),
    ],
  );
  button.setAttribute("aria-pressed", active ? "true" : "false");
  return button;
}

function visibleFamilies(activeFamily: string | null): string[] {
  return activeFamily === null ? FAMILY_ORDER : [activeFamily];
}

function exercisesByFamily(family: string): ExerciseDefinition[] {
  return EXERCISES.filter((exercise) => displayFamily(exercise) === family);
}

function displayFamily(exercise: ExerciseDefinition): string {
  if (
    exercise.family === "Same-Axis Transfer" ||
    exercise.family === "Cross-Axis Transfer" ||
    exercise.family === "Random-Line Transfer"
  ) {
    return "Length Transfer";
  }
  if (
    exercise.family === "Angle Copy" ||
    exercise.family === "Angle Estimation"
  ) {
    return "Angle";
  }
  return exercise.family;
}

function exerciseFamilySection(
  family: string,
  totalCount: number,
  exercises: ExerciseDefinition[],
  progress: ProgressStore,
  onNavigate: (next: AppState) => void,
  getListState: () => ListFilterState,
  selectedFilters: Record<string, string[]>,
  onToggleSubfilter: (facetId: string, optionId: string) => void,
): HTMLElement {
  const facets = subfilterFacets(family);
  return h("section", { class: "exercise-family-section" }, [
    h("div", { class: "exercise-family-header" }, [
      h("div", { class: "exercise-family-title-row" }, [
        h("h3", {}, [family]),
        subfilterControls(facets, selectedFilters, onToggleSubfilter),
      ]),
      h("p", { class: "exercise-family-count" }, [
        exercises.length === totalCount
          ? `${exercises.length} drills`
          : `${exercises.length} of ${totalCount} drills`,
      ]),
    ]),
    h(
      "div",
      { class: "exercise-grid" },
      exercises.map((ex) =>
        exerciseCard(
          ex,
          progress.aggregates[ex.id]?.ema,
          onNavigate,
          getListState,
        ),
      ),
    ),
  ]);
}

function exerciseCard(
  exercise: ExerciseDefinition,
  emaScore: number | undefined,
  onNavigate: (next: AppState) => void,
  getListState: () => ListFilterState,
): HTMLElement {
  const button = h(
    "button",
    {
      type: "button",
      class: "secondary-action",
      disabled: !exercise.implemented,
      ...(exercise.implemented
        ? {
            on: {
              click: () =>
                onNavigate({
                  screen: "exercise",
                  exerciseId: exercise.id,
                  source: "direct",
                  listState: getListState(),
                }),
            },
          }
        : {}),
    },
    [exercise.implemented ? "Practice" : "Coming soon"],
  );

  return h("article", { class: "exercise-card" }, [
    h("p", { class: "card-kicker" }, [exercise.family]),
    h("h3", {}, [exercise.label]),
    h("p", {}, [exercise.description]),
    h("div", { class: "card-footer" }, [
      h(
        "p",
        {
          class:
            exercise.implemented && emaScore !== undefined
              ? "score-chip has-score"
              : "score-chip",
        },
        [exercise.implemented ? formatScore(emaScore) : "---"],
      ),
      button,
    ]),
  ]);
}

export function primaryActionButton(
  label: string,
  onClick: () => void,
): HTMLButtonElement {
  return h(
    "button",
    { type: "button", class: "primary-action", on: { click: onClick } },
    [label],
  );
}

export { actionButton };

type FilterFacet = {
  id: string;
  label: string;
  options: { id: string; label: string }[];
};

const FILTER_FACETS: Record<string, FilterFacet[]> = {
  Division: [
    {
      id: "input",
      label: "Input",
      options: [
        { id: "adjust", label: "Adjust" },
        { id: "1-shot", label: "1-Shot" },
      ],
    },
    {
      id: "parts",
      label: "Parts",
      options: [
        { id: "halves", label: "Halves" },
        { id: "thirds", label: "Thirds" },
        { id: "quarters", label: "Quarters" },
        { id: "fifths", label: "Fifths" },
      ],
    },
    {
      id: "axis",
      label: "Axis",
      options: [
        { id: "horizontal", label: "Horizontal" },
        { id: "vertical", label: "Vertical" },
        { id: "random", label: "Random" },
      ],
    },
  ],
  "Length Transfer": [
    {
      id: "input",
      label: "Input",
      options: [
        { id: "adjust", label: "Adjust" },
        { id: "1-shot", label: "1-Shot" },
      ],
    },
    {
      id: "task",
      label: "Task",
      options: [
        { id: "copy", label: "Copy" },
        { id: "double", label: "Double" },
      ],
    },
    {
      id: "axis",
      label: "Axis",
      options: [
        { id: "same", label: "Same Axis" },
        { id: "cross", label: "Cross Axis" },
        { id: "random", label: "Random" },
      ],
    },
  ],
  Angle: [
    {
      id: "task",
      label: "Task",
      options: [
        { id: "copy", label: "Copy" },
        { id: "estimate", label: "Estimate" },
      ],
    },
    {
      id: "input",
      label: "Input",
      options: [
        { id: "adjust", label: "Adjust" },
        { id: "adjust-1-shot", label: "Adjust 1-Shot" },
        { id: "free-draw-1-shot", label: "Free Draw" },
      ],
    },
    {
      id: "estimate-base",
      label: "Estimate Base",
      options: [
        { id: "horizontal", label: "Horizontal" },
        { id: "vertical", label: "Vertical" },
        { id: "random", label: "Random" },
      ],
    },
    {
      id: "reference",
      label: "Reference",
      options: [
        { id: "horizontal", label: "Horizontal" },
        { id: "vertical", label: "Vertical" },
        { id: "arbitrary", label: "Arbitrary" },
      ],
    },
    {
      id: "base",
      label: "Base",
      options: [
        { id: "aligned", label: "Aligned" },
        { id: "rotated", label: "Rotated" },
      ],
    },
  ],
};

function subfilterFacets(family: string): FilterFacet[] {
  return FILTER_FACETS[family] ?? [];
}

function subfilterControls(
  facets: FilterFacet[],
  selectedFilters: Record<string, string[]>,
  onToggle: (facetId: string, optionId: string) => void,
): HTMLElement | null {
  if (facets.length === 0) return null;
  return h(
    "div",
    { class: "exercise-subfilter-list" },
    facets.map((facet) =>
      h("div", { class: "exercise-subfilter-group" }, [
        h("span", { class: "exercise-subfilter-label" }, [facet.label]),
        ...facet.options.map((option) => {
          const selected =
            selectedFilters[facet.id]?.includes(option.id) ?? false;
          const button = h(
            "button",
            {
              type: "button",
              class: selected
                ? "exercise-subfilter is-active"
                : "exercise-subfilter",
              on: { click: () => onToggle(facet.id, option.id) },
            },
            [option.label],
          );
          button.setAttribute("aria-pressed", selected ? "true" : "false");
          return button;
        }),
      ]),
    ),
  );
}

function applySubfilters(
  family: string,
  exercises: ExerciseDefinition[],
  selectedFilters: Record<string, string[]>,
): ExerciseDefinition[] {
  const facets = subfilterFacets(family);
  if (facets.length === 0) return exercises;
  return exercises.filter((exercise) =>
    facets.every((facet) => {
      const selected = selectedFilters[facet.id] ?? [];
      if (selected.length === 0) return true;
      const value = subfilterValue(family, facet.id, exercise);
      return value !== null && selected.includes(value);
    }),
  );
}

function subfilterValue(
  family: string,
  facetId: string,
  exercise: ExerciseDefinition,
): string | null {
  if (family === "Division") {
    if (facetId === "input")
      return exercise.id.endsWith("-1-shot") ? "1-shot" : "adjust";
    if (facetId === "parts") {
      if (exercise.id.includes("-halves")) return "halves";
      if (exercise.id.includes("-thirds")) return "thirds";
      if (exercise.id.includes("-quarters")) return "quarters";
      if (exercise.id.includes("-fifths")) return "fifths";
    }
    if (facetId === "axis") {
      if (exercise.id.startsWith("division-horizontal-")) return "horizontal";
      if (exercise.id.startsWith("division-vertical-")) return "vertical";
      if (exercise.id.startsWith("division-random-")) return "random";
    }
  }

  if (family === "Length Transfer") {
    if (facetId === "input")
      return exercise.id.endsWith("-1-shot") ? "1-shot" : "adjust";
    if (facetId === "task") {
      if (exercise.id.startsWith("copy-")) return "copy";
      if (exercise.id.startsWith("double-")) return "double";
    }
    if (facetId === "axis") {
      if (exercise.family === "Same-Axis Transfer") return "same";
      if (exercise.family === "Cross-Axis Transfer") return "cross";
      if (exercise.family === "Random-Line Transfer") return "random";
    }
  }

  if (family === "Angle") {
    if (facetId === "task") {
      if (exercise.id.startsWith("angle-copy-")) return "copy";
      if (exercise.id.startsWith("angle-estimate-")) return "estimate";
    }
    if (exercise.id.startsWith("angle-estimate-")) {
      if (facetId === "estimate-base") {
        if (exercise.id === "angle-estimate-horizontal") return "horizontal";
        if (exercise.id === "angle-estimate-vertical") return "vertical";
        if (exercise.id === "angle-estimate-random") return "random";
      }
      return null;
    }
    if (facetId === "input") {
      if (exercise.id.endsWith("-free-draw-1-shot")) return "free-draw-1-shot";
      if (exercise.id.endsWith("-adjustable-1-shot")) return "adjust-1-shot";
      return "adjust";
    }
    if (facetId === "reference") {
      if (exercise.id.startsWith("angle-copy-horizontal-")) return "horizontal";
      if (exercise.id.startsWith("angle-copy-vertical-")) return "vertical";
      if (exercise.id.startsWith("angle-copy-arbitrary-")) return "arbitrary";
    }
    if (facetId === "base") {
      if (exercise.id.includes("-aligned")) return "aligned";
      if (exercise.id.includes("-rotated")) return "rotated";
    }
  }

  return null;
}

function toggleSubfilter(
  activeSubfilters: Record<string, Record<string, string[]>>,
  family: string,
  facetId: string,
  optionId: string,
): void {
  const familyFilters = activeSubfilters[family] ?? {};
  const selected = familyFilters[facetId] ?? [];
  const next = selected.includes(optionId)
    ? selected.filter((id) => id !== optionId)
    : [...selected, optionId];

  if (next.length === 0) {
    delete familyFilters[facetId];
  } else {
    familyFilters[facetId] = next;
  }

  if (Object.keys(familyFilters).length === 0) {
    delete activeSubfilters[family];
  } else {
    activeSubfilters[family] = familyFilters;
  }
}

function cloneSubfilters(
  source?: Record<string, Record<string, string[]>>,
): Record<string, Record<string, string[]>> {
  const clone: Record<string, Record<string, string[]>> = {};
  if (!source) return clone;
  for (const [family, filters] of Object.entries(source)) {
    clone[family] = {};
    for (const [facetId, selected] of Object.entries(filters)) {
      clone[family][facetId] = [...selected];
    }
  }
  return clone;
}
