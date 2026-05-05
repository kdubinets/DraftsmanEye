import { expect, type Locator, type Page } from "@playwright/test";

export async function locatorCenter(locator: Locator): Promise<{
  x: number;
  y: number;
}> {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error("Expected locator to have a bounding box.");
  }

  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}

export async function expectPointInsideLocator(
  locator: Locator,
  point: { x: number; y: number },
): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error("Expected locator to have a bounding box.");
  }

  expect(point.x).toBeGreaterThanOrEqual(box.x);
  expect(point.x).toBeLessThanOrEqual(box.x + box.width);
  expect(point.y).toBeGreaterThanOrEqual(box.y);
  expect(point.y).toBeLessThanOrEqual(box.y + box.height);
}

export async function scrollExerciseSvgPointIntoView(
  page: Page,
  point: { x: number; y: number },
): Promise<void> {
  await page
    .getByTestId("exercise-canvas")
    .evaluate((svgElement, sourcePoint) => {
      const svg = svgElement as SVGSVGElement;
      const matrix = svg.getScreenCTM();
      if (!matrix) {
        throw new Error("Expected exercise canvas to have a screen transform.");
      }

      const svgPoint = svg.createSVGPoint();
      svgPoint.x = sourcePoint.x;
      svgPoint.y = sourcePoint.y;
      const transformed = svgPoint.matrixTransform(matrix);
      const viewportMargin = 80;
      if (
        transformed.y < viewportMargin ||
        transformed.y > window.innerHeight - viewportMargin
      ) {
        window.scrollBy(0, transformed.y - window.innerHeight / 2);
      }
    }, point);
}

export async function targetPlusCenter(locator: Locator): Promise<{
  x: number;
  y: number;
}> {
  const horizontal = locator.locator("line").first();
  const x1 = Number(await horizontal.getAttribute("x1"));
  const x2 = Number(await horizontal.getAttribute("x2"));
  const y = Number(await horizontal.getAttribute("y1"));
  if (!Number.isFinite(x1) || !Number.isFinite(x2) || !Number.isFinite(y)) {
    throw new Error("Expected target plus mark to expose line coordinates.");
  }

  return {
    x: (x1 + x2) / 2,
    y,
  };
}

export async function svgLineEnd(locator: Locator): Promise<{
  x: number;
  y: number;
}> {
  const x = Number(await locator.getAttribute("x2"));
  const y = Number(await locator.getAttribute("y2"));
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error("Expected SVG line to expose x2/y2 coordinates.");
  }

  return { x, y };
}

export async function svgLineMidpoint(locator: Locator): Promise<{
  x: number;
  y: number;
}> {
  const x1 = Number(await locator.getAttribute("x1"));
  const y1 = Number(await locator.getAttribute("y1"));
  const x2 = Number(await locator.getAttribute("x2"));
  const y2 = Number(await locator.getAttribute("y2"));
  if (
    !Number.isFinite(x1) ||
    !Number.isFinite(y1) ||
    !Number.isFinite(x2) ||
    !Number.isFinite(y2)
  ) {
    throw new Error("Expected SVG line to expose endpoint coordinates.");
  }

  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
}

export async function svgLineEndpoints(locator: Locator): Promise<{
  start: { x: number; y: number };
  end: { x: number; y: number };
}> {
  const x1 = Number(await locator.getAttribute("x1"));
  const y1 = Number(await locator.getAttribute("y1"));
  const x2 = Number(await locator.getAttribute("x2"));
  const y2 = Number(await locator.getAttribute("y2"));
  if (
    !Number.isFinite(x1) ||
    !Number.isFinite(y1) ||
    !Number.isFinite(x2) ||
    !Number.isFinite(y2)
  ) {
    throw new Error("Expected SVG line to expose endpoint coordinates.");
  }

  return { start: { x: x1, y: y1 }, end: { x: x2, y: y2 } };
}

export async function svgCircleClientGeometry(
  page: Page,
  locator: Locator,
): Promise<{ center: { x: number; y: number }; radius: number }> {
  const cx = Number(await locator.getAttribute("cx"));
  const cy = Number(await locator.getAttribute("cy"));
  const r = Number(await locator.getAttribute("r"));
  if (!Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(r)) {
    throw new Error("Expected SVG circle to expose cx/cy/r coordinates.");
  }

  const [center, edge] = await svgPointsToClient(page, [
    { x: cx, y: cy },
    { x: cx + r, y: cy },
  ]);
  return { center, radius: distance(center, edge) };
}

export function distance(
  first: { x: number; y: number },
  second: { x: number; y: number },
): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

