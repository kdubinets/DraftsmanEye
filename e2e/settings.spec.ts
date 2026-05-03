import { expect, test } from "@playwright/test";
import {
  drawFreehandStraightLineAttempt,
  exerciseSvgPointsToClient,
  svgLineMidpoint,
} from "./support/helpers";

test("settings page exposes install affordance when the browser allows it", async ({
  page,
}) => {
  await page.goto("/settings");

  await expect(page.getByLabel("3D solid reference style")).toHaveValue(
    "wireframe",
  );

  const installButton = page.getByRole("button", { name: "Install app" });
  await expect(installButton).toBeVisible();
  await installButton.click();
  await expect(
    page.getByText(
      "Use the install icon in the address bar or the browser menu.",
    ),
  ).toBeVisible();

  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(event, {
      platforms: ["web"],
      prompt: () => Promise.resolve(),
      userChoice: Promise.resolve({ outcome: "dismissed", platform: "web" }),
    });
    window.dispatchEvent(event);
  });

  await expect(installButton).toBeVisible();
});

test("changing auto-repeat delay affects freehand clear timing", async ({
  page,
}) => {
  await page.goto("/settings");
  await page.getByLabel("Auto-repeat delay").selectOption({ label: "4.0s" });
  await page.getByRole("button", { name: "Back to list" }).click();

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", { level: 3, name: "Straight Line" }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await drawFreehandStraightLineAttempt(page);
  await expect(page.getByText(/Score \d+\.\d/)).toBeVisible();

  await page.waitForTimeout(1900);
  await expect(page.getByText(/Score \d+\.\d/)).toBeVisible();
  await expect(
    page.getByTestId("freehand-canvas").locator(".freehand-fit-line"),
  ).toBeHidden({
    timeout: 3500,
  });
});

test("result display settings can hide headline and score boxes", async ({
  page,
}) => {
  await page.goto("/settings");
  await page.getByLabel("Auto-repeat delay").selectOption({ label: "Off" });
  await page.getByLabel("Show result string").uncheck();
  await page.getByLabel("Show score boxes").uncheck();
  await expect(page.getByLabel("Show result string")).not.toBeChecked();
  await expect(page.getByLabel("Show score boxes")).not.toBeChecked();
  await expect
    .poll(async () =>
      page.evaluate(() =>
        JSON.parse(
          window.localStorage.getItem("draftsman-eye.settings.v1") ?? "{}",
        ),
      ),
    )
    .toMatchObject({
      showResultString: false,
      showScoreBoxes: false,
    });
  await page.getByRole("button", { name: "Back to list" }).click();

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        level: 3,
        name: "Horizontal Halves 1-Shot",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  const line = page.locator(".exercise-line");
  const midpoint = await svgLineMidpoint(line);
  const [midpointClient] = await exerciseSvgPointsToClient(page, [midpoint]);
  await page.mouse.click(midpointClient.x, midpointClient.y);

  await expect(page.getByRole("button", { name: "Again" })).toBeVisible();
  await expect(page.getByText(/Score \d+\.\d/)).toBeHidden();
  await expect(page.locator(".result-summary")).toBeHidden();
});
