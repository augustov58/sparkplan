import { test as setup, expect } from '@playwright/test';
import { existsSync, statSync } from 'fs';

const AUTH_FILE = 'tests/e2e/.auth/user.json';
const REUSE_MAX_AGE_MS = 1000 * 60 * 30;

setup('authenticate', async ({ page }) => {
  if (existsSync(AUTH_FILE)) {
    const ageMs = Date.now() - statSync(AUTH_FILE).mtimeMs;
    if (ageMs < REUSE_MAX_AGE_MS && !process.env.E2E_FORCE_REAUTH) {
      console.log(`[auth.setup] reusing auth state (age ${Math.round(ageMs / 1000)}s)`);
      return;
    }
  }

  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'auth.setup needs E2E_USER_EMAIL and E2E_USER_PASSWORD env vars. ' +
        'Example: E2E_USER_EMAIL=you@example.com E2E_USER_PASSWORD=... npx playwright test',
    );
  }

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const emailField = page.getByLabel(/email/i).first();
  await emailField.waitFor({ state: 'visible', timeout: 15_000 });
  await emailField.fill(email);
  await page.getByLabel(/password/i).first().fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(page.getByText(/sign in/i)).toBeHidden({ timeout: 20_000 });
  await page.waitForLoadState('networkidle');

  await page.context().storageState({ path: AUTH_FILE });
  console.log(`[auth.setup] saved fresh auth state to ${AUTH_FILE}`);
});
