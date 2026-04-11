import { test, expect } from '@playwright/test';

// Visual regression tests for desktop layout.
// On the FIRST run Playwright generates baseline PNG files in e2e/visual/__screenshots__/.
// Subsequent runs compare against those baselines. Tests always pass on first run.
//
// The timer display is masked (it ticks every second) to avoid flaky diffs.
// maxDiffPixelRatio: 0.05 gives 5% tolerance for antialiasing / minor rendering differences.

test.describe('Visual - Desktop', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('text=Round 1', { timeout: 15000 });
  });

  test('desktop timer screen - initial state (paused)', async ({ page }) => {
    // Timer starts in paused state — the display is stable (PAUSE watermark, static time).
    // Mask the timer digits so that any clock drift does not cause false failures.
    await expect(page).toHaveScreenshot('desktop-timer-initial.png', {
      maxDiffPixelRatio: 0.05,
      mask: [
        // The large MM:SS timer text uses font-black tabular-nums
        page.locator('.font-black.tabular-nums'),
      ],
    });
  });

  test('desktop settings screen', async ({ page }) => {
    // Open settings via JS to bypass the "Игра не настроена" overlay (z-40)
    await page.evaluate(() => {
      const btn = document.querySelector<HTMLButtonElement>('button[title="Settings"]');
      btn?.click();
    });
    await page.waitForSelector('h1', { timeout: 10000 });
    await expect(page.locator('h1', { hasText: 'НАСТРОЙКИ' })).toBeVisible();

    await expect(page).toHaveScreenshot('desktop-settings.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('desktop timer screen - no session overlay', async ({ page }) => {
    // The "Игра не настроена" overlay is shown when no session is configured.
    await expect(page.getByRole('heading', { name: 'Игра не настроена' })).toBeVisible({ timeout: 10000 });

    await expect(page).toHaveScreenshot('desktop-no-session-overlay.png', {
      maxDiffPixelRatio: 0.05,
      mask: [
        page.locator('.font-black.tabular-nums'),
      ],
    });
  });
});
