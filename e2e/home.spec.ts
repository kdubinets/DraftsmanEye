import { test, expect, type Locator, type Page } from "@playwright/test";

test("home page lists drills and auto entry point", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: /choose a drill/i }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Start Auto" })).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 3, name: "Horizontal Halves" }),
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
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Arbitrary Reference, Rotated Base",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 3, name: "Horizontal Thirds" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 3, name: "Vertical Halves" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 3, name: "Vertical Fifths" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 3, name: "Random Thirds" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Copy Horizontal to Vertical",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Copy Vertical to Horizontal",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Double Horizontal on Horizontal",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Double Vertical on Horizontal",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Copy Distance on Random Lines",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Double Distance on Random Lines",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Projected Line Intersection",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Extrapolated Segment Intersection",
    }),
  ).toBeVisible();
  await expect(page.getByText("New")).toHaveCount(39);
  await expect(page.getByRole("button", { name: "Coming soon" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("button", { name: "Practice" })).toHaveCount(39);
  await expect(
    page
      .getByRole("article")
      .filter({
        has: page.getByRole("heading", {
          level: 3,
          name: "Double Horizontal on Horizontal",
        }),
      })
      .getByRole("button", { name: "Practice" }),
  ).toBeEnabled();
});

test("home page groups drills and filters by family", async ({ page }) => {
  await page.goto("/");

  const familyHeadings = page.locator(".exercise-family-header h3");
  await expect(familyHeadings).toHaveText([
    "Division",
    "Length Transfer",
    "Angle Copy",
    "Intersection",
    "Freehand Control",
    "Trace Control",
    "Target Drawing",
  ]);

  await page.getByRole("button", { name: "Trace Control 3" }).click();
  await expect(familyHeadings).toHaveText(["Trace Control"]);
  await expect(
    page.getByRole("heading", { level: 3, name: "Trace Line" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 3, name: "Line Through Two Points" }),
  ).toBeHidden();

  await page.getByRole("button", { name: "All 39" }).click();
  await expect(familyHeadings).toHaveCount(7);
});

test("target line drill scores a stroke connecting two marks", async ({
  page,
}) => {
  await page.goto("/");

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

  const marks = page
    .getByTestId("freehand-canvas")
    .locator(".freehand-target-mark");
  await expect(marks).toHaveCount(2);
  const [start, end] = await svgPointsToClient(page, [
    await targetPlusCenter(marks.nth(0)),
    await targetPlusCenter(marks.nth(1)),
  ]);

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (let index = 1; index <= 8; index += 1) {
    const ratio = index / 8;
    await page.mouse.move(
      start.x + (end.x - start.x) * ratio,
      start.y + (end.y - start.y) * ratio,
    );
  }
  await page.mouse.up();

  await expect(page.getByText(/Target line \d+\.\d/)).toBeVisible();
  await expect(page.getByText("Start miss")).toBeVisible();
  await expect(
    page
      .getByTestId("freehand-canvas")
      .locator(".freehand-target-correction-line"),
  ).toBeVisible();
  await expect(page.locator(".freehand-history-item")).toHaveCount(1);
});

test("angle copy drill scores a drawn ray from the target vertex", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        level: 3,
        name: "Horizontal Reference, Rotated Base",
      }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Horizontal Reference, Rotated Base",
    }),
  ).toBeVisible();

  const canvas = page.getByTestId("freehand-canvas");
  await expect(canvas.locator(".freehand-angle-reference-ray")).toHaveCount(2);
  await expect(canvas.locator(".freehand-angle-target-base")).toHaveCount(1);
  await expect(canvas.locator(".freehand-angle-direction-cue")).toHaveCount(1);
  const vertex = await locatorCenter(
    canvas.locator(".freehand-angle-target-vertex"),
  );
  const baseEnd = await svgLineEnd(
    canvas.locator(".freehand-angle-target-base"),
  );
  const [baseEndClient] = await svgPointsToClient(page, [baseEnd]);

  await page.mouse.move(vertex.x, vertex.y);
  await page.mouse.down();
  for (let index = 1; index <= 8; index += 1) {
    const ratio = index / 8;
    await page.mouse.move(
      vertex.x + (baseEndClient.x - vertex.x) * ratio,
      vertex.y + (baseEndClient.y - vertex.y) * ratio,
    );
  }
  await page.mouse.up();

  await expect(page.getByText(/Angle copy \d+\.\d/)).toBeVisible();
  await expect(page.getByText("Angle miss")).toBeVisible();
  await expect(
    canvas.locator(".freehand-target-correction-line"),
  ).toBeVisible();
  await expect(page.locator(".freehand-history-item")).toHaveCount(1);
});

