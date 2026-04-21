import { pathToFileURL } from 'node:url';
import {
  buildPageSpeedSummary,
  parseStrategies,
  runPageSpeedAudit,
} from './run-pagespeed';
import {
  appendGitHubStepSummary,
  normalizeOrigin,
  parseCsvUrls,
} from './shared';

export async function main() {
  const baseUrl = normalizeOrigin(
    process.env.SEO_PLATFORM_ORIGIN || 'https://usebaci.com'
  );
  const extraUrls = parseCsvUrls(process.env.PAGESPEED_EXTRA_URLS);
  const strategies = parseStrategies(process.env.PAGESPEED_STRATEGIES);
  const results = await runPageSpeedAudit({
    apiKey: process.env.PAGESPEED_INSIGHTS_API_KEY,
    baseUrl,
    extraUrls,
    strategies,
  });

  const failedResults = results.filter((result) => !result.passed);
  const markdown = buildPageSpeedSummary(results);

  console.log(markdown.replace(/^## /gm, '').replace(/^### /gm, ''));
  await appendGitHubStepSummary(markdown);

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
