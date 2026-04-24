import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;
const localBaseURL = 'http://127.0.0.1:3000';

export default defineConfig({
  testDir: './e2e',
  timeout: 45000,
  retries: 2,
  workers: isCI ? 1 : undefined,
  use: {
    baseURL: isCI ? localBaseURL : process.env.PLAYWRIGHT_BASE_URL ?? 'https://poker-timer-black.vercel.app',
    trace: 'on-first-retry',
  },
  webServer: isCI
    ? {
        command: 'npm run dev -- --hostname 127.0.0.1 --port 3000',
        url: localBaseURL,
        reuseExistingServer: false,
        timeout: 120000,
        env: {
          CI: 'true',
          NEXT_PUBLIC_SESSION_ID: 'ci-e2e',
        },
      }
    : undefined,
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
    {
      name: 'visual-desktop',
      testMatch: '**/visual/desktop*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'visual-mobile',
      testMatch: '**/visual/mobile*.spec.ts',
      use: {
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