test("angle copy drill accepts a ray drawn toward the target vertex", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        level: 3,
        name: "Horizontal Reference, Rotated Base",
      }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  const canvas = page.getByTestId("freehand-canvas");
  const vertex = await locatorCenter(
    canvas.locator(".freehand-angle-target-vertex"),
  );
  const baseEnd = await svgLineEnd(
    canvas.locator(".freehand-angle-target-base"),
  );
  const [baseEndClient] = await svgPointsToClient(page, [baseEnd]);

  await page.mouse.move(baseEndClient.x, baseEndClient.y);
  await page.mouse.down();
  for (let index = 1; index <= 8; index += 1) {
    const ratio = index / 8;
    await page.mouse.move(
      baseEndClient.x + (vertex.x - baseEndClient.x) * ratio,
      baseEndClient.y + (vertex.y - baseEndClient.y) * ratio,
    );
  }
  await page.mouse.up();

  await expect(page.getByText(/Angle copy \d+\.\d/)).toBeVisible();
  await expect(page.getByText("Angle miss")).toBeVisible();
});

test("target circle drill scores a circle from center and radius point", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", { level: 3, name: "Circle From Center" }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Circle From Center" }),
  ).toBeVisible();

  const canvas = page.getByTestId("freehand-canvas");
  const center = await locatorCenter(canvas.locator(".freehand-target-center"));
  const radiusPoint = await targetPlusCenter(
    canvas.locator(".freehand-target-mark").first(),
  );
  const radius = Math.hypot(radiusPoint.x - center.x, radiusPoint.y - center.y);

  await drawCircle(page, center, radius, 40);

  await expect(page.getByText(/Target circle \d+\.\d/)).toBeVisible();
  await expect(page.getByText("Center miss")).toBeVisible();
  await expect(
    canvas.locator(".freehand-target-correction-circle"),
  ).toBeVisible();
  await expect(page.locator(".freehand-history-item")).toHaveCount(1);
});

