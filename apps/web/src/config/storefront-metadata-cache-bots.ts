export const STOREFRONT_METADATA_CACHE_BUCKET_HEADER =
  'x-baci-metadata-cache-bucket';
export const STOREFRONT_METADATA_CACHE_BUCKET_QUERY_PARAM =
  '__baci_metadata_cache_bucket';

// Mirrors Next 16.2's HTML-limited bot list. Keep this in the same module as
// the proxy bucket classifier so future Next upgrades cannot silently desync
// origin metadata rendering from edge-cache partitioning.
//
// Do not include the main Googlebot crawler here. Next classifies the main
// Googlebot as a DOM bot that can execute JavaScript, while htmlLimitedBots is
// specifically for crawlers that need blocking metadata in the initial HTML.
// Treating Googlebot as HTML-limited creates a second metadata render mode for
// Google Search and can replay cached storefront shells against Next's internal
// metadata boundary.
const NEXT_HTML_LIMITED_METADATA_BOT_USER_AGENT_PATTERN = String.raw`[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight`;

export const STOREFRONT_METADATA_BLOCKING_BOT_USER_AGENT_REGEX = new RegExp(
  NEXT_HTML_LIMITED_METADATA_BOT_USER_AGENT_PATTERN,
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
