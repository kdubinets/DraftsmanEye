import { expect, test } from "@playwright/test";
import {
  expectPointInsideLocator,
  locatorCenter,
  svgLineEnd,
  svgPointsToClient,
} from "./support/helpers";

test("angle copy free draw 1-shot scores a drawn ray from the target vertex", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        level: 3,
        name: "Horizontal Reference, Rotated Base Free Draw 1-Shot",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Horizontal Reference, Rotated Base Free Draw 1-Shot",
      exact: true,
    }),
  ).toBeVisible();

  const canvas = page.getByTestId("freehand-canvas");
  await expect(canvas.locator(".freehand-angle-reference-ray")).toHaveCount(2);
  await expect(canvas.locator(".freehand-angle-target-base")).toHaveCount(1);
  await expect(canvas.locator(".freehand-angle-direction-cue")).toHaveCount(1);
  const vertex = await locatorCenter(
    canvas.locator(".freehand-angle-target-vertex"),
  );
  const baseEnd = await svgLineEnd(
    canvas.locator(".freehand-angle-target-base"),
  );
  const [baseEndClient] = await svgPointsToClient(page, [baseEnd]);

  await page.mouse.move(vertex.x, vertex.y);
  await page.mouse.down();
  for (let index = 1; index <= 8; index += 1) {
    const ratio = index / 8;
    await page.mouse.move(
      vertex.x + (baseEndClient.x - vertex.x) * ratio,
      vertex.y + (baseEndClient.y - vertex.y) * ratio,
    );
  }
  await page.mouse.up();

  await expect(page.getByText(/Score \d+\.\d/)).toBeVisible();
  await expect(page.getByText("Angle miss", { exact: true })).toBeVisible();
  await expect(
    canvas.locator(".freehand-target-correction-line"),
  ).toBeVisible();
  await expect(page.locator(".freehand-history-item")).toHaveCount(1);
});

test("angle copy free draw 1-shot accepts a ray drawn toward the target vertex", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        level: 3,
        name: "Horizontal Reference, Rotated Base Free Draw 1-Shot",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  const canvas = page.getByTestId("freehand-canvas");
  const vertex = await locatorCenter(
    canvas.locator(".freehand-angle-target-vertex"),
  );
  const baseEnd = await svgLineEnd(
    canvas.locator(".freehand-angle-target-base"),
  );
  const [baseEndClient] = await svgPointsToClient(page, [baseEnd]);

  await page.mouse.move(baseEndClient.x, baseEndClient.y);
  await page.mouse.down();
  for (let index = 1; index <= 8; index += 1) {
    const ratio = index / 8;
    await page.mouse.move(
      baseEndClient.x + (vertex.x - baseEndClient.x) * ratio,
      baseEndClient.y + (vertex.y - baseEndClient.y) * ratio,
    );
  }
  await page.mouse.up();

  await expect(page.getByText(/Score \d+\.\d/)).toBeVisible();
  await expect(page.getByText("Angle miss", { exact: true })).toBeVisible();
});

test("angle copy default adjustable line commits after revisions", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        level: 3,
        name: "Horizontal Reference, Rotated Base",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Horizontal Reference, Rotated Base",
      exact: true,
    }),
  ).toBeVisible();

  const canvas = page.getByTestId("freehand-canvas");
  const handle = canvas.locator(".freehand-adjustable-handle");
  const initial = await locatorCenter(handle);
  await expectPointInsideLocator(canvas, initial);
  const baseEnd = await svgLineEnd(
    canvas.locator(".freehand-angle-target-base"),
  );
  const [baseEndClient] = await svgPointsToClient(page, [baseEnd]);

  await page.mouse.move(initial.x, initial.y);
  await page.mouse.down();
  await page.mouse.move(baseEndClient.x, baseEndClient.y - 80);
  await page.mouse.up();
  await expect(page.getByText(/Score \d+\.\d/)).toHaveCount(0);
  await expect(handle).toBeVisible();
  await expect(page.locator(".freehand-history-item")).toHaveCount(0);

  const revised = await locatorCenter(handle);
  await page.mouse.move(revised.x, revised.y);
  await page.mouse.down();
  await page.mouse.move(baseEndClient.x, baseEndClient.y);
  await page.mouse.up();
  await expect(page.getByText(/Score \d+\.\d/)).toHaveCount(0);

  await page.getByRole("button", { name: "Commit" }).click();

  await expect(page.getByText(/Score \d+\.\d/)).toBeVisible();
  await expect(
    canvas.locator(".freehand-target-correction-line"),
  ).toBeVisible();
  await expect(page.locator(".freehand-history-item")).toHaveCount(1);
});

test("angle copy adjustable 1-shot scores after dragging one endpoint", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        level: 3,
        name: "Horizontal Reference, Rotated Base 1-Shot",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Horizontal Reference, Rotated Base 1-Shot",
      exact: true,
    }),
  ).toBeVisible();

  const canvas = page.getByTestId("freehand-canvas");
  const handle = canvas.locator(".freehand-adjustable-handle");
  const initial = await locatorCenter(handle);
  await expectPointInsideLocator(canvas, initial);
  const baseEnd = await svgLineEnd(
    canvas.locator(".freehand-angle-target-base"),
  );
  const [baseEndClient] = await svgPointsToClient(page, [baseEnd]);

  await page.mouse.move(initial.x, initial.y);
  await page.mouse.down();
  await page.mouse.move(baseEndClient.x, baseEndClient.y);
  await page.mouse.up();

  await expect(page.getByText(/Score \d+\.\d/)).toBeVisible();
  await expect(
    canvas.locator(".freehand-target-correction-line"),
  ).toBeVisible();
  await expect(canvas.locator(".freehand-adjustable-line")).toBeHidden();
  await expect(page.locator(".freehand-history-item")).toHaveCount(1);
});
