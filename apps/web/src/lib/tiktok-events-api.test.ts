import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tiktokEventsAPI } from './tiktok-events-api';

function sha256(value: string) {
  return createHash('sha256').update(value.toLowerCase().trim()).digest('hex');
}

function mockOkFetch() {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue({ code: 0, message: 'OK' }),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function getSentPayload(fetchMock: ReturnType<typeof mockOkFetch>) {
  const [, init] = fetchMock.mock.calls[0];
  return JSON.parse(String(init?.body)).data[0];
}

describe('tiktokEventsAPI', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends Purchase with payload-helper commerce and customer fields', async () => {
    const fetchMock = mockOkFetch();

    await tiktokEventsAPI.purchase(
      'pixel-1',
      'token-1',
      {
        email: 'Buyer@Example.com',
        externalId: 'customer-1',
        ipAddress: '203.0.113.10',
        phone: '+234 800 123 4567',
        ttclid: 'ttclid-1',
        userAgent: 'Unit Test Agent',
      },
      'order-1',
      120_000,
      'NGN',
      [
        {
          id: 'sku-1',
          name: 'iPhone 15',
          price: 120_000,
          quantity: 1,
        },
      ],
      {
        eventId: 'evt-1',
        url: 'https://ogabassey.com/products/iphone-15',
      }
    );

    const payload = getSentPayload(fetchMock);

    expect(payload).toMatchObject({
      event: 'Purchase',
      event_id: 'evt-1',
      pixel_code: 'pixel-1',
      context: {
        page: {
          url: 'https://ogabassey.com/products/iphone-15',
        },
        user: {
          email: sha256('Buyer@Example.com'),
          external_id: sha256('customer-1'),
          ip: '203.0.113.10',
          phone: sha256('+2348001234567'),
          ttclid: 'ttclid-1',
          user_agent: 'Unit Test Agent',
        },
      },
      properties: {
        content_id: 'sku-1',
        content_name: 'iPhone 15',
        content_type: 'product',
        currency: 'NGN',
        order_id: 'order-1',
        price: 120_000,
        value: 120_000,
      },
    });
  });

  it.each([
    ['viewContent', 'ViewContent'],
    ['addToCart', 'AddToCart'],
    ['addToWishlist', 'AddToWishlist'],
    ['addPaymentInfo', 'AddPaymentInfo'],
    ['initiateCheckout', 'InitiateCheckout'],
    ['placeAnOrder', 'PlaceAnOrder'],
    ['completeRegistration', 'CompleteRegistration'],
  ] as const)('supports %s as %s', async (methodName, eventName) => {
    const fetchMock = mockOkFetch();

    await tiktokEventsAPI[methodName](
      'pixel-1',
      'token-1',
      {},
      {
        contents: [
          {
            content_id: 'sku-1',
            content_name: 'iPhone 15',
            price: 120_000,
            quantity: 1,
          },
        ],
        currency: 'NGN',
        value: 120_000,
      },
      { eventId: `evt-${eventName}` }
    );

    expect(getSentPayload(fetchMock).event).toBe(eventName);
  });

  it('sends Search with search_string', async () => {
    const fetchMock = mockOkFetch();

    await tiktokEventsAPI.search('pixel-1', 'token-1', {}, 'iphone', {
      eventId: 'evt-search',
      url: 'https://ogabassey.com/search?q=iphone',
    });

    expect(getSentPayload(fetchMock)).toMatchObject({
      event: 'Search',
      properties: {
        search_string: 'iphone',
      },
    });
  });
});
