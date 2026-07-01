import http from 'node:http';
import https from 'node:https';
import { pathToFileURL } from 'node:url';

export interface VerifierResponse {
  headers: Headers;
  status: number;
  text: () => Promise<string>;
}

export type VerifierFetch = (
  url: string,
  init: { headers: Record<string, string> }
) => Promise<VerifierResponse>;

export interface VerifierConfig {
  hostHeader: string;
  maxCanonicalHtmlBytes: number;
  origin: string;
  pathPrefix: string;
  routes: string[];
  userAgents: Record<string, string>;
}

export interface VerifyRouteResult {
  bytes: number;
  firstByteMs: number;
  metadataBucket: string;
  route: string;
  status: number;
  title: string;
  uaName: string;
  vary: string;
}

interface ExpectedRouteText {
  description: string[];
  title: string[];
}

export const DEFAULT_BLOG_ROUTES = [
  '/blog',
  '/blog/category/smartphones',
  '/blog/category/laptops',
  '/blog/author/bassey-john',
];

export const DEFAULT_USER_AGENTS: Record<string, string> = {
  browser: 'Mozilla/5.0',
  googlebot: 'Googlebot/2.1 (+http://www.google.com/bot.html)',
};

const DEFAULT_MAX_HTML_BYTES = 450_000;

export function parseMaxHtmlBytes(raw: string | undefined): number {
  if (raw === undefined || raw === '') {
    return DEFAULT_MAX_HTML_BYTES;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(
      `OGABASSEY_VERIFY_MAX_HTML_BYTES must be a positive integer, got: ${raw}`
    );
  }
  return parsed;
}

