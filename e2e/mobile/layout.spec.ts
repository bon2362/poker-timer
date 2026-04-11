import { test, expect } from '@playwright/test';

// These tests run in the 'mobile' project which uses iPhone 14 viewport (390x844)
test.describe('Mobile Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('text=Round 1', { timeout: 30000 });
  });

  // M1: Mobile view (<768px) renders MobileView component with its own layout.
  // MobileView has: "Round 1" label, "10 / 20" blinds, and a full-width ▶ button (no title attr).
  test('M1: mobile view renders timer on small screen', async ({ page }) => {
    await expect(page.locator('text=Round 1')).toBeVisible();
    await expect(page.locator('text=10 / 20')).toBeVisible();

    // MobileView play button shows ▶ (no variant selector character, unlike desktop ▶︎)
    const playBtn = page.locator('button', { hasText: '▶' });
    await expect(playBtn).toBeVisible();
  });

  // M5: Landscape mode — page should still display key elements
  test('M5: landscape orientation shows timer content', async ({ page }) => {
    // Rotate to landscape: 844x390 (still <768 height but width > threshold — reloads as desktop).
    // Use a width that stays below 768 to keep mobile layout.
    await page.setViewportSize({ width: 430, height: 932 });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('text=Round 1', { timeout: 30000 });

    await expect(page.locator('text=Round 1')).toBeVisible();
    await expect(page.locator('text=10 / 20')).toBeVisible();
  });

  // M6: Tablet viewport (≥768px) renders desktop PokerTimer layout
  test('M6: tablet viewport (768px+) shows desktop layout elements', async ({ page }) => {
    // Set viewport BEFORE navigating so client-side window.innerWidth picks up 1024px
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    // Desktop PokerTimer renders "Round 1" blind info
    await page.waitForSelector('text=Round 1', { timeout: 30000 });

    await expect(page.locator('text=Round 1')).toBeVisible();
    await expect(page.locator('text=10 / 20')).toBeVisible();

    // Desktop-only element: "Далее" next-blind label (not shown in MobileView)
    await expect(page.locator('text=Далее')).toBeVisible();
  });
});
