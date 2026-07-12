/**
 * Public storefront machine-feed paths.
 *
 * - openaiProductFeed: legacy OpenAI-compatible JSONL catalog feed.
 * - agentProducts: current structured JSONL feed for agent product readers.
 * - googleMerchantXml: Google Merchant Center-compatible XML feed.
 * - facebookCatalogXml: Meta Facebook/Instagram catalog XML feed.
 * - facebookRepairsXml: Meta Facebook/Instagram repair-services catalog feed
 *   (one item per repair quote — services, not products).
 * - agentRepairs: structured JSONL feed of repair services for agent readers.
 */
export const STOREFRONT_FEED_ROUTES = {
  openaiProductFeed: '/feeds/openai.jsonl',
  agentProducts: '/feeds/agent-products.jsonl',
  googleMerchantXml: '/feeds/google-merchant.xml',
  facebookCatalogXml: '/feeds/facebook.xml',
  facebookRepairsXml: '/feeds/facebook-repairs.xml',
  agentRepairs: '/feeds/agent-repairs.jsonl',
} as const;
