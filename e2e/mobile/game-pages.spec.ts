import { test, expect } from '@playwright/test';

// Data-backed cases are covered by Jest with fictional records. CI deliberately has no database.
test.describe('Public game pages', () => {
  test('catalogue opens without login, forbids indexing and fits a phone', async ({ page }) => {
    await page.goto('/games');
    await expect(page.getByRole('heading', { name: 'Таблица компании' })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole('heading', { name: 'Игры', exact: true })).toBeVisible();
  });
  test('unknown game returns 404 without requiring a password', async ({ page }) => {
    const response = await page.goto('/games/fictional-unknown-game');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Вход в управление' })).not.toBeVisible();
  });
});
