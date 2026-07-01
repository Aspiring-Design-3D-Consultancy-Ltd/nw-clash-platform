import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  timeout: 30_000,
  use: {
    headless: true,
    launchOptions: {
      // Cloud sandbox / CI: system-provided chromium binary.
      executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    },
  },
});
