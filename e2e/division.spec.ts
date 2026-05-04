import { expect, test } from "@playwright/test";
import {
  completeHorizontalHalves,
  exerciseSvgPointsToClient,
  openHorizontalHalves,
  scrollExerciseSvgPointIntoView,
  svgLineMidpoint,
} from "./support/helpers";

test("division default adjustment commits only after revisions", async ({
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
        name: "Horizontal Halves",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Horizontal Halves",
      exact: true,
    }),
  ).toBeVisible();

  const lineBox = await page.locator(".exercise-line").boundingBox();
  if (!lineBox) throw new Error("Expected exercise line bounding box");

  await page.mouse.click(
    lineBox.x + lineBox.width * 0.25,
    lineBox.y + lineBox.height / 2,
  );
  await expect(page.getByText(/Score \d+\.\d/)).toHaveCount(0);
  await expect(page.locator(".candidate-tick")).toHaveCount(1);

  await page.mouse.click(
    lineBox.x + lineBox.width * 0.55,
    lineBox.y + lineBox.height / 2,
  );
  await expect(page.getByText(/Score \d+\.\d/)).toHaveCount(0);
  await expect(page.locator(".candidate-tick")).toHaveCount(1);

  await page.keyboard.press("Space");

  await expect(page.getByText(/Score \d+\.\d/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Again" })).toBeVisible();
});

test("division default adjustment commits from a safe double click on the canvas", async ({
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
        name: "Horizontal Halves",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Horizontal Halves",
      exact: true,
    }),
  ).toBeVisible();

  const midpoint = await svgLineMidpoint(page.locator(".exercise-line"));
  const [midpointClient] = await exerciseSvgPointsToClient(page, [midpoint]);
  await page.mouse.click(midpointClient.x, midpointClient.y);
  await expect(page.locator(".candidate-tick")).toHaveCount(1);
  await expect(page.getByText(/Score \d+\.\d/)).toHaveCount(0);

  const canvasBox = await page.getByTestId("exercise-canvas").boundingBox();
  if (!canvasBox) throw new Error("Expected exercise canvas bounding box");
  const safeX = canvasBox.x + 24;
  const safeY = canvasBox.y + 24;

  await page.mouse.click(safeX, safeY);
  await page.mouse.click(safeX + 4, safeY + 2);

  await expect(page.getByText(/Score \d+\.\d/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Again" })).toBeVisible();
});

