import { expect, test } from "@playwright/test";
import {
  drawFreehandStraightLineAttempt,
  freehandCanvasBox,
  openStraightLine,
  storedLineAngleBuckets,
} from "./support/helpers";

test("ellipse drill scores a drawn stroke and auto-clears", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        level: 3,
        name: "Ellipse",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Ellipse" }),
  ).toBeVisible();

  const canvasBox = await page
    .locator('[data-testid="freehand-canvas"]')
    .boundingBox();
  if (!canvasBox) {
    throw new Error("Expected freehand canvas to have a bounding box.");
  }

  const centerX = canvasBox.x + canvasBox.width / 2;
  const centerY = canvasBox.y + canvasBox.height / 2;
  const majorRadius = Math.min(canvasBox.width, canvasBox.height) * 0.28;
  const minorRadius = Math.min(canvasBox.width, canvasBox.height) * 0.15;
  const rotation = Math.PI / 7;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  await page.mouse.move(
    centerX + majorRadius * cos,
    centerY + majorRadius * sin,
  );
  await page.mouse.down();
  for (let index = 1; index <= 46; index += 1) {
    const angle = (Math.PI * 2 * index) / 48;
    const localX = Math.cos(angle) * majorRadius;
    const localY = Math.sin(angle) * minorRadius;
    await page.mouse.move(
      centerX + localX * cos - localY * sin,
      centerY + localX * sin + localY * cos,
    );
  }
  await page.mouse.up();

  await expect(page.getByText(/Score \d+\.\d/)).toBeVisible();
  await expect(
    page.getByTestId("freehand-canvas").locator(".freehand-fit-ellipse"),
  ).toBeVisible();
  await expect(page.locator(".freehand-closure-gap")).toBeVisible();
  await expect(page.locator(".freehand-join-tangent")).toHaveCount(2);
  await expect(page.getByText("Join")).toBeVisible();
  await expect(page.getByText(/\d+ deg/)).toBeVisible();
  await expect(page.locator(".freehand-history-item")).toHaveCount(1);
  await expect(
    page.locator(".freehand-history-item .freehand-fit-ellipse"),
  ).toBeVisible();

  await page.locator(".freehand-history-item").click();
  await expect(page.getByTestId("freehand-history-modal")).toBeVisible();
  await expect(page.locator(".freehand-history-modal-canvas")).toBeVisible();
  await expect(
    page.getByTestId("freehand-history-modal").locator(".freehand-fit-ellipse"),
  ).toBeVisible();
  await expect(
    page.getByTestId("freehand-history-modal").getByText("Score", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByTestId("freehand-history-modal")
    .getByText("Score", { exact: true })
    .click();
  await expect(page.getByTestId("freehand-history-modal")).toHaveCount(0);

  await page.getByLabel("Show fitted shapes").uncheck();
  await expect(
    page.locator(".freehand-history-item .freehand-fit-ellipse"),
  ).toHaveCount(0);
  await expect(page.locator(".freehand-history-stroke").first()).toBeVisible();

  await expect(
    page.getByTestId("freehand-canvas").locator(".freehand-fit-ellipse"),
  ).toBeHidden({
    timeout: 4000,
  });

  await page.getByRole("button", { name: "Back to List" }).click();
  await expect(
    page.locator(".score-chip").filter({ hasText: /^\d+\.\d$/ }),
  ).toHaveCount(1);
});

