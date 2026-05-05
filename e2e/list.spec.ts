import { expect, test } from "@playwright/test";

test("home page lists drills and switches to curriculum presentation", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: /choose a drill/i }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Curriculum" })).toBeVisible();
  await expect(
    page.getByText("Let the app choose the next drill."),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Horizontal Halves",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 3, name: "Straight Line" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 3, name: "Circle", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 3, name: "Ellipse", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 3, name: "Line Through Two Points" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 3, name: "Circle From Center" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Circle Through Three Points",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 3, name: "Trace Line" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 3, name: "Trace Circle" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 3, name: "Trace Ellipse" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Horizontal Reference, Aligned Base",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Arbitrary Reference, Rotated Base",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Horizontal Thirds",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Vertical Halves",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Vertical Fifths",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Random Thirds",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Copy Horizontal to Vertical",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Copy Vertical to Horizontal",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Double Horizontal on Horizontal",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Double Vertical on Horizontal",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Copy Distance on Random Lines",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Double Distance on Random Lines",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Projected Line Intersection",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Extrapolated Segment Intersection",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Triangle",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Four-Sided Figure",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Five-Sided Figure",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Six-Sided Figure",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Cube — 2-Point Perspective",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Box — 2-Point Perspective",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Triangular Prism — 2-Point Perspective",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Square Pyramid — 2-Point Perspective",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Triangular Pyramid — 2-Point Perspective",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("New")).toHaveCount(100);
  await expect(page.getByRole("button", { name: "Coming soon" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("button", { name: "Practice" })).toHaveCount(100);
  await expect(
    page
      .getByRole("article")
      .filter({
        has: page.getByRole("heading", {
          level: 3,
          name: "Double Horizontal on Horizontal",
          exact: true,
        }),
      })
      .getByRole("button", { name: "Practice" }),
  ).toBeEnabled();

  await page.getByRole("button", { name: "Curriculum" }).click();
  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("button", { name: "Exercise List" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Division/ })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Exercise List" }),
  ).toBeVisible();
});

test("home page groups drills and filters by family", async ({ page }) => {
  await page.goto("/");

  const familyHeadings = page.locator(".exercise-family-header h3");
  await expect(familyHeadings).toHaveText([
    "Division",
    "Length Transfer",
    "Angle",
    "Intersection",
    "Flat Shapes",
    "Solids",
    "Freehand Control",
    "Trace Control",
    "Target Drawing",
    "Loop Chain",
  ]);

  await page.getByRole("button", { name: "Trace Control 7" }).click();
  await expect(familyHeadings).toHaveText(["Trace Control"]);
  await expect(
    page.getByRole("heading", { level: 3, name: "Trace Line" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 3, name: "Line Through Two Points" }),
  ).toBeHidden();

  await page.getByRole("button", { name: "All 100" }).click();
  await expect(familyHeadings).toHaveCount(10);
});

test("large family subfilters combine and persist after returning to list", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Division 24" }).click();
  const division = page.locator(".exercise-family-section").filter({
    has: page.getByRole("heading", { level: 3, name: "Division" }),
  });
  await division.getByRole("button", { name: "1-Shot" }).click();
  await division.getByRole("button", { name: "Thirds" }).click();
  await division.getByRole("button", { name: "Random" }).click();

  await expect(division.locator(".exercise-family-count")).toHaveText(
    "1 of 24 drills",
  );
  await expect(division.locator(".exercise-card")).toHaveCount(1);
  await expect(
    division.getByRole("heading", { level: 3, name: "Random Thirds 1-Shot" }),
  ).toBeVisible();

  await division.getByRole("button", { name: "Practice" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Random Thirds 1-Shot" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Back to List" }).click();

  const restoredHeadings = page.locator(".exercise-family-header h3");
  await expect(restoredHeadings).toHaveText(["Division"]);
  const restoredDivision = page.locator(".exercise-family-section").filter({
    has: page.getByRole("heading", { level: 3, name: "Division" }),
  });
  await expect(restoredDivision.locator(".exercise-family-count")).toHaveText(
    "1 of 24 drills",
  );
  await expect(restoredDivision.locator(".exercise-card")).toHaveCount(1);
  await expect(
    restoredDivision.getByRole("button", { name: "1-Shot" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    restoredDivision.getByRole("button", { name: "Thirds" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    restoredDivision.getByRole("button", { name: "Random" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("length transfer and angle drills expose family-specific subfilters", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Length Transfer 20" }).click();
  const transfer = page.locator(".exercise-family-section").filter({
    has: page.getByRole("heading", { level: 3, name: "Length Transfer" }),
  });
  await transfer.getByRole("button", { name: "Adjust" }).click();
  await transfer.getByRole("button", { name: "Copy" }).click();
  await transfer.getByRole("button", { name: "Cross Axis" }).click();

  await expect(transfer.locator(".exercise-family-count")).toHaveText(
    "2 of 20 drills",
  );
  await expect(transfer.locator(".exercise-card")).toHaveCount(2);
  await expect(
    transfer.getByRole("heading", {
      level: 3,
      name: "Copy Horizontal to Vertical",
      exact: true,
    }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Angle 21" }).click();
  const angleCopy = page.locator(".exercise-family-section").filter({
    has: page.getByRole("heading", { level: 3, name: "Angle" }),
  });
  await angleCopy.getByRole("button", { name: "Free Draw" }).click();
  await angleCopy.getByRole("button", { name: "Arbitrary" }).click();
  await angleCopy.getByRole("button", { name: "Rotated" }).click();

  await expect(angleCopy.locator(".exercise-family-count")).toHaveText(
    "1 of 21 drills",
  );
  await expect(angleCopy.locator(".exercise-card")).toHaveCount(1);
  await expect(
    angleCopy.getByRole("heading", {
      level: 3,
      name: "Arbitrary Reference, Rotated Base Free Draw 1-Shot",
      exact: true,
    }),
  ).toBeVisible();
});
