/** Counts focused, recently active practice time for one mounted exercise. */
import type { ExerciseId } from "../practice/catalog";
import { recordCurriculumActiveTime } from "./curriculumStats";

const DEFAULT_IDLE_THRESHOLD_MS = 30_000;
const TICK_MS = 1_000;

export function startActivePracticeTimer(
  exerciseId: ExerciseId,
  root: HTMLElement,
  idleThresholdMs = DEFAULT_IDLE_THRESHOLD_MS,
): () => void {
  let activeMs = 0;
  let lastTickAt = Date.now();
  let lastActivityAt = lastTickAt;
  let listening = true;

  const tick = (): void => {
    const now = Date.now();
    if (document.visibilityState === "visible" && document.hasFocus()) {
      const activeUntil = Math.min(now, lastActivityAt + idleThresholdMs);
      if (activeUntil > lastTickAt) {
        activeMs += activeUntil - lastTickAt;
      }
    }
    lastTickAt = now;
  };

  const markActivity = (): void => {
    if (!listening) return;
    tick();
    lastActivityAt = Date.now();
  };

  const interval = window.setInterval(tick, TICK_MS);
  root.addEventListener("pointerdown", markActivity);
  root.addEventListener("pointermove", markActivity);
  root.addEventListener("pointerup", markActivity);
  root.addEventListener("keydown", markActivity);
  window.addEventListener("focus", markActivity);
  window.addEventListener("blur", tick);
  document.addEventListener("visibilitychange", tick);

  return () => {
    listening = false;
    tick();
    window.clearInterval(interval);
    root.removeEventListener("pointerdown", markActivity);
    root.removeEventListener("pointermove", markActivity);
    root.removeEventListener("pointerup", markActivity);
    root.removeEventListener("keydown", markActivity);
    window.removeEventListener("focus", markActivity);
    window.removeEventListener("blur", tick);
    document.removeEventListener("visibilitychange", tick);
    recordCurriculumActiveTime(exerciseId, activeMs / 1000);
  };
}
