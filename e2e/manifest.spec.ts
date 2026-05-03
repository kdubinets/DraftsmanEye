import { expect, test } from "@playwright/test";

test("serves web app manifest metadata", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );

  const response = await page.request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = (await response.json()) as Record<string, unknown>;
  expect(manifest).toEqual(
    expect.objectContaining({
      name: "Draftsman Eye",
      display: "standalone",
      start_url: "/",
    }),
  );
});