test("single-mark toolbar is available before and after an attempt", async ({
  page,
}) => {
  await page.goto("/");

  await openHorizontalHalves(page);
  await expect(
    page.getByRole("button", { name: "Back to List" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Full" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pause" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Again" })).toHaveCount(0);

  await completeHorizontalHalves(page);

  await expect(
    page.getByRole("button", { name: "Back to List" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Full" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Again" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Auto Next" })).toHaveCount(0);
});

test("quick repeated single-mark clicks do not duplicate score updates", async ({
  page,
}) => {
  await page.goto("/");

  await openHorizontalHalves(page);
  const midpoint = await completeHorizontalHalves(page);
  await expect(page.getByText(/Error .* px/i)).toBeVisible();

  await page.mouse.click(midpoint.x, midpoint.y);
  await expect(page.getByRole("button", { name: "Again" })).toHaveCount(0);

  const attempts = await page.evaluate(() => {
    const raw = window.localStorage.getItem("draftsman-eye.progress.v8");
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { attempts?: unknown[] };
    return Array.isArray(parsed.attempts) ? parsed.attempts.length : 0;
  });
  expect(attempts).toBe(1);
});

test("horizontal halves 1-shot drill can be completed and updates score on return", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        level: 3,
        name: "Horizontal Halves 1-Shot",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Horizontal Halves 1-Shot" }),
  ).toBeVisible();
  await expect(page.getByText(/divided at one half/i)).toBeVisible();
  await expect(page.locator(".anchor-direction-cue")).toHaveCount(0);

  const line = page.locator(".exercise-line");
  const lineBox = await line.boundingBox();
  if (!lineBox) {
    throw new Error("Expected rendered exercise line to have a bounding box.");
  }

  const midpoint = await svgLineMidpoint(line);
  const [midpointClient] = await exerciseSvgPointsToClient(page, [midpoint]);
  await page.mouse.click(midpointClient.x, midpointClient.y);

  await expect(page.getByText(/Error .* px/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Again" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Back to List" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Auto Next" })).toHaveCount(0);

  await page.getByRole("button", { name: "Back to List" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: /choose a drill/i }),
  ).toBeVisible();
  await expect(
    page.locator(".score-chip").filter({ hasText: /^\d+\.\d$/ }),
  ).toHaveCount(1);
});

test("vertical thirds drill can be completed", async ({ page }) => {
  await page.goto("/");

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        level: 3,
        name: "Vertical Thirds 1-Shot",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Vertical Thirds 1-Shot" }),
  ).toBeVisible();
  await expect(page.getByText(/marked at one third/i)).toBeVisible();

  const line = page.locator(".exercise-line");
  const lineBox = await line.boundingBox();
  if (!lineBox) {
    throw new Error("Expected rendered exercise line to have a bounding box.");
  }

  const canvasBox = await page
    .locator('[data-testid="exercise-canvas"]')
    .boundingBox();
  if (!canvasBox) {
    throw new Error("Expected exercise canvas to have a bounding box.");
  }
  expect(lineBox.y).toBeGreaterThanOrEqual(canvasBox.y);
  expect(lineBox.y + lineBox.height).toBeLessThanOrEqual(
    canvasBox.y + canvasBox.height,
  );
  expect(canvasBox.height).toBeGreaterThan(500);

  const lineXBeforeResult = lineBox.x;
  const midpoint = await svgLineMidpoint(line);
  await scrollExerciseSvgPointIntoView(page, midpoint);
  const [midpointClient] = await exerciseSvgPointsToClient(page, [midpoint]);
  await page.mouse.click(midpointClient.x, midpointClient.y);
  await page
    .getByText(/Error .* px/i)
    .waitFor({ state: "visible", timeout: 800 })
    .catch(async () => {
      await page.mouse.click(midpointClient.x, midpointClient.y);
    });

  await expect(page.getByText(/Error .* px/i)).toBeVisible();
  await expect(page.getByText(/Too high|Too low|Exact/)).toBeVisible();

  const resultLineBox = await line.boundingBox();
  if (!resultLineBox) {
    throw new Error(
      "Expected rendered exercise line to stay mounted after result.",
    );
  }
  expect(resultLineBox.x).toBeCloseTo(lineXBeforeResult, 1);
});

test("random thirds drill can be completed on an arbitrary segment", async ({
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
        name: "Random Thirds 1-Shot",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Random Thirds 1-Shot" }),
  ).toBeVisible();
  await expect(page.getByText(/marked at one third/i)).toBeVisible();

  const line = page.locator(".exercise-line");
  const lineBox = await line.boundingBox();
  if (!lineBox) {
    throw new Error("Expected rendered random line to have a bounding box.");
  }
  const directionCueBox = await page
    .locator(".anchor-direction-cue")
    .boundingBox();
  if (!directionCueBox) {
    throw new Error("Expected random division direction cue to render.");
  }

  const midpoint = await svgLineMidpoint(line);
  await scrollExerciseSvgPointIntoView(page, midpoint);
  const [midpointClient] = await exerciseSvgPointsToClient(page, [midpoint]);
  await page.mouse.click(midpointClient.x, midpointClient.y);
  await page
    .getByText(/Error .* px/i)
    .waitFor({ state: "visible", timeout: 800 })
    .catch(async () => {
      await page.mouse.click(midpointClient.x, midpointClient.y);
    });

  await expect(page.getByText(/Error .* px/i)).toBeVisible();
  await expect(
    page.getByText(/Too far back|Too far forward|Exact/),
  ).toBeVisible();
});

test("Again re-runs the same drill without returning to the list", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        level: 3,
        name: "Horizontal Halves 1-Shot",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Horizontal Halves 1-Shot" }),
  ).toBeVisible();

  const line = page.locator(".exercise-line");
  const lineBox = await line.boundingBox();
  if (!lineBox) throw new Error("Expected exercise line bounding box");
  await page.mouse.click(
    lineBox.x + lineBox.width / 2,
    lineBox.y + lineBox.height / 2,
  );
  await expect(page.getByRole("button", { name: "Again" })).toBeVisible();

  await page.getByRole("button", { name: "Again" }).click();

  // Should be back on the same exercise — not the list
  await expect(
    page.getByRole("heading", { level: 1, name: "Horizontal Halves 1-Shot" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: /choose a drill/i }),
  ).toHaveCount(0);
  // Result buttons should be gone — fresh trial
  await expect(page.getByRole("button", { name: "Again" })).toHaveCount(0);
});

test("Auto Next is not shown after completion", async ({ page }) => {
  await page.goto("/");

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        level: 3,
        name: "Horizontal Halves 1-Shot",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  const line = page.locator(".exercise-line");
  const lineBox = await line.boundingBox();
  if (!lineBox) throw new Error("Expected exercise line bounding box");
  await page.mouse.click(
    lineBox.x + lineBox.width / 2,
    lineBox.y + lineBox.height / 2,
  );
  await expect(page.getByRole("button", { name: "Auto Next" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Again" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Back to List" }),
  ).toBeVisible();
});

test("progress persists across a full page reload", async ({ page }) => {
  await page.goto("/");

  // Complete a drill
  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        level: 3,
        name: "Horizontal Halves 1-Shot",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  const line = page.locator(".exercise-line");
  const lineBox = await line.boundingBox();
  if (!lineBox) throw new Error("Expected exercise line bounding box");
  await page.mouse.click(
    lineBox.x + lineBox.width / 2,
    lineBox.y + lineBox.height / 2,
  );
  await expect(page.getByText(/Error .* px/i)).toBeVisible();

  await page.getByRole("button", { name: "Back to List" }).click();
  await expect(
    page.locator(".score-chip").filter({ hasText: /^\d+\.\d$/ }),
  ).toHaveCount(1);

  // Reload — localStorage must survive
  await page.reload();
  await expect(
    page.getByRole("heading", { level: 1, name: /choose a drill/i }),
  ).toBeVisible();
  await expect(
    page.locator(".score-chip").filter({ hasText: /^\d+\.\d$/ }),
  ).toHaveCount(1);
});
