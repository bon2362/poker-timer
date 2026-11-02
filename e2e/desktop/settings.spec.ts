import { loginAsAdmin } from '../helpers/admin';
import { test, expect } from '@playwright/test';

test.describe('Settings - Desktop', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await loginAsAdmin(page, baseURL);
  });

  // E12: The gear keeps the timer running by opening the admin area in a new tab
  test('E12: gear opens the admin area in a new tab', async ({ page }) => {
    await page.goto('/');
    const gear = page.locator('[title="Settings"]');
    await expect(gear).toBeVisible({ timeout: 15000 });
    await expect(gear).toHaveAttribute('href', '/admin');
    await expect(gear).toHaveAttribute('target', '_blank');
    // Chrome does not capture auxiliary tabs into the installed app, so this link must keep its opener.
    await expect(gear).toHaveAttribute('rel', 'opener');
  });

  // E13: All settings are tabs of the admin area
  test('E13: admin tabs lead to every settings section', async ({ page }) => {
    await page.goto('/admin/tournament');
    await expect(page.getByText('Блайнды', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: '▶ Начать игру' })).toBeVisible();

    await page.getByRole('link', { name: 'Оформление' }).click();
    await expect(page).toHaveURL(/\/admin\/display$/);
    await expect(page.getByText('Слайдшоу на перерыве')).toBeVisible({ timeout: 15000 });

    await page.getByRole('link', { name: 'Игроки' }).click();
    await expect(page).toHaveURL(/\/admin\/players$/);

    await page.getByRole('link', { name: 'CI/CD' }).click();
    await expect(page).toHaveURL(/\/admin\/ci$/);
    await expect(page.getByRole('button', { name: 'Обновить' })).toBeVisible();
  });

  test('settings pages require login', async ({ page }) => {
    await page.context().clearCookies();
    for (const path of ['/admin/tournament', '/admin/display', '/admin/ci']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/login$/);
    }
  });
});
