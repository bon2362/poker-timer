import { test, expect } from '@playwright/test';

// These tests run in the 'mobile' project which uses iPhone 14 viewport (390x844).
// The admin panel is accessed by double-tapping (two rapid clicks) on the blind info area.
test.describe('Mobile Admin Panel', () => {
  test.beforeEach(async ({ page }) => {
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
    await page.waitForSelector('text=Администратор', { timeout: 5000 });
  }

  // M2: Mobile view shows play/pause button that is functional
  test('M2: mobile shows play/pause button', async ({ page }) => {
    // In mobile view the play button shows ▶ (no variant selector like on desktop)
    const playBtn = page.locator('button', { hasText: '▶' });
    await expect(playBtn).toBeVisible();

    // Verify the button occupies a wide area (full-width style)
    const box = await playBtn.boundingBox();
    expect(box).not.toBeNull();
    // The button should be at least 200px wide (max-w-[280px] style)
    expect(box!.width).toBeGreaterThan(200);
  });

  // M3: Tapping play/pause changes timer state
  test('M3: tapping play/pause toggles timer between play and pause states', async ({ page }) => {
    // Initial state: timer is paused (starts paused), button shows ▶
    const playBtn = page.locator('button', { hasText: '▶' });
    await expect(playBtn).toBeVisible();

    // Tap play — timer should start
    await playBtn.click();

    // After pressing play, button switches to pause icon ⏸
    await expect(page.locator('button', { hasText: '⏸' })).toBeVisible({ timeout: 5000 });

    // Tap pause — timer should stop
    const pauseBtn = page.locator('button', { hasText: '⏸' });
    await pauseBtn.click();

    // Should return to play icon
    await expect(page.locator('button', { hasText: '▶' })).toBeVisible({ timeout: 5000 });
  });

  // M4: Mobile view shows blind level info
  test('M4: mobile shows blind level info (round label and SB/BB)', async ({ page }) => {
    // Round label
    await expect(page.locator('text=Round 1')).toBeVisible();

    // Initial blinds: 10 / 20
    await expect(page.locator('text=10 / 20')).toBeVisible();

    // "Далее" next blind info
    await expect(page.locator('text=Далее')).toBeVisible();
    await expect(page.locator('text=20 / 40')).toBeVisible();
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

  // M8: Admin panel shows "no session" message when no game is active
  test('M8: admin panel shows no-session message when no game configured', async ({ page }) => {
    await openAdminPanel(page);

    // Without an active session the panel shows a placeholder message
    await expect(page.locator('text=Активная игра не найдена')).toBeVisible();
  });

  // M9: Admin panel can be closed with ✕ button
  test('M9: admin panel closes on ✕ button tap', async ({ page }) => {
    await openAdminPanel(page);
    await expect(page.locator('text=Администратор')).toBeVisible();

    // Tap the close button
    const closeBtn = page.locator('button', { hasText: '✕' });
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();

    // Admin panel should be gone and normal mobile view back
    await expect(page.locator('text=Администратор')).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Round 1')).toBeVisible();
  });
});
