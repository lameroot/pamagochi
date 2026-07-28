import { expect, test } from '@playwright/test';

/**
 * Cloud smoke browser check, run only via the manual
 * `.github/workflows/cloud-smoke.yml` workflow (`playwright test --grep @cloud`).
 * Requires CLOUD_WEB_URL / CLOUD_API_URL to be set; PLAYWRIGHT_BASE_URL should
 * point at CLOUD_WEB_URL when invoking this spec.
 */
test('@cloud Cloudflare frontend loads Phaser canvas with no critical console errors', async ({
  page,
}) => {
  test.skip(!process.env.CLOUD_WEB_URL, 'CLOUD_WEB_URL is not configured');

  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto('/');

  await expect(page.getByTestId('profile-badge')).toHaveText('CLOUD', { timeout: 15_000 });

  const canvas = page.getByTestId('game-canvas-host').locator('canvas');
  await expect(canvas).toBeVisible({ timeout: 20_000 });

  const criticalErrors = consoleErrors.filter((text) => !text.includes('favicon'));
  expect(criticalErrors, `Unexpected console errors: ${criticalErrors.join('\n')}`).toHaveLength(0);
});
