import { expect, test } from "@playwright/test";

test("length transfer default adjustment commits only after revisions", async ({
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
        name: "Copy Horizontal to Vertical",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Copy Horizontal to Vertical",
      exact: true,
    }),
  ).toBeVisible();

  const lineBox = await page.locator(".exercise-line").boundingBox();
  if (!lineBox) throw new Error("Expected exercise line bounding box");

  await page.mouse.click(
    lineBox.x + lineBox.width / 2,
    lineBox.y + lineBox.height * 0.35,
  );
  await expect(page.getByText(/Score \d+\.\d/)).toHaveCount(0);
  await expect(page.locator(".candidate-tick")).toHaveCount(1);

  await page.mouse.click(
    lineBox.x + lineBox.width / 2,
    lineBox.y + lineBox.height * 0.7,
  );
  await expect(page.getByText(/Score \d+\.\d/)).toHaveCount(0);

  await page.getByRole("button", { name: "Commit" }).click();

  await expect(page.getByText(/Score \d+\.\d/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Again" })).toBeVisible();
});

test("cross-axis double drill scores a mark on the full guide", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        level: 3,
        name: "Double Horizontal on Vertical 1-Shot",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Double Horizontal on Vertical 1-Shot",
    }),
  ).toBeVisible();
  const referenceBox = await page.locator(".reference-line").boundingBox();
  if (!referenceBox) {
    throw new Error("Expected transfer reference to have a bounding box.");
  }
  const anchorBox = await page.locator(".anchor-tick").boundingBox();
  if (!anchorBox) {
    throw new Error("Expected transfer anchor to have a bounding box.");
  }
  const directionCueBox = await page
    .locator(".anchor-direction-cue")
    .boundingBox();
  if (!directionCueBox) {
    throw new Error("Expected transfer direction cue to have a bounding box.");
  }

  const guide = page.locator(".exercise-line");
  const guideBox = await guide.boundingBox();
  if (!guideBox) {
    throw new Error("Expected transfer guide to have a bounding box.");
  }

  const canvasBox = await page.getByTestId("exercise-canvas").boundingBox();
  if (!canvasBox) {
    throw new Error("Expected exercise canvas to have a bounding box.");
  }
  expect(guideBox.height).toBeGreaterThan(canvasBox.height * 0.75);

  await page.mouse.click(
    guideBox.x + guideBox.width / 2,
    guideBox.y + guideBox.height / 2,
  );

  await expect(page.getByText(/Error .* px/i)).toBeVisible();
  await expect(page.getByText(/Too high|Too low|Exact/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Auto Next" })).toHaveCount(0);
});
