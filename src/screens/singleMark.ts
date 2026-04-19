/**
 * Single-mark exercise screen used by all Division drills.
 * The SVG is rebuilt on result reveal rather than updated in-place; that's intentional
 * — the result overlay shares the same element pool as the pre-reveal canvas, so a
 * full rebuild is simpler than toggling visibility on many elements.
 */
import { getAutoExercise } from '../practice/catalog';
import type { SingleMarkExerciseDefinition, LineAxis, TrialLine, SingleMarkTrialResult } from '../practice/catalog';
import { getStoredProgress, updateStoredProgress } from '../storage/progress';
import { createSvg, localSvgPoint } from '../render/svg';
import {
  pageShell,
  exerciseHeader,
  resultStat,
  actionButton,
  formatSignedValue,
} from '../render/components';
import {
  feedbackHueForError,
  feedbackBandClass,
  feedbackLabel,
} from '../scoring/bands';
import type { AppState } from '../app/state';

export function mountSingleMarkScreen(
  root: HTMLElement,
  exercise: SingleMarkExerciseDefinition,
  source: 'direct' | 'auto',
  onNavigate: (next: AppState) => void,
): () => void {
  const trial = exercise.createTrial();
  let result: SingleMarkTrialResult | null = null;

  const screen = pageShell();
  const header = exerciseHeader(exercise, source);
  const stage = document.createElement('section');
  stage.className = 'exercise-stage';

  const prompt = document.createElement('p');
  prompt.className = 'exercise-prompt';
  prompt.textContent = trial.prompt;

  const feedback = document.createElement('p');
  feedback.className = 'feedback-banner';
  feedback.textContent = 'Place one mark on the line.';

  const summary = document.createElement('div');
  summary.className = 'result-summary';
  summary.hidden = true;

  const actions = document.createElement('div');
  actions.className = 'session-actions';

  const againBtn = actionButton('Again', () => {
    onNavigate({ screen: 'exercise', exerciseId: exercise.id, source });
  });
  againBtn.hidden = true;

  const backBtn = actionButton('Back to List', () => {
    onNavigate({ screen: 'list' });
  });
  backBtn.hidden = true;

  const autoBtn = actionButton('Auto Next', () => {
    const { exercise: next } = getAutoExercise(getStoredProgress());
    onNavigate({ screen: 'exercise', exerciseId: next.id, source: 'auto' });
  });
  autoBtn.hidden = true;

  let svg = renderTrialSvg(trial, () => result, onSelect);

  actions.append(againBtn, backBtn, autoBtn);
  stage.append(prompt, svg, feedback, summary, actions);
  screen.append(header, stage);
  root.append(screen);
  return () => {};

  function onSelect(scalar: number): void {
    if (result) return;
    revealResult(trial.scoreSelection(scalar));
  }

  function rerenderSvg(): void {
    const next = renderTrialSvg(trial, () => result, onSelect);
    svg.replaceWith(next);
    svg = next;
  }

  function revealResult(next: SingleMarkTrialResult): void {
    result = next;
    updateStoredProgress(exercise.id, result.relativeAccuracyPercent, result.signedErrorPixels);

    const hue = feedbackHueForError(result.relativeErrorPercent);
    const cls = feedbackBandClass(result.relativeErrorPercent);
    const accent = `hsl(${hue} 55% 42%)`;

    feedback.dataset.tone = cls;
    summary.dataset.tone = cls;
    feedback.style.setProperty('--result-accent', accent);
    summary.style.setProperty('--result-accent', accent);

    feedback.textContent =
      `${feedbackLabel(result.relativeErrorPercent)} · ` +
      `Error ${formatSignedValue(result.signedErrorPixels)} px · ` +
      `${result.relativeErrorPercent.toFixed(1)}% of line length`;

    summary.hidden = false;
    summary.replaceChildren(
      resultStat('Score', result.relativeAccuracyPercent.toFixed(1)),
      resultStat('Placed', `${Math.round(result.placedScalar)} px`),
      resultStat('Target', `${Math.round(result.targetScalar)} px`),
      resultStat(
        'Direction',
        result.signedErrorPixels === 0 ? 'Exact' : result.directionLabel,
      ),
    );

    againBtn.hidden = false;
    backBtn.hidden = false;
    autoBtn.hidden = false;
    rerenderSvg();
  }
}

