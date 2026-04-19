import { test, expect } from '@playwright/test';

test('home page lists drills and auto entry point', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { level: 1, name: /choose a drill/i }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Auto' })).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 3, name: 'Horizontal Halves' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 3, name: 'Straight Line' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 3, name: 'Circle' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 3, name: 'Ellipse' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 3, name: 'Horizontal Thirds' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 3, name: 'Vertical Halves' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 3, name: 'Vertical Fifths' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', {
      level: 3,
      name: 'Copy Horizontal to Vertical',
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', {
      level: 3,
      name: 'Copy Vertical to Horizontal',
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', {
      level: 3,
      name: 'Double Horizontal on Horizontal',
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', {
      level: 3,
      name: 'Double Vertical on Horizontal',
    }),
  ).toBeVisible();
  await expect(page.getByText('No score yet')).toHaveCount(11);
  await expect(page.getByRole('button', { name: 'Comming' })).toHaveCount(8);
  await expect(
    page
      .getByRole('article')
      .filter({
        has: page.getByRole('heading', {
          level: 3,
          name: 'Double Horizontal on Horizontal',
        }),
      })
      .getByRole('button', { name: 'Comming' }),
  ).toBeDisabled();
});

test('ellipse drill scores a drawn stroke and auto-clears', async ({ page }) => {
  await page.goto('/');

  await page
    .getByRole('article')
    .filter({
      has: page.getByRole('heading', { level: 3, name: 'Ellipse' }),
    })
    .getByRole('button', { name: 'Practice' })
    .click();

  await expect(
    page.getByRole('heading', { level: 1, name: 'Ellipse' }),
  ).toBeVisible();

  const canvasBox = await page
    .locator('[data-testid="freehand-canvas"]')
    .boundingBox();
  if (!canvasBox) {
    throw new Error('Expected freehand canvas to have a bounding box.');
  }

  const centerX = canvasBox.x + canvasBox.width / 2;
  const centerY = canvasBox.y + canvasBox.height / 2;
  const majorRadius = Math.min(canvasBox.width, canvasBox.height) * 0.28;
  const minorRadius = Math.min(canvasBox.width, canvasBox.height) * 0.15;
  const rotation = Math.PI / 7;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  await page.mouse.move(centerX + majorRadius * cos, centerY + majorRadius * sin);
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
    page.getByTestId('freehand-canvas').locator('.freehand-fit-ellipse'),
  ).toBeVisible();
  await expect(page.locator('.freehand-closure-gap')).toBeVisible();
  await expect(page.locator('.freehand-join-tangent')).toHaveCount(2);
  await expect(page.getByText('Join')).toBeVisible();
  await expect(page.getByText(/\d+ deg/)).toBeVisible();
  await expect(page.locator('.freehand-history-item')).toHaveCount(1);
  await expect(
    page.locator('.freehand-history-item .freehand-fit-ellipse'),
  ).toBeVisible();

  await page.locator('.freehand-history-item').click();
  await expect(page.getByTestId('freehand-history-modal')).toBeVisible();
  await expect(page.locator('.freehand-history-modal-canvas')).toBeVisible();
  await expect(
    page
      .getByTestId('freehand-history-modal')
      .locator('.freehand-fit-ellipse'),
  ).toBeVisible();
  await expect(
    page.getByTestId('freehand-history-modal').getByText('Score'),
  ).toBeVisible();
  await page.getByTestId('freehand-history-modal').getByText('Score').click();
  await expect(page.getByTestId('freehand-history-modal')).toHaveCount(0);

  await page.getByLabel('Show fitted shapes').uncheck();
  await expect(
    page.locator('.freehand-history-item .freehand-fit-ellipse'),
  ).toHaveCount(0);
  await expect(page.locator('.freehand-history-stroke')).toBeVisible();

  await expect(page.getByText(/Draw one ellipse in the field/i)).toBeVisible({
    timeout: 2500,
  });

  await page.getByRole('button', { name: 'Back to List' }).click();
  await expect(
    page.locator('.score-chip').filter({ hasText: /^\d+\.\d$/ }),
  ).toHaveCount(1);
});

test('circle drill scores a drawn stroke and auto-clears', async ({ page }) => {
  await page.goto('/');

  await page
    .getByRole('article')
    .filter({
      has: page.getByRole('heading', { level: 3, name: 'Circle' }),
    })
    .getByRole('button', { name: 'Practice' })
    .click();

  await expect(
    page.getByRole('heading', { level: 1, name: 'Circle' }),
  ).toBeVisible();

  const canvasBox = await page
    .locator('[data-testid="freehand-canvas"]')
    .boundingBox();
  if (!canvasBox) {
    throw new Error('Expected freehand canvas to have a bounding box.');
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
    page.getByTestId('freehand-canvas').locator('.freehand-fit-circle'),
  ).toBeVisible();
  await expect(page.locator('.freehand-closure-gap')).toBeVisible();
  await expect(page.locator('.freehand-join-tangent')).toHaveCount(2);
  await expect(page.getByText('Join')).toBeVisible();
  await expect(page.getByText(/\d+ deg/)).toBeVisible();
  await expect(page.locator('.freehand-history-item')).toHaveCount(1);

  await expect(page.getByText(/Draw one circle in the field/i)).toBeVisible({
    timeout: 2500,
  });

  await page.getByRole('button', { name: 'Back to List' }).click();
  await expect(
    page.locator('.score-chip').filter({ hasText: /^\d+\.\d$/ }),
  ).toHaveCount(1);
});

