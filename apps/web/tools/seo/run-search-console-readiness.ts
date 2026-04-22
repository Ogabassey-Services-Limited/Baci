import {
  MERCHANT_REQUIRED_SITEMAPS,
  PLATFORM_EXCLUDED_LOCATIONS,
  PLATFORM_REQUIRED_LOCATIONS,
} from './run-search-console-readiness.config';
import { searchConsoleReadinessShared } from './run-search-console-readiness.shared';
import type {
  CrawlSurfaceAudit,
  SearchConsoleReadinessResult,
} from './run-search-console-readiness.types';
import { seoShared } from './shared';

async function runSearchConsoleReadinessAudit({
  fetchImpl = fetch,
  merchantOrigins,
  platformOrigin,
}: {
  fetchImpl?: typeof fetch;
  merchantOrigins: string[];
  platformOrigin: string;
}): Promise<SearchConsoleReadinessResult> {
  const settledSurfaces = await Promise.allSettled([
    auditPlatformSurface(fetchImpl, platformOrigin),
    ...merchantOrigins.map((origin) => auditMerchantSurface(fetchImpl, origin)),
  ]);
  const [platformSurface, ...merchantSurfaces] = settledSurfaces;
  const surfaces = [
    platformSurface?.status === 'fulfilled'
      ? platformSurface.value
      : searchConsoleReadinessShared.buildSurfaceFailure(
          'platform',
          platformOrigin ?? 'unknown',
          `failed to audit platform surface: ${searchConsoleReadinessShared.toErrorMessage(platformSurface?.reason)}`
        ),
    ...merchantSurfaces.map((surface, index) =>
      surface.status === 'fulfilled'
        ? surface.value
        : searchConsoleReadinessShared.buildSurfaceFailure(
            'merchant',
            merchantOrigins[index] ?? 'unknown',
            `failed to audit merchant surface: ${searchConsoleReadinessShared.toErrorMessage(surface.reason)}`
          )
    ),
  ];
  return { passed: surfaces.every((surface) => surface.passed), surfaces };
}

async function runConfiguredSearchConsoleReadinessAudit({
  fetchImpl = fetch,
  merchantOriginsEnv,
  platformOrigin,
}: {
  fetchImpl?: typeof fetch;
  merchantOriginsEnv?: string;
  platformOrigin: string;
}): Promise<SearchConsoleReadinessResult> {
  const { invalidOrigins, validOrigins } =
    seoShared.partitionCsvOrigins(merchantOriginsEnv);
  const auditResult = await runSearchConsoleReadinessAudit({
    fetchImpl,
    merchantOrigins: validOrigins,
    platformOrigin,
  });

  if (invalidOrigins.length === 0) {
    return auditResult;
  }

  const surfaces = [
    ...auditResult.surfaces,
    ...invalidOrigins.map((origin) =>
      searchConsoleReadinessShared.buildSurfaceFailure(
        'merchant',
        origin,
        `invalid merchant origin in SEO_MERCHANT_ORIGINS: ${origin}`
      )
    ),
  ];

  return {
    passed: surfaces.every((surface) => surface.passed),
    surfaces,
  };
}