export function lineIntersection(
  first: { start: { x: number; y: number }; end: { x: number; y: number } },
  second: { start: { x: number; y: number }; end: { x: number; y: number } },
): { x: number; y: number } {
  const x1 = first.start.x;
  const y1 = first.start.y;
  const x2 = first.end.x;
  const y2 = first.end.y;
  const x3 = second.start.x;
  const y3 = second.start.y;
  const x4 = second.end.x;
  const y4 = second.end.y;
  const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denominator) < 0.001) {
    throw new Error("Expected extrapolated segments to intersect.");
  }

  return {
    x:
      ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) /
      denominator,
    y:
      ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) /
      denominator,
  };
}

export function interpolatePoint(
  start: { x: number; y: number },
  end: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  };
}

export async function exerciseSvgPointsToClient(
  page: Page,
  points: { x: number; y: number }[],
): Promise<{ x: number; y: number }[]> {
  return page
    .getByTestId("exercise-canvas")
    .evaluate((svgElement, sourcePoints) => {
      const svg = svgElement as SVGSVGElement;
      const matrix = svg.getScreenCTM();
      if (!matrix) {
        throw new Error("Expected exercise canvas to have a screen transform.");
      }

      return sourcePoints.map((sourcePoint) => {
        const point = svg.createSVGPoint();
        point.x = sourcePoint.x;
        point.y = sourcePoint.y;
        const transformed = point.matrixTransform(matrix);
        return { x: transformed.x, y: transformed.y };
      });
    }, points);
}

export async function svgPointsToClient(
  page: Page,
  points: { x: number; y: number }[],
): Promise<{ x: number; y: number }[]> {
  return page
    .getByTestId("freehand-canvas")
    .evaluate((svgElement, sourcePoints) => {
      const svg = svgElement as SVGSVGElement;
      const matrix = svg.getScreenCTM();
      if (!matrix) {
        throw new Error("Expected freehand canvas to have a screen transform.");
      }

      return sourcePoints.map((sourcePoint) => {
        const point = svg.createSVGPoint();
        point.x = sourcePoint.x;
        point.y = sourcePoint.y;
        const transformed = point.matrixTransform(matrix);
        return { x: transformed.x, y: transformed.y };
      });
    }, points);
}

export async function drawPolyline(
  page: Page,
  points: { x: number; y: number }[],
): Promise<void> {
  const [firstPoint, ...restPoints] = points;
  if (!firstPoint) {
    throw new Error("Expected at least one point to draw.");
  }

  await page.mouse.move(firstPoint.x, firstPoint.y);
  await page.mouse.down();
  for (const point of restPoints) {
    await page.mouse.move(point.x, point.y);
  }
  await page.mouse.up();
}

export function interpolatedPoints(
  start: { x: number; y: number },
  end: { x: number; y: number },
  steps: number,
): { x: number; y: number }[] {
  const points = [start];
  for (let index = 1; index <= steps; index += 1) {
    const ratio = index / steps;
    points.push({
      x: start.x + (end.x - start.x) * ratio,
      y: start.y + (end.y - start.y) * ratio,
    });
  }
  return points;
}

export async function drawFreehandStraightLineAttempt(
  page: Page,
): Promise<void> {
  const canvasBox = await freehandCanvasBox(page);

  await drawPolyline(page, [
    { x: canvasBox.x + 120, y: canvasBox.y + 220 },
    { x: canvasBox.x + 280, y: canvasBox.y + 221 },
    { x: canvasBox.x + 440, y: canvasBox.y + 219 },
    { x: canvasBox.x + 600, y: canvasBox.y + 222 },
  ]);
}

export async function openStraightLine(page: Page): Promise<void> {
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
}

export async function openTargetLine(page: Page): Promise<void> {
  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        level: 3,
        name: "Line Through Two Points",
      }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Line Through Two Points" }),
  ).toBeVisible();
}

export async function storedLineAngleBuckets(
  page: Page,
  exerciseId: string,
): Promise<string[]> {
  return page.evaluate((id) => {
    const raw = window.localStorage.getItem("draftsman-eye.progress.v8");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as {
      dimensions?: {
        lineAngleBuckets?: Record<string, Record<string, unknown>>;
      };
    };
    return Object.keys(parsed.dimensions?.lineAngleBuckets?.[id] ?? {});
  }, exerciseId);
}

export async function storedCircleRadiusBuckets(
  page: Page,
  exerciseId: string,
): Promise<string[]> {
  return page.evaluate((id) => {
    const raw = window.localStorage.getItem("draftsman-eye.progress.v8");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as {
      dimensions?: {
        circleRadiusBuckets?: Record<string, Record<string, unknown>>;
      };
    };
    return Object.keys(parsed.dimensions?.circleRadiusBuckets?.[id] ?? {});
  }, exerciseId);
}

