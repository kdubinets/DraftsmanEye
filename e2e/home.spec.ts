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
  await expect(page.getByText('No score yet')).toHaveCount(8);
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
