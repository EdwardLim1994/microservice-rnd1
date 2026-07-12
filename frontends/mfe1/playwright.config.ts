import { defineConfig, devices } from '@playwright/test';

// Real, end-to-end browser flows against the full local stack (Apollo Router → auth subgraph →
// Authentik) — see docker-compose.yml at the repo root for what needs to already be running
// (`docker compose up -d authentik-server authentik-worker authentik-postgresql authentik-redis
// auth router`) before these run. `webServer` below only starts mfe1's own dev server; it does
// not stand up the backend stack.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
