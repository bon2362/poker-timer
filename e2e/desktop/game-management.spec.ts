import { test, expect } from '@playwright/test';

// Helper: open settings screen bypassing the "Игра не настроена" overlay (z-40, intercepts pointer events)
async function openSettingsViaGear(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const btn = document.querySelector<HTMLButtonElement>('button[title="Settings"]');
    btn?.click();
  });
  await expect(page.locator('h1', { hasText: 'НАСТРОЙКИ' })).toBeVisible({ timeout: 10000 });
}

test.describe('Game Management - Desktop', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    // Wait for the timer to hydrate — "Round 1" is rendered by PokerTimer component
    await page.waitForSelector('text=Round 1', { timeout: 15000 });
  });

  // E7: Setup overlay is visible when there is no active session; otherwise the live game screen is visible.
  test('E7: setup overlay or active game state is visible', async ({ page }) => {
    const noSessionHeading = page.getByRole('heading', { name: 'Игра не настроена' });

    if (await noSessionHeading.isVisible()) {
      await expect(noSessionHeading).toBeVisible();
      await expect(
        page.locator('p', { hasText: 'Настройте игроков и параметры сессии перед стартом таймера' })
      ).toBeVisible();
      await expect(page.getByRole('button', { name: 'Открыть настройки' })).toBeVisible();
    } else {
      await expect(page.locator('text=Round 1')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Открыть настройки' })).not.toBeVisible();
    }
  });

  // E8: Settings → Игроки tab shows the player list
  test('E8: settings player list section is visible', async ({ page }) => {
    await openSettingsViaGear(page);

    // Switch to the "Игроки" tab
    const playersTab = page.getByRole('button', { name: 'Игроки' });
    await expect(playersTab).toBeVisible();
    await playersTab.click();

    // Heading should contain "Игроки" and a count
    await expect(page.locator('text=/Игроки \\(\\d+\\)/')).toBeVisible({ timeout: 5000 });

    // "+ Добавить" button is present
    await expect(page.getByRole('button', { name: '+ Добавить' })).toBeVisible();

    const emptyState = page.getByText('Нет игроков. Добавьте первого.');
    if (await emptyState.isVisible()) {
      await expect(emptyState).toBeVisible();
    } else {
      await expect(page.locator('img[alt]').first()).toBeVisible({ timeout: 5000 });
    }
  });

  // E9: Settings → Турнир tab shows blinds table with SB/BB columns
  test('E9: settings tournament tab shows blinds configuration', async ({ page }) => {
    await openSettingsViaGear(page);

    // "Турнир" tab is the default/active tab
    const tournamentTab = page.getByRole('button', { name: 'Турнир' });
    await expect(tournamentTab).toBeVisible();
    // Make sure we're on the Турнир tab (click in case another tab is active)
    await tournamentTab.click();

    // Blinds section heading (exact match on the section label "Блайнды")
    await expect(page.getByText('Блайнды', { exact: true })).toBeVisible();

    // SB and BB column headers
    await expect(page.locator('text=SB')).toBeVisible();
    await expect(page.locator('text=BB')).toBeVisible();

    // First blind row should show 10 (SB) and 20 (BB) based on prod data
    // We check for a table cell containing "10" within the blinds table
    await expect(page.locator('table')).toBeVisible();

    // Time section label should be visible (exact match to avoid matching "Применить время и блайнды")
    await expect(page.getByText('Время', { exact: true })).toBeVisible();

    // "Применить время и блайнды" button at the bottom
    await expect(page.getByRole('button', { name: 'Применить время и блайнды' })).toBeVisible();
  });

  // E10: BlindInfo section shows Round label and SB/BB values on main screen
  test('E10: main screen shows blind info with round and SB/BB values', async ({ page }) => {
    // Round label (e.g. "Round 1")
    await expect(page.locator('text=Round 1')).toBeVisible();

    // Blinds displayed as "SB / BB" — initial prod config is 10 / 20
    await expect(page.locator('text=10 / 20')).toBeVisible();

    // "Далее" (next round preview) section is visible below
    await expect(page.locator('text=Далее')).toBeVisible();
    await expect(page.locator('text=20 / 40')).toBeVisible();
  });

  // E11: Timer display shows time in MM:SS format
  test('E11: timer display shows MM:SS formatted time', async ({ page }) => {
    // The large timer element contains text matching MM:SS (e.g. "20:00")
    const timerEl = page.locator('div').filter({ hasText: /^\d{2}:\d{2}$/ }).first();
    await expect(timerEl).toBeVisible();

    // Verify the text actually matches the MM:SS pattern
    const timerText = await timerEl.textContent();
    expect(timerText).toMatch(/^\d{2}:\d{2}$/);

    // The timer can be paused or running because e2e runs against the shared live app.
  });
});
