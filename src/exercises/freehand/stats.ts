/**
 * Display helpers specific to freehand results: score labels and result stat panels.
 * Kept separate from correction.ts so the history modal and live screen can both import
 * without pulling in SVG rendering.
 */
import type { FreehandResult } from './types';

export function freehandScoreLabel(kind: FreehandResult['kind']): string {
  switch (kind) {
    case 'circle':
      return 'Roundness';
    case 'target-circle':
      return 'Target circle';
    case 'target-ellipse':
      return 'Target ellipse';
    case 'ellipse':
      return 'Ellipse fit';
    case 'target-line':
      return 'Target line';
    case 'line':
      return 'Straightness';
  }
}

export function freehandResultStats(result: FreehandResult): HTMLElement[] {
  const stats = [
    stat('Score', result.score.toFixed(1)),
    stat('Mean drift', `${result.meanErrorPixels.toFixed(1)} px`),
    stat('Max drift', `${result.maxErrorPixels.toFixed(1)} px`),
    stat('Length', `${Math.round(result.strokeLengthPixels)} px`),
    stat('Samples', String(result.pointCount)),
  ];

  if (result.kind === 'circle') {
    stats.splice(
      3,
      0,
      stat('Radius', `${Math.round(result.radius)} px`),
      stat('Closure', `${Math.round(result.closureGapPixels)} px`),
      stat('Join', `${Math.round(result.joinAngleDegrees)} deg`),
    );
  } else if (result.kind === 'target-circle') {
    stats.splice(
      3,
      0,
      stat('Center miss', `${Math.round(result.centerErrorPixels)} px`),
      stat('Radius miss', `${Math.round(result.radiusErrorPixels)} px`),
      stat('Closure', `${Math.round(result.closureGapPixels)} px`),
      stat('Join', `${Math.round(result.joinAngleDegrees)} deg`),
    );
  } else if (result.kind === 'target-ellipse') {
    stats.splice(
      3,
      0,
      stat('Center miss', `${Math.round(result.centerErrorPixels)} px`),
      stat('Major miss', `${Math.round(result.majorRadiusErrorPixels)} px`),
      stat('Minor miss', `${Math.round(result.minorRadiusErrorPixels)} px`),
      stat('Rotation', `${Math.round(result.rotationErrorDegrees)} deg`),
      stat('Closure', `${Math.round(result.closureGapPixels)} px`),
      stat('Join', `${Math.round(result.joinAngleDegrees)} deg`),
    );
  } else if (result.kind === 'ellipse') {
    stats.splice(
      3,
      0,
      stat('Major', `${Math.round(result.majorRadius)} px`),
      stat('Minor', `${Math.round(result.minorRadius)} px`),
      stat('Closure', `${Math.round(result.closureGapPixels)} px`),
      stat('Join', `${Math.round(result.joinAngleDegrees)} deg`),
    );
  } else if (result.kind === 'target-line') {
    stats.splice(
      3,
      0,
      stat('Start miss', `${Math.round(result.startErrorPixels)} px`),
      stat('End miss', `${Math.round(result.endErrorPixels)} px`),
      stat('Angle miss', `${Math.round(result.angleErrorDegrees)} deg`),
    );
  }

  return stats;
}

function stat(label: string, value: string): HTMLElement {
  const block = document.createElement('div');
  block.className = 'result-stat';
  const term = document.createElement('p');
  term.className = 'result-label';
  term.textContent = label;
  const detail = document.createElement('p');
  detail.className = 'result-value';
  detail.textContent = value;
  block.append(term, detail);
  return block;
}
