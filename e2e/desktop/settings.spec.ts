import { test, expect } from '@playwright/test';

test.describe('Settings - Desktop', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('text=Round 1', { timeout: 30000 });
  });

  // Helper: click the gear (Settings) button via JS to bypass the overlay (z-40)
  async function openSettingsViaGear(page: import('@playwright/test').Page) {
    await page.evaluate(() => {
      const btn = document.querySelector<HTMLButtonElement>('button[title="Settings"]');
      btn?.click();
    });
  }

  // E12: Can open settings via gear button
  test('E12: navigate to settings via gear button', async ({ page }) => {
    // The gear button is behind the "Игра не настроена" overlay (z-40).
    // Use JS click to bypass the overlay's pointer-event interception.
    await openSettingsViaGear(page);

    // Settings screen shows "НАСТРОЙКИ" heading
    await expect(page.locator('h1', { hasText: 'НАСТРОЙКИ' })).toBeVisible();
  });

  // E13: Can open settings via overlay button when present, or via gear during an active session.
  test('E13: navigate to settings from current game state', async ({ page }) => {
    const openSettingsBtn = page.getByRole('button', { name: 'Открыть настройки' });
    if (await openSettingsBtn.isVisible()) {
      await openSettingsBtn.click();
    } else {
      await openSettingsViaGear(page);
    }

    // Settings screen should appear
    await expect(page.locator('h1', { hasText: 'НАСТРОЙКИ' })).toBeVisible();
  });

  // E14: Settings screen has back button to return to timer
  test('E14: can close settings and return to timer', async ({ page }) => {
    // Open settings via JS click (bypasses overlay)
    await openSettingsViaGear(page);
    await expect(page.locator('h1', { hasText: 'НАСТРОЙКИ' })).toBeVisible();

    // Click "← Назад" button to return — no overlay on settings screen
    const backBtn = page.locator('button', { hasText: '← Назад' });
    await expect(backBtn).toBeVisible();
    await backBtn.click();

    // Timer screen should be back
    await expect(page.locator('text=Round 1')).toBeVisible({ timeout: 15000 });
  });
});
