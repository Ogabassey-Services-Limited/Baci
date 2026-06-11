export const STOREFRONT_METADATA_CACHE_BUCKET_HEADER =
  'x-baci-metadata-cache-bucket';
export const STOREFRONT_METADATA_CACHE_BUCKET_QUERY_PARAM =
  '__baci_metadata_cache_bucket';

// Mirrors Next 16.2's DOM bot branch for PPR metadata rendering.
const NEXT_DOM_METADATA_BOT_USER_AGENT_PATTERN = 'Googlebot(?!-)|Googlebot$';

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

export const STOREFRONT_METADATA_BLOCKING_BOT_USER_AGENT_REGEX = new RegExp(
  `${NEXT_DOM_METADATA_BOT_USER_AGENT_PATTERN}|${NEXT_HTML_LIMITED_METADATA_BOT_USER_AGENT_PATTERN}|${AI_HTML_LIMITED_METADATA_BOT_USER_AGENT_PATTERN}`,
  'i'
);

export type StorefrontMetadataCacheBucket = 'metadata-blocking' | 'streaming';

export function getStorefrontMetadataCacheBucket(
  userAgent: string
): StorefrontMetadataCacheBucket {
  return STOREFRONT_METADATA_BLOCKING_BOT_USER_AGENT_REGEX.test(userAgent)
    ? 'metadata-blocking'
    : 'streaming';
}