test("circle drill scores a drawn stroke and auto-clears", async ({ page }) => {
  await page.goto("/");

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        level: 3,
        name: "Circle",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Circle" }),
  ).toBeVisible();

  const canvasBox = await page
    .locator('[data-testid="freehand-canvas"]')
    .boundingBox();
  if (!canvasBox) {
    throw new Error("Expected freehand canvas to have a bounding box.");
  }

  const centerX = canvasBox.x + canvasBox.width / 2;
  const centerY = canvasBox.y + canvasBox.height / 2;
  const radius = Math.min(canvasBox.width, canvasBox.height) * 0.24;

  await page.mouse.move(centerX + radius, centerY);
  await page.mouse.down();
  for (let index = 1; index <= 34; index += 1) {
    const angle = (Math.PI * 2 * index) / 36;
    await page.mouse.move(
      centerX + Math.cos(angle) * radius,
      centerY + Math.sin(angle) * radius,
    );
  }
  await page.mouse.up();

  await expect(page.getByText(/Score \d+\.\d/)).toBeVisible();
  await expect(
    page.getByTestId("freehand-canvas").locator(".freehand-fit-circle"),
  ).toBeVisible();
  await expect(page.locator(".freehand-closure-gap")).toBeVisible();
  await expect(page.locator(".freehand-join-tangent")).toHaveCount(2);
  await expect(page.getByText("Join")).toBeVisible();
  await expect(page.getByText(/\d+ deg/)).toBeVisible();
  await expect(page.locator(".freehand-history-item")).toHaveCount(1);

  await expect(
    page.getByTestId("freehand-canvas").locator(".freehand-fit-circle"),
  ).toBeHidden({
    timeout: 4000,
  });

  await page.getByRole("button", { name: "Back to List" }).click();
  await expect(
    page.locator(".score-chip").filter({ hasText: /^\d+\.\d$/ }),
  ).toHaveCount(1);
});

test("straight line drill scores a drawn stroke and auto-clears", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", { level: 3, name: "Straight Line" }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Straight Line" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Full" })).toBeVisible();

  const canvasBox = await page
    .locator('[data-testid="freehand-canvas"]')
    .boundingBox();
  if (!canvasBox) {
    throw new Error("Expected freehand canvas to have a bounding box.");
  }

  const canvas = page.getByTestId("freehand-canvas");
  await canvas.dispatchEvent("pointerdown", {
    pointerId: 41,
    pointerType: "touch",
    clientX: canvasBox.x + 120,
    clientY: canvasBox.y + 180,
  });
  await canvas.dispatchEvent("pointermove", {
    pointerId: 41,
    pointerType: "touch",
    clientX: canvasBox.x + 300,
    clientY: canvasBox.y + 180,
  });
  await canvas.dispatchEvent("pointerup", {
    pointerId: 41,
    pointerType: "touch",
    clientX: canvasBox.x + 300,
    clientY: canvasBox.y + 180,
  });
  await expect(page.locator(".freehand-user-stroke")).toHaveCount(0);
  await expect(
    page.getByText("Use Apple Pencil or mouse to draw."),
  ).toBeVisible();

  await page.mouse.move(canvasBox.x + 120, canvasBox.y + 220);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + 280, canvasBox.y + 221);
  await page.mouse.move(canvasBox.x + 440, canvasBox.y + 219);
  await page.mouse.move(canvasBox.x + 600, canvasBox.y + 222);
  await page.mouse.up();

  await expect(page.getByText(/Score \d+\.\d/)).toBeVisible();
  await expect(
    page.locator(".exercise-toolbar .line-angle-chart"),
  ).toBeVisible();
  await expect(page.locator(".line-angle-chart-sector")).toHaveCount(36);
  await expect(
    await storedLineAngleBuckets(page, "freehand-straight-line"),
  ).toHaveLength(1);
  await expect(
    page.getByTestId("freehand-canvas").locator(".freehand-fit-line"),
  ).toBeVisible();
  await expect(page.locator(".freehand-user-stroke").first()).toBeVisible();
  await expect(page.locator(".freehand-user-stroke").first()).toHaveAttribute(
    "style",
    /stroke-width: 5(?:\.00)?px; stroke: rgb\(/,
  );
  await expect(page.locator(".freehand-closure-gap")).toBeHidden();
  await expect(page.locator(".freehand-history-item")).toHaveCount(1);
  await expect(
    page.locator(".freehand-history-item .freehand-fit-line"),
  ).toBeVisible();

  await expect(
    page.getByTestId("freehand-canvas").locator(".freehand-fit-line"),
  ).toBeHidden({
    timeout: 4000,
  });

  await page.getByRole("button", { name: "Back to List" }).click();
  await expect(
    page.locator(".score-chip").filter({ hasText: /^\d+\.\d$/ }),
  ).toHaveCount(1);
});

