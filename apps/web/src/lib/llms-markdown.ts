const CACHE_CONTROL = 'public, max-age=3600, s-maxage=3600';

function createMarkdownResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': CACHE_CONTROL,
      'X-Robots-Tag': 'noarchive',
    },
  });
}

export function markdownResponse(body: string): Response {
  return createMarkdownResponse(body);
}

export function notFoundMarkdownResponse(message: string): Response {
  return new Response(message, {
    status: 404,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=60',
      'X-Robots-Tag': 'noindex, noarchive',
    },
  });
}

/**
 * Transient-unavailability response for markdown endpoints (PR4b review r5).
 *
 * A read that cannot produce the COMPLETE payload must never be reported as a
 * 404: telling a crawler or LLM ingester that a valid category does not exist
 * deindexes it on a transient database blip. 503 is the retryable signal, and
 * it is explicitly `no-store` so neither the CDN nor a client caches the
 * failure.
 *
 * Deliberately carries NO `noindex` (PR4b review r6). A crawler or LLM ingester
 * that honours `X-Robots-Tag: noindex` would DROP the URL during the very
 * outage this response exists to ride out — which defeats the whole point of a
 * retryable 503. `noindex` belongs only on genuinely degraded 200s (see the
 * category route's `robots` handling), never on a 5xx that means "come back
 * later". `noarchive` is kept: it suppresses cached-copy display without
 * removing the URL from the index.
 */
export function unavailableMarkdownResponse(message: string): Response {
  return new Response(message, {
    status: 503,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'no-store',
      'Retry-After': '60',
      'X-Robots-Tag': 'noarchive',
    },
  });
}

export {
  buildBlogIndexMarkdown,
  buildBlogPostMarkdown,
} from '@/lib/llms-markdown-blog';
export {
  buildPlatformFeaturesMarkdown,
  buildPlatformHomeMarkdown,
  buildPlatformOnboardingMarkdown,
  buildPlatformPricingMarkdown,
} from '@/lib/llms-markdown-platform';
export {
  buildCategoryMarkdown,
  buildProductMarkdown,
  buildStorefrontAboutMarkdown,
  buildStorefrontContactMarkdown,
  buildStorefrontFaqMarkdown,
  buildStorefrontHomeMarkdown,
} from '@/lib/llms-markdown-storefront';
