import { pathToFileURL } from 'node:url';
import {
  MERCHANT_REQUIRED_SITEMAPS,
  PLATFORM_EXCLUDED_LOCATIONS,
  PLATFORM_REQUIRED_LOCATIONS,
} from './run-search-console-readiness.config';
import {
  buildSurfaceFailure,
  extractCanonicalHref,
  extractLocs,
  extractRobotsSitemaps,
  fetchText,
  fetchTextOrIssue,
  toErrorMessage,
  urlsMatch,
} from './run-search-console-readiness.shared';
import type {
  CrawlSurfaceAudit,
  SearchConsoleReadinessResult,
} from './run-search-console-readiness.types';
import { appendGitHubStepSummary, parseCsvOrigins, resolveUrl } from './shared';

export {
  extractCanonicalHref,
  extractLocs,
  extractRobotsSitemaps,
} from './run-search-console-readiness.shared';
export type {
  CrawlSurfaceAudit,
  SearchConsoleReadinessResult,
} from './run-search-console-readiness.types';

export async function runSearchConsoleReadinessAudit({
  fetchImpl = fetch,
  merchantOrigins,
  platformOrigin,
}: {
  fetchImpl?: typeof fetch;
  merchantOrigins: string[];
  platformOrigin: string;
}): Promise<SearchConsoleReadinessResult> {
  const merchantSurfaces = await Promise.allSettled(
    merchantOrigins.map((origin) => auditMerchantSurface(fetchImpl, origin))
  );
  const surfaces = [
    await auditPlatformSurface(fetchImpl, platformOrigin),
    ...merchantSurfaces.map((surface, index) =>
      surface.status === 'fulfilled'
        ? surface.value
        : buildSurfaceFailure(
            'merchant',
            merchantOrigins[index] ?? 'unknown',
            `failed to audit merchant surface: ${toErrorMessage(surface.reason)}`
          )
    ),
  ];
  return { passed: surfaces.every((surface) => surface.passed), surfaces };
}

