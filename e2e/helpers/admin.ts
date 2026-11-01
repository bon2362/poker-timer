import { expect, test, type Page } from '@playwright/test';

// Deliberately public fixture values; never use production credentials in E2E.
export const TEST_ADMIN_PASSWORD = 'local-e2e-admin-password';

export function isLocalBaseURL(baseURL: string | undefined) {
  if (!baseURL) return false;
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(new URL(baseURL).hostname);
}

export async function loginAsAdmin(page: Page, baseURL: string | undefined) {
  test.skip(!isLocalBaseURL(baseURL), 'Authenticated E2E uses local fixture credentials only');
  const response = await page.request.post('/api/admin/login', { data: { password: TEST_ADMIN_PASSWORD } });
  expect(response.ok()).toBe(true);
}
