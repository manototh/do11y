/**
 * Do11y — Test Helpers
 *
 * Test metadata injection via Puppeteer network interception.
 *
 * Instead of polluting production Do11yConfig with testRunId/testFramework
 * fields, this helper intercepts network requests at the Puppeteer level
 * and injects test identifiers into outgoing event payloads.
 *
 * Usage:
 *   import { injectTestMetadata } from '../helpers/test-metadata';
 *
 *   const testRunId = `run-${Date.now()}`;
 *   await injectTestMetadata(page, testRunId, 'mintlify');
 *   // All Supabase-bound POST requests will now include _testRunId and _testFramework
 */

import type { Page } from 'puppeteer';

/**
 * Intercept Supabase-bound POST requests and inject test metadata
 * into the event payloads.
 *
 * @param page - Puppeteer Page instance
 * @param testRunId - Unique identifier for this test run
 * @param testFramework - Framework name (e.g. 'mintlify', 'docusaurus')
 */
export async function injectTestMetadata(
  page: Page,
  testRunId: string,
  testFramework: string,
): Promise<void> {
  await page.route('**/rest/v1/**', async (route) => {
    if (route.request().method() === 'POST') {
      const postData = route.request().postData();
      if (!postData) {
        await route.continue();
        return;
      }

      try {
        const payload = JSON.parse(postData);
        const enriched = (Array.isArray(payload) ? payload : [payload]).map(
          (event: Record<string, unknown>) => ({
            ...event,
            _testRunId: testRunId,
            _testFramework: testFramework,
          }),
        );

        await route.continue({
          postData: JSON.stringify(enriched),
          headers: route.request().headers(),
        });
      } catch {
        // If parsing fails, forward the request as-is
        await route.continue();
      }
    } else {
      await route.continue();
    }
  });
}

/**
 * Remove all route interceptors from the page.
 */
export async function removeTestMetadataInterceptor(page: Page): Promise<void> {
  await page.unroute('**/rest/v1/**');
}
