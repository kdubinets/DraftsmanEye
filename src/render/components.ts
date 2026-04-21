/** Shared DOM component builders and formatting utilities used across screens. */
import type { ExerciseDefinition } from "../practice/catalog";
import { h } from "./h";

export function pageShell(...children: HTMLElement[]): HTMLElement {
  return h("main", { class: "page-shell" }, children);
}

export function exerciseHeader(
  exercise: ExerciseDefinition,
  source: "direct" | "auto",
): HTMLElement {
  return h("header", { class: "exercise-header" }, [
    h("p", { class: "eyebrow" }, [
      source === "auto" ? "Auto Drill" : exercise.family,
    ]),
    h("h1", { class: "exercise-title" }, [exercise.label]),
    h("p", { class: "hero-copy" }, [exercise.description]),
  ]);
}

export function resultStat(label: string, value: string): HTMLElement {
  return h("div", { class: "result-stat" }, [
    h("p", { class: "result-label" }, [label]),
    h("p", { class: "result-value" }, [value]),
  ]);
}

export function actionButton(
  label: string,
  onClick: () => void,
): HTMLButtonElement {
  return h(
    "button",
    { type: "button", class: "secondary-action", on: { click: onClick } },
    [label],
  );
}

export function exerciseToolbar(
  prompt: HTMLElement,
  ...actions: HTMLButtonElement[]
): HTMLElement {
  return h("div", { class: "exercise-toolbar" }, [prompt, ...actions]);
}

export function fullscreenButton(stage: HTMLElement): HTMLButtonElement {
  const button = actionButton("Full", () => {
    void toggleExerciseFullscreen(stage, button);
  });
  button.classList.add("fullscreen-action");
  return button;
}

async function toggleExerciseFullscreen(
  stage: HTMLElement,
  button: HTMLButtonElement,
): Promise<void> {
  const isMaximized = stage.classList.contains("is-maximized");
  try {
    if (isMaximized) {
      stage.classList.remove("is-maximized");
      button.textContent = "Full";
      if (document.fullscreenElement === stage) {
        await document.exitFullscreen();
      }
      return;
    }

    stage.classList.add("is-maximized");
    button.textContent = "Exit";
    if (!document.fullscreenElement && stage.requestFullscreen) {
      await stage.requestFullscreen();
    }
  } catch (error) {
    stage.classList.toggle(
      "is-maximized",
      document.fullscreenElement === stage,
    );
    button.textContent = document.fullscreenElement === stage ? "Exit" : "Full";
    console.error("Failed to toggle fullscreen mode.", error);
  }
}

export function formatScore(score: number | undefined): string {
  return score === undefined ? "New" : score.toFixed(1);
}

export function formatSignedValue(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return rounded > 0 ? `+${rounded}` : String(rounded);
}
