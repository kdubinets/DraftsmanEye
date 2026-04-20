/**
 * Display helpers specific to freehand results: score labels and result stat panels.
 * Kept separate from correction.ts so the history modal and live screen can both import
 * without pulling in SVG rendering.
 */
import { h } from "../../render/h";
import type { FreehandResult } from "./types";

export function freehandScoreLabel(kind: FreehandResult["kind"]): string {
  switch (kind) {
    case "circle":
      return "Roundness";
    case "target-circle":
      return "Target circle";
    case "target-ellipse":
      return "Target ellipse";
    case "ellipse":
      return "Ellipse fit";
    case "target-line":
      return "Target line";
    case "target-angle":
      return "Angle copy";
    case "line":
      return "Straightness";
  }
}

export function freehandResultStats(result: FreehandResult): HTMLElement[] {
  const header = [
    stat("Score", result.score.toFixed(1)),
    stat("Mean drift", `${result.meanErrorPixels.toFixed(1)} px`),
    stat("Max drift", `${result.maxErrorPixels.toFixed(1)} px`),
  ];
  const footer = [
    stat("Length", `${Math.round(result.strokeLengthPixels)} px`),
    stat("Samples", String(result.pointCount)),
  ];

  let kindStats: HTMLElement[];
  if (result.kind === "circle") {
    kindStats = [
      stat("Radius", `${Math.round(result.radius)} px`),
      stat("Closure", `${Math.round(result.closureGapPixels)} px`),
      stat("Join", `${Math.round(result.joinAngleDegrees)} deg`),
    ];
  } else if (result.kind === "target-circle") {
    kindStats = [
      stat("Center miss", `${Math.round(result.centerErrorPixels)} px`),
      stat("Radius miss", `${Math.round(result.radiusErrorPixels)} px`),
      stat("Closure", `${Math.round(result.closureGapPixels)} px`),
      stat("Join", `${Math.round(result.joinAngleDegrees)} deg`),
    ];
  } else if (result.kind === "target-ellipse") {
    kindStats = [
      stat("Center miss", `${Math.round(result.centerErrorPixels)} px`),
      stat("Major miss", `${Math.round(result.majorRadiusErrorPixels)} px`),
      stat("Minor miss", `${Math.round(result.minorRadiusErrorPixels)} px`),
      stat("Rotation", `${Math.round(result.rotationErrorDegrees)} deg`),
      stat("Closure", `${Math.round(result.closureGapPixels)} px`),
      stat("Join", `${Math.round(result.joinAngleDegrees)} deg`),
    ];
  } else if (result.kind === "ellipse") {
    kindStats = [
      stat("Major", `${Math.round(result.majorRadius)} px`),
      stat("Minor", `${Math.round(result.minorRadius)} px`),
      stat("Closure", `${Math.round(result.closureGapPixels)} px`),
      stat("Join", `${Math.round(result.joinAngleDegrees)} deg`),
    ];
  } else if (result.kind === "target-line") {
    kindStats = [
      stat("Start miss", `${Math.round(result.startErrorPixels)} px`),
      stat("End miss", `${Math.round(result.endErrorPixels)} px`),
      stat("Angle miss", `${Math.round(result.angleErrorDegrees)} deg`),
    ];
  } else if (result.kind === "target-angle") {
    kindStats = [
      stat("Start miss", `${Math.round(result.startErrorPixels)} px`),
      stat("Angle miss", `${result.angleErrorDegrees.toFixed(1)} deg`),
      stat(
        "Opening",
        result.signedOpenErrorDegrees > 0
          ? "Too open"
          : result.signedOpenErrorDegrees < 0
            ? "Too narrow"
            : "Exact",
      ),
    ];
  } else {
    kindStats = [];
  }

  return [...header, ...kindStats, ...footer];
}

function stat(label: string, value: string): HTMLElement {
  return h("div", { class: "result-stat" }, [
    h("p", { class: "result-label" }, [label]),
    h("p", { class: "result-value" }, [value]),
  ]);
}