export async function main() {
  const result = await runSearchConsoleReadinessAudit({
    merchantOrigins: parseCsvOrigins(process.env.SEO_MERCHANT_ORIGINS),
    platformOrigin: process.env.SEO_PLATFORM_ORIGIN || 'https://usebaci.com',
  });

  const markdown = buildReadinessSummary(result);

  console.log(markdown.replace(/^## /gm, '').replace(/^### /gm, ''));
  await appendGitHubStepSummary(markdown);

  if (!result.passed) {
    throw new Error('Search Console readiness checks failed');
  }
}

function buildReadinessSummary(result: SearchConsoleReadinessResult) {
  const lines = ['## Search Console Readiness'];

  for (const surface of result.surfaces) {
    lines.push(
      `- ${surface.kind} ${surface.origin}: ${surface.passed ? 'PASS' : 'FAIL'}`
    );

    if (!surface.passed) {
      for (const issue of surface.issues) {
        lines.push(`  - ${issue}`);
      }
    }
  }
  return `${lines.join('\n')}\n`;
}

async function auditPlatformSurface(
  fetchImpl: typeof fetch,
  origin: string
): Promise<CrawlSurfaceAudit> {
  const normalizedOrigin = new URL(origin).origin;
  const issues: string[] = [];
  const robotsTxt = await fetchTextOrIssue(
    fetchImpl,
    resolveUrl(normalizedOrigin, '/robots.txt'),
    issues,
    'failed to fetch robots.txt'
  );
  const sitemapUrls = robotsTxt ? extractRobotsSitemaps(robotsTxt) : [];
  const platformSitemapUrl = resolveUrl(normalizedOrigin, '/sitemap.xml');

  if (!sitemapUrls.includes(platformSitemapUrl)) {
    issues.push(`robots.txt is missing ${platformSitemapUrl}`);
  }

  const platformSitemapXml = await fetchTextOrIssue(
    fetchImpl,
    platformSitemapUrl,
    issues,
    'failed to fetch root sitemap'
  );
  const platformLocs = platformSitemapXml
    ? extractLocs(platformSitemapXml)
    : [];

  for (const path of PLATFORM_REQUIRED_LOCATIONS) {
    const requiredUrl = resolveUrl(normalizedOrigin, path);
    if (!platformLocs.includes(requiredUrl)) {
      issues.push(`root sitemap is missing ${requiredUrl}`);
    }
  }

  for (const path of PLATFORM_EXCLUDED_LOCATIONS) {
    const excludedUrl = resolveUrl(normalizedOrigin, path);
    if (platformLocs.includes(excludedUrl)) {
      issues.push(`root sitemap should not expose ${excludedUrl}`);
    }
  }

  const homepageHtml = await fetchTextOrIssue(
    fetchImpl,
    resolveUrl(normalizedOrigin, '/'),
    issues,
    'failed to fetch homepage'
  );
  const canonical = homepageHtml ? extractCanonicalHref(homepageHtml) : null;

  if (
    homepageHtml &&
    !urlsMatch(canonical, resolveUrl(normalizedOrigin, '/'))
  ) {
    issues.push(
      `homepage canonical mismatch: expected ${resolveUrl(normalizedOrigin, '/')}`
    );
  }
  return {
    kind: 'platform',
    origin: normalizedOrigin,
    issues,
    passed: issues.length === 0,
    sitemaps: sitemapUrls,
  };
}

async function auditMerchantSurface(
  fetchImpl: typeof fetch,
  origin: string
): Promise<CrawlSurfaceAudit> {
  const normalizedOrigin = new URL(origin).origin;
  const issues: string[] = [];
  const robotsTxt = await fetchTextOrIssue(
    fetchImpl,
    resolveUrl(normalizedOrigin, '/robots.txt'),
    issues,
    'failed to fetch merchant robots.txt'
  );
  const sitemapUrls = robotsTxt ? extractRobotsSitemaps(robotsTxt) : [];

  for (const path of MERCHANT_REQUIRED_SITEMAPS) {
    const requiredUrl = resolveUrl(normalizedOrigin, path);
    if (!sitemapUrls.includes(requiredUrl)) {
      issues.push(`merchant robots.txt is missing ${requiredUrl}`);
    }
  }

  const staticSitemapUrl = resolveUrl(normalizedOrigin, '/sitemap/static.xml');
  const staticSitemapXml = await fetchTextOrIssue(
    fetchImpl,
    staticSitemapUrl,
    issues,
    'failed to fetch merchant static sitemap'
  );
  const staticLocs = staticSitemapXml ? extractLocs(staticSitemapXml) : [];
  const merchantHomeUrl = resolveUrl(normalizedOrigin, '/');

  if (!staticLocs.some((location) => urlsMatch(location, merchantHomeUrl))) {
    issues.push(`merchant static sitemap is missing ${merchantHomeUrl}`);
  }

  const homepageHtml = await fetchTextOrIssue(
    fetchImpl,
    resolveUrl(normalizedOrigin, '/'),
    issues,
    'failed to fetch merchant homepage'
  );
  const canonical = homepageHtml ? extractCanonicalHref(homepageHtml) : null;

  if (
    homepageHtml &&
    !urlsMatch(canonical, resolveUrl(normalizedOrigin, '/'))
  ) {
    issues.push(
      `merchant homepage canonical mismatch: expected ${resolveUrl(normalizedOrigin, '/')}`
    );
  }
  const reachabilitySitemapPaths = MERCHANT_REQUIRED_SITEMAPS.filter(
    (path) => path !== '/sitemap/static.xml'
  );

  const reachabilityResults = await Promise.allSettled(
    reachabilitySitemapPaths.map((path) =>
      fetchText(fetchImpl, resolveUrl(normalizedOrigin, path))
    )
  );

  reachabilityResults.forEach((result, index) => {
    if (result.status === 'rejected') {
      const path = reachabilitySitemapPaths[index];
      const message =
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason);
      issues.push(
        `merchant sitemap ${resolveUrl(normalizedOrigin, path)} is unreachable: ${message}`
      );
    }
  });

  return {
    kind: 'merchant',
    origin: normalizedOrigin,
    issues,
    passed: issues.length === 0,
    sitemaps: sitemapUrls,
  };
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