test('straight line drill scores a drawn stroke and auto-clears', async ({
  page,
}) => {
  await page.goto('/');

  await page
    .getByRole('article')
    .filter({
      has: page.getByRole('heading', { level: 3, name: 'Straight Line' }),
    })
    .getByRole('button', { name: 'Practice' })
    .click();

  await expect(
    page.getByRole('heading', { level: 1, name: 'Straight Line' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fullscreen' })).toBeVisible();

  const canvasBox = await page
    .locator('[data-testid="freehand-canvas"]')
    .boundingBox();
  if (!canvasBox) {
    throw new Error('Expected freehand canvas to have a bounding box.');
  }

  await page.mouse.move(canvasBox.x + 120, canvasBox.y + 220);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + 280, canvasBox.y + 221);
  await page.mouse.move(canvasBox.x + 440, canvasBox.y + 219);
  await page.mouse.move(canvasBox.x + 600, canvasBox.y + 222);
  await page.mouse.up();

  await expect(page.getByText(/Straightness \d+\.\d/)).toBeVisible();
  await expect(
    page.getByTestId('freehand-canvas').locator('.freehand-fit-line'),
  ).toBeVisible();
  await expect(page.locator('.freehand-closure-gap')).toBeHidden();
  await expect(page.locator('.freehand-history-item')).toHaveCount(1);
  await expect(
    page.locator('.freehand-history-item .freehand-fit-line'),
  ).toBeVisible();

  await expect(
    page.getByText(/Draw one straight line in the field/i),
  ).toBeVisible({
    timeout: 2500,
  });

  await page.getByRole('button', { name: 'Back to List' }).click();
  await expect(
    page.locator('.score-chip').filter({ hasText: /^\d+\.\d$/ }),
  ).toHaveCount(1);
});

test('horizontal halves drill can be completed and updates score on return', async ({
  page,
}) => {
  await page.goto('/');

  await page
    .getByRole('article')
    .filter({
      has: page.getByRole('heading', { level: 3, name: 'Horizontal Halves' }),
    })
    .getByRole('button', { name: 'Practice' })
    .click();

  await expect(
    page.getByRole('heading', { level: 1, name: 'Horizontal Halves' }),
  ).toBeVisible();
  await expect(page.getByText(/divided at one half/i)).toBeVisible();

  const line = page.locator('.exercise-line');
  const lineBox = await line.boundingBox();
  if (!lineBox) {
    throw new Error('Expected rendered exercise line to have a bounding box.');
  }

  await page.mouse.click(
    lineBox.x + lineBox.width / 2,
    lineBox.y + lineBox.height / 2,
  );

  await expect(page.getByText(/Error .* px/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Again' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Back to List' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Auto Next' })).toBeVisible();

  await page.getByRole('button', { name: 'Back to List' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: /choose a drill/i }),
  ).toBeVisible();
  await expect(page.locator('.score-chip').filter({ hasText: /^\d+\.\d$/ })).toHaveCount(1);
});

test('vertical thirds drill can be completed', async ({ page }) => {
  await page.goto('/');

  await page
    .getByRole('article')
    .filter({
      has: page.getByRole('heading', { level: 3, name: 'Vertical Thirds' }),
    })
    .getByRole('button', { name: 'Practice' })
    .click();

  await expect(
    page.getByRole('heading', { level: 1, name: 'Vertical Thirds' }),
  ).toBeVisible();
  await expect(page.getByText(/divided at one third/i)).toBeVisible();

  const line = page.locator('.exercise-line');
  const lineBox = await line.boundingBox();
  if (!lineBox) {
    throw new Error('Expected rendered exercise line to have a bounding box.');
  }

  const canvasBox = await page
    .locator('[data-testid="exercise-canvas"]')
    .boundingBox();
  if (!canvasBox) {
    throw new Error('Expected exercise canvas to have a bounding box.');
  }
  expect(lineBox.y).toBeGreaterThanOrEqual(canvasBox.y);
  expect(lineBox.y + lineBox.height).toBeLessThanOrEqual(
    canvasBox.y + canvasBox.height,
  );
  expect(canvasBox.height).toBeGreaterThan(500);

  const lineXBeforeResult = lineBox.x;
  await page.mouse.click(
    lineBox.x + lineBox.width / 2,
    lineBox.y + lineBox.height / 2,
  );

  await expect(page.getByText(/Error .* px/i)).toBeVisible();
  await expect(page.getByText(/Too high|Too low|Exact/)).toBeVisible();

  const resultLineBox = await line.boundingBox();
  if (!resultLineBox) {
    throw new Error('Expected rendered exercise line to stay mounted after result.');
  }
  expect(resultLineBox.x).toBeCloseTo(lineXBeforeResult, 1);
});
