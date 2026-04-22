import { pathToFileURL } from 'node:url';
import { seoConstants } from './constants';
import { pageSpeedTools } from './run-pagespeed';
import { seoShared } from './shared';

export async function main() {
  const baseUrl = seoShared.normalizeOrigin(
    process.env.SEO_PLATFORM_ORIGIN || seoConstants.DEFAULT_PLATFORM_ORIGIN
  );
  const extraUrls = (process.env.PAGESPEED_EXTRA_URLS || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const strategies = pageSpeedTools.parseStrategies(
    process.env.PAGESPEED_STRATEGIES
  );
  const results = await pageSpeedTools.runPageSpeedAudit({
    apiKey: process.env.PAGESPEED_INSIGHTS_API_KEY,
    baseUrl,
    extraUrls,
    strategies,
  });

  const failedResults = results.filter((result) => !result.passed);
  const markdown = pageSpeedTools.buildPageSpeedSummary(results);

  console.log(markdown.replace(/^## /gm, '').replace(/^### /gm, ''));
  await seoShared.appendGitHubStepSummary(markdown);

  if (failedResults.length > 0) {
    throw new Error(
      `PageSpeed monitoring found ${failedResults.length} failing audits`
    );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    await main();
  } catch (error) {
    console.error('[seo:pagespeed] Monitoring failed', error);
    process.exitCode = 1;
  }
}
