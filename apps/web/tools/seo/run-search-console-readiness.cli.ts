import { pathToFileURL } from 'node:url';
import { searchConsoleReadiness } from './run-search-console-readiness';
import { seoShared } from './shared';

export async function main() {
  const merchantOriginsEnv =
    process.env.SEO_MERCHANT_ORIGINS?.trim() || undefined;
  const configuredPlatformOrigin = process.env.SEO_PLATFORM_ORIGIN?.trim();
  const platformOrigin = configuredPlatformOrigin
    ? seoShared.normalizeOrigin(configuredPlatformOrigin)
    : 'https://usebaci.com';

  const result =
    await searchConsoleReadiness.runConfiguredSearchConsoleReadinessAudit({
      merchantOriginsEnv,
      platformOrigin,
    });
  const markdown = searchConsoleReadiness.buildReadinessSummary(result);

  console.log(markdown.replace(/^## /gm, '').replace(/^### /gm, ''));
  await seoShared.appendGitHubStepSummary(markdown);

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
