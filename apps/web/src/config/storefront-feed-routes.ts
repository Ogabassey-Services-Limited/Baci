/**
 * Public storefront machine-feed paths.
 *
 * - openaiProductFeed: legacy OpenAI-compatible JSONL catalog feed.
 * - agentProducts: current structured JSONL feed for agent product readers.
 * - googleMerchantXml: Google Merchant Center-compatible XML feed.
 */
export const STOREFRONT_FEED_ROUTES = {
  openaiProductFeed: '/feeds/openai.jsonl',
  agentProducts: '/feeds/agent-products.jsonl',
  googleMerchantXml: '/feeds/google-merchant.xml',
} as const;
