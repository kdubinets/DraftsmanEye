/** Settings screen: user-facing toggles and progress reset. */
import {
  AUTO_REPEAT_DELAYS,
  SOLID_REFERENCE_STYLES,
  type AutoRepeatDelayMs,
  type SolidReferenceStyle,
  getSettings,
  updateSetting,
} from "../storage/settings";
import { resetStoredProgress } from "../storage/progress";
import { pageShell, actionButton } from "../render/components";
import { h } from "../render/h";
import type { AppState } from "../app/state";
import { promptPwaInstall, subscribeInstallPrompt } from "../app/pwa";

export function mountSettingsScreen(
  root: HTMLElement,
  onNavigate: (next: AppState) => void,
): () => void {
  const settings = getSettings();
  const { section: installSection, cleanup: cleanupInstallButton } =
    installSectionBlock();

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

  const referenceSection = h("section", { class: "settings-section" }, [
    h("h2", {}, ["Reference display"]),
    solidReferenceStyleSelect(
      "solid-reference-style",
      settings.solidReferenceStyle,
      (v) => updateSetting("solidReferenceStyle", v),
    ),
  ]);

  const togglesSection = h("section", { class: "settings-section" }, [
    h("h2", {}, ["Drawing input"]),
    settingToggle(
      "directional-line-guides",
      "Directional line prompts",
      "Shows a start cue for guided line drills and scores opposite-direction strokes as misses.",
      settings.directionalLineGuides,
      (v) => updateSetting("directionalLineGuides", v),
    ),
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
      referenceSection,
      togglesSection,
      dangerSection,
      installSection,
      backBtn,
    ),
  );
  return cleanupInstallButton;
}

function solidReferenceStyleSelect(
  id: string,
  initialValue: SolidReferenceStyle,
  onChange: (value: SolidReferenceStyle) => void,
): HTMLElement {
  const select = h("select", {
    id,
    class: "settings-select",
  });
  select.append(
    ...SOLID_REFERENCE_STYLES.map((style) =>
      h(
        "option",
        {
          value: style,
          selected: style === initialValue,
        },
        [formatSolidReferenceStyle(style)],
      ),
    ),
  );
  select.addEventListener("change", () => {
    onChange(parseSolidReferenceStyle(select.value));
  });

  return h("div", { class: "settings-row" }, [
    h("div", { class: "settings-label-group" }, [
      h("label", { htmlFor: id, class: "settings-label" }, [
        "3D solid reference style",
      ]),
      h("p", { class: "settings-note" }, [
        "Shaded adds simple face lighting to 3D references while keeping edge construction visible.",
      ]),
    ]),
    select,
  ]);
}

function parseSolidReferenceStyle(value: string): SolidReferenceStyle {
  return SOLID_REFERENCE_STYLES.includes(value as SolidReferenceStyle)
    ? (value as SolidReferenceStyle)
    : "wireframe";
}

function formatSolidReferenceStyle(style: SolidReferenceStyle): string {
  return style === "wireframe" ? "Wireframe" : "Shaded";
}

function installSectionBlock(): { section: HTMLElement; cleanup: () => void } {
  const helpText = h("span", { class: "install-help", hidden: true }, [
    installHelpText(),
  ]);
  const button = h(
    "button",
    {
      type: "button",
      class: "hero-settings-link",
      on: {
        click: () => {
          void promptPwaInstall().then((shownNativePrompt) => {
            helpText.hidden = shownNativePrompt;
          });
        },
      },
    },
    ["Install app"],
  );
  button.append(helpText);

  const cleanup = subscribeInstallPrompt((state) => {
    button.hidden = state.isInstalled;
    helpText.hidden = true;
  });

  return {
    section: h("section", { class: "settings-section" }, [
      h("h2", {}, ["App"]),
      h("div", { class: "settings-row" }, [
        h("div", { class: "settings-label-group" }, [
          h("p", { class: "settings-label" }, ["Installation"]),
          h("p", { class: "settings-note" }, [
            "Adds Draftsman Eye to your device when the browser supports it.",
          ]),
        ]),
        button,
      ]),
    ]),
    cleanup,
  };
}

function installHelpText(): string {
  const userAgent = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(userAgent)) {
    return "Use Share, then Add to Home Screen.";
  }
  if (userAgent.includes("firefox")) {
    return "Use the browser menu, then Add to Home screen if available.";
  }
  return "Use the install icon in the address bar or the browser menu.";
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