test("target circle drill scores a circle through three points", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        level: 3,
        name: "Circle Through Three Points",
      }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Circle Through Three Points",
    }),
  ).toBeVisible();

  const marks = page
    .getByTestId("freehand-canvas")
    .locator(".freehand-target-mark");
  await expect(marks).toHaveCount(3);
  await expect(
    page.getByTestId("freehand-canvas").locator(".freehand-target-center"),
  ).toHaveCount(0);
  const first = await targetPlusCenter(marks.nth(0));
  const second = await targetPlusCenter(marks.nth(1));
  const third = await targetPlusCenter(marks.nth(2));
  const circle = circleThroughPoints(first, second, third);

  await drawCircle(page, circle.center, circle.radius, 40);

  await expect(page.getByText(/Target circle \d+\.\d/)).toBeVisible();
  await expect(page.getByText("Radius miss")).toBeVisible();
  await expect(
    page
      .getByTestId("freehand-canvas")
      .locator(".freehand-target-correction-circle"),
  ).toBeVisible();
  await expect(page.locator(".freehand-history-item")).toHaveCount(1);
});

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
  const geometry = await guide.evaluate((line) => ({
    start: {
      x: Number(line.getAttribute("x1")),
      y: Number(line.getAttribute("y1")),
    },
    end: {
      x: Number(line.getAttribute("x2")),
      y: Number(line.getAttribute("y2")),
    },
  }));
  const points = await svgPointsToClient(page, [
    geometry.start,
    ...Array.from({ length: 7 }, (_, index) => {
      const ratio = (index + 1) / 8;
      return {
        x: geometry.start.x + (geometry.end.x - geometry.start.x) * ratio,
        y: geometry.start.y + (geometry.end.y - geometry.start.y) * ratio,
      };
    }),
    geometry.end,
  ]);

  await drawPolyline(page, points);

  await expect(page.getByText(/Target line \d+\.\d/)).toBeVisible();
  await expect(
    canvas.locator(".freehand-target-correction-line"),
  ).toBeVisible();
  await expect(canvas.locator(".freehand-target-mark")).toHaveCount(0);
  await expect(page.locator(".freehand-history-item")).toHaveCount(1);
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

  await expect(page.getByText(/Target circle \d+\.\d/)).toBeVisible();
  await expect(page.getByText("Center miss")).toBeVisible();
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

  await expect(page.getByText(/Target ellipse \d+\.\d/)).toBeVisible();
  await expect(page.getByText("Major miss")).toBeVisible();
  await expect(
    canvas.locator(".freehand-target-correction-ellipse"),
  ).toBeVisible();
  await expect(canvas.locator(".freehand-target-mark")).toHaveCount(0);
  await expect(page.locator(".freehand-history-item")).toHaveCount(1);
});

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

  await expect(page.getByText(/Ellipse fit \d+\.\d/)).toBeVisible();
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
    page.getByTestId("freehand-history-modal").getByText("Score"),
  ).toBeVisible();
  await page.getByTestId("freehand-history-modal").getByText("Score").click();
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

  await expect(page.getByText(/Roundness \d+\.\d/)).toBeVisible();
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
  await expect(page.getByRole("button", { name: "Fullscreen" })).toBeVisible();

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

  await expect(page.getByText(/Straightness \d+\.\d/)).toBeVisible();
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
  await expect(page.getByText(/Straightness \d+\.\d/)).toBeVisible();
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

  await expect(page.getByText(/Straightness \d+\.\d/)).toBeVisible();
  await expect(page.locator(".freehand-history-item")).toHaveCount(2);
});

test("early freehand next attempt scores only fresh input", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "draftsman-eye.settings.v1",
      JSON.stringify({ autoRepeatDelayMs: 4000 }),
    );
  });
  await page.goto("/");

  await openStraightLine(page);
  await drawFreehandStraightLineAttempt(page);
  await expect(page.getByText(/Straightness \d+\.\d/)).toBeVisible();
  await expect(page.locator(".freehand-history-item")).toHaveCount(1);

  const canvasBox = await freehandCanvasBox(page);
  await page.mouse.move(canvasBox.x + 160, canvasBox.y + 330);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + 162, canvasBox.y + 331);
  await page.mouse.up();

  await expect(page.getByText("Stroke was too short. Draw a longer line.")).toBeVisible();
  await expect(page.locator(".freehand-history-item")).toHaveCount(1);
  await expect(
    page.getByTestId("freehand-canvas").locator(".freehand-fit-line"),
  ).toBeHidden();
});

test("target line early next activates new target geometry", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "draftsman-eye.settings.v1",
      JSON.stringify({ autoRepeatDelayMs: 4000 }),
    );
  });
  await page.goto("/");

  await openTargetLine(page);
  const canvas = page.getByTestId("freehand-canvas");
  const oldMarks = canvas.locator(".freehand-target-mark");
  const oldTargets = await svgPointsToClient(page, [
    await targetPlusCenter(oldMarks.nth(0)),
    await targetPlusCenter(oldMarks.nth(1)),
  ]);
  await drawPolyline(page, interpolatedPoints(oldTargets[0], oldTargets[1], 8));

  await expect(page.getByText(/Target line \d+\.\d/)).toBeVisible();
  await expect(page.locator(".freehand-history-item")).toHaveCount(1);

  await canvas.click({ position: { x: 40, y: 40 } });

  await expect(canvas.locator(".freehand-ghost-stroke").first()).toBeVisible();
  await expect(canvas.locator(".freehand-target-correction-line")).toBeHidden();
  await expect(canvas.locator(".freehand-target-mark")).toHaveCount(2);

  const newMarks = canvas.locator(".freehand-target-mark");
  const newTargets = await svgPointsToClient(page, [
    await targetPlusCenter(newMarks.nth(0)),
    await targetPlusCenter(newMarks.nth(1)),
  ]);
  expect(distance(oldTargets[0], newTargets[0])).toBeGreaterThan(4);

  await drawPolyline(page, interpolatedPoints(newTargets[0], newTargets[1], 8));

  await expect(page.getByText(/Target line \d+\.\d/)).toBeVisible();
  await expect(page.locator(".freehand-history-item")).toHaveCount(2);
});

