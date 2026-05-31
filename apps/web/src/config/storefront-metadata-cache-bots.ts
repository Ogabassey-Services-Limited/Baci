export const STOREFRONT_METADATA_CACHE_BUCKET_HEADER =
  'x-baci-metadata-cache-bucket';

// Production PDP traffic hit Next 16 resume mismatches when Vercel replayed a
// cacheComponents shell with a streamed metadata boundary in the content slot.
// htmlLimitedBots is global, so intentionally block streaming metadata for all
// non-empty user agents until that upstream resume path is safe again.
const STOREFRONT_METADATA_BLOCKING_ALL_USER_AGENTS_PATTERN = '.+';

// Mirrors Next 16.2's DOM bot branch for PPR metadata rendering. Kept as
// documentation for the upstream classifier this module intentionally widens.
const NEXT_DOM_METADATA_BOT_USER_AGENT_PATTERN = 'Googlebot(?!-)|Googlebot$';

// Mirrors Next 16.2's HTML-limited bot list. Keep this in the same module as
// the proxy bucket classifier so future Next upgrades cannot silently desync
// origin metadata rendering from edge-cache partitioning.
const NEXT_HTML_LIMITED_METADATA_BOT_USER_AGENT_PATTERN = String.raw`[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight`;
// The reported customer path was Instagram's in-app browser. Keep this as a
// native Next htmlLimitedBots match instead of mutating user-agent in proxy.ts.
const STOREFRONT_METADATA_BLOCKING_WEBVIEW_USER_AGENT_PATTERN = 'Instagram';

export const STOREFRONT_METADATA_BLOCKING_BOT_USER_AGENT_REGEX = new RegExp(
  `${STOREFRONT_METADATA_BLOCKING_ALL_USER_AGENTS_PATTERN}|${NEXT_DOM_METADATA_BOT_USER_AGENT_PATTERN}|${NEXT_HTML_LIMITED_METADATA_BOT_USER_AGENT_PATTERN}|${STOREFRONT_METADATA_BLOCKING_WEBVIEW_USER_AGENT_PATTERN}`,
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
