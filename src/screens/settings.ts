/** Settings screen: user-facing toggles and progress reset. */
import {
  AUTO_REPEAT_DELAYS,
  type AutoRepeatDelayMs,
  getSettings,
  updateSetting,
} from "../storage/settings";
import { resetStoredProgress } from "../storage/progress";
import { pageShell, actionButton } from "../render/components";
import { h } from "../render/h";
import type { AppState } from "../app/state";

export function mountSettingsScreen(
  root: HTMLElement,
  onNavigate: (next: AppState) => void,
): () => void {
  const settings = getSettings();

  const loopSection = h("section", { class: "settings-section" }, [
    h("h2", {}, ["Practice loop"]),
    delaySelect("auto-repeat-delay", settings.autoRepeatDelayMs, (v) =>
      updateSetting("autoRepeatDelayMs", v),
    ),
  ]);

  const resultSection = h("section", { class: "settings-section" }, [
    h("h2", {}, ["Result display"]),
    settingToggle(
      "show-result-string",
      "Show result string",
      "Shows the compact result headline after each completed drill.",
      settings.showResultString,
      (v) => updateSetting("showResultString", v),
    ),
    settingToggle(
      "show-score-boxes",
      "Show score boxes",
      "Shows the detailed diagnostic score boxes after each completed drill.",
      settings.showScoreBoxes,
      (v) => updateSetting("showScoreBoxes", v),
    ),
  ]);

  const togglesSection = h("section", { class: "settings-section" }, [
    h("h2", {}, ["Drawing input"]),
    settingToggle(
      "allow-touch",
      "Allow touch drawing",
      "Off by default; Apple Pencil or mouse gives more precise feedback.",
      settings.allowTouchDrawing,
      (v) => updateSetting("allowTouchDrawing", v),
    ),
    settingToggle(
      "pressure-width",
      "Vary stroke width by pressure",
      "Shows stylus pressure as stroke thickness. No effect with mouse.",
      settings.visualizePressureWidth,
      (v) => updateSetting("visualizePressureWidth", v),
    ),
    settingToggle(
      "speed-color",
      "Vary stroke colour by speed",
      "Slow strokes appear warm; fast strokes appear cool.",
      settings.visualizeSpeedColor,
      (v) => updateSetting("visualizeSpeedColor", v),
    ),
  ]);

  const resetBtn = h(
    "button",
    {
      type: "button",
      class: "settings-reset-btn",
      on: {
        click: () => {
          if (!confirm("Delete all stored progress? This cannot be undone."))
            return;
          resetStoredProgress();
        },
      },
    },
    ["Reset all progress"],
  );

  const dangerSection = h("section", { class: "settings-section" }, [
    h("h2", {}, ["Progress"]),
    h("p", { class: "settings-note" }, [
      "Clears scores and attempt history for all drills.",
    ]),
    resetBtn,
  ]);

  const backBtn = actionButton("Back to list", () =>
    onNavigate({ screen: "list" }),
  );

  root.append(
    pageShell(
      h("h1", { class: "settings-heading" }, ["Settings"]),
      loopSection,
      resultSection,
      togglesSection,
      dangerSection,
      backBtn,
    ),
  );
  return () => {};
}

function delaySelect(
  id: string,
  initialValue: AutoRepeatDelayMs,
  onChange: (value: AutoRepeatDelayMs) => void,
): HTMLElement {
  const select = h("select", {
    id,
    class: "settings-select",
  });
  select.append(
    ...AUTO_REPEAT_DELAYS.map((delay) => {
      const value = delay === null ? "off" : String(delay);
      return h(
        "option",
        {
          value,
          selected: delay === initialValue,
        },
        [formatDelay(delay)],
      );
    }),
  );
  select.addEventListener("change", () => {
    onChange(parseDelayValue(select.value));
  });

  return h("div", { class: "settings-row" }, [
    h("div", { class: "settings-label-group" }, [
      h("label", { htmlFor: id, class: "settings-label" }, [
        "Auto-repeat delay",
      ]),
      h("p", { class: "settings-note" }, [
        "Controls how long completed drills stay visible before the next attempt.",
      ]),
    ]),
    select,
  ]);
}

function parseDelayValue(value: string): AutoRepeatDelayMs {
  if (value === "off") return null;
  const numeric = Number(value);
  return AUTO_REPEAT_DELAYS.includes(numeric as AutoRepeatDelayMs)
    ? (numeric as AutoRepeatDelayMs)
    : 2500;
}

function formatDelay(delay: AutoRepeatDelayMs): string {
  return delay === null ? "Off" : `${(delay / 1000).toFixed(1)}s`;
}

function settingToggle(
  id: string,
  label: string,
  description: string,
  initialValue: boolean,
  onChange: (value: boolean) => void,
): HTMLElement {
  const toggle = h("input", {
    type: "checkbox",
    id,
    class: "settings-toggle",
    checked: initialValue,
  });
  toggle.addEventListener("change", () => onChange(toggle.checked));

  return h("div", { class: "settings-row" }, [
    h("div", { class: "settings-label-group" }, [
      h("label", { htmlFor: id, class: "settings-label" }, [label]),
      h("p", { class: "settings-note" }, [description]),
    ]),
    toggle,
  ]);
}