export async function storedEllipseAngleBuckets(
  page: Page,
  exerciseId: string,
): Promise<string[]> {
  return page.evaluate((id) => {
    const raw = window.localStorage.getItem("draftsman-eye.progress.v8");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as {
      dimensions?: {
        ellipseAngleBuckets?: Record<string, Record<string, unknown>>;
      };
    };
    return Object.keys(parsed.dimensions?.ellipseAngleBuckets?.[id] ?? {});
  }, exerciseId);
}

export async function storedEllipseMajorRadiusBuckets(
  page: Page,
  exerciseId: string,
): Promise<string[]> {
  return page.evaluate((id) => {
    const raw = window.localStorage.getItem("draftsman-eye.progress.v8");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as {
      dimensions?: {
        ellipseMajorRadiusBuckets?: Record<string, Record<string, unknown>>;
      };
    };
    return Object.keys(
      parsed.dimensions?.ellipseMajorRadiusBuckets?.[id] ?? {},
    );
  }, exerciseId);
}

export async function storedEllipseAxisRatioBuckets(
  page: Page,
  exerciseId: string,
): Promise<string[]> {
  return page.evaluate((id) => {
    const raw = window.localStorage.getItem("draftsman-eye.progress.v8");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as {
      dimensions?: {
        ellipseAxisRatioBuckets?: Record<string, Record<string, unknown>>;
      };
    };
    return Object.keys(parsed.dimensions?.ellipseAxisRatioBuckets?.[id] ?? {});
  }, exerciseId);
}

export async function openTraceCircle(page: Page): Promise<void> {
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
}

export async function openAngleCopy(page: Page): Promise<void> {
  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        level: 3,
        name: "Horizontal Reference, Rotated Base Free Draw 1-Shot",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Horizontal Reference, Rotated Base Free Draw 1-Shot",
      exact: true,
    }),
  ).toBeVisible();
}

export async function freehandCanvasBox(
  page: Page,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const canvasBox = await page
    .locator('[data-testid="freehand-canvas"]')
    .boundingBox();
  if (!canvasBox) {
    throw new Error("Expected freehand canvas to have a bounding box.");
  }
  return canvasBox;
}

export async function openHorizontalHalves(page: Page): Promise<void> {
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

  await expect(
    page.getByRole("heading", { level: 1, name: "Horizontal Halves 1-Shot" }),
  ).toBeVisible();
}

export async function completeHorizontalHalves(
  page: Page,
): Promise<{ x: number; y: number }> {
  const line = page.locator(".exercise-line");
  const lineBox = await line.boundingBox();
  if (!lineBox) {
    throw new Error("Expected rendered exercise line to have a bounding box.");
  }

  const midpoint = await svgLineMidpoint(line);
  const [midpointClient] = await exerciseSvgPointsToClient(page, [midpoint]);
  await page.mouse.click(midpointClient.x, midpointClient.y);
  return midpointClient;
}

export async function drawCircle(
  page: Page,
  center: { x: number; y: number },
  radius: number,
  steps: number,
): Promise<void> {
  await page.mouse.move(center.x + radius, center.y);
  await page.mouse.down();
  for (let index = 1; index <= steps; index += 1) {
    const angle = (Math.PI * 2 * index) / steps;
    await page.mouse.move(
      center.x + Math.cos(angle) * radius,
      center.y + Math.sin(angle) * radius,
    );
  }
  await page.mouse.up();
}

export function circleThroughPoints(
  first: { x: number; y: number },
  second: { x: number; y: number },
  third: { x: number; y: number },
): { center: { x: number; y: number }; radius: number } {
  const determinant =
    2 *
    (first.x * (second.y - third.y) +
      second.x * (third.y - first.y) +
      third.x * (first.y - second.y));
  if (Math.abs(determinant) < 0.001) {
    throw new Error("Expected target points to define a circle.");
  }

  const firstSquared = first.x * first.x + first.y * first.y;
  const secondSquared = second.x * second.x + second.y * second.y;
  const thirdSquared = third.x * third.x + third.y * third.y;
  const center = {
    x:
      (firstSquared * (second.y - third.y) +
        secondSquared * (third.y - first.y) +
        thirdSquared * (first.y - second.y)) /
      determinant,
    y:
      (firstSquared * (third.x - second.x) +
        secondSquared * (first.x - third.x) +
        thirdSquared * (second.x - first.x)) /
      determinant,
  };

  return {
    center,
    radius: Math.hypot(first.x - center.x, first.y - center.y),
  };
}
