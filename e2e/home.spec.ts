import { test, expect } from '@playwright/test';

test('home page lists drills and auto entry point', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: /choose a drill/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Auto' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: 'Horizontal Halves' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: 'Copy Horizontal to Vertical' })).toBeVisible();
  await expect(page.getByText('No score yet')).toHaveCount(6);
});
