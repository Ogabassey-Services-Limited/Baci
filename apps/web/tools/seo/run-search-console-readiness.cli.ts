import { pathToFileURL } from 'node:url';
import {
  buildReadinessSummary,
  runConfiguredSearchConsoleReadinessAudit,
} from './run-search-console-readiness';
import { appendGitHubStepSummary, normalizeOrigin } from './shared';

export async function main() {
  const merchantOriginsEnv =
    process.env.SEO_MERCHANT_ORIGINS?.trim() || undefined;
  const configuredPlatformOrigin = process.env.SEO_PLATFORM_ORIGIN?.trim();
  const platformOrigin = configuredPlatformOrigin
    ? normalizeOrigin(configuredPlatformOrigin)
    : 'https://usebaci.com';

  const result = await runConfiguredSearchConsoleReadinessAudit({
    merchantOriginsEnv,
    platformOrigin,
  });
  const markdown = buildReadinessSummary(result);

  console.log(markdown.replace(/^## /gm, '').replace(/^### /gm, ''));
  await appendGitHubStepSummary(markdown);

  if (!result.passed) {
    throw new Error('Search Console readiness checks failed');
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    await main();
  } catch (error) {
    console.error('[seo:readiness] Monitoring failed', error);
    process.exitCode = 1;
  }
}
