/** Trial target geometry generation for target and trace exercise variants. */
import { randomRange, pointOnCircle } from '../../geometry/primitives';
import type { FreehandExerciseDefinition } from '../../practice/catalog';
import type { FreehandTarget, TargetLine, TargetCircle, TargetEllipse } from './types';

export function createFreehandTarget(
  kind: FreehandExerciseDefinition['kind'],
): FreehandTarget | null {
  switch (kind) {
    case 'target-line-two-points':
      return createTargetLine();
    case 'trace-line':
      return { ...createTargetLine(), trace: true };
    case 'target-circle-center-point':
      return createTargetCircle(1);
    case 'target-circle-three-points':
      return createTargetCircle(3);
    case 'trace-circle':
      return createTraceCircle();
    case 'trace-ellipse':
      return createTraceEllipse();
    case 'freehand-circle':
    case 'freehand-ellipse':
    case 'freehand-line':
      return null;
  }
}

function createTargetLine(): TargetLine {
  const length = randomRange(340, 520);
  const angle = randomRange(-0.45, 0.45);
  const center = { x: randomRange(320, 680), y: randomRange(210, 410) };
  const half = length / 2;
  return {
    kind: 'line',
    start: {
      x: center.x - Math.cos(angle) * half,
      y: center.y - Math.sin(angle) * half,
    },
    end: {
      x: center.x + Math.cos(angle) * half,
      y: center.y + Math.sin(angle) * half,
    },
  };
}

function createTargetCircle(markCount: 1 | 3): TargetCircle {
  const radius = randomRange(100, 170);
  const center = {
    x: randomRange(260 + radius, 740 - radius),
    y: randomRange(120 + radius, 500 - radius),
  };
  const startAngle = randomRange(0, Math.PI * 2);
  const marks =
    markCount === 1
      ? [pointOnCircle(center, radius, startAngle)]
      : [0, 1, 2].map((i) =>
          pointOnCircle(
            center,
            radius,
            startAngle +
              i * ((Math.PI * 2) / 3) +
              randomRange(-0.24, 0.24),
          ),
        );
  return { kind: 'circle', center, radius, marks, showCenter: markCount === 1 };
}

function createTraceCircle(): TargetCircle {
  const radius = randomRange(105, 180);
  return {
    kind: 'circle',
    center: {
      x: randomRange(260 + radius, 740 - radius),
      y: randomRange(120 + radius, 500 - radius),
    },
    radius,
    marks: [],
    showCenter: false,
    trace: true,
  };
}

function createTraceEllipse(): TargetEllipse {
  const majorRadius = randomRange(150, 240);
  const minorRadius = randomRange(70, 130);
  // Both bounds use majorRadius so the rotated ellipse stays within the canvas
  // regardless of orientation.
  return {
    kind: 'ellipse',
    center: {
      x: randomRange(80 + majorRadius, 920 - majorRadius),
      y: randomRange(70 + majorRadius, 550 - majorRadius),
    },
    majorRadius,
    minorRadius,
    rotationRadians: randomRange(-0.65, 0.65),
    trace: true,
  };
}
