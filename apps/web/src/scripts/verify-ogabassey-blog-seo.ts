import http from 'node:http';
import https from 'node:https';
import { pathToFileURL } from 'node:url';
import {
  containsAllText,
  expectedRouteTextForRoute,
  extractCanonicalHref,
  extractMetaContent,
  extractTitle,
  hasBlogLinks,
  hasJsonLd,
  isCanonicalForRoute,
  normalizeResponseHeaders,
  routePath,
} from './verify-ogabassey-blog-seo-html';

export * from './verify-ogabassey-blog-seo-html';

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
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;

export function parseMaxHtmlBytes(raw: string | undefined): number {
  if (raw === undefined || raw === '') {
    return DEFAULT_MAX_HTML_BYTES;
  }
  // Strict: reject partial parses like "120000px" or decimals like "1.5" that
  // Number.parseInt would otherwise coerce to a truthy integer.
  const trimmed = raw.trim();
  const parsed = Number.parseInt(trimmed, 10);
  if (!/^\d+$/.test(trimmed) || parsed <= 0) {
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

export function headerValue(response: VerifierResponse, name: string): string {
  return response.headers.get(name) ?? '';
}

export function fetchVerifierResponseWithNode(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS
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

    // Bound the request so `verify:blog-seo` can never hang indefinitely.
    request.setTimeout(timeoutMs, () => {
      request.destroy(
        new Error(`request to ${url} timed out after ${timeoutMs}ms`)
      );
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
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  }: {
    fetchImpl?: VerifierFetch;
    headers: Record<string, string>;
    timeoutMs?: number;
  }
): Promise<VerifierResponse> {
  if (fetchImpl) {
    return fetchImpl(url, { headers });
  }

  // Node's WHATWG fetch ignores forbidden request headers such as Host.
  // Local custom-domain verification therefore needs the lower-level
  // http/https adapter when OGABASSEY_VERIFY_HOST is set.
  if (headers.Host) {
    return fetchVerifierResponseWithNode(url, headers, timeoutMs);
  }

  return fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
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

  const expectedCanonicalHost = hostHeader || new URL(origin).host;

  const startedAt = now();
  const response = await fetchVerifierResponse(url, { fetchImpl, headers });
  const firstByteMs = Math.round(now() - startedAt);
  const html = await response.text();
  // Measure the real UTF-8 payload, not UTF-16 code units (html.length).
  const htmlByteLength = Buffer.byteLength(html, 'utf8');
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
    isCanonicalForRoute(canonicalHref, route, expectedCanonicalHost),
    `${uaName} ${route}: canonical must point at the clean ${route} URL on ${expectedCanonicalHost} with no query, got ${canonicalHref}`
  );
  assert(hasJsonLd(html), `${uaName} ${route}: missing JSON-LD`);
  assert(hasBlogLinks(html), `${uaName} ${route}: missing crawlable blog links`);
  assert(
    !html.includes('NEXT_STATIC_GEN_BAILOUT'),
    `${uaName} ${route}: contains NEXT_STATIC_GEN_BAILOUT`
  );
  assert(
    htmlByteLength <= maxCanonicalHtmlBytes,
    `${uaName} ${route}: HTML exceeds ${maxCanonicalHtmlBytes} bytes (${htmlByteLength})`
  );

  return {
    bytes: htmlByteLength,
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
