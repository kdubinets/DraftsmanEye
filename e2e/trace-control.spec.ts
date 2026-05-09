import { expect, test } from "@playwright/test";
import {
  drawPolyline,
  interpolatedPoints,
  storedLineAngleBuckets,
  svgLineEndpoints,
  svgPointsToClient,
} from "./support/helpers";

test("trace line drill scores a stroke against the faint guide", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", { level: 3, name: "Trace Line" }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Trace Line" }),
  ).toBeVisible();

  const canvas = page.getByTestId("freehand-canvas");
  const guide = canvas.locator(".freehand-trace-guide");
  await expect(guide).toBeVisible();
  await expect(canvas.locator(".freehand-line-direction-cue")).toHaveCount(1);
  const guideLine = await svgLineEndpoints(guide);
  const [start, end] = await svgPointsToClient(page, [
    guideLine.start,
    guideLine.end,
  ]);
  await drawPolyline(page, interpolatedPoints(start, end, 10));

  await expect(page.getByText(/Score \d+\.\d/)).toBeVisible();
  await expect(
    page.locator(".exercise-toolbar .line-angle-chart"),
  ).toBeVisible();
  await expect(page.locator(".line-angle-chart-sector")).toHaveCount(36);
  await expect(await storedLineAngleBuckets(page, "trace-line")).toHaveLength(
    1,
  );
  await expect(
    canvas.locator(".freehand-target-correction-line"),
  ).toBeVisible();
  await expect(canvas.locator(".freehand-target-mark")).toHaveCount(0);
  await expect(page.locator(".freehand-history-item")).toHaveCount(1);
});

test("sequence mode advances trace line targets predictably", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "draftsman-eye.settings.v1",
      JSON.stringify({ autoRepeatDelayMs: null }),
    );
  });
  await page.goto("/");

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", { level: 3, name: "Trace Line" }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await page.getByRole("button", { name: "Sequence target mode" }).click();
  await expect(page.getByTestId("guided-practice-sequence-label")).toContainText(
    "1/9",
  );
  await page.getByTestId("guided-practice-sequence-label").click();
  await expect(page.getByTestId("guided-practice-sequence-menu")).toBeVisible();
  await page.getByRole("button", { name: "Length ladder" }).click();
  await expect(page.getByTestId("guided-practice-sequence-label")).toContainText(
    "Length ladder 1/9",
  );

  const canvas = page.getByTestId("freehand-canvas");
  const guide = canvas.locator(".freehand-trace-guide");
  const firstGuide = await svgLineEndpoints(guide);
  const firstPoints = await svgPointsToClient(page, [
    firstGuide.start,
    firstGuide.end,
  ]);
  await drawPolyline(page, interpolatedPoints(firstPoints[0], firstPoints[1], 10));

  await expect(page.getByRole("button", { name: "Next" })).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByTestId("guided-practice-sequence-label")).toContainText(
    "2/9",
  );

  const secondGuide = await svgLineEndpoints(guide);
  expect(
    Math.hypot(
      secondGuide.start.x - firstGuide.start.x,
      secondGuide.start.y - firstGuide.start.y,
    ),
  ).toBeGreaterThan(1);
});

test("trace circle drill scores a stroke against the faint guide", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", { level: 3, name: "Trace Circle" }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Trace Circle" }),
  ).toBeVisible();

  const canvas = page.getByTestId("freehand-canvas");
  const guide = canvas.locator(".freehand-trace-guide");
  await expect(guide).toBeVisible();
  const geometry = await guide.evaluate((circle) => ({
    center: {
      x: Number(circle.getAttribute("cx")),
      y: Number(circle.getAttribute("cy")),
    },
    radius: Number(circle.getAttribute("r")),
  }));
  const points = await svgPointsToClient(
    page,
    Array.from({ length: 41 }, (_, index) => {
      const angle = (Math.PI * 2 * index) / 40;
      return {
        x: geometry.center.x + Math.cos(angle) * geometry.radius,
        y: geometry.center.y + Math.sin(angle) * geometry.radius,
      };
    }),
  );

  await drawPolyline(page, points);

  await expect(page.getByText(/Score \d+\.\d/)).toBeVisible();
  await expect(page.getByText("Closure")).toBeVisible();
  await expect(
    canvas.locator(".freehand-target-correction-circle"),
  ).toBeVisible();
  await expect(canvas.locator(".freehand-target-mark")).toHaveCount(0);
  await expect(canvas.locator(".freehand-target-center")).toHaveCount(0);
  await expect(page.locator(".freehand-history-item")).toHaveCount(1);
});

