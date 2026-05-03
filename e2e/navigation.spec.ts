import { expect, test } from "@playwright/test";

test("unknown route triggers error boundary and falls back to list", async ({
  page,
}) => {
  await page.goto("/exercise/does-not-exist");

  // Error boundary should recover and render the list
  await expect(
    page.getByRole("heading", { level: 1, name: /choose a drill/i }),
  ).toBeVisible();
});
