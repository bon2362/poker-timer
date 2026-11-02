import { loginAsAdmin, isLocalBaseURL, TEST_ADMIN_PASSWORD } from '../helpers/admin';
import { test, expect } from '@playwright/test';

// These tests run in the 'mobile' project which uses iPhone 14 viewport (390x844).
// The admin panel is accessed by double-tapping (two rapid clicks) on the blind info area.
test.describe('Mobile Admin Panel', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await loginAsAdmin(page, baseURL);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('text=Round 1', { timeout: 30000 });
  });

  // Helper: simulate double-tap by firing two rapid clicks on the blind info area.
  // MobileView uses onClick + a ref timestamp to detect two clicks within 400 ms.
  async function openAdminPanel(page: import('@playwright/test').Page) {
    await page.evaluate(() => {
      // The blind info div is the first child of the top section — it wraps "Round N" and blinds text.
      // We fire two click events in quick succession to trigger the double-tap handler.
      const blindArea = document.querySelector<HTMLElement>('[class*="pt-10"]');
      if (blindArea) {
        blindArea.click();
        blindArea.click();
      }
    });
    // Wait for admin panel header to appear
    await page.waitForSelector('text=Администратор', { timeout: 10000 });
  }

  // M3: Tapping play/pause changes timer state
  test('M3: tapping play/pause toggles timer between play and pause states', async ({ page }) => {
    const playBtn = page.locator('button', { hasText: '▶' });
    const pauseBtn = page.locator('button', { hasText: '⏸' });

    if (await playBtn.isVisible()) {
      await playBtn.click();
      await expect(pauseBtn).toBeVisible({ timeout: 5000 });
      await pauseBtn.click();
      await expect(playBtn).toBeVisible({ timeout: 5000 });
    } else {
      await expect(pauseBtn).toBeVisible();
      await pauseBtn.click();
      await expect(playBtn).toBeVisible({ timeout: 5000 });
      await playBtn.click();
      await expect(pauseBtn).toBeVisible({ timeout: 5000 });
    }
  });

  // M7: Double-tapping blind area opens admin panel
  test('M7: double-tap on blind area opens admin panel', async ({ page }) => {
    await openAdminPanel(page);

    // Admin panel header
    await expect(page.locator('text=Администратор')).toBeVisible();

    // Display toggle buttons
    await expect(page.locator('button', { hasText: '👥 Игроки' })).toBeVisible();
    await expect(page.locator('button', { hasText: '🃏 Комбинации' })).toBeVisible();
  });
});

test.describe('Mobile viewer', () => {
  test('double tap asks for password before showing admin actions', async ({ page, baseURL }) => {
    test.skip(!isLocalBaseURL(baseURL), 'Login test uses local fixture credentials only');
    await page.goto('/');
    await expect(page.getByText('Round 1', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^[▶⏸]$/ })).toHaveCount(0);
    await expect.poll(async () => (await page.request.get('/api/admin/session')).json()).toEqual({ authenticated: false });
    // Two clicks in one browser task match the existing mobile double-tap detection.
    await page.evaluate(() => {
      const blindArea = document.querySelector<HTMLElement>('[class*="pt-10"]')!;
      blindArea.click(); blindArea.click();
    });
    await expect(page.getByLabel('Пароль', { exact: true })).toBeVisible();
    await expect(page.getByText('Администратор', { exact: true })).toHaveCount(0);
    await page.getByLabel('Пароль', { exact: true }).fill('wrong');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Неверный пароль');
    await page.getByLabel('Пароль', { exact: true }).fill(TEST_ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await expect(page.getByText('Администратор', { exact: true })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});
