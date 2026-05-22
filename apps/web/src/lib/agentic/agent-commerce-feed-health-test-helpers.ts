import type { GoogleMerchantFeedData } from '@/app/api/feed/google-merchant/feed-data';
import type { OpenAIFeedData } from '@/app/api/feed/openai/feed-data';

export const AGENT_COMMERCE_FEED_HEALTH_TEST_NOW = new Date(
  '2026-05-22T12:00:00.000Z'
);

export function openAiFeed(productIds: string[]): OpenAIFeedData {
  return {
    products: productIds.map((id) => ({
      description: `${id} description`,
      id,
      name: id,
      price: 1000,
      stock: 5,
      updated_at: '2026-05-22T10:00:00.000Z',
    })),
  };
}

export function googleFeed(productIds: string[]): GoogleMerchantFeedData {
  return {
    custom_domain: 'ogabassey.com',
    imageManifest: {},
    products: productIds.map((id) => ({
      description: `${id} description`,
      id,
      name: id,
      price: 1000,
      stock: 5,
      updated_at: '2026-05-22T10:00:00.000Z',
    })),
    slug: 'ogabassey',
  };
}
