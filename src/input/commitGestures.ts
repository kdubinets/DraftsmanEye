/** Commit shortcut helpers shared by exercise screens. */

import { distanceBetween } from "../geometry/primitives";

type CommitShortcutOptions = {
  canCommit: () => boolean;
  onCommit: () => void;
};

type DoubleTapCommitOptions = CommitShortcutOptions & {
  isSafeCommitPoint: (event: PointerEvent) => boolean;
  maxIntervalMs?: number;
  maxDistancePx?: number;
  maxMovementPx?: number;
};

type PointerSample = {
  pointerId: number;
  pointerType: string;
  x: number;
  y: number;
  time: number;
};

const DEFAULT_DOUBLE_TAP_INTERVAL_MS = 380;
const DEFAULT_DOUBLE_TAP_DISTANCE_PX = 32;
const DEFAULT_TAP_MOVEMENT_PX = 10;

export function installSpaceCommitShortcut(
  options: CommitShortcutOptions,
): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (!isSpaceKey(event) || event.repeat || event.defaultPrevented) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (isInteractiveKeyTarget(event.target)) return;
    if (!options.canCommit()) return;

    event.preventDefault();
    options.onCommit();
  };

  document.addEventListener("keydown", onKeyDown);
  return () => {
    document.removeEventListener("keydown", onKeyDown);
  };
}

export function createDoubleTapCommitDetector(
  options: DoubleTapCommitOptions,
): {
  onPointerDown: (event: PointerEvent) => void;
  onPointerUp: (event: PointerEvent) => void;
  reset: () => void;
} {
  const maxIntervalMs =
    options.maxIntervalMs ?? DEFAULT_DOUBLE_TAP_INTERVAL_MS;
  const maxDistancePx =
    options.maxDistancePx ?? DEFAULT_DOUBLE_TAP_DISTANCE_PX;
  const maxMovementPx = options.maxMovementPx ?? DEFAULT_TAP_MOVEMENT_PX;
  let down: PointerSample | null = null;
  let previousTap: PointerSample | null = null;

  return {
    onPointerDown(event): void {
      if (event.button !== 0) {
        down = null;
        return;
      }
      down = pointerSample(event);
    },
    onPointerUp(event): void {
      if (!down || down.pointerId !== event.pointerId) return;

      const up = pointerSample(event);
      const moved = distanceBetween(down, up);
      down = null;
      if (moved > maxMovementPx) return;
      if (!options.canCommit() || !options.isSafeCommitPoint(event)) {
        previousTap = null;
        return;
      }

      if (
        previousTap &&
        previousTap.pointerType === up.pointerType &&
        up.time - previousTap.time <= maxIntervalMs &&
        distanceBetween(previousTap, up) <= maxDistancePx
      ) {
        event.preventDefault();
        options.onCommit();
        previousTap = null;
        return;
      }

      previousTap = up;
    },
    reset(): void {
      down = null;
      previousTap = null;
    },
  };
}

function isSpaceKey(event: KeyboardEvent): boolean {
  return event.code === "Space" || event.key === " " || event.key === "Spacebar";
}

function isInteractiveKeyTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      'button, input, textarea, select, a[href], [contenteditable="true"], [role="button"]',
    ),
  );
}

function pointerSample(event: PointerEvent): PointerSample {
  return {
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    x: event.clientX,
    y: event.clientY,
    time: event.timeStamp,
  };
}
