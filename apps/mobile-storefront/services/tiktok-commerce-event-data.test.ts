import { buildTikTokCommerceEventParams } from './tiktok-commerce-event-data';

describe('buildTikTokCommerceEventParams', () => {
  it('builds TikTok content parameters for a product event', () => {
    const result = buildTikTokCommerceEventParams({
      contentId: 'sku-1',
      contentName: 'iPhone 15',
      description: 'Apple smartphone',
      value: 900_000,
      currency: 'NGN',
      items: [
        {
          id: 'sku-1',
          name: 'iPhone 15',
          category: 'Phones',
          price: 900_000,
          quantity: 1,
          brand: 'Apple',
        },
      ],
    });

    expect(result).toEqual({
      content_id: 'sku-1',
      content_name: 'iPhone 15',
      content_type: 'product',
      currency: 'NGN',
      description: 'Apple smartphone',
      value: 900_000,
      quantity: 1,
      contents: [
        {
          content_id: 'sku-1',
          content_name: 'iPhone 15',
          content_category: 'Phones',
          price: 900_000,
          quantity: 1,
          brand: 'Apple',
        },
      ],
    });
  });

  it('uses the first content id and summed quantity for multi-item events', () => {
    const result = buildTikTokCommerceEventParams({
      value: 1_100_000,
      items: [
        { id: 'phone-1', name: 'Phone', price: 900_000, quantity: 1 },
        { id: 'case-1', name: 'Case', price: 100_000, quantity: 2 },
      ],
      extra: {
        order_id: 'order-123',
      },
    });

    expect(result).toMatchObject({
      content_id: 'phone-1',
      content_type: 'product',
      currency: 'NGN',
      value: 1_100_000,
      quantity: 3,
      order_id: 'order-123',
    });
    expect(result.contents).toEqual([
      {
        content_id: 'phone-1',
        content_name: 'Phone',
        price: 900_000,
        quantity: 1,
      },
      {
        content_id: 'case-1',
        content_name: 'Case',
        price: 100_000,
        quantity: 2,
      },
    ]);
  });

  it('omits empty ids and non-finite numeric values', () => {
    const result = buildTikTokCommerceEventParams({
      value: Number.NaN,
      quantity: Number.POSITIVE_INFINITY,
      items: [
        { id: ' ', name: 'Invalid' },
        { id: 'valid', price: Number.NEGATIVE_INFINITY, quantity: -2 },
      ],
    });

    expect(result).toEqual({
      content_id: 'valid',
      content_type: 'product',
      currency: 'NGN',
      quantity: 1,
      contents: [{ content_id: 'valid', quantity: 1 }],
    });
  });
});
