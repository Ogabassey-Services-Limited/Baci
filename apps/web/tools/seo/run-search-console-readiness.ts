import { pathToFileURL } from 'node:url';
import { appendGitHubStepSummary, parseCsvOrigins, resolveUrl } from './shared';

const PLATFORM_REQUIRED_LOCATIONS = ['/', '/pricing', '/features', '/blog'];
const PLATFORM_EXCLUDED_LOCATIONS = ['/login', '/onboarding'];
const MERCHANT_REQUIRED_SITEMAPS = [
  '/sitemap/static.xml',
  '/sitemap/products.xml',
  '/sitemap/categories.xml',
  '/blog/sitemap.xml',
];

export interface CrawlSurfaceAudit {
  origin: string;
  issues: string[];
  kind: 'platform' | 'merchant';
  passed: boolean;
  sitemaps: string[];
}

export interface SearchConsoleReadinessResult {
  passed: boolean;
  surfaces: CrawlSurfaceAudit[];
}

export function extractRobotsSitemaps(robotsTxt: string): string[] {
  return [...robotsTxt.matchAll(/^\s*Sitemap:\s*(\S+)\s*$/gim)].map(
    (match) => match[1]
  );
}

export function extractLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gim)].map((match) =>
    match[1].trim()
  );
}

export function extractCanonicalHref(html: string): string | null {
  const linkTags = html.match(/<link\b[^>]*>/gi) || [];

  for (const tag of linkTags) {
    const attributes = parseHtmlAttributes(tag);
    const rel = attributes.rel?.toLowerCase();

    if (rel?.split(/\s+/).includes('canonical') && attributes.href) {
      return attributes.href;
    }
  }

  return null;
}

export async function runSearchConsoleReadinessAudit({
  fetchImpl = fetch,
  merchantOrigins,
  platformOrigin,
}: {
  fetchImpl?: typeof fetch;
  merchantOrigins: string[];
  platformOrigin: string;
}): Promise<SearchConsoleReadinessResult> {
  const surfaces = [
    await auditPlatformSurface(fetchImpl, platformOrigin),
    ...(await Promise.all(
      merchantOrigins.map((origin) => auditMerchantSurface(fetchImpl, origin))
    )),
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
  const robotsTxt = await fetchText(
    fetchImpl,
    resolveUrl(normalizedOrigin, '/robots.txt')
  );
  const sitemapUrls = extractRobotsSitemaps(robotsTxt);
  const platformSitemapUrl = resolveUrl(normalizedOrigin, '/sitemap.xml');

  if (!sitemapUrls.includes(platformSitemapUrl)) {
    issues.push(`robots.txt is missing ${platformSitemapUrl}`);
  }

  const platformSitemapXml = await fetchText(fetchImpl, platformSitemapUrl);
  const platformLocs = extractLocs(platformSitemapXml);

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

  const canonical = extractCanonicalHref(
    await fetchText(fetchImpl, resolveUrl(normalizedOrigin, '/'))
  );

  if (!urlsMatch(canonical, resolveUrl(normalizedOrigin, '/'))) {
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
  const robotsTxt = await fetchText(
    fetchImpl,
    resolveUrl(normalizedOrigin, '/robots.txt')
  );
  const sitemapUrls = extractRobotsSitemaps(robotsTxt);

  for (const path of MERCHANT_REQUIRED_SITEMAPS) {
    const requiredUrl = resolveUrl(normalizedOrigin, path);
    if (!sitemapUrls.includes(requiredUrl)) {
      issues.push(`merchant robots.txt is missing ${requiredUrl}`);
    }
  }

  const staticSitemapUrl = resolveUrl(normalizedOrigin, '/sitemap/static.xml');
  const staticSitemapXml = await fetchText(fetchImpl, staticSitemapUrl);
  const staticLocs = extractLocs(staticSitemapXml);
  const merchantHomeUrl = resolveUrl(normalizedOrigin, '/');

  if (!staticLocs.some((location) => urlsMatch(location, merchantHomeUrl))) {
    issues.push(`merchant static sitemap is missing ${merchantHomeUrl}`);
  }

  const canonical = extractCanonicalHref(
    await fetchText(fetchImpl, resolveUrl(normalizedOrigin, '/'))
  );

  if (!urlsMatch(canonical, resolveUrl(normalizedOrigin, '/'))) {
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

async function fetchText(
  fetchImpl: typeof fetch,
  url: string
): Promise<string> {
  const signal = AbortSignal.timeout(10_000);
  let response: Response;

  try {
    response = await fetchImpl(url, { signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new Error(`Request timed out for ${url}`);
    }

    throw error;
  }

  if (!response.ok) {
    throw new Error(`Request failed for ${url} with status ${response.status}`);
  }
  return response.text();
}

function parseHtmlAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};

  for (const match of tag.matchAll(
    /([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g
  )) {
    const [, key, , doubleQuoted, singleQuoted, unquoted] = match;
    attributes[key.toLowerCase()] =
      doubleQuoted ?? singleQuoted ?? unquoted ?? '';
  }

  return attributes;
}

function urlsMatch(left: string | null, right: string): boolean {
  if (!left) {
    return false;
  }

  try {
    const leftUrl = new URL(left, right);
    const rightUrl = new URL(right);
    return (
      leftUrl.origin === rightUrl.origin &&
      normalizeComparablePath(leftUrl.pathname) ===
        normalizeComparablePath(rightUrl.pathname) &&
      leftUrl.search === rightUrl.search
    );
  } catch {
    return false;
  }
}

function normalizeComparablePath(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, '');
  return normalized || '/';
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    await main();
  } catch (error) {
    console.error('run-search-console-readiness:', error);
    process.exitCode = 1;
  }
}