test("trace circle early next fades prior result behind new guide", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "draftsman-eye.settings.v1",
      JSON.stringify({ autoRepeatDelayMs: null }),
    );
  });
  await page.goto("/");

  await openTraceCircle(page);
  const canvas = page.getByTestId("freehand-canvas");
  const firstGuide = await svgCircleClientGeometry(
    page,
    canvas.locator(".freehand-trace-guide"),
  );
  await drawCircle(page, firstGuide.center, firstGuide.radius, 36);

  await expect(page.getByText(/Target circle \d+\.\d/)).toBeVisible();
  await expect(page.locator(".freehand-history-item")).toHaveCount(1);

  await canvas.click({ position: { x: 40, y: 40 } });
  await expect(canvas.locator(".freehand-ghost-stroke").first()).toBeVisible();
  await expect(canvas.locator(".freehand-ghost-correction").first()).toBeVisible();
  await expect(canvas.locator(".freehand-trace-guide")).toHaveCount(1);

  const nextGuide = await svgCircleClientGeometry(
    page,
    canvas.locator(".freehand-trace-guide"),
  );
  await drawCircle(page, nextGuide.center, nextGuide.radius, 36);

  await expect(page.getByText(/Target circle \d+\.\d/)).toBeVisible();
  await expect(page.locator(".freehand-history-item")).toHaveCount(2);
});

test("angle copy early next scores against the new target", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "draftsman-eye.settings.v1",
      JSON.stringify({ autoRepeatDelayMs: null }),
    );
  });
  await page.goto("/");

  await openAngleCopy(page);
  const canvas = page.getByTestId("freehand-canvas");
  const oldVertex = await locatorCenter(canvas.locator(".freehand-angle-target-vertex"));
  const oldBaseEnd = await svgLineEnd(canvas.locator(".freehand-angle-target-base"));
  const [oldBaseEndClient] = await svgPointsToClient(page, [oldBaseEnd]);
  await drawPolyline(page, interpolatedPoints(oldVertex, oldBaseEndClient, 8));

  await expect(page.getByText(/Angle copy \d+\.\d/)).toBeVisible();
  await expect(page.locator(".freehand-history-item")).toHaveCount(1);

  await canvas.click({ position: { x: 40, y: 40 } });

  await expect(canvas.locator(".freehand-ghost-stroke").first()).toBeVisible();
  await expect(canvas.locator(".freehand-target-correction-line")).toBeHidden();
  const newVertex = await locatorCenter(canvas.locator(".freehand-angle-target-vertex"));
  expect(distance(oldVertex, newVertex)).toBeGreaterThan(4);

  const newBaseEnd = await svgLineEnd(canvas.locator(".freehand-angle-target-base"));
  const [newBaseEndClient] = await svgPointsToClient(page, [newBaseEnd]);
  await drawPolyline(page, interpolatedPoints(newVertex, newBaseEndClient, 8));

  await expect(page.getByText(/Angle copy \d+\.\d/)).toBeVisible();
  await expect(page.locator(".freehand-history-item")).toHaveCount(2);
});

