import { expect, test } from "@playwright/test";

test("solids cube drill mounts reference and warns on incomplete graph", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "draftsman-eye.settings.v1",
      JSON.stringify({ solidReferenceStyle: "shaded" }),
    );
  });
  await page.goto("/exercise/solids-cube-2pt");

  await expect(
    page.getByRole("heading", { level: 1, name: "Cube — 2-Point Perspective" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Choose a reference" }),
  ).toBeVisible();
  await expect(page.locator(".solids-chooser-option")).toHaveCount(12);
  await page.getByRole("button", { name: "Regenerate" }).click();
  await expect(page.locator(".solids-chooser-option")).toHaveCount(12);
  await page.getByRole("button", { name: "Reference 1", exact: true }).click();

  const activeReferenceEdges = page.locator(
    ".solids-reference-panel .solids-reference-edge",
  );
  await expect(activeReferenceEdges.first()).toBeVisible();
  const referenceEdgeCount = await activeReferenceEdges.count();
  expect(referenceEdgeCount).toBeGreaterThanOrEqual(7);
  expect(referenceEdgeCount).toBeLessThanOrEqual(9);
  await expect(
    page.locator(".solids-reference-panel .solids-reference-face").first(),
  ).toBeVisible();

  const panel = page.locator(".solids-reference-panel");
  const before = await panel.boundingBox();
  expect(before).not.toBeNull();
  const handle = page.locator(".solids-reference-resize");
  const handleBox = await handle.boundingBox();
  expect(handleBox).not.toBeNull();
  await page.mouse.move(
    handleBox!.x + handleBox!.width / 2,
    handleBox!.y + handleBox!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    handleBox!.x + handleBox!.width / 2 + 42,
    handleBox!.y + handleBox!.height / 2,
  );
  await page.mouse.up();
  const after = await panel.boundingBox();
  expect(after?.width).toBeGreaterThan((before?.width ?? 0) + 20);

  await page.getByRole("button", { name: "Done" }).click();
  await expect(
    page.getByText(/Reference needs \d+ vertices and \d+ edges/),
  ).toBeVisible();
});
