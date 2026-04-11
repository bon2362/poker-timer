import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: 'https://poker-timer-black.vercel.app',
    trace: 'on-first-retry',
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
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
});
