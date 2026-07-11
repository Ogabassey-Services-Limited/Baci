import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCachedRepairsFeedData,
  getRepairsFeedData,
} from './repairs-feed-data';

type QueryResult = { data: unknown; error: unknown };

const mocks = vi.hoisted(() => ({
  createAnonClient: vi.fn(),
}));

vi.mock('@/lib/supabase/anon', () => ({
  createAnonClient: mocks.createAnonClient,
}));

vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

function makeBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = chain;
  builder.eq = chain;
  builder.in = chain;
  // biome-ignore lint/suspicious/noThenProperty: intentional thenable mocking a Supabase query builder awaited without a terminal method
  builder.then = (
    resolve: (value: QueryResult) => unknown,
    reject?: (reason: unknown) => unknown
  ) => Promise.resolve(result).then(resolve, reject);
  return builder;
}

function makeClient(results: Record<string, QueryResult>) {
  return {
    from: (table: string) =>
      makeBuilder(results[table] ?? { data: [], error: null }),
  };
}

describe('getRepairsFeedData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an empty item list when the merchant has no active devices', async () => {
    mocks.createAnonClient.mockReturnValue(
      makeClient({
        repair_devices: { data: [], error: null },
      })
    );

    const result = await getRepairsFeedData('merchant-1');

    expect(result).toEqual({ items: [] });
  });

  it('throws when the device query errors', async () => {
    const dbError = new Error('boom');
    mocks.createAnonClient.mockReturnValue(
      makeClient({
        repair_devices: { data: null, error: dbError },
      })
    );

    await expect(getRepairsFeedData('merchant-1')).rejects.toThrow(dbError);
  });

  it('maps one feed item per active quote, joined to its device and service type name', async () => {
    mocks.createAnonClient.mockReturnValue(
      makeClient({
        repair_devices: {
          data: [
            {
              id: 'device-1',
              brand: 'Apple',
              model: 'iPhone 13',
              slug: 'apple-iphone-13',
              image_url: 'https://cdn.example.com/iphone-13.jpg',
              product_id: 'product-1',
            },
          ],
          error: null,
        },
        repair_quotes: {
          data: [
            {
              id: 'quote-1',
              device_id: 'device-1',
              service_type_id: 'type-1',
              price: 25000,
              is_from_price: true,
              description: 'OEM screen replacement',
            },
          ],
          error: null,
        },
        repair_service_types: {
          data: [{ id: 'type-1', name: 'Screen Replacement' }],
          error: null,
        },
        product_feed_images: {
          data: [
            {
              product_id: 'product-1',
              verified_url: 'https://cdn.example.com/product-1.jpg',
            },
          ],
          error: null,
        },
      })
    );

    const result = await getRepairsFeedData('merchant-1');

    expect(result.items).toEqual([
      {
        quoteId: 'quote-1',
        price: 25000,
        isFromPrice: true,
        description: 'OEM screen replacement',
        serviceTypeName: 'Screen Replacement',
        deviceId: 'device-1',
        deviceSlug: 'apple-iphone-13',
        deviceBrand: 'Apple',
        deviceModel: 'iPhone 13',
        deviceImageUrl: 'https://cdn.example.com/iphone-13.jpg',
        productId: 'product-1',
        productImageUrl: 'https://cdn.example.com/product-1.jpg',
      },
    ]);
  });

  it('drops quotes whose service type is missing or inactive', async () => {
    mocks.createAnonClient.mockReturnValue(
      makeClient({
        repair_devices: {
          data: [
            {
              id: 'device-1',
              brand: 'Apple',
              model: 'iPhone 13',
              slug: 'apple-iphone-13',
              image_url: null,
              product_id: null,
            },
          ],
          error: null,
        },
        repair_quotes: {
          data: [
            {
              id: 'quote-1',
              device_id: 'device-1',
              service_type_id: 'inactive-type',
              price: 10000,
              is_from_price: false,
              description: null,
            },
          ],
          error: null,
        },
        repair_service_types: { data: [], error: null },
      })
    );

    const result = await getRepairsFeedData('merchant-1');

    expect(result.items).toEqual([]);
  });

  it('leaves productImageUrl null when the device has no linked product', async () => {
    mocks.createAnonClient.mockReturnValue(
      makeClient({
        repair_devices: {
          data: [
            {
              id: 'device-1',
              brand: 'Tecno',
              model: 'Camon 20',
              slug: 'tecno-camon-20',
              image_url: 'https://cdn.example.com/camon.jpg',
              product_id: null,
            },
          ],
          error: null,
        },
        repair_quotes: {
          data: [
            {
              id: 'quote-1',
              device_id: 'device-1',
              service_type_id: 'type-1',
              price: 8000,
              is_from_price: true,
              description: null,
            },
          ],
          error: null,
        },
        repair_service_types: {
          data: [{ id: 'type-1', name: 'Battery Replacement' }],
          error: null,
        },
      })
    );

    const result = await getRepairsFeedData('merchant-1');

    expect(result.items).toEqual([
      expect.objectContaining({
        productId: null,
        productImageUrl: null,
        deviceImageUrl: 'https://cdn.example.com/camon.jpg',
      }),
    ]);
  });
});

describe('getCachedRepairsFeedData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates to getRepairsFeedData and returns its result', async () => {
    mocks.createAnonClient.mockReturnValue(
      makeClient({
        repair_devices: { data: [], error: null },
      })
    );

    const result = await getCachedRepairsFeedData('merchant-1');

    expect(result).toEqual({ items: [] });
  });
});
