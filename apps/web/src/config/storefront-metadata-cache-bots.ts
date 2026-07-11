export const STOREFRONT_METADATA_CACHE_BUCKET_HEADER =
  'x-baci-metadata-cache-bucket';
export const STOREFRONT_METADATA_CACHE_BUCKET_QUERY_PARAM =
  '__baci_metadata_cache_bucket';

// Lookaround-free superset of Next 16.2's DOM Googlebot branch for PPR
// metadata rendering. Vercel serializes `htmlLimitedBots` into header-based
// PPR cache bypass rules that live traffic shows are evaluated from the start
// of the user-agent string. Real Googlebot crawls use a Mozilla-compatible UA
// with `Googlebot/2.1` in the middle, so keep the leading wildcard to bypass
// the static shell cache for the actual production crawler string.
export const NEXT_DOM_METADATA_BOT_USER_AGENT_PATTERN = '.*Googlebot';

// Mirrors Next 16.2's HTML-limited bot list. Keep this in the same module as
// the proxy bucket classifier so future Next upgrades cannot silently desync
// origin metadata rendering from edge-cache partitioning.
const NEXT_HTML_LIMITED_METADATA_BOT_USER_AGENT_PATTERN = String.raw`[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight`;

// AI answer engines usually fetch raw HTML and do not execute the Flight stream.
// Keep them in the blocking metadata bucket so PDP title/canonical/robots tags
// are emitted as parseable head HTML instead of only streamed client metadata.
const AI_HTML_LIMITED_METADATA_BOT_USER_AGENT_PATTERN = [
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  'OAI-AdsBot',
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'PerplexityBot',
  'Perplexity-User',
  'Meta-ExternalAgent',
  'Meta-ExternalFetcher',
  'Bytespider',
  'CCBot',
].join('|');

// SEO audit crawlers parse raw HTML head tags without executing the Flight
// stream (Semrush Site Audit defaults to a mobile SiteAuditBot and can also
// audit as SemrushBot). Keep them all in the blocking bucket so site audits
// (Semrush, Ahrefs, Moz, Screaming Frog) report the real per-page metadata
// instead of the streamed shell fallback title.
const SEO_AUDIT_HTML_LIMITED_METADATA_BOT_USER_AGENT_PATTERN = [
  'SiteAuditBot',
  'SemrushBot',
  'AhrefsBot',
  'AhrefsSiteAudit',
  'Screaming Frog SEO Spider',
  'rogerbot',
  'DotBot',
].join('|');

export const STOREFRONT_METADATA_BLOCKING_BOT_USER_AGENT_REGEX = new RegExp(
  `${NEXT_DOM_METADATA_BOT_USER_AGENT_PATTERN}|${NEXT_HTML_LIMITED_METADATA_BOT_USER_AGENT_PATTERN}|${AI_HTML_LIMITED_METADATA_BOT_USER_AGENT_PATTERN}|${SEO_AUDIT_HTML_LIMITED_METADATA_BOT_USER_AGENT_PATTERN}`,
  'i'
);

// IMPORTANT: `htmlLimitedBots` only controls whether Next streams or blocks
// <head> metadata (`shouldServeStreamingMetadata`). The PPR postpone-vs-
// blocking-render decision uses Next's HARDCODED `getBotType()` lists
// (dist shared/lib/router/utils/is-bot.js + html-bots.js) and cannot be
// extended by config in Next 16.2.9. A UA that matches our blocking regex but
// NOT Next's built-in lists is routed past the static shell by Vercel's
// serialized bypass rule, then rendered as a HUMAN by the origin — in minimal
// mode that returns the raw `application/x-nextjs-pre-render` postponed state
// to the crawler instead of HTML (Semrush audit 2026-07-07: 4,404 compare
// pages "couldn't be crawled"). The two mirrors below let the proxy detect
// that gap and annotate the forwarded UA so `getBotType()` classifies these
// bots as HTML-limited and performs a full blocking render.
const NEXT_BUILTIN_DOM_BOT_USER_AGENT_REGEX = /Googlebot(?!-)|Googlebot$/i;
const NEXT_BUILTIN_HTML_LIMITED_BOT_USER_AGENT_REGEX =
  /[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight/i;

// 'googleweblight' is in Next's built-in HTML-limited list AND in our blocking
// regex, and the product it identified is retired — appending it cannot match
// a real crawler and reads as clearly synthetic in logs.
export const STOREFRONT_BLOCKING_BOT_USER_AGENT_ANNOTATION = ' googleweblight';

export function isNextRuntimeRecognizedBotUserAgent(
  userAgent: string
): boolean {
  return (
    NEXT_BUILTIN_DOM_BOT_USER_AGENT_REGEX.test(userAgent) ||
    NEXT_BUILTIN_HTML_LIMITED_BOT_USER_AGENT_REGEX.test(userAgent)
  );
}

/**
 * Returns the forwarded user-agent for a storefront request: bots we force
 * into the metadata-blocking bucket that Next's runtime would NOT classify as
 * bots get a synthetic HTML-limited marker appended, so the origin performs a
 * full blocking render (real HTML) instead of emitting a postponed PPR
 * pre-render that nothing resumes. All other user-agents pass through as-is.
 */
export function getStorefrontForwardedBotUserAgent(userAgent: string): string {
  if (
    STOREFRONT_METADATA_BLOCKING_BOT_USER_AGENT_REGEX.test(userAgent) &&
    !isNextRuntimeRecognizedBotUserAgent(userAgent)
  ) {
    return `${userAgent}${STOREFRONT_BLOCKING_BOT_USER_AGENT_ANNOTATION}`;
  }

  return userAgent;
}

export type StorefrontMetadataCacheBucket = 'metadata-blocking' | 'streaming';

export function getStorefrontMetadataCacheBucket(
  userAgent: string
): StorefrontMetadataCacheBucket {
  return STOREFRONT_METADATA_BLOCKING_BOT_USER_AGENT_REGEX.test(userAgent)
    ? 'metadata-blocking'
    : 'streaming';
}