function buildReadinessSummary(result: SearchConsoleReadinessResult): string {
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

async function collectSurfaceBasics({
  fetchImpl,
  origin,
  sitemapPath,
  robotsFailureLabel,
  sitemapFailureLabel,
  homepageFailureLabel,
}: {
  fetchImpl: typeof fetch;
  origin: string;
  sitemapPath: string;
  robotsFailureLabel: string;
  sitemapFailureLabel: string;
  homepageFailureLabel: string;
}) {
  const normalizedOrigin = new URL(origin).origin;
  const issues: string[] = [];
  const robotsTxt = await searchConsoleReadinessShared.fetchTextOrIssue(
    fetchImpl,
    seoShared.resolveUrl(normalizedOrigin, '/robots.txt'),
    issues,
    robotsFailureLabel
  );
  const sitemapUrls = robotsTxt
    ? searchConsoleReadinessShared.extractRobotsSitemaps(robotsTxt)
    : [];
  const sitemapXml = await searchConsoleReadinessShared.fetchTextOrIssue(
    fetchImpl,
    seoShared.resolveUrl(normalizedOrigin, sitemapPath),
    issues,
    sitemapFailureLabel
  );
  const sitemapLocs = sitemapXml
    ? searchConsoleReadinessShared.extractLocs(sitemapXml)
    : [];
  const homepageHtml = await searchConsoleReadinessShared.fetchTextOrIssue(
    fetchImpl,
    seoShared.resolveUrl(normalizedOrigin, '/'),
    issues,
    homepageFailureLabel
  );

  return {
    canonical: homepageHtml
      ? searchConsoleReadinessShared.extractCanonicalHref(homepageHtml)
      : null,
    homepageFetched: Boolean(homepageHtml),
    homepageUrl: seoShared.resolveUrl(normalizedOrigin, '/'),
    issues,
    normalizedOrigin,
    sitemapLocs,
    sitemapUrls,
  };
}

async function auditPlatformSurface(
  fetchImpl: typeof fetch,
  origin: string
): Promise<CrawlSurfaceAudit> {
  const {
    canonical,
    homepageFetched,
    homepageUrl,
    issues,
    normalizedOrigin,
    sitemapLocs: platformLocs,
    sitemapUrls,
  } = await collectSurfaceBasics({
    fetchImpl,
    homepageFailureLabel: 'failed to fetch homepage',
    origin,
    robotsFailureLabel: 'failed to fetch robots.txt',
    sitemapFailureLabel: 'failed to fetch root sitemap',
    sitemapPath: '/sitemap.xml',
  });
  const platformSitemapUrl = seoShared.resolveUrl(
    normalizedOrigin,
    '/sitemap.xml'
  );

  if (!sitemapUrls.includes(platformSitemapUrl)) {
    issues.push(`robots.txt is missing ${platformSitemapUrl}`);
  }

  for (const path of PLATFORM_REQUIRED_LOCATIONS) {
    const requiredUrl = seoShared.resolveUrl(normalizedOrigin, path);
    if (!platformLocs.includes(requiredUrl)) {
      issues.push(`root sitemap is missing ${requiredUrl}`);
    }
  }

  for (const path of PLATFORM_EXCLUDED_LOCATIONS) {
    const excludedUrl = seoShared.resolveUrl(normalizedOrigin, path);
    if (platformLocs.includes(excludedUrl)) {
      issues.push(`root sitemap should not expose ${excludedUrl}`);
    }
  }

  if (
    homepageFetched &&
    !searchConsoleReadinessShared.urlsMatch(canonical, homepageUrl)
  ) {
    issues.push(`homepage canonical mismatch: expected ${homepageUrl}`);
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
  const {
    canonical,
    homepageFetched,
    homepageUrl: merchantHomeUrl,
    issues,
    normalizedOrigin,
    sitemapLocs: staticLocs,
    sitemapUrls,
  } = await collectSurfaceBasics({
    fetchImpl,
    homepageFailureLabel: 'failed to fetch merchant homepage',
    origin,
    robotsFailureLabel: 'failed to fetch merchant robots.txt',
    sitemapFailureLabel: 'failed to fetch merchant static sitemap',
    sitemapPath: '/sitemap/static.xml',
  });

  for (const path of MERCHANT_REQUIRED_SITEMAPS) {
    const requiredUrl = seoShared.resolveUrl(normalizedOrigin, path);
    if (!sitemapUrls.includes(requiredUrl)) {
      issues.push(`merchant robots.txt is missing ${requiredUrl}`);
    }
  }

  if (
    !staticLocs.some((location) =>
      searchConsoleReadinessShared.urlsMatch(location, merchantHomeUrl)
    )
  ) {
    issues.push(`merchant static sitemap is missing ${merchantHomeUrl}`);
  }

  if (
    homepageFetched &&
    !searchConsoleReadinessShared.urlsMatch(canonical, merchantHomeUrl)
  ) {
    issues.push(
      `merchant homepage canonical mismatch: expected ${merchantHomeUrl}`
    );
  }
  const reachabilitySitemapPaths = MERCHANT_REQUIRED_SITEMAPS.filter(
    (path) => path !== '/sitemap/static.xml'
  );

  const reachabilityResults = await Promise.allSettled(
    reachabilitySitemapPaths.map((path) =>
      searchConsoleReadinessShared.fetchText(
        fetchImpl,
        seoShared.resolveUrl(normalizedOrigin, path)
      )
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
        `merchant sitemap ${seoShared.resolveUrl(normalizedOrigin, path)} is unreachable: ${message}`
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

export const searchConsoleReadiness = {
  buildReadinessSummary,
  runConfiguredSearchConsoleReadinessAudit,
  runSearchConsoleReadinessAudit,
} as const;