test("pause keeps freehand result visible past the auto-repeat delay", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "draftsman-eye.settings.v1",
      JSON.stringify({ autoRepeatDelayMs: 1500 }),
    );
  });
  await page.goto("/");

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", { level: 3, name: "Straight Line" }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await drawFreehandStraightLineAttempt(page);
  await expect(page.getByText(/Straightness \d+\.\d/)).toBeVisible();

  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
  await page.waitForTimeout(1900);

  await expect(page.getByText(/Straightness \d+\.\d/)).toBeVisible();
  await expect(
    page.getByTestId("freehand-canvas").locator(".freehand-fit-line"),
  ).toBeVisible();
  await expect(page.locator(".freehand-history-item")).toHaveCount(1);
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
  await expect(page.getByText(/Straightness \d+\.\d/)).toBeVisible();

  await page.waitForTimeout(1900);
  await expect(page.getByText(/Straightness \d+\.\d/)).toBeVisible();
  await expect(
    page.getByTestId("freehand-canvas").locator(".freehand-fit-line"),
  ).toBeHidden({
    timeout: 3500,
  });
});

test("division drill auto-advances after the configured delay", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "draftsman-eye.settings.v1",
      JSON.stringify({ autoRepeatDelayMs: 1500 }),
    );
  });
  await page.goto("/");

  await openHorizontalHalves(page);
  await completeHorizontalHalves(page);

  await expect(page.locator(".target-tick")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Again" })).toBeVisible();
  await expect(page.locator(".target-tick")).toHaveCount(0, {
    timeout: 2500,
  });
  await expect(page.getByRole("button", { name: "Again" })).toHaveCount(0);
});

test("pause keeps single-mark result visible past the delay", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "draftsman-eye.settings.v1",
      JSON.stringify({ autoRepeatDelayMs: 1500 }),
    );
  });
  await page.goto("/");

  await openHorizontalHalves(page);
  await completeHorizontalHalves(page);

  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
  await page.waitForTimeout(1900);

  await expect(page.locator(".target-tick")).toHaveCount(1);
  await expect(page.getByText(/Error .* px/i)).toBeVisible();
});

test("quick repeated single-mark clicks do not duplicate score updates", async ({
  page,
}) => {
  await page.goto("/");

  await openHorizontalHalves(page);
  const midpoint = await completeHorizontalHalves(page);
  await expect(page.getByText(/Error .* px/i)).toBeVisible();

  await page.mouse.click(midpoint.x, midpoint.y);
  await expect(page.getByRole("button", { name: "Again" })).toHaveCount(0);

  const attempts = await page.evaluate(() => {
    const raw = window.localStorage.getItem("draftsman-eye.progress.v2");
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { attempts?: unknown[] };
    return Array.isArray(parsed.attempts) ? parsed.attempts.length : 0;
  });
  expect(attempts).toBe(1);
});

test("horizontal halves drill can be completed and updates score on return", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", { level: 3, name: "Horizontal Halves" }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Horizontal Halves" }),
  ).toBeVisible();
  await expect(page.getByText(/divided at one half/i)).toBeVisible();
  await expect(page.locator(".anchor-direction-cue")).toHaveCount(0);

  const line = page.locator(".exercise-line");
  const lineBox = await line.boundingBox();
  if (!lineBox) {
    throw new Error("Expected rendered exercise line to have a bounding box.");
  }

  const midpoint = await svgLineMidpoint(line);
  const [midpointClient] = await exerciseSvgPointsToClient(page, [midpoint]);
  await page.mouse.click(midpointClient.x, midpointClient.y);

  await expect(page.getByText(/Error .* px/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Again" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Back to List" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Auto Next" })).toBeVisible();

  await page.getByRole("button", { name: "Back to List" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: /choose a drill/i }),
  ).toBeVisible();
  await expect(
    page.locator(".score-chip").filter({ hasText: /^\d+\.\d$/ }),
  ).toHaveCount(1);
});

