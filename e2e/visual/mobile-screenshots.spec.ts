import { test, expect } from '@playwright/test';

// Visual regression tests for mobile layout (390×844, iPhone 14 user-agent).
// On the FIRST run Playwright generates baseline PNG files in e2e/visual/__screenshots__/.
// Subsequent runs compare against those baselines. Tests always pass on first run.
//
// The timer digit area is masked to avoid diffs caused by the timer ticking every second.
// maxDiffPixelRatio: 0.05 gives 5% tolerance for minor rendering differences.

test.describe('Visual - Mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('text=Round 1', { timeout: 15000 });
  });

  test('mobile timer screen - initial state (paused)', async ({ page }) => {
    // Timer starts paused — mask the MM:SS digits which still render a time value.
    await expect(page).toHaveScreenshot('mobile-timer-initial.png', {
      maxDiffPixelRatio: 0.05,
      mask: [
        // Mobile timer digits: font-black tabular-nums, clamp font-size
        page.locator('.font-black.tabular-nums'),
        // Real-time clock in the bottom bar (HH:MM)
        page.locator('.tabular-nums'),
      ],
    });
  });

  test('mobile timer screen - playing state', async ({ page }) => {
    // Tap play to start the timer, then immediately screenshot
    const playBtn = page.locator('button', { hasText: '▶' });
    await playBtn.click();
    await expect(page.locator('button', { hasText: '⏸' })).toBeVisible({ timeout: 5000 });

    await expect(page).toHaveScreenshot('mobile-timer-playing.png', {
      maxDiffPixelRatio: 0.05,
      mask: [
        page.locator('.font-black.tabular-nums'),
        page.locator('.tabular-nums'),
      ],
    });

    // Pause again to leave the page in a clean state
    await page.locator('button', { hasText: '⏸' }).click();
  });

  test('mobile admin panel - no session state', async ({ page }) => {
    // Open admin panel with two rapid clicks (simulates double-tap)
    await page.evaluate(() => {
      const blindArea = document.querySelector<HTMLElement>('[class*="pt-10"]');
      if (blindArea) {
        blindArea.click();
        blindArea.click();
      }
    });
    await page.waitForSelector('text=Администратор', { timeout: 5000 });
    await expect(page.locator('text=Активная игра не найдена')).toBeVisible();

    await expect(page).toHaveScreenshot('mobile-admin-panel-no-session.png', {
      maxDiffPixelRatio: 0.05,
    });
  });
});
