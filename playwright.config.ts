import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const localBaseURL = 'http://127.0.0.1:3100';
// Keys of the test Supabase project (poker-timer-test). In CI they come from GitHub secrets.
if (existsSync('.env.test.local')) process.loadEnvFile('.env.test.local');
// Set PLAYWRIGHT_BASE_URL only to run the unauthenticated smoke checks against a deployed site.
const remoteBaseURL = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 45000,
  retries: 2,
  // One worker: the tests share one test database and the same timer.
  workers: 1,
  use: {
    baseURL: remoteBaseURL ?? localBaseURL,
    trace: 'on-first-retry',
  },
  webServer: remoteBaseURL
    ? undefined
    : {
        command: 'npm run dev -- --hostname 127.0.0.1 --port 3100',
        url: localBaseURL,
        reuseExistingServer: false,
        timeout: 120000,
        env: {
          CI: 'true',
          ADMIN_PASSWORD: 'local-e2e-admin-password',
          ADMIN_SESSION_SECRET: 'local-e2e-session-secret-not-for-production',
          NEXT_PUBLIC_SESSION_ID: 'ci-e2e',
          // Empty values stop Next from falling back to the production keys in .env.local.
          NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
          NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
          SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
        },
      },
  projects: [
    {
      name: 'desktop',
      testMatch: '**/desktop/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      testMatch: '**/mobile/**/*.spec.ts',
      use: {
        // Use Chrome with iPhone 14 viewport/user-agent (WebKit not installed)
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3,
      },
    },
  ],
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['allure-playwright', { resultsDir: 'allure-results' }],
  ],
});
