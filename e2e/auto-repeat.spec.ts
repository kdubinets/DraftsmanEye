import { expect, test } from "@playwright/test";
import {
  completeHorizontalHalves,
  distance,
  drawCircle,
  drawFreehandStraightLineAttempt,
  drawPolyline,
  freehandCanvasBox,
  interpolatedPoints,
  locatorCenter,
  openAngleCopy,
  openHorizontalHalves,
  openStraightLine,
  openTargetLine,
  openTraceCircle,
  svgCircleClientGeometry,
  svgLineEnd,
  svgPointsToClient,
} from "./support/helpers";

test("early freehand next attempt scores only fresh input", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "draftsman-eye.settings.v1",
      JSON.stringify({ autoRepeatDelayMs: 4000 }),
    );
  });
  await page.goto("/");

  await openStraightLine(page);
  await drawFreehandStraightLineAttempt(page);
  await expect(page.getByText(/Score \d+\.\d/)).toBeVisible();
  await expect(page.locator(".freehand-history-item")).toHaveCount(1);

  const canvasBox = await freehandCanvasBox(page);
  await page.mouse.move(canvasBox.x + 160, canvasBox.y + 330);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + 162, canvasBox.y + 331);
  await page.mouse.up();

  await expect(
    page.getByText("Stroke was too short. Draw a longer line."),
  ).toBeVisible();
  await expect(page.locator(".freehand-history-item")).toHaveCount(1);
  await expect(
    page.getByTestId("freehand-canvas").locator(".freehand-fit-line"),
  ).toBeHidden();
});

test("target line early next activates new target geometry", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "draftsman-eye.settings.v1",
      JSON.stringify({ autoRepeatDelayMs: 4000 }),
    );
  });
  await page.goto("/");

  await openTargetLine(page);
  const canvas = page.getByTestId("freehand-canvas");
  const canvasBox = await freehandCanvasBox(page);
  const oldMarks = canvas.locator(".freehand-target-mark");
  const oldTargets = [
    await locatorCenter(oldMarks.nth(0)),
    await locatorCenter(oldMarks.nth(1)),
  ];
  await drawPolyline(page, [
    { x: canvasBox.x + 160, y: canvasBox.y + 180 },
    { x: canvasBox.x + 360, y: canvasBox.y + 220 },
    { x: canvasBox.x + 580, y: canvasBox.y + 260 },
  ]);

  await expect(page.getByText(/Score \d+\.\d/)).toBeVisible();
  await expect(page.locator(".freehand-history-item")).toHaveCount(1);

  await canvas.click({ position: { x: 40, y: 40 } });

  await expect(canvas.locator(".freehand-ghost-stroke").first()).toBeVisible();
  await expect(canvas.locator(".freehand-target-correction-line")).toBeHidden();
  await expect(canvas.locator(".freehand-target-mark")).toHaveCount(2);

  const newMarks = canvas.locator(".freehand-target-mark");
  const newTargets = [
    await locatorCenter(newMarks.nth(0)),
    await locatorCenter(newMarks.nth(1)),
  ];
  expect(distance(oldTargets[0], newTargets[0])).toBeGreaterThan(4);

  const nextCanvasBox = await freehandCanvasBox(page);
  await drawPolyline(page, [
    { x: nextCanvasBox.x + 180, y: nextCanvasBox.y + 340 },
    { x: nextCanvasBox.x + 380, y: nextCanvasBox.y + 310 },
    { x: nextCanvasBox.x + 610, y: nextCanvasBox.y + 300 },
  ]);

  await expect(page.getByText(/Score \d+\.\d/)).toBeVisible();
  await expect(page.locator(".freehand-history-item")).toHaveCount(2);
});

