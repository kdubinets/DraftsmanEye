import { expect, test } from "@playwright/test";

test("angle estimation drill commits numeric estimate and updates progress", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        level: 3,
        name: "Horizontal Base",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Horizontal Base",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByTestId("angle-estimate-canvas")).toBeVisible();
  await expect(page.locator(".angle-estimate-user-ray")).toHaveCount(0);

  await page.getByTestId("angle-estimate-slider").fill("45");
  await expect(page.getByTestId("angle-estimate-number")).toHaveValue("45");
  await page.getByRole("button", { name: "Commit" }).click();

  await expect(page.getByText(/Correct \d+°/)).toBeVisible();
  await expect(page.getByText(/Estimate 45°/)).toBeVisible();
  await expect(page.getByText(/Error [+-]?\d/)).toBeVisible();
  await expect(page.locator(".angle-estimate-user-ray")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Again" })).toBeVisible();

  const progress = await page.evaluate(() => {
    const raw = window.localStorage.getItem("draftsman-eye.progress.v9");
    if (!raw) return null;
    return JSON.parse(raw) as {
      aggregates?: Record<string, unknown>;
      dimensions?: {
        angleEstimateBuckets?: Record<string, Record<string, unknown>>;
      };
    };
  });
  expect(progress?.aggregates?.["angle-estimate-horizontal"]).toBeTruthy();
  expect(
    progress?.dimensions?.angleEstimateBuckets?.["angle-estimate-horizontal"],
  ).toBeTruthy();

  await page.getByRole("button", { name: "Back to List" }).click();
  await expect(
    page
      .getByRole("article")
      .filter({
        has: page.getByRole("heading", {
          level: 3,
          name: "Horizontal Base",
          exact: true,
        }),
      })
      .locator(".score-chip")
      .filter({ hasText: /^\d+\.\d$/ }),
  ).toHaveCount(1);
});

test("angle estimation varieties and bucket widget are reachable", async ({
  page,
}) => {
  await page.goto("/");

  for (const label of ["Vertical Base", "Random Base"]) {
    await page
      .getByRole("article")
      .filter({
        has: page.getByRole("heading", {
          level: 3,
          name: label,
          exact: true,
        }),
      })
      .getByRole("button", { name: "Practice" })
      .click();

    await expect(
      page.getByRole("heading", { level: 1, name: label, exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("angle-estimate-canvas")).toBeVisible();
    await page.getByTestId("angle-estimate-number").fill("90");
    await page.getByRole("button", { name: "Commit" }).click();
    await page
      .getByRole("button", { name: "Review angle estimation practice" })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Angle estimation tracker detail" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();
    await page.getByRole("button", { name: "Back to List" }).click();
  }
});

test("angle estimation supports spacebar next and auto-repeat pause", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        level: 3,
        name: "Horizontal Base",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await page.getByTestId("angle-estimate-number").fill("45");
  await page.getByRole("button", { name: "Commit" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();

  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "Commit" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pause" })).toHaveCount(0);
  await expect(page.locator(".angle-estimate-user-ray")).toHaveCount(0);
});

test("angle estimation spacebar works from focused controls", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        level: 3,
        name: "Horizontal Base",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await page.getByTestId("angle-estimate-number").fill("45");
  await page.keyboard.press("Space");
  await expect(page.locator(".angle-estimate-user-ray")).toHaveCount(1);

  await page.keyboard.press("Space");
  await expect(page.locator(".angle-estimate-user-ray")).toHaveCount(0);

  await page.getByTestId("angle-estimate-slider").focus();
  await page.keyboard.press("Space");
  await expect(page.locator(".angle-estimate-user-ray")).toHaveCount(1);

  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "Commit" }).focus();
  await page.keyboard.press("Space");
  await expect(page.locator(".angle-estimate-user-ray")).toHaveCount(1);
});
