import type { CrawlSurfaceAudit } from './run-search-console-readiness.types';

function extractRobotsSitemaps(robotsTxt: string): string[] {
  return [...robotsTxt.matchAll(/^\s*Sitemap:\s*(\S+)\s*$/gim)].map(
    (match) => match[1]
  );
}

function extractLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gim)].map((match) =>
    decodeHtmlEntities(match[1]).trim()
  );
}

function extractCanonicalHref(html: string): string | null {
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

function buildSurfaceFailure(
  kind: CrawlSurfaceAudit['kind'],
  origin: string,
  issue: string
): CrawlSurfaceAudit {
  return { kind, origin, issues: [issue], passed: false, sitemaps: [] };
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

async function fetchTextOrIssue(
  fetchImpl: typeof fetch,
  url: string,
  issues: string[],
  label: string
): Promise<string | null> {
  try {
    return await fetchText(fetchImpl, url);
  } catch (error) {
    issues.push(`${label}: ${url} — ${toErrorMessage(error)}`);
    return null;
  }
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
      normalizeSearch(leftUrl.search) === normalizeSearch(rightUrl.search)
    );
  } catch {
    return false;
  }
}

function matchesAnyUrl(locations: string[], expected: string): boolean {
  return locations.some((location) => urlsMatch(location, expected));
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseHtmlAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};

  for (const match of tag.matchAll(
    /([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g
  )) {
    const [, key, , doubleQuoted, singleQuoted, unquoted] = match;
    attributes[key.toLowerCase()] = decodeHtmlEntities(
      doubleQuoted ?? singleQuoted ?? unquoted ?? ''
    );
  }

  return attributes;
}

function decodeHtmlEntities(value: string): string {
  return value.replace(
    /&(#[0-9]+|#x[0-9a-f]+|amp|lt|gt|quot|apos);/gi,
    (match, entity: string) => {
      switch (entity.toLowerCase()) {
        case 'amp':
          return '&';
        case 'lt':
          return '<';
        case 'gt':
          return '>';
        case 'quot':
          return '"';
        case 'apos':
          return "'";
        default:
          if (entity.startsWith('#x') || entity.startsWith('#X')) {
            const codePoint = Number.parseInt(entity.slice(2), 16);
            return !isValidCodePoint(codePoint)
              ? match
              : String.fromCodePoint(codePoint);
          }
          if (entity.startsWith('#')) {
            const codePoint = Number.parseInt(entity.slice(1), 10);
            return !isValidCodePoint(codePoint)
              ? match
              : String.fromCodePoint(codePoint);
          }
          return match;
      }
    }
  );
}

function isValidCodePoint(codePoint: number): boolean {
  return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff;
}

function normalizeComparablePath(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, '');
  return normalized || '/';
}

function normalizeSearch(search: string): string {
  const normalizedEntries = [...new URLSearchParams(search).entries()].sort(
    ([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey === rightKey
        ? leftValue.localeCompare(rightValue)
        : leftKey.localeCompare(rightKey)
  );
  const normalized = new URLSearchParams(normalizedEntries).toString();
  return normalized ? `?${normalized}` : '';
}

export const searchConsoleReadinessShared = {
  buildSurfaceFailure,
  extractCanonicalHref,
  extractLocs,
  extractRobotsSitemaps,
  fetchText,
  fetchTextOrIssue,
  matchesAnyUrl,
  toErrorMessage,
  urlsMatch,
} as const;