function renderTrialSvg(
  trial: import('../practice/catalog').SingleMarkTrial,
  getResult: () => SingleMarkTrialResult | null,
  onSelect: (scalar: number) => void,
): SVGSVGElement {
  const svg = createSvg('svg');
  svg.setAttribute('class', 'exercise-canvas');
  svg.setAttribute(
    'viewBox',
    `0 0 ${trial.viewport.width} ${trial.viewport.height}`,
  );
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${trial.label} practice canvas`);
  svg.dataset.testid = 'exercise-canvas';
  svg.dataset.axis = trial.line.axis;

  const frame = createSvg('rect');
  frame.setAttribute('x', '1');
  frame.setAttribute('y', '1');
  frame.setAttribute('width', String(trial.viewport.width - 2));
  frame.setAttribute('height', String(trial.viewport.height - 2));
  frame.setAttribute('rx', '24');
  frame.setAttribute('class', 'canvas-frame');

  const line = createSvg('line');
  line.setAttribute('x1', String(linePoint(trial.line, 'start').x));
  line.setAttribute('y1', String(linePoint(trial.line, 'start').y));
  line.setAttribute('x2', String(linePoint(trial.line, 'end').x));
  line.setAttribute('y2', String(linePoint(trial.line, 'end').y));
  line.setAttribute('class', 'exercise-line');

  // Invisible hit-rect wider than the line so taps near the ends still register.
  const guide = createSvg('rect');
  if (trial.line.axis === 'horizontal') {
    guide.setAttribute('x', String(trial.line.startScalar));
    guide.setAttribute('y', String(trial.line.anchorY - 22));
    guide.setAttribute(
      'width',
      String(trial.line.endScalar - trial.line.startScalar),
    );
    guide.setAttribute('height', '44');
  } else {
    guide.setAttribute('x', String(trial.line.anchorX - 22));
    guide.setAttribute('y', String(trial.line.startScalar));
    guide.setAttribute('width', '44');
    guide.setAttribute(
      'height',
      String(trial.line.endScalar - trial.line.startScalar),
    );
  }
  guide.setAttribute('class', 'click-guide');

  const startCap = createTick(
    trial.line.axis,
    trial.line,
    trial.line.startScalar,
    'endpoint-tick',
  );
  const endCap = createTick(
    trial.line.axis,
    trial.line,
    trial.line.endScalar,
    'endpoint-tick',
  );

  svg.addEventListener('pointerdown', (event) => {
    const local = localSvgPoint(svg, event.clientX, event.clientY);
    if (!local) return;

    const scalar = scalarFromPoint(trial.line.axis, local);
    const crossDist = crossAxisDistance(trial.line.axis, trial.line, local);
    if (
      crossDist > 28 ||
      scalar < trial.line.startScalar - 12 ||
      scalar > trial.line.endScalar + 12
    ) {
      return;
    }
    onSelect(
      Math.max(
        trial.line.startScalar,
        Math.min(scalar, trial.line.endScalar),
      ),
    );
  });

  svg.append(frame, guide, line, startCap, endCap);

  const res = getResult();
  if (res) {
    const accent = `hsl(${feedbackHueForError(res.relativeErrorPercent)} 55% 42%)`;

    const gapEl = createSvg('line');
    const gapA = gapPoint(trial.line.axis, trial.line, res.placedScalar);
    const gapB = gapPoint(trial.line.axis, trial.line, res.targetScalar);
    gapEl.setAttribute('x1', String(gapA.x));
    gapEl.setAttribute('y1', String(gapA.y));
    gapEl.setAttribute('x2', String(gapB.x));
    gapEl.setAttribute('y2', String(gapB.y));
    gapEl.setAttribute('class', 'error-gap');
    gapEl.style.stroke = accent;

    const placedTick = createTick(
      trial.line.axis,
      trial.line,
      res.placedScalar,
      'user-tick',
    );
    placedTick.style.stroke = accent;

    svg.append(
      gapEl,
      placedTick,
      createTick(trial.line.axis, trial.line, res.targetScalar, 'target-tick'),
    );
  }

  return svg;
}

function createTick(
  axis: LineAxis,
  line: TrialLine,
  scalar: number,
  className: string,
): SVGLineElement {
  const tick = createSvg('line');
  const len = 30;
  if (axis === 'horizontal') {
    tick.setAttribute('x1', String(scalar));
    tick.setAttribute('y1', String(line.anchorY - len));
    tick.setAttribute('x2', String(scalar));
    tick.setAttribute('y2', String(line.anchorY + len));
  } else {
    tick.setAttribute('x1', String(line.anchorX - len));
    tick.setAttribute('y1', String(scalar));
    tick.setAttribute('x2', String(line.anchorX + len));
    tick.setAttribute('y2', String(scalar));
  }
  tick.setAttribute('class', className);
  return tick;
}

function linePoint(
  line: TrialLine,
  edge: 'start' | 'end',
): { x: number; y: number } {
  const s = edge === 'start' ? line.startScalar : line.endScalar;
  return line.axis === 'horizontal'
    ? { x: s, y: line.anchorY }
    : { x: line.anchorX, y: s };
}

function gapPoint(
  axis: LineAxis,
  line: TrialLine,
  scalar: number,
): { x: number; y: number } {
  const offset = 34;
  return axis === 'horizontal'
    ? { x: scalar, y: line.anchorY - offset }
    : { x: line.anchorX - offset, y: scalar };
}

function scalarFromPoint(
  axis: LineAxis,
  point: DOMPoint | SVGPoint,
): number {
  return axis === 'horizontal' ? point.x : point.y;
}

function crossAxisDistance(
  axis: LineAxis,
  line: TrialLine,
  point: DOMPoint | SVGPoint,
): number {
  return axis === 'horizontal'
    ? Math.abs(point.y - line.anchorY)
    : Math.abs(point.x - line.anchorX);
}