test("vertical thirds drill can be completed", async ({ page }) => {
  await page.goto("/");

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", { level: 3, name: "Vertical Thirds" }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Vertical Thirds" }),
  ).toBeVisible();
  await expect(page.getByText(/marked at one third/i)).toBeVisible();

  const line = page.locator(".exercise-line");
  const lineBox = await line.boundingBox();
  if (!lineBox) {
    throw new Error("Expected rendered exercise line to have a bounding box.");
  }

  const canvasBox = await page
    .locator('[data-testid="exercise-canvas"]')
    .boundingBox();
  if (!canvasBox) {
    throw new Error("Expected exercise canvas to have a bounding box.");
  }
  expect(lineBox.y).toBeGreaterThanOrEqual(canvasBox.y);
  expect(lineBox.y + lineBox.height).toBeLessThanOrEqual(
    canvasBox.y + canvasBox.height,
  );
  expect(canvasBox.height).toBeGreaterThan(500);

  const lineXBeforeResult = lineBox.x;
  const midpoint = await svgLineMidpoint(line);
  const [midpointClient] = await exerciseSvgPointsToClient(page, [midpoint]);
  await page.mouse.click(midpointClient.x, midpointClient.y);

  await expect(page.getByText(/Error .* px/i)).toBeVisible();
  await expect(page.getByText(/Too high|Too low|Exact/)).toBeVisible();

  const resultLineBox = await line.boundingBox();
  if (!resultLineBox) {
    throw new Error(
      "Expected rendered exercise line to stay mounted after result.",
    );
  }
  expect(resultLineBox.x).toBeCloseTo(lineXBeforeResult, 1);
});

test("random thirds drill can be completed on an arbitrary segment", async ({
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
      has: page.getByRole("heading", { level: 3, name: "Random Thirds" }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Random Thirds" }),
  ).toBeVisible();
  await expect(page.getByText(/marked at one third/i)).toBeVisible();

  const line = page.locator(".exercise-line");
  const lineBox = await line.boundingBox();
  if (!lineBox) {
    throw new Error("Expected rendered random line to have a bounding box.");
  }
  const directionCueBox = await page
    .locator(".anchor-direction-cue")
    .boundingBox();
  if (!directionCueBox) {
    throw new Error("Expected random division direction cue to render.");
  }

  const midpoint = await svgLineMidpoint(line);
  const [midpointClient] = await exerciseSvgPointsToClient(page, [midpoint]);
  await page.mouse.click(midpointClient.x, midpointClient.y);

  await expect(page.getByText(/Error .* px/i)).toBeVisible();
  await expect(
    page.getByText(/Too far back|Too far forward|Exact/),
  ).toBeVisible();
});

test("intersection drill scores the marked crossing by angle", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        level: 3,
        name: "Projected Line Intersection",
      }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Projected Line Intersection",
    }),
  ).toBeVisible();
  await expect(page.getByText(/short segment would cross/i)).toBeVisible();
  await expect(page.locator(".projection-line")).toBeVisible();

  const canvas = page.getByTestId("exercise-canvas");
  const canvasBefore = await canvas.boundingBox();
  if (!canvasBefore) {
    throw new Error("Expected intersection canvas to have a bounding box.");
  }
  const longLine = page.locator(".exercise-line");
  const midpoint = await svgLineMidpoint(longLine);
  const [midpointClient] = await exerciseSvgPointsToClient(page, [midpoint]);
  await page.mouse.click(midpointClient.x, midpointClient.y);

  await expect(page.getByText(/Angle error \d+\.\d°/)).toBeVisible();
  await expect(page.getByText(/Offset .* px/i)).toBeVisible();
  await expect(page.locator(".projection-result-ray")).toBeVisible();
  await expect(page.getByRole("button", { name: "Auto Next" })).toBeVisible();

  const canvasAfter = await canvas.boundingBox();
  if (!canvasAfter) {
    throw new Error("Expected intersection canvas to remain mounted.");
  }
  expect(canvasAfter.x).toBeCloseTo(canvasBefore.x, 1);
  expect(canvasAfter.y).toBeCloseTo(canvasBefore.y, 1);
  expect(canvasAfter.width).toBeCloseTo(canvasBefore.width, 1);
});

