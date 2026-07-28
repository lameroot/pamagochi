import { expect, test } from '@playwright/test';

/**
 * Local profile end-to-end smoke test (see docs/local-development.md).
 * Assumes the API and web dev servers are already running against a
 * seeded local PostgreSQL instance (orchestrated by
 * `scripts/run-profile.mjs local e2e` / `scripts/verify-local.mjs`).
 */
test('local dev flow: login, game canvas, child profile CRUD', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto('/');

  await expect(page.getByTestId('profile-badge')).toHaveText('LOCAL');
  await expect(page.getByTestId('api-status')).toHaveText('API: online', { timeout: 15_000 });

  const canvas = page.getByTestId('game-canvas-host').locator('canvas');
  await expect(canvas).toBeVisible({ timeout: 15_000 });

  await expect(page.getByTestId('scene-status')).toHaveText(/готова/, { timeout: 15_000 });

  const childName = `E2E Kid ${Date.now()}`;
  await page.getByLabel('Имя ребёнка').fill(childName);
  await page.getByRole('button', { name: 'Добавить профиль' }).click();

  await expect(page.getByTestId('children-list')).toContainText(childName, { timeout: 10_000 });

  await page.reload();
  await expect(page.getByTestId('children-list')).toContainText(childName, { timeout: 10_000 });

  const criticalErrors = consoleErrors.filter((text) => !text.includes('favicon'));
  expect(criticalErrors, `Unexpected console errors: ${criticalErrors.join('\n')}`).toHaveLength(0);
});
