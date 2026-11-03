import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  timeout: 90000,
  use: { baseURL: 'http://127.0.0.1:4173/mando/', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
    },
  ],
  webServer: {
    command: 'npm run preview -- --base /mando/ --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/mando/',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
