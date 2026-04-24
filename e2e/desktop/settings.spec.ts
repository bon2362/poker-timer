import { test, expect } from '@playwright/test';

async function waitForSettingsEntryPoints(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('text=Round 1')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('button[title="Settings"]')).toBeVisible({ timeout: 15000 });
}

test.describe('Settings - Desktop', () => {
  test.beforeEach(async ({ page }) => {
    await waitForSettingsEntryPoints(page);
  });

  // Helper: click the gear (Settings) button via JS to bypass the overlay (z-40)
  async function openSettingsViaGear(page: import('@playwright/test').Page) {
    await expect(page.locator('button[title="Settings"]')).toBeVisible({ timeout: 15000 });
    await page.evaluate(() => {
      const btn = document.querySelector<HTMLButtonElement>('button[title="Settings"]');
      btn?.click();
    });
    await expect(page.locator('h1', { hasText: 'НАСТРОЙКИ' })).toBeVisible({ timeout: 10000 });
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
    await expect(page.locator('h1', { hasText: 'НАСТРОЙКИ' })).toBeVisible({ timeout: 10000 });
  });

  // E14: Settings screen has back button to return to timer
  test('E14: can close settings and return to timer', async ({ page }) => {
    // Open settings via JS click (bypasses overlay)
    await openSettingsViaGear(page);
    await expect(page.locator('h1', { hasText: 'НАСТРОЙКИ' })).toBeVisible();

    // Close settings via the header back button and wait for the settings screen to unmount.
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
        button => button.textContent?.includes('Назад')
      );
      btn?.click();
    });
    await expect(page.locator('h1', { hasText: 'НАСТРОЙКИ' })).not.toBeVisible({ timeout: 10000 });

    // Timer screen should be back
    await expect(page.locator('text=Round 1')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('button[title="Settings"]')).toBeVisible({ timeout: 15000 });
  });
});
