import { test, expect } from '@playwright/test';

test.describe('Game history admin protection', () => {
  test('private admin screens redirect to login and disable indexing', async ({ page }) => {
    for (const path of ['/admin', '/admin/games/fictional-game', '/admin/no-game', '/admin/players']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/login$/);
      await expect(page.getByRole('button', { name: 'Войти', exact: true })).toBeVisible();
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    }
  });

  test('new admin write endpoints reject requests without a cookie', async ({ request }) => {
    for (const [method, path, body] of [
      ['PATCH', '/api/admin/games/fictional/results', { players: [] }],
      ['PATCH', '/api/admin/games/fictional/images', {}],
      ['DELETE', '/api/admin/games/fictional', undefined],
      ['GET', '/api/admin/photos?unassigned=1', undefined],
      ['POST', '/api/admin/photos', {}],
      ['PATCH', '/api/admin/photos/fictional', { sessionId: null }],
      ['DELETE', '/api/admin/photos/fictional', undefined],
    ] as const) {
      const response = await request.fetch(path, { method, ...(body === undefined ? {} : { data: body }) });
      expect(response.status()).toBe(401);
    }
  });
});