test("extrapolated intersection drill scores a free point mark", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        level: 3,
        name: "Extrapolated Segment Intersection",
      }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Extrapolated Segment Intersection",
    }),
  ).toBeVisible();
  await expect(page.getByText(/two segments would meet/i)).toBeVisible();
  await expect(page.getByText(/Place one mark in the field/i)).toBeVisible();

  const first = await svgLineEndpoints(page.locator(".exercise-line"));
  const second = await svgLineEndpoints(page.locator(".projection-line"));
  const target = lineIntersection(first, second);
  const placed = { x: target.x + 18, y: target.y + 9 };
  const [placedClient] = await exerciseSvgPointsToClient(page, [placed]);
  await page.mouse.click(placedClient.x, placedClient.y);

  await expect(page.getByText(/Error 20\.1 px/)).toBeVisible();
  await expect(page.locator(".user-point-mark")).toBeVisible();
  await expect(page.locator(".target-point-mark")).toHaveCount(0);
  await expect(page.locator(".point-error-gap")).toBeVisible();
  await expect(page.locator(".projection-result-ray")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Auto Next" })).toBeVisible();
});

test("cross-axis double drill scores a mark on the full guide", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        level: 3,
        name: "Double Horizontal on Vertical",
      }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Double Horizontal on Vertical",
    }),
  ).toBeVisible();
  const referenceBox = await page.locator(".reference-line").boundingBox();
  if (!referenceBox) {
    throw new Error("Expected transfer reference to have a bounding box.");
  }
  const anchorBox = await page.locator(".anchor-tick").boundingBox();
  if (!anchorBox) {
    throw new Error("Expected transfer anchor to have a bounding box.");
  }
  const directionCueBox = await page
    .locator(".anchor-direction-cue")
    .boundingBox();
  if (!directionCueBox) {
    throw new Error("Expected transfer direction cue to have a bounding box.");
  }

  const guide = page.locator(".exercise-line");
  const guideBox = await guide.boundingBox();
  if (!guideBox) {
    throw new Error("Expected transfer guide to have a bounding box.");
  }

  const canvasBox = await page.getByTestId("exercise-canvas").boundingBox();
  if (!canvasBox) {
    throw new Error("Expected exercise canvas to have a bounding box.");
  }
  expect(guideBox.height).toBeGreaterThan(canvasBox.height * 0.75);

  await page.mouse.click(
    guideBox.x + guideBox.width / 2,
    guideBox.y + guideBox.height / 2,
  );

  await expect(page.getByText(/Error .* px/i)).toBeVisible();
  await expect(page.getByText(/Too high|Too low|Exact/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Auto Next" })).toBeVisible();
});

async function locatorCenter(locator: Locator): Promise<{
  x: number;
  y: number;
}> {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error("Expected locator to have a bounding box.");
  }

  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}

