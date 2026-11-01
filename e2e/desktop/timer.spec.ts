import { loginAsAdmin, isLocalBaseURL, TEST_ADMIN_PASSWORD } from '../helpers/admin';
import { test, expect } from '@playwright/test';

async function waitForTimerApp(page: import('@playwright/test').Page) {
  await page.goto('/');
  // 'networkidle' is not used because Supabase Realtime keeps WebSocket connections open.
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('text=Round 1')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('button[title="Settings"]')).toBeVisible({ timeout: 15000 });
}

test.describe('Timer - Desktop', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await loginAsAdmin(page, baseURL);
    await waitForTimerApp(page);
  });

  // E1: Play and pause toggle
  test('E1: can play and pause timer', async ({ page }) => {
    // The "Игра не настроена" overlay (z-40, fixed inset-0) intercepts pointer events.
    // We use JS evaluation to directly dispatch a click on the button element, bypassing the overlay.
    // Timer may already be running (⏸) or paused (▶) depending on live app state.

    const playPauseBtn = page.locator('button').filter({ hasText: /[▶⏸]/ });
    await expect(playPauseBtn).toBeVisible();

    const initialText = await playPauseBtn.textContent();
    const startsPlaying = initialText?.includes('⏸');

    // Click via JS — reaches the button's React handler even with overlay present
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(
        b => b.textContent?.includes('▶') || b.textContent?.includes('⏸')
      );
      btn?.click();
    });

    // After clicking, button should switch to opposite icon
    if (startsPlaying) {
      await expect(page.getByRole('button', { name: '▶︎' })).toBeVisible({ timeout: 5000 });
    } else {
      await expect(page.getByRole('button', { name: '⏸︎' })).toBeVisible({ timeout: 5000 });
    }

    // Click again to toggle back
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(
        b => b.textContent?.includes('▶') || b.textContent?.includes('⏸')
      );
      btn?.click();
    });

    // Should return to initial icon
    if (startsPlaying) {
      await expect(page.getByRole('button', { name: '⏸︎' })).toBeVisible({ timeout: 5000 });
    } else {
      await expect(page.getByRole('button', { name: '▶︎' })).toBeVisible({ timeout: 5000 });
    }
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
    await expect(settingsBtn).toBeVisible({ timeout: 15000 });
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

test.describe('Timer viewer - Desktop', () => {
  test('viewer sees the timer without settings, controls or setup overlay', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Round 1', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Войти в управление' })).toBeEnabled();
    await expect(page.locator('button[title="Settings"]')).toHaveCount(0);
    await expect(page.locator('button[title="Следующий уровень"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /[▶⏸]/ })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Игра не настроена' })).toHaveCount(0);
    await page.keyboard.press('Space');
    await page.keyboard.press('Tab');
    await page.keyboard.press('PageUp');
    await page.keyboard.press('PageDown');
    await expect(page.getByText('Round 1', { exact: true })).toBeVisible();
    await expect(page.getByText('20:00', { exact: true }).first()).toBeVisible();
  });

  test('desktop entry shows password form and successful login unlocks settings', async ({ page, baseURL }) => {
    test.skip(!isLocalBaseURL(baseURL), 'Login test uses local fixture credentials only');
    await page.goto('/');
    await page.getByRole('button', { name: 'Войти в управление' }).click();
    await page.getByLabel('Пароль', { exact: true }).fill('wrong');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Неверный пароль');
    await expect(page.locator('button[title="Settings"]')).toHaveCount(0);
    await page.getByLabel('Пароль', { exact: true }).fill(TEST_ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('button[title="Settings"]')).toBeVisible();
    await page.reload();
    await expect(page.locator('button[title="Settings"]')).toBeVisible();
  });
});

test('admin login page supports phone and desktop widths and returns to the timer', async ({ page, baseURL }, testInfo) => {
  test.skip(!isLocalBaseURL(baseURL), 'Login test uses local fixture credentials only');
  await page.goto('/admin/login');
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.getByLabel('Пароль', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Войти', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: '← На сайт' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`admin-login-${width}.png`) });
  }
  await page.getByLabel('Пароль', { exact: true }).fill(TEST_ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(new URL('/', baseURL).href);
  await expect(page.locator('button[title="Settings"]')).toBeVisible();
});
