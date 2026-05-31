export const STOREFRONT_METADATA_CACHE_BUCKET_HEADER =
  'x-baci-metadata-cache-bucket';
export const STOREFRONT_METADATA_BLOCKING_USER_AGENT_TOKEN =
  'BaciMetadataBlocking';

// Mirrors Next 16.2's DOM bot branch for PPR metadata rendering. On
// cacheComponents routes, Next disables streaming metadata for these bots.
const NEXT_DOM_METADATA_BOT_USER_AGENT_PATTERN = 'Googlebot(?!-)|Googlebot$';

// Mirrors Next 16.2's HTML-limited bot list. Keep this in the same module as
// the proxy bucket classifier so future Next upgrades cannot silently desync
// origin metadata rendering from edge-cache partitioning.
const NEXT_HTML_LIMITED_METADATA_BOT_USER_AGENT_PATTERN = String.raw`[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight`;

export const STOREFRONT_METADATA_BLOCKING_BOT_USER_AGENT_REGEX = new RegExp(
  `${STOREFRONT_METADATA_BLOCKING_USER_AGENT_TOKEN}|${NEXT_DOM_METADATA_BOT_USER_AGENT_PATTERN}|${NEXT_HTML_LIMITED_METADATA_BOT_USER_AGENT_PATTERN}`,
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