test("unguided freehand accepts a second stroke before timeout", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "draftsman-eye.settings.v1",
      JSON.stringify({ autoRepeatDelayMs: null }),
    );
  });
  await page.goto("/");

  await openStraightLine(page);
  await drawFreehandStraightLineAttempt(page);
  await expect(page.getByText(/Score \d+\.\d/)).toBeVisible();
  await expect(page.locator(".freehand-history-item")).toHaveCount(1);

  const canvasBox = await freehandCanvasBox(page);
  await page.mouse.move(canvasBox.x + 130, canvasBox.y + 320);
  await page.mouse.down();
  await expect(page.locator(".freehand-ghost-stroke").first()).toBeVisible();
  await expect(
    page.getByTestId("freehand-canvas").locator(".freehand-fit-line"),
  ).toBeHidden();
  await page.mouse.move(canvasBox.x + 300, canvasBox.y + 318);
  await page.mouse.move(canvasBox.x + 470, canvasBox.y + 321);
  await page.mouse.move(canvasBox.x + 640, canvasBox.y + 319);
  await page.mouse.up();

  await expect(page.getByText(/Score \d+\.\d/)).toBeVisible();
  await expect(page.locator(".freehand-history-item")).toHaveCount(2);
});

test("freehand toolbar hides inactive actions and Again resets cleanly", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "draftsman-eye.settings.v1",
      JSON.stringify({ autoRepeatDelayMs: null }),
    );
  });
  await page.goto("/");

  await openStraightLine(page);
  await expect(
    page.getByRole("button", { name: "Back to List" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Full" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pause" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Again" })).toHaveCount(0);

  await drawFreehandStraightLineAttempt(page);
  await expect(page.getByText(/Score \d+\.\d/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Pause" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Again" })).toBeVisible();

  await page.getByRole("button", { name: "Again" }).click();

  await expect(
    page.getByText("Use Pencil, touch, or mouse to draw one line."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Again" })).toHaveCount(0);
  await expect(
    page.getByTestId("freehand-canvas").locator(".freehand-fit-line"),
  ).toBeHidden();
  await expect(page.locator(".freehand-ghost-stroke")).toHaveCount(0);
  await expect(page.locator(".freehand-history-item")).toHaveCount(1);
});

test("Escape key dismisses the history modal", async ({ page }) => {
  await page.goto("/");

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", { level: 3, name: "Circle", exact: true }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  const canvasBox = await page
    .locator('[data-testid="freehand-canvas"]')
    .boundingBox();
  if (!canvasBox) throw new Error("Expected freehand canvas bounding box");

  const centerX = canvasBox.x + canvasBox.width / 2;
  const centerY = canvasBox.y + canvasBox.height / 2;
  const radius = Math.min(canvasBox.width, canvasBox.height) * 0.24;

  await page.mouse.move(centerX + radius, centerY);
  await page.mouse.down();
  for (let i = 1; i <= 34; i++) {
    const angle = (Math.PI * 2 * i) / 36;
    await page.mouse.move(
      centerX + Math.cos(angle) * radius,
      centerY + Math.sin(angle) * radius,
    );
  }
  await page.mouse.up();

  await expect(page.getByText(/Score \d+\.\d/)).toBeVisible();

  // Open history modal
  await page.locator(".freehand-history-item").first().click();
  await expect(page.getByTestId("freehand-history-modal")).toBeVisible();

  // Dismiss with Escape
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("freehand-history-modal")).toHaveCount(0);
});