export function buildVerifierConfig(
  env: NodeJS.ProcessEnv = process.env
): VerifierConfig {
  return {
    hostHeader: env.OGABASSEY_VERIFY_HOST || '',
    maxCanonicalHtmlBytes: parseMaxHtmlBytes(env.OGABASSEY_VERIFY_MAX_HTML_BYTES),
    origin: env.OGABASSEY_VERIFY_ORIGIN || 'https://ogabassey.com',
    pathPrefix: env.OGABASSEY_VERIFY_PATH_PREFIX || '',
    routes: DEFAULT_BLOG_ROUTES,
    userAgents: DEFAULT_USER_AGENTS,
  };
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

// Validate the canonical points at the clean route path with no query string,
// so a wrong self-canonical or a `?page=`/`?search=` canonical fails the check
// (not just a missing tag).
export function isCanonicalForRoute(canonicalHref: string, route: string): boolean {
  if (!canonicalHref || canonicalHref.includes('?')) {
    return false;
  }
  let canonicalPath: string;
  try {
    canonicalPath = new URL(canonicalHref).pathname;
  } catch {
    canonicalPath = canonicalHref;
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

export function headerValue(response: VerifierResponse, name: string): string {
  return response.headers.get(name) ?? '';
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

export function fetchVerifierResponseWithNode(
  url: string,
  headers: Record<string, string>
): Promise<VerifierResponse> {
  return new Promise<VerifierResponse>((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    const request = client.request(parsedUrl, { headers }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      response.on('end', () => {
        const html = Buffer.concat(chunks).toString('utf8');
        resolve({
          headers: normalizeResponseHeaders(response.headers),
          status: response.statusCode ?? 0,
          text: async () => html,
        });
      });
    });

    request.on('error', reject);
    request.end();
  });
}

export async function fetchVerifierResponse(
  url: string,
  {
    fetchImpl,
    headers,
  }: { fetchImpl?: VerifierFetch; headers: Record<string, string> }
): Promise<VerifierResponse> {
  if (fetchImpl) {
    return fetchImpl(url, { headers });
  }

  // Node's WHATWG fetch ignores forbidden request headers such as Host.
  // Local custom-domain verification therefore needs the lower-level
  // http/https adapter when OGABASSEY_VERIFY_HOST is set.
  if (headers.Host) {
    return fetchVerifierResponseWithNode(url, headers);
  }

  return fetch(url, { headers });
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

export async function verifyRoute({
  fetchImpl,
  hostHeader,
  maxCanonicalHtmlBytes,
  now = () => performance.now(),
  origin,
  pathPrefix,
  route,
  uaName,
  userAgent,
}: {
  fetchImpl?: VerifierFetch;
  hostHeader: string;
  maxCanonicalHtmlBytes: number;
  now?: () => number;
  origin: string;
  pathPrefix: string;
  route: string;
  uaName: string;
  userAgent: string;
}): Promise<VerifyRouteResult> {
  const url = new URL(routePath(route, pathPrefix), origin).toString();
  const headers: Record<string, string> = { 'user-agent': userAgent };
  if (hostHeader) {
    headers.Host = hostHeader;
  }

  const startedAt = now();
  const response = await fetchVerifierResponse(url, { fetchImpl, headers });
  const firstByteMs = Math.round(now() - startedAt);
  const html = await response.text();
  const title = extractTitle(html);
  const description = extractMetaContent(html, 'description');
  const expectedRouteText = expectedRouteTextForRoute(route);
  const vary = headerValue(response, 'vary');
  const metadataBucket = headerValue(response, 'x-baci-metadata-cache-bucket');

  assert(
    response.status === 200,
    `${uaName} ${route}: expected 200, got ${response.status}`
  );
  assert(
    Boolean(title) && title !== 'Ogabassey',
    `${uaName} ${route}: generic or missing title: ${title}`
  );
  assert(
    containsAllText(title, expectedRouteText.title),
    `${uaName} ${route}: missing route-specific title text: ${title}`
  );
  assert(
    description.length >= 30,
    `${uaName} ${route}: missing route description`
  );
  assert(
    containsAllText(description, expectedRouteText.description),
    `${uaName} ${route}: missing route-specific description text`
  );
  const canonicalHref = extractCanonicalHref(html);
  assert(
    Boolean(canonicalHref),
    `${uaName} ${route}: missing canonical`
  );
  assert(
    isCanonicalForRoute(canonicalHref, route),
    `${uaName} ${route}: canonical must point at the clean ${route} URL with no query, got ${canonicalHref}`
  );
  assert(hasJsonLd(html), `${uaName} ${route}: missing JSON-LD`);
  assert(hasBlogLinks(html), `${uaName} ${route}: missing crawlable blog links`);
  assert(
    !html.includes('NEXT_STATIC_GEN_BAILOUT'),
    `${uaName} ${route}: contains NEXT_STATIC_GEN_BAILOUT`
  );
  assert(
    html.length <= maxCanonicalHtmlBytes,
    `${uaName} ${route}: HTML exceeds ${maxCanonicalHtmlBytes} bytes`
  );

  return {
    bytes: html.length,
    firstByteMs,
    metadataBucket,
    route,
    status: response.status,
    title,
    uaName,
    vary,
  };
}

export async function runVerifier(
  config: VerifierConfig = buildVerifierConfig(),
  {
    fetchImpl,
    logger = console.log,
    now,
  }: {
    fetchImpl?: VerifierFetch;
    logger?: (message: string) => void;
    now?: () => number;
  } = {}
): Promise<VerifyRouteResult[]> {
  const results: VerifyRouteResult[] = [];

  for (const [uaName, userAgent] of Object.entries(config.userAgents)) {
    for (const route of config.routes) {
      const result = await verifyRoute({
        fetchImpl,
        hostHeader: config.hostHeader,
        maxCanonicalHtmlBytes: config.maxCanonicalHtmlBytes,
        now,
        origin: config.origin,
        pathPrefix: config.pathPrefix,
        route,
        uaName,
        userAgent,
      });
      results.push(result);
      logger(JSON.stringify(result));
    }
  }

  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runVerifier();
}
