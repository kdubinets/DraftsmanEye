import { expect, test } from "@playwright/test";
import {
  circleThroughPoints,
  drawCircle,
  drawPolyline,
  interpolatedPoints,
  locatorCenter,
  openTargetLine,
  storedLineAngleBuckets,
  targetPlusCenter,
} from "./support/helpers";

test("target line drill scores a stroke with two target marks", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        level: 3,
        name: "Line Through Two Points",
      }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Line Through Two Points" }),
  ).toBeVisible();

  const marks = page
    .getByTestId("freehand-canvas")
    .locator(".freehand-target-mark");
  await expect(marks).toHaveCount(2);
  await expect(
    page.getByTestId("freehand-canvas").locator(".freehand-line-direction-cue"),
  ).toHaveCount(1);
  const start = await locatorCenter(marks.nth(0));
  const end = await locatorCenter(marks.nth(1));
  await drawPolyline(page, interpolatedPoints(start, end, 10));

  await expect(page.getByText(/Score \d+\.\d/)).toBeVisible();
  await expect(
    page.locator(".exercise-toolbar .line-angle-chart"),
  ).toBeVisible();
  await expect(page.locator(".line-angle-chart-sector")).toHaveCount(36);
  await expect(
    await storedLineAngleBuckets(page, "target-line-two-points"),
  ).toHaveLength(1);
  await expect(page.getByText("Endpoint miss", { exact: true })).toBeVisible();
  await expect(
    page
      .getByTestId("freehand-canvas")
      .locator(".freehand-target-correction-line"),
  ).toBeVisible();
  await expect(page.locator(".freehand-history-item")).toHaveCount(1);
});

test("target line directional prompt can be disabled", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "draftsman-eye.settings.v1",
      JSON.stringify({ directionalLineGuides: false }),
    );
  });
  await page.goto("/");
  await openTargetLine(page);

  const canvas = page.getByTestId("freehand-canvas");
  await expect(canvas.locator(".freehand-line-direction-cue")).toHaveCount(0);
  const marks = canvas.locator(".freehand-target-mark");
  const start = await locatorCenter(marks.nth(0));
  const end = await locatorCenter(marks.nth(1));
  await drawPolyline(page, interpolatedPoints(end, start, 10));

  await expect(page.getByText(/Score \d+\.\d/)).toBeVisible();
  await expect(page.getByText("Opposite stroke direction")).toHaveCount(0);
  await expect(
    await storedLineAngleBuckets(page, "target-line-two-points"),
  ).toHaveLength(1);
});

test("repeat mode keeps the same target line across attempts", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "draftsman-eye.settings.v1",
      JSON.stringify({ autoRepeatDelayMs: null }),
    );
  });
  await page.goto("/");
  await openTargetLine(page);

  await page.getByRole("button", { name: "Repeat target mode" }).click();
  await expect(page.getByRole("button", { name: "Repeat target mode" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  const canvas = page.getByTestId("freehand-canvas");
  const marks = canvas.locator(".freehand-target-mark");
  const firstStart = await locatorCenter(marks.nth(0));
  const firstEnd = await locatorCenter(marks.nth(1));
  await drawPolyline(page, interpolatedPoints(firstStart, firstEnd, 10));

  await expect(page.getByRole("button", { name: "Again" })).toBeVisible();
  await expect(page.getByRole("button", { name: "New" })).toBeVisible();
  await page.getByRole("button", { name: "Again" }).click();

  const secondStart = await locatorCenter(marks.nth(0));
  const secondEnd = await locatorCenter(marks.nth(1));
  expect(secondStart.x).toBeCloseTo(firstStart.x, 1);
  expect(secondStart.y).toBeCloseTo(firstStart.y, 1);
  expect(secondEnd.x).toBeCloseTo(firstEnd.x, 1);
  expect(secondEnd.y).toBeCloseTo(firstEnd.y, 1);

  await drawPolyline(page, interpolatedPoints(secondStart, secondEnd, 10));
  await expect(page.locator(".freehand-history-item")).toHaveCount(2);
  const attempts = await page.evaluate(() => {
    const raw = window.localStorage.getItem("draftsman-eye.progress.v10");
    return raw
      ? JSON.parse(raw).aggregates["target-line-two-points"]?.attempts
      : undefined;
  });
  expect(attempts).toBe(2);
});

test("target circle drill scores a circle from center and radius point", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", { level: 3, name: "Circle From Center" }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Circle From Center" }),
  ).toBeVisible();

  const canvas = page.getByTestId("freehand-canvas");
  const center = await locatorCenter(canvas.locator(".freehand-target-center"));
  const radiusPoint = await targetPlusCenter(
    canvas.locator(".freehand-target-mark").first(),
  );
  const radius = Math.hypot(radiusPoint.x - center.x, radiusPoint.y - center.y);

  await drawCircle(page, center, radius, 40);

  await expect(page.getByText(/Score \d+\.\d/)).toBeVisible();
  await expect(page.getByText("Center miss")).toBeVisible();
  await expect(
    canvas.locator(".freehand-target-correction-circle"),
  ).toBeVisible();
  await expect(page.locator(".freehand-history-item")).toHaveCount(1);
});

test("target circle drill scores a circle through three points", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        level: 3,
        name: "Circle Through Three Points",
      }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Circle Through Three Points",
    }),
  ).toBeVisible();

  const marks = page
    .getByTestId("freehand-canvas")
    .locator(".freehand-target-mark");
  await expect(marks).toHaveCount(3);
  await expect(
    page.getByTestId("freehand-canvas").locator(".freehand-target-center"),
  ).toHaveCount(0);
  const first = await targetPlusCenter(marks.nth(0));
  const second = await targetPlusCenter(marks.nth(1));
  const third = await targetPlusCenter(marks.nth(2));
  const circle = circleThroughPoints(first, second, third);

  await drawCircle(page, circle.center, circle.radius, 40);

  await expect(page.getByText(/Score \d+\.\d/)).toBeVisible();
  await expect(page.getByText("Radius miss")).toBeVisible();
  await expect(
    page
      .getByTestId("freehand-canvas")
      .locator(".freehand-target-correction-circle"),
  ).toBeVisible();
  await expect(page.locator(".freehand-history-item")).toHaveCount(1);
});
