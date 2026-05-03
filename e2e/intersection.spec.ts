import { expect, test } from "@playwright/test";
import {
  exerciseSvgPointsToClient,
  interpolatePoint,
  lineIntersection,
  svgLineEndpoints,
  svgLineMidpoint,
} from "./support/helpers";

test("intersection drill scores the marked crossing by angle", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        level: 3,
        name: "Projected Line Intersection 1-Shot",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Projected Line Intersection 1-Shot",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText(/short segment would cross/i)).toBeVisible();
  await expect(page.locator(".projection-line")).toBeVisible();

  const canvas = page.getByTestId("exercise-canvas");
  const canvasBefore = await canvas.boundingBox();
  if (!canvasBefore) {
    throw new Error("Expected intersection canvas to have a bounding box.");
  }
  const longLine = page.locator(".exercise-line");
  const midpoint = await svgLineMidpoint(longLine);
  const [midpointClient] = await exerciseSvgPointsToClient(page, [midpoint]);
  await page.mouse.click(midpointClient.x, midpointClient.y);

  await expect(page.getByText(/Angle error \d+\.\d°/)).toBeVisible();
  await expect(page.getByText(/Offset .* px/i)).toBeVisible();
  await expect(page.locator(".projection-result-ray")).toBeVisible();
  await expect(page.getByRole("button", { name: "Auto Next" })).toHaveCount(0);

  const canvasAfter = await canvas.boundingBox();
  if (!canvasAfter) {
    throw new Error("Expected intersection canvas to remain mounted.");
  }
  expect(canvasAfter.x).toBeCloseTo(canvasBefore.x, 1);
  expect(canvasAfter.y).toBeCloseTo(canvasBefore.y, 1);
  expect(canvasAfter.width).toBeCloseTo(canvasBefore.width, 1);
});

test("extrapolated intersection drill scores a free point mark", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        level: 3,
        name: "Extrapolated Segment Intersection 1-Shot",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Extrapolated Segment Intersection 1-Shot",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText(/two segments would meet/i)).toBeVisible();
  await expect(page.getByText(/Place one mark in the field/i)).toBeVisible();

  const first = await svgLineEndpoints(page.locator(".exercise-line"));
  const second = await svgLineEndpoints(page.locator(".projection-line"));
  const target = lineIntersection(first, second);
  const placed = { x: target.x + 18, y: target.y + 9 };
  const [placedClient] = await exerciseSvgPointsToClient(page, [placed]);
  await page.mouse.click(placedClient.x, placedClient.y);

  await expect(page.getByText(/Error 20\.1 px/)).toBeVisible();
  await expect(page.locator(".user-point-mark")).toBeVisible();
  await expect(page.locator(".target-point-mark")).toHaveCount(0);
  await expect(page.locator(".point-error-gap")).toBeVisible();
  await expect(page.locator(".projection-result-ray")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Auto Next" })).toHaveCount(0);
});

test("projected intersection default adjustment commits only after revisions", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "draftsman-eye.settings.v1",
      JSON.stringify({ autoRepeatDelayMs: null }),
    );
  });
  await page.goto("/");

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        level: 3,
        name: "Projected Line Intersection",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Projected Line Intersection",
      exact: true,
    }),
  ).toBeVisible();

  const longLine = await svgLineEndpoints(page.locator(".exercise-line"));
  const firstMark = interpolatePoint(longLine.start, longLine.end, 0.42);
  const revisedMark = interpolatePoint(longLine.start, longLine.end, 0.58);
  const [firstClient, revisedClient] = await exerciseSvgPointsToClient(page, [
    firstMark,
    revisedMark,
  ]);

  await page.mouse.click(firstClient.x, firstClient.y);
  await expect(page.getByText(/Angle error \d+\.\d°/)).toHaveCount(0);
  await expect(page.locator(".candidate-tick")).toHaveCount(1);

  await page.mouse.click(revisedClient.x, revisedClient.y);
  await expect(page.getByText(/Angle error \d+\.\d°/)).toHaveCount(0);
  await expect(page.locator(".candidate-tick")).toHaveCount(1);

  await page.getByRole("button", { name: "Commit" }).click();

  await expect(page.getByText(/Angle error \d+\.\d°/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Again" })).toBeVisible();
});

test("extrapolated intersection default adjustment commits only after revisions", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "draftsman-eye.settings.v1",
      JSON.stringify({ autoRepeatDelayMs: null }),
    );
  });
  await page.goto("/");

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        level: 3,
        name: "Extrapolated Segment Intersection",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Extrapolated Segment Intersection",
      exact: true,
    }),
  ).toBeVisible();

  const first = await svgLineEndpoints(page.locator(".exercise-line"));
  const second = await svgLineEndpoints(page.locator(".projection-line"));
  const target = lineIntersection(first, second);
  const firstPlaced = { x: target.x + 34, y: target.y + 12 };
  const revised = { x: target.x + 18, y: target.y + 9 };
  const [firstClient, revisedClient] = await exerciseSvgPointsToClient(page, [
    firstPlaced,
    revised,
  ]);

  await page.mouse.click(firstClient.x, firstClient.y);
  await expect(page.getByText(/Error .* px/i)).toHaveCount(0);
  await expect(page.locator(".candidate-point-mark")).toHaveCount(1);

  await page.mouse.click(revisedClient.x, revisedClient.y);
  await expect(page.getByText(/Error .* px/i)).toHaveCount(0);
  await expect(page.locator(".candidate-point-mark")).toHaveCount(1);

  await page.getByRole("button", { name: "Commit" }).click();

  await expect(page.getByText(/Error 20\.1 px/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Again" })).toBeVisible();
});
