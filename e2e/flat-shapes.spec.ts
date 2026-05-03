import { expect, test } from "@playwright/test";

test("flat shape drills mount generated polygon references", async ({
  page,
}) => {
  await page.goto("/exercise/flat-triangle");

  await expect(
    page.getByRole("heading", { level: 1, name: "Triangle" }),
  ).toBeVisible();
  await expect(page.locator(".solids-reference-edge")).toHaveCount(3);
  await page.getByRole("button", { name: "Done" }).click();
  await expect(
    page.getByText(/Reference needs 3 vertices and 3 edges/),
  ).toBeVisible();

  const canvas = page.locator(".solids-canvas");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const points = [
    { x: box!.x + 420, y: box!.y + 180 },
    { x: box!.x + 590, y: box!.y + 230 },
    { x: box!.x + 500, y: box!.y + 390 },
    { x: box!.x + 690, y: box!.y + 430 },
  ];
  await page.mouse.click(points[0].x, points[0].y);
  await page.mouse.click(points[1].x, points[1].y);
  await page.mouse.click(points[2].x, points[2].y);
  await page.mouse.click(points[3].x, points[3].y);
  await expect(page.locator(".solids-vertex")).toHaveCount(3);
  await expect(page.locator(".solids-edge")).toHaveCount(2);
  await page.mouse.click(points[0].x, points[0].y);
  await expect(page.locator(".solids-edge")).toHaveCount(3);
  await page.mouse.move(points[2].x + 80, points[2].y + 40);
  await expect(page.locator(".solids-preview-edge")).toHaveCount(0);
  await page.mouse.click(points[1].x, points[1].y);
  await expect(page.locator(".solids-edge")).toHaveCount(3);

  await page.goto("/exercise/flat-quadrilateral");
  await expect(
    page.getByRole("heading", { level: 1, name: "Four-Sided Figure" }),
  ).toBeVisible();
  await expect(page.locator(".solids-reference-edge")).toHaveCount(4);
  const quadBox = await page.locator(".solids-canvas").boundingBox();
  expect(quadBox).not.toBeNull();
  const quadPoints = [
    { x: quadBox!.x + 380, y: quadBox!.y + 180 },
    { x: quadBox!.x + 600, y: quadBox!.y + 210 },
    { x: quadBox!.x + 630, y: quadBox!.y + 390 },
    { x: quadBox!.x + 420, y: quadBox!.y + 410 },
  ];
  await page.mouse.click(quadPoints[0].x, quadPoints[0].y);
  await page.mouse.click(quadPoints[1].x, quadPoints[1].y);
  await page.mouse.click(quadPoints[0].x, quadPoints[0].y);
  await expect(page.locator(".solids-edge")).toHaveCount(1);
  await page.mouse.move(quadPoints[2].x, quadPoints[2].y);
  await expect(page.locator(".solids-preview-edge")).toHaveCount(1);
  await page.mouse.click(quadPoints[2].x, quadPoints[2].y);
  await expect(page.locator(".solids-edge")).toHaveCount(2);

  await page.goto("/exercise/flat-pentagon");
  await expect(
    page.getByRole("heading", { level: 1, name: "Five-Sided Figure" }),
  ).toBeVisible();
  await expect(page.locator(".solids-reference-edge")).toHaveCount(5);

  await page.goto("/exercise/flat-hexagon");
  await expect(
    page.getByRole("heading", { level: 1, name: "Six-Sided Figure" }),
  ).toBeVisible();
  await expect(page.locator(".solids-reference-edge")).toHaveCount(6);
});
