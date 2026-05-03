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
});

test("curriculum practice returns to curriculum and records completions", async ({
  page,
}) => {
  await page.goto("/curriculum");
  await page
    .locator(".curriculum-row")
    .filter({ hasText: "Horizontal Halves" })
    .getByRole("button", { name: "Practice" })
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
