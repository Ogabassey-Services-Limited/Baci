// Pure HTML/text parsing helpers for the OgaBassey blog SEO verifier. These are
// I/O-free so they can be unit-tested in isolation from the transport/CLI.

export interface ExpectedRouteText {
  description: string[];
  title: string[];
}

export function routePath(route: string, pathPrefix = ''): string {
  if (!pathPrefix) {
    return route;
  }
  return `${pathPrefix.replace(/\/$/, '')}${route}`;
}

export function extractTitle(html: string): string {
  return html.match(/<title>(.*?)<\/title>/is)?.[1]?.trim() ?? '';
}

export function extractMetaContent(html: string, name: string): string {
  const tagPattern = /<meta\b[^>]*>/gi;
  for (const [tag] of html.matchAll(tagPattern)) {
    const nameMatch = tag.match(/\bname=["']([^"']+)["']/i);
    if (nameMatch?.[1]?.toLowerCase() !== name.toLowerCase()) {
      continue;
    }
    return tag.match(/\bcontent=["']([^"']*)["']/i)?.[1]?.trim() ?? '';
  }
  return '';
}

export function hasDescription(html: string): boolean {
  return extractMetaContent(html, 'description').length >= 30;
}

export function extractCanonicalHref(html: string): string {
  const tag = html.match(/<link[^>]+rel=["']canonical["'][^>]*>/i)?.[0];
  if (!tag) {
    return '';
  }
  return tag.match(/\bhref=["']([^"']*)["']/i)?.[1]?.trim() ?? '';
}

// Validate the canonical points at the clean route path (and, when known, the
// expected host) with no query string, so a wrong self-canonical, a cross-host
// canonical, or a `?page=`/`?search=` canonical fails the check — not just a
// missing tag.
export function isCanonicalForRoute(
  canonicalHref: string,
  route: string,
  expectedHost?: string
): boolean {
  if (!canonicalHref || canonicalHref.includes('?')) {
    return false;
  }
  let canonicalPath = canonicalHref;
  let canonicalHost = '';
  try {
    const parsed = new URL(canonicalHref);
    canonicalPath = parsed.pathname;
    canonicalHost = parsed.host;
  } catch {
    // Relative href — no host to validate; fall through to the path check.
  }
  if (expectedHost && canonicalHost !== expectedHost) {
    return false;
  }
  return canonicalPath.replace(/\/$/, '') === route.replace(/\/$/, '');
}

export function hasJsonLd(html: string): boolean {
  return /<script[^>]+type=["']application\/ld\+json["'][^>]*>/i.test(html);
}

export function hasBlogLinks(html: string): boolean {
  return /href=["'][^"']*\/blog\//i.test(html);
}

export function titleCaseRouteSegment(segment: string): string {
  return segment
    .split('-')
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

export function expectedRouteTextForRoute(route: string): ExpectedRouteText {
  const normalizedRoute = route.replace(/\/$/, '');
  if (normalizedRoute.startsWith('/blog/category/')) {
    const categoryLabel = titleCaseRouteSegment(
      normalizedRoute.split('/').at(-1) ?? ''
    );
    return { description: [categoryLabel], title: [categoryLabel] };
  }
  if (normalizedRoute.startsWith('/blog/author/')) {
    const authorName = titleCaseRouteSegment(
      normalizedRoute.split('/').at(-1) ?? ''
    );
    return { description: [authorName], title: [authorName] };
  }
  return { description: ['Ogabassey'], title: ['Blog'] };
}

export function containsAllText(value: string, needles: string[]): boolean {
  const normalizedValue = value.toLowerCase();
  return needles.every((needle) =>
    normalizedValue.includes(needle.toLowerCase())
  );
}

export function normalizeResponseHeaders(
  rawHeaders: NodeJS.Dict<string | string[]>
): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(rawHeaders)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(name, item);
      }
    } else if (value !== undefined) {
      headers.set(name, String(value));
    }
  }
  return headers;
}