test("trace circle early next fades prior result behind new guide", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "draftsman-eye.settings.v1",
      JSON.stringify({ autoRepeatDelayMs: null }),
    );
  });
  await page.goto("/");

  await openTraceCircle(page);
  const canvas = page.getByTestId("freehand-canvas");
  const firstGuide = await svgCircleClientGeometry(
    page,
    canvas.locator(".freehand-trace-guide"),
  );
  await drawCircle(page, firstGuide.center, firstGuide.radius, 36);

  await expect(page.getByText(/Score \d+\.\d/)).toBeVisible();
  await expect(page.locator(".freehand-history-item")).toHaveCount(1);

  await canvas.click({ position: { x: 40, y: 40 } });
  await expect(canvas.locator(".freehand-ghost-stroke").first()).toBeVisible();
  await expect(
    canvas.locator(".freehand-ghost-correction").first(),
  ).toBeVisible();
  await expect(canvas.locator(".freehand-trace-guide")).toHaveCount(1);

  const nextGuide = await svgCircleClientGeometry(
    page,
    canvas.locator(".freehand-trace-guide"),
  );
  await drawCircle(page, nextGuide.center, nextGuide.radius, 36);

  await expect(page.getByText(/Score \d+\.\d/)).toBeVisible();
  await expect(page.locator(".freehand-history-item")).toHaveCount(2);
});

test("angle copy early next scores against the new target", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "draftsman-eye.settings.v1",
      JSON.stringify({ autoRepeatDelayMs: null }),
    );
  });
  await page.goto("/");

  await openAngleCopy(page);
  const canvas = page.getByTestId("freehand-canvas");
  const oldVertex = await locatorCenter(
    canvas.locator(".freehand-angle-target-vertex"),
  );
  const oldBaseEnd = await svgLineEnd(
    canvas.locator(".freehand-angle-target-base"),
  );
  const [oldBaseEndClient] = await svgPointsToClient(page, [oldBaseEnd]);
  await drawPolyline(page, interpolatedPoints(oldVertex, oldBaseEndClient, 8));

  await expect(page.getByText(/Score \d+\.\d/)).toBeVisible();
  await expect(page.locator(".freehand-history-item")).toHaveCount(1);

  await canvas.click({ position: { x: 40, y: 40 } });

  await expect(canvas.locator(".freehand-ghost-stroke").first()).toBeVisible();
  await expect(canvas.locator(".freehand-target-correction-line")).toBeHidden();
  const newVertex = await locatorCenter(
    canvas.locator(".freehand-angle-target-vertex"),
  );
  expect(distance(oldVertex, newVertex)).toBeGreaterThan(4);

  const newBaseEnd = await svgLineEnd(
    canvas.locator(".freehand-angle-target-base"),
  );
  const [newBaseEndClient] = await svgPointsToClient(page, [newBaseEnd]);
  await drawPolyline(page, interpolatedPoints(newVertex, newBaseEndClient, 8));

  await expect(page.getByText(/Score \d+\.\d/)).toBeVisible();
  await expect(page.locator(".freehand-history-item")).toHaveCount(2);
});

test("pause keeps freehand result visible past the auto-repeat delay", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "draftsman-eye.settings.v1",
      JSON.stringify({ autoRepeatDelayMs: 1500 }),
    );
  });
  await page.goto("/");

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", { level: 3, name: "Straight Line" }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await drawFreehandStraightLineAttempt(page);
  await expect(page.getByText(/Score \d+\.\d/)).toBeVisible();

  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
  await page.waitForTimeout(1900);

  await expect(page.getByText(/Score \d+\.\d/)).toBeVisible();
  await expect(
    page.getByTestId("freehand-canvas").locator(".freehand-fit-line"),
  ).toBeVisible();
  await expect(page.locator(".freehand-history-item")).toHaveCount(1);
});

test("division drill auto-advances after the configured delay", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "draftsman-eye.settings.v1",
      JSON.stringify({ autoRepeatDelayMs: 1500 }),
    );
  });
  await page.goto("/");

  await openHorizontalHalves(page);
  await completeHorizontalHalves(page);

  await expect(page.locator(".target-tick")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Again" })).toBeVisible();
  await expect(page.locator(".target-tick")).toHaveCount(0, {
    timeout: 2500,
  });
  await expect(page.getByRole("button", { name: "Again" })).toHaveCount(0);
});

test("pause keeps single-mark result visible past the delay", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "draftsman-eye.settings.v1",
      JSON.stringify({ autoRepeatDelayMs: 1500 }),
    );
  });
  await page.goto("/");

  await openHorizontalHalves(page);
  await completeHorizontalHalves(page);

  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
  await page.waitForTimeout(1900);

  await expect(page.locator(".target-tick")).toHaveCount(1);
  await expect(page.getByText(/Error .* px/i)).toBeVisible();
});
