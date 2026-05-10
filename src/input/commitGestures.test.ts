import { describe, expect, it, vi } from "vitest";
import { createDoubleTapCommitDetector } from "./commitGestures";

describe("createDoubleTapCommitDetector", () => {
  it("commits after two close safe taps", () => {
    const onCommit = vi.fn();
    const detector = createDoubleTapCommitDetector({
      canCommit: () => true,
      isSafeCommitPoint: () => true,
      onCommit,
    });

    detector.onPointerDown(pointerEvent("pointerdown", 10, 10, 0));
    detector.onPointerUp(pointerEvent("pointerup", 10, 10, 20));
    detector.onPointerDown(pointerEvent("pointerdown", 18, 12, 220));
    detector.onPointerUp(pointerEvent("pointerup", 18, 12, 240));

    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("commits after two Apple Pencil-like tip taps", () => {
    const onCommit = vi.fn();
    const detector = createDoubleTapCommitDetector({
      canCommit: () => true,
      isSafeCommitPoint: () => true,
      onCommit,
    });

    detector.onPointerDown(
      pointerEvent("pointerdown", 10, 10, 0, { button: -1, buttons: 1 }),
    );
    detector.onPointerUp(pointerEvent("pointerup", 10, 10, 20));
    detector.onPointerDown(
      pointerEvent("pointerdown", 18, 12, 220, { button: -1, buttons: 1 }),
    );
    detector.onPointerUp(pointerEvent("pointerup", 18, 12, 240));

    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("does not commit from pen barrel or eraser button input", () => {
    const onCommit = vi.fn();
    const detector = createDoubleTapCommitDetector({
      canCommit: () => true,
      isSafeCommitPoint: () => true,
      onCommit,
    });

    detector.onPointerDown(
      pointerEvent("pointerdown", 10, 10, 0, { button: 2, buttons: 2 }),
    );
    detector.onPointerUp(pointerEvent("pointerup", 10, 10, 20));
    detector.onPointerDown(
      pointerEvent("pointerdown", 18, 12, 220, { button: 5, buttons: 32 }),
    );
    detector.onPointerUp(pointerEvent("pointerup", 18, 12, 240));

    expect(onCommit).not.toHaveBeenCalled();
  });

  it("does not commit when a tap lands in the active exercise area", () => {
    const onCommit = vi.fn();
    const detector = createDoubleTapCommitDetector({
      canCommit: () => true,
      isSafeCommitPoint: (event) => event.clientX > 100,
      onCommit,
    });

    detector.onPointerDown(pointerEvent("pointerdown", 10, 10, 0));
    detector.onPointerUp(pointerEvent("pointerup", 10, 10, 20));
    detector.onPointerDown(pointerEvent("pointerdown", 120, 12, 220));
    detector.onPointerUp(pointerEvent("pointerup", 120, 12, 240));

    expect(onCommit).not.toHaveBeenCalled();
  });

  it("does not treat a drag as a tap", () => {
    const onCommit = vi.fn();
    const detector = createDoubleTapCommitDetector({
      canCommit: () => true,
      isSafeCommitPoint: () => true,
      onCommit,
    });

    detector.onPointerDown(pointerEvent("pointerdown", 10, 10, 0));
    detector.onPointerUp(pointerEvent("pointerup", 35, 10, 20));
    detector.onPointerDown(pointerEvent("pointerdown", 10, 10, 220));
    detector.onPointerUp(pointerEvent("pointerup", 10, 10, 240));

    expect(onCommit).not.toHaveBeenCalled();
  });
});

function pointerEvent(
  type: "pointerdown" | "pointerup",
  x: number,
  y: number,
  timeStamp: number,
  options: { button?: number; buttons?: number; pointerType?: string } = {},
): PointerEvent {
  return {
    type,
    button: options.button ?? 0,
    buttons: options.buttons ?? (type === "pointerup" ? 0 : 1),
    pointerId: 1,
    pointerType: options.pointerType ?? "pen",
    clientX: x,
    clientY: y,
    timeStamp,
    preventDefault: vi.fn(),
  } as unknown as PointerEvent;
}
