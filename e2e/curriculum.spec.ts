import { expect, test } from "@playwright/test";

test("curriculum page renders hierarchy and remembers stage tabs", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Curriculum" }).click();
  await expect(page).toHaveURL("/curriculum");
  await expect(
    page.getByRole("heading", { level: 1, name: "Curriculum" }),
  ).toBeVisible();

  await expect(page.getByRole("button", { name: /Division/ })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(
    page.getByRole("button", { name: "H", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Horizontal Halves")).toBeVisible();

  await page.getByRole("button", { name: /Length/ }).click();
  await page.getByRole("button", { name: "1:1 Rand" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: /Length/ })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(page.getByRole("button", { name: "1:1 Rand" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.getByRole("button", { name: /Intersection/ }).click();
  await expect(
    page.getByText("Projected Line Intersection", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Extrapolated Segment Intersection", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: /Figure Representation/ }).click();
  await expect(
    page.getByRole("button", { name: "Flat Shapes" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Triangle", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Four-Sided Figure", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Solids", exact: true }).click();
  await expect(
    page.getByText("Cube — 2-Point Perspective", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Triangular Pyramid — 2-Point Perspective", {
      exact: true,
    }),
  ).toBeVisible();
  const tableOverflows = await page
    .locator(".curriculum-table")
    .evaluate((element) => element.scrollWidth > element.clientWidth);
  expect(tableOverflows).toBe(false);

  await page.getByRole("button", { name: /Straight Lines/ }).click();
  await expect(page.getByRole("button", { name: "Freehand" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByText("Straight Line", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Target" }).click();
  await expect(
    page.getByText("Line Through Two Points", { exact: true }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: /Circle \/ Ellipse \/ Loopy Figures/ })
    .click();
  await expect(page.getByText("Circle", { exact: true })).toBeVisible();
  await expect(page.getByText("Ellipse", { exact: true })).toBeVisible();
  await expect(page.getByText("Free Loops", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Trace+" }).click();
  await expect(page.getByText("Trace Circle", { exact: true })).toBeVisible();
  await expect(page.getByText("Trace Ellipse", { exact: true })).toBeVisible();
  await expect(page.getByText("Linear Loops", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Trace Archimedean Spiral — Right", { exact: true }),
  ).toBeVisible();
});

test("curriculum practice returns to curriculum and records completions", async ({
  page,
}) => {
  await page.goto("/curriculum");
  await page
    .locator(".curriculum-row")
    .filter({ hasText: "Horizontal Halves" })
    .getByRole("button", { name: "Horizontal Halves" })
    .click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Horizontal Halves" }),
  ).toBeVisible();
  const lineBox = await page.locator(".exercise-line").boundingBox();
  if (!lineBox) throw new Error("Expected exercise line bounding box");
  await page.mouse.click(
    lineBox.x + lineBox.width * 0.55,
    lineBox.y + lineBox.height / 2,
  );
  await page.getByRole("button", { name: "Commit" }).click();
  await expect(page.getByText(/Score \d+\.\d/)).toBeVisible();
  await page.getByRole("button", { name: "Back to Curriculum" }).click();

  await expect(page).toHaveURL("/curriculum");
  const row = page.locator(".curriculum-row").filter({ hasText: "Horizontal Halves" });
  await expect(row).toContainText("1");
});

test("curriculum target settings appear on top-level groups", async ({
  page,
}) => {
  await page.goto("/settings");
  await page
    .getByLabel("Division")
    .fill("10");

  await page.getByRole("button", { name: "Back to list" }).click();
  await page.getByRole("button", { name: "Curriculum" }).click();

  await expect(page.getByRole("button", { name: /Division/ })).toContainText(
    "Need 10m today",
  );
  await expect(page.getByRole("button", { name: /Division/ })).toContainText(
    "10m below 7d target",
  );
});