test("trace ellipse drill scores a stroke against the faint guide", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", { level: 3, name: "Trace Ellipse" }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Trace Ellipse" }),
  ).toBeVisible();

  const canvas = page.getByTestId("freehand-canvas");
  const guide = canvas.locator(".freehand-trace-guide");
  await expect(guide).toBeVisible();
  const geometry = await guide.evaluate((ellipse) => {
    const transform = ellipse.getAttribute("transform") ?? "";
    const rotationMatch = /rotate\(([-\d.]+)/.exec(transform);
    return {
      center: {
        x: Number(ellipse.getAttribute("cx")),
        y: Number(ellipse.getAttribute("cy")),
      },
      majorRadius: Number(ellipse.getAttribute("rx")),
      minorRadius: Number(ellipse.getAttribute("ry")),
      rotationRadians: rotationMatch
        ? (Number(rotationMatch[1]) * Math.PI) / 180
        : 0,
    };
  });
  const cos = Math.cos(geometry.rotationRadians);
  const sin = Math.sin(geometry.rotationRadians);
  const points = await svgPointsToClient(
    page,
    Array.from({ length: 49 }, (_, index) => {
      const angle = (Math.PI * 2 * index) / 48;
      const localX = Math.cos(angle) * geometry.majorRadius;
      const localY = Math.sin(angle) * geometry.minorRadius;
      return {
        x: geometry.center.x + localX * cos - localY * sin,
        y: geometry.center.y + localX * sin + localY * cos,
      };
    }),
  );

  await drawPolyline(page, points);

  await expect(page.getByText(/Score \d+\.\d/)).toBeVisible();
  await expect(page.getByText("Join")).toBeVisible();
  await expect(
    canvas.locator(".freehand-target-correction-ellipse"),
  ).toBeVisible();
  await expect(canvas.locator(".freehand-target-mark")).toHaveCount(0);
  await expect(page.locator(".freehand-history-item")).toHaveCount(1);
});

test("trace S-curve drill scores a stroke against the faint guide", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", { level: 3, name: "Trace S-Curve" }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Trace S-Curve" }),
  ).toBeVisible();

  const canvas = page.getByTestId("freehand-canvas");
  const guide = canvas.locator(".freehand-trace-guide");
  await expect(guide).toBeVisible();
  const guidePoints = await guide.evaluate((path) => {
    const curve = path as SVGPathElement;
    const length = curve.getTotalLength();
    return Array.from({ length: 81 }, (_, index) => {
      const point = curve.getPointAtLength((length * index) / 80);
      return { x: point.x, y: point.y };
    });
  });
  const points = await svgPointsToClient(page, guidePoints);

  await drawPolyline(page, points);

  await expect(page.getByText(/Score \d+\.\d/)).toBeVisible();
  await expect(page.getByText("Drift", { exact: true })).toBeVisible();
  await expect(
    canvas.locator(".freehand-target-correction-s-curve"),
  ).toBeVisible();
  await expect(page.locator(".freehand-history-item")).toHaveCount(1);
});

test("trace compound curve drill scores a stroke against the faint guide", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        level: 3,
        name: "Trace Compound Curve",
      }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Trace Compound Curve" }),
  ).toBeVisible();

  const canvas = page.getByTestId("freehand-canvas");
  const guide = canvas.locator(".freehand-trace-guide");
  await expect(guide).toBeVisible();
  const guidePoints = await guide.evaluate((path) => {
    const curve = path as SVGPathElement;
    const length = curve.getTotalLength();
    return Array.from({ length: 97 }, (_, index) => {
      const point = curve.getPointAtLength((length * index) / 96);
      return { x: point.x, y: point.y };
    });
  });
  const points = await svgPointsToClient(page, guidePoints);

  await drawPolyline(page, points);

  await expect(page.getByText(/Score \d+\.\d/)).toBeVisible();
  await expect(page.getByText("Drift", { exact: true })).toBeVisible();
  await expect(
    canvas.locator(".freehand-target-correction-compound-curve"),
  ).toBeVisible();
  await expect(page.locator(".freehand-history-item")).toHaveCount(1);
});
