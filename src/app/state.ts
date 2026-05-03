/** App routing state. One screen at a time; navigating replaces the current screen. */
import type { ExerciseId } from "../practice/catalog";

export type ListFilterState = {
  activeFamily: string | null;
  activeSubfilters: Record<string, Record<string, string[]>>;
};

export type AppState =
  | { screen: "list"; listState?: ListFilterState }
  | { screen: "curriculum" }
  | { screen: "settings" }
  | {
      screen: "exercise";
      exerciseId: ExerciseId;
      source: "direct" | "auto" | "curriculum";
      listState?: ListFilterState;
    };