async function targetPlusCenter(locator: Locator): Promise<{
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

async function svgLineEnd(locator: Locator): Promise<{
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

async function svgLineMidpoint(locator: Locator): Promise<{
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

async function svgLineEndpoints(locator: Locator): Promise<{
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

async function svgCircleClientGeometry(
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

function distance(
  first: { x: number; y: number },
  second: { x: number; y: number },
): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function lineIntersection(
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

async function exerciseSvgPointsToClient(
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

async function svgPointsToClient(
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

async function drawPolyline(
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

function interpolatedPoints(
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

async function drawFreehandStraightLineAttempt(page: Page): Promise<void> {
  const canvasBox = await freehandCanvasBox(page);

  await drawPolyline(page, [
    { x: canvasBox.x + 120, y: canvasBox.y + 220 },
    { x: canvasBox.x + 280, y: canvasBox.y + 221 },
    { x: canvasBox.x + 440, y: canvasBox.y + 219 },
    { x: canvasBox.x + 600, y: canvasBox.y + 222 },
  ]);
}

async function openStraightLine(page: Page): Promise<void> {
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

async function openTargetLine(page: Page): Promise<void> {
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

async function openTraceCircle(page: Page): Promise<void> {
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

async function openAngleCopy(page: Page): Promise<void> {
  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        level: 3,
        name: "Horizontal Reference, Rotated Base",
      }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Horizontal Reference, Rotated Base",
    }),
  ).toBeVisible();
}

async function freehandCanvasBox(
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

async function openHorizontalHalves(page: Page): Promise<void> {
  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", { level: 3, name: "Horizontal Halves" }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Horizontal Halves" }),
  ).toBeVisible();
}

async function completeHorizontalHalves(
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

async function drawCircle(
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

// ── §8.6 missing E2E tests ─────────────────────────────────────────────────

test("Again re-runs the same drill without returning to the list", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", { level: 3, name: "Horizontal Halves" }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Horizontal Halves" }),
  ).toBeVisible();

  const line = page.locator(".exercise-line");
  const lineBox = await line.boundingBox();
  if (!lineBox) throw new Error("Expected exercise line bounding box");
  await page.mouse.click(
    lineBox.x + lineBox.width / 2,
    lineBox.y + lineBox.height / 2,
  );
  await expect(page.getByRole("button", { name: "Again" })).toBeVisible();

  await page.getByRole("button", { name: "Again" }).click();

  // Should be back on the same exercise — not the list
  await expect(
    page.getByRole("heading", { level: 1, name: "Horizontal Halves" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: /choose a drill/i }),
  ).toHaveCount(0);
  // Result buttons should be gone — fresh trial
  await expect(page.getByRole("button", { name: "Again" })).toHaveCount(0);
});

test("Auto Next navigates to a different drill after completion", async ({
  page,
}) => {
  await page.goto("/");

  // Practice one drill to give Auto something to pick against
  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", { level: 3, name: "Horizontal Halves" }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  const line = page.locator(".exercise-line");
  const lineBox = await line.boundingBox();
  if (!lineBox) throw new Error("Expected exercise line bounding box");
  await page.mouse.click(
    lineBox.x + lineBox.width / 2,
    lineBox.y + lineBox.height / 2,
  );
  await expect(page.getByRole("button", { name: "Auto Next" })).toBeVisible();

  await page.getByRole("button", { name: "Auto Next" }).click();

  // Should land on an exercise screen — not the list
  await expect(
    page.getByRole("heading", { level: 1, name: /choose a drill/i }),
  ).toHaveCount(0);
  // And the heading should not be the one we just came from
  await expect(
    page.getByRole("heading", { level: 1, name: "Horizontal Halves" }),
  ).toHaveCount(0);
});

test("progress persists across a full page reload", async ({ page }) => {
  await page.goto("/");

  // Complete a drill
  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", { level: 3, name: "Horizontal Halves" }),
    })
    .getByRole("button", { name: "Practice" })
    .click();

  const line = page.locator(".exercise-line");
  const lineBox = await line.boundingBox();
  if (!lineBox) throw new Error("Expected exercise line bounding box");
  await page.mouse.click(
    lineBox.x + lineBox.width / 2,
    lineBox.y + lineBox.height / 2,
  );
  await expect(page.getByText(/Error .* px/i)).toBeVisible();

  await page.getByRole("button", { name: "Back to List" }).click();
  await expect(
    page.locator(".score-chip").filter({ hasText: /^\d+\.\d$/ }),
  ).toHaveCount(1);

  // Reload — localStorage must survive
  await page.reload();
  await expect(
    page.getByRole("heading", { level: 1, name: /choose a drill/i }),
  ).toBeVisible();
  await expect(
    page.locator(".score-chip").filter({ hasText: /^\d+\.\d$/ }),
  ).toHaveCount(1);
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

  await expect(page.getByText(/Roundness \d+\.\d/)).toBeVisible();

  // Open history modal
  await page.locator(".freehand-history-item").first().click();
  await expect(page.getByTestId("freehand-history-modal")).toBeVisible();

  // Dismiss with Escape
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("freehand-history-modal")).toHaveCount(0);
});

test("unknown route triggers error boundary and falls back to list", async ({
  page,
}) => {
  await page.goto("/exercise/does-not-exist");

  // Error boundary should recover and render the list
  await expect(
    page.getByRole("heading", { level: 1, name: /choose a drill/i }),
  ).toBeVisible();
});

function circleThroughPoints(
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
