import { expect, test } from "@playwright/test";

test("length ratio estimation commits fraction input and updates progress", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        level: 3,
        name: "Horizontal Source, Aligned Target",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Horizontal Source, Aligned Target",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByTestId("length-ratio-estimate-canvas")).toBeVisible();

  await page.getByTestId("length-ratio-number").fill("2/3");
  await page.getByRole("button", { name: "Commit" }).click();

  await expect(page.locator(".feedback-banner")).toContainText(/Actual \d/);
  await expect(page.locator(".feedback-banner")).toContainText(/Estimate 0\.67/);
  await expect(page.locator(".feedback-banner")).toContainText(/Score \d+\.\d/);
  await expect(page.getByRole("button", { name: "Again" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Auto Next" })).toBeVisible();

  const progress = await page.evaluate(() => {
    const raw = window.localStorage.getItem("draftsman-eye.progress.v10");
    if (!raw) return null;
    return JSON.parse(raw) as {
      aggregates?: Record<string, unknown>;
      dimensions?: {
        lengthRatioBuckets?: Record<string, Record<string, unknown>>;
      };
      attempts?: Array<{ metadata?: Record<string, unknown> }>;
    };
  });
  expect(
    progress?.aggregates?.["length-ratio-estimate-horizontal-aligned"],
  ).toBeTruthy();
  expect(
    progress?.dimensions?.lengthRatioBuckets?.[
      "length-ratio-estimate-horizontal-aligned"
    ],
  ).toBeTruthy();
  expect(progress?.attempts?.[0]?.metadata?.lengthRatioBucket).toBeDefined();

  await page
    .getByRole("button", {
      name: "Review length ratio estimation practice",
    })
    .click();
  await expect(
    page.getByRole("dialog", {
      name: "Length ratio estimation tracker detail",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "Again" }).click();
  await expect(page.getByRole("button", { name: "Commit" })).toBeVisible();

  await page.getByTestId("length-ratio-number").fill("1");
  await page.getByRole("button", { name: "Commit" }).click();
  await page.getByRole("button", { name: "Auto Next" }).click();
  await expect(page.locator(".exercise-title")).toBeVisible();
});

test("length ratio estimation variants and filters are reachable", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("button", { name: /^Length Ratio Estimation/ })
    .click();
  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Vertical Source, Cross Target",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Random Source, Random Target",
      exact: true,
    }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Vertical" }).click();
  await page.getByRole("button", { name: "Cross" }).click();
  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Vertical Source, Cross Target",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Horizontal Source, Cross Target",
      exact: true,
    }),
  ).toHaveCount(0);
});
