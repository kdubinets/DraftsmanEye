import { test, expect } from '@playwright/test';

test('home page lists drills and auto entry point', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: /choose a drill/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Auto' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: 'Horizontal Halves' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: 'Copy Horizontal to Vertical' })).toBeVisible();
  await expect(page.getByText('No score yet')).toHaveCount(6);
});

test('horizontal halves drill can be completed and updates score on return', async ({ page }) => {
  await page.goto('/');

  await page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { level: 3, name: 'Horizontal Halves' }) })
    .getByRole('button', { name: 'Practice' })
    .click();

  await expect(page.getByRole('heading', { level: 1, name: 'Horizontal Halves' })).toBeVisible();
  await expect(page.getByText(/divided into two equal halves/i)).toBeVisible();

  const canvas = page.locator('[data-testid="exercise-canvas"]');
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error('Expected exercise canvas to have a bounding box.');
  }

  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  await expect(page.getByText(/Error .* px/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Again' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back to List' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Auto Next' })).toBeVisible();

  await page.getByRole('button', { name: 'Back to List' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /choose a drill/i })).toBeVisible();
  await expect(page.getByText(/^EMA /)).toHaveCount(1);
});
