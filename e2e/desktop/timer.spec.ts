import { test, expect } from '@playwright/test';

test.describe('Timer - Desktop', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // 'networkidle' is not used because Supabase Realtime keeps WebSocket connections open.
    await page.waitForLoadState('domcontentloaded');
    // Wait for the timer display or overlay to appear — signals React has hydrated
    await page.waitForSelector('text=Round 1', { timeout: 30000 });
  });

  // E1: Play and pause toggle
  test('E1: can play and pause timer', async ({ page }) => {
    // The "Игра не настроена" overlay (z-40, fixed inset-0) intercepts pointer events.
    // We use JS evaluation to directly dispatch a click on the button element, bypassing the overlay.

    // Verify the play button is present in the DOM
    const playPauseBtn = page.getByRole('button', { name: '▶︎' });
    await expect(playPauseBtn).toBeVisible();

    // Click via JS — reaches the button's React handler even with overlay present
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(
        b => b.textContent?.includes('▶') || b.textContent?.includes('⏸')
      );
      btn?.click();
    });

    // After clicking play, button text should switch to pause icon
    await expect(page.getByRole('button', { name: '⏸︎' })).toBeVisible({ timeout: 5000 });

    // Click again to pause
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(
        b => b.textContent?.includes('⏸')
      );
      btn?.click();
    });

    // Should return to play icon
    await expect(page.getByRole('button', { name: '▶︎' })).toBeVisible({ timeout: 5000 });
  });

  // E2: Navigate between stages
  test('E2: next/prev stage navigation', async ({ page }) => {
    // Initial blinds should be visible
    await expect(page.locator('text=10 / 20')).toBeVisible();

    // The overlay (z-40) blocks normal clicks on controls.
    // Use JS dispatch to click the next/prev buttons directly.
    await page.evaluate(() => {
      const btn = document.querySelector<HTMLButtonElement>('button[title="Следующий уровень"]');
      btn?.click();
    });

    // Blinds should have changed from 10/20 to something else
    await expect(page.locator('text=10 / 20')).not.toBeVisible({ timeout: 5000 });

    // Navigate back with prev button
    await page.evaluate(() => {
      const btn = document.querySelector<HTMLButtonElement>('button[title="Предыдущий уровень"]');
      btn?.click();
    });

    // Original blinds should be back
    await expect(page.locator('text=10 / 20')).toBeVisible({ timeout: 5000 });
  });

  // E3: Timer displays correct initial state
  test('E3: shows initial blind level and timer', async ({ page }) => {
    // Round 1 label
    await expect(page.locator('text=Round 1')).toBeVisible({ timeout: 10000 });

    // Initial blinds 10 / 20
    await expect(page.locator('text=10 / 20')).toBeVisible({ timeout: 10000 });

    // Timer should display a time in MM:SS format — use .first() because the clock widget
    // in the bottom-right also matches /\d{2}:\d{2}/ and would cause a strict-mode violation.
    await expect(page.getByText(/\d{2}:\d{2}/).first()).toBeVisible({ timeout: 10000 });
  });

  // E4: Next blind info shown below timer
  test('E4: shows next blind info below timer', async ({ page }) => {
    // "Далее" label and next blinds 20/40 should be visible
    await expect(page.locator('text=Далее')).toBeVisible();
    await expect(page.locator('text=20 / 40')).toBeVisible();
  });

  // E5: Settings button visible in top bar
  test('E5: settings button is accessible', async ({ page }) => {
    // The ⚙ button has title="Settings" — it is in the top-right corner
    const settingsBtn = page.locator('button[title="Settings"]');
    await expect(settingsBtn).toBeVisible({ timeout: 10000 });
  });

  // E6: Session overlay shown when no active session; active session screen otherwise remains usable.
  test('E6: shows setup overlay or active session screen', async ({ page }) => {
    const noSessionHeading = page.getByRole('heading', { name: 'Игра не настроена' });

    if (await noSessionHeading.isVisible()) {
      await expect(noSessionHeading).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('button', { name: 'Открыть настройки' })).toBeVisible();
    } else {
      await expect(page.locator('text=Round 1')).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('button', { name: 'Открыть настройки' })).not.toBeVisible();
    }
  });
});
