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
    case "loop-chain-band":
    case "loop-chain-scored":
      return "Loop chain";
    case "trace-spiral":
      return "Trace spiral";
  }
}

export function freehandResultStats(result: FreehandResult): HTMLElement[] {
  if (result.kind === "trace-spiral") {
    return [
      stat("Score", result.score.toFixed(1)),
      stat("Drift", formatDrift(result)),
      stat("Length", `${Math.round(result.strokeLengthPixels)} px`),
    ];
  }
  if (result.kind === "loop-chain-band") {
    return [
      stat("Score", result.score.toFixed(1)),
      stat("In band", `${result.containmentPercent.toFixed(1)} %`),
      stat("Length", `${Math.round(result.strokeLengthPixels)} px`),
    ];
  }
  if (result.kind === "loop-chain-scored") {
    return [
      stat("Score", result.score.toFixed(1)),
      ...(result.bandScore !== undefined
        ? [
            stat("Band", result.bandScore.toFixed(1)),
            stat("Touch", `${result.bandTouchPercent?.toFixed(1) ?? "0.0"} %`),
          ]
        : []),
      stat("Loops score", result.loopQualityScore.toFixed(1)),
      stat("Loops", `${result.loopCount}`),
      stat("Roundness", result.roundnessScore.toFixed(1)),
      stat("Consistency", result.radiusConsistencyScore.toFixed(1)),
      ...(result.pathAdherenceScore > 0
        ? [
            stat("Path", result.pathAdherenceScore.toFixed(1)),
            stat(
              "Center drift",
              `${result.centerLineDeviationPixels.toFixed(1)} px`,
            ),
          ]
        : []),
    ];
  }

  const stats = [
    stat("Score", result.score.toFixed(1)),
    stat("Drift", formatDrift(result)),
  ];

  if (result.kind === "circle") {
    return [
      ...stats,
      stat("Closure", `${Math.round(result.closureGapPixels)} px`),
      stat("Join", `${Math.round(result.joinAngleDegrees)} deg`),
    ];
  }

  if (result.kind === "target-circle") {
    if (result.target.trace) {
      return [
        ...stats,
        stat("Closure", `${Math.round(result.closureGapPixels)} px`),
        stat("Join", `${Math.round(result.joinAngleDegrees)} deg`),
      ];
    }
    return [
      ...stats,
      stat("Center miss", `${Math.round(result.centerErrorPixels)} px`),
      stat("Radius miss", `${Math.round(result.radiusErrorPixels)} px`),
    ];
  }

  if (result.kind === "target-ellipse") {
    if (result.target.trace) {
      return [
        ...stats,
        stat("Closure", `${Math.round(result.closureGapPixels)} px`),
        stat("Join", `${Math.round(result.joinAngleDegrees)} deg`),
      ];
    }
    return [
      ...stats,
      stat(
        "Size miss",
        `${Math.round(result.majorRadiusErrorPixels)} / ${Math.round(result.minorRadiusErrorPixels)} px`,
      ),
      stat("Closure", `${Math.round(result.closureGapPixels)} px`),
    ];
  }

  if (result.kind === "ellipse") {
    return [
      ...stats,
      stat("Closure", `${Math.round(result.closureGapPixels)} px`),
      stat("Join", `${Math.round(result.joinAngleDegrees)} deg`),
    ];
  }

  if (result.kind === "target-line") {
    return [
      ...stats,
      stat(
        "Endpoint miss",
        `${Math.round(result.startErrorPixels)} / ${Math.round(result.endErrorPixels)} px`,
      ),
      stat("Length", `${Math.round(result.strokeLengthPixels)} px`),
    ];
  }

  if (result.kind === "target-angle") {
    return [
      stat("Score", result.score.toFixed(1)),
      stat("Angle miss", `${result.angleErrorDegrees.toFixed(1)} deg`),
      stat(
        "Opening",
        result.signedOpenErrorDegrees > 0
          ? "Too open"
          : result.signedOpenErrorDegrees < 0
            ? "Too narrow"
            : "Exact",
      ),
      stat("Start miss", `${Math.round(result.startErrorPixels)} px`),
    ];
  }

  return [
    ...stats,
    stat("Length", `${Math.round(result.strokeLengthPixels)} px`),
  ];
}

export function freehandResultLine(
  result: FreehandResult,
  bandLabel: string,
): string {
  return `${bandLabel} · Score ${result.score.toFixed(1)} · ${primaryResultDetail(result)}`;
}

function primaryResultDetail(result: FreehandResult): string {
  if (result.kind === "trace-spiral") {
    return `Mean drift ${result.meanErrorPixels.toFixed(1)} px`;
  }
  if (result.kind === "loop-chain-band") {
    return `In band ${result.containmentPercent.toFixed(1)} %`;
  }
  if (result.kind === "loop-chain-scored") {
    return result.loopCount > 0
      ? result.bandScore !== undefined
        ? `Band ${result.bandScore.toFixed(1)} · Loops ${result.loopQualityScore.toFixed(1)}`
        : `${result.loopCount} loops · Roundness ${result.roundnessScore.toFixed(1)}`
      : "No loops detected";
  }
  if (result.kind === "target-angle") {
    const opening =
      result.signedOpenErrorDegrees > 0
        ? "too open"
        : result.signedOpenErrorDegrees < 0
          ? "too narrow"
          : "exact";
    return `Angle miss ${result.angleErrorDegrees.toFixed(1)} deg · ${opening}`;
  }

  if (result.kind === "target-line") {
    return `Endpoint miss ${Math.round(result.startErrorPixels)} / ${Math.round(result.endErrorPixels)} px`;
  }

  if (result.kind === "target-circle" && !result.target.trace) {
    return `Center ${Math.round(result.centerErrorPixels)} px · Radius ${Math.round(result.radiusErrorPixels)} px`;
  }

  if (result.kind === "target-ellipse" && !result.target.trace) {
    return `Size ${Math.round(result.majorRadiusErrorPixels)} / ${Math.round(result.minorRadiusErrorPixels)} px`;
  }

  return `Mean drift ${result.meanErrorPixels.toFixed(1)} px`;
}

function formatDrift(result: {
  meanErrorPixels: number;
  maxErrorPixels: number;
}): string {
  return `${result.meanErrorPixels.toFixed(1)} / ${result.maxErrorPixels.toFixed(1)} px`;
}

function stat(label: string, value: string): HTMLElement {
  return h("div", { class: "result-stat" }, [
    h("p", { class: "result-label" }, [label]),
    h("p", { class: "result-value" }, [value]),
  ]);
}
