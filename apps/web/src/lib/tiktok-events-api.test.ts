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
function getSentBody(fetchMock: ReturnType<typeof mockOkFetch>) {
  const [, init] = fetchMock.mock.calls[0];
  return JSON.parse(String(init?.body));
}

describe('tiktokEventsAPI', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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

    const body = getSentBody(fetchMock);
    const payload = getSentPayload(fetchMock);

    expect(body).toMatchObject({
      event_source: 'web',
      event_source_id: 'pixel-1',
    });
    expect(payload).toMatchObject({
      event: 'Purchase',
      event_id: 'evt-1',
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
    expect(payload.event_time).toEqual(expect.any(Number));
  });

  it.each([
    ['Date object', new Date('2026-05-29T20:02:19.000Z')],
    ['ISO string', '2026-05-29T20:02:19.000Z'],
    ['Unix seconds', 1_780_084_939],
    ['Unix seconds string', '1780084939'],
    ['Unix milliseconds', 1_780_084_939_000],
    ['Unix milliseconds string', '1780084939000'],
  ])('serializes %s event time as TikTok event_time seconds', async (_caseName, eventTime) => {
    const fetchMock = mockOkFetch();

    await tiktokEventsAPI.viewContent(
      'pixel-1',
      'token-1',
      {},
      { contentId: 'sku-1' },
      {
        eventId: 'evt-with-time',
        eventTime,
      }
    );

    expect(getSentPayload(fetchMock)).toMatchObject({
      event_id: 'evt-with-time',
      event_time: 1_780_084_939,
    });
  });

  it('sends test_event_code at the TikTok request root', async () => {
    const fetchMock = mockOkFetch();

    await tiktokEventsAPI.viewContent(
      'pixel-1',
      'token-1',
      {},
      { contentId: 'sku-1' },
      {
        eventId: 'evt-test-event',
        testEventCode: 'TEST123',
      }
    );

    const body = getSentBody(fetchMock);

    expect(body).toMatchObject({
      event_source: 'web',
      event_source_id: 'pixel-1',
      test_event_code: 'TEST123',
    });
    expect(body.data[0]).not.toHaveProperty('test_event_code');
  });

  it.each([
    ['empty string', ''],
    ['invalid string', 'not-a-date'],
    ['invalid Date', new Date('invalid')],
    ['NaN', Number.NaN],
    ['zero string', '0'],
    ['undefined', undefined],
  ])('falls back to current event_time for %s', async (_caseName, eventTime) => {
    const fetchMock = mockOkFetch();
    const before = Math.floor(Date.now() / 1000);

    await tiktokEventsAPI.viewContent(
      'pixel-1',
      'token-1',
      {},
      { contentId: 'sku-1' },
      { eventId: 'evt-fallback-time', eventTime }
    );

    const after = Math.floor(Date.now() / 1000);
    const payload = getSentPayload(fetchMock);

    expect(payload.event_time).toBeGreaterThanOrEqual(before);
    expect(payload.event_time).toBeLessThanOrEqual(after);
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

  it('preserves caller abort through the composed fetch signal', async () => {
    const fetchMock = mockOkFetch();
    const controller = new AbortController();

    await tiktokEventsAPI.viewContent(
      'pixel-1',
      'token-1',
      {},
      { contentId: 'sku-1' },
      { eventId: 'event-1' },
      controller.signal
    );

    const requestSignal = fetchMock.mock.calls[0]?.[1]?.signal as AbortSignal;
    expect(requestSignal).not.toBe(controller.signal);
    controller.abort('caller-abort');
    expect(requestSignal.aborted).toBe(true);
    expect(requestSignal.reason).toBe('caller-abort');
  });

  it('returns a provider rejection without throwing', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({
          access_token: 'private-token',
          message: 'invalid access token',
        }),
        ok: false,
        status: 401,
      })
    );

    const result = await tiktokEventsAPI.viewContent(
      'pixel-1',
      'token-1',
      {},
      { contentId: 'sku-1' }
    );

    expect(result).toEqual({
      error: 'invalid access token',
      httpStatus: 401,
      success: false,
    });
    expect(consoleError).toHaveBeenCalledWith(
      'TikTok Events API error:',
      'invalid access token'
    );
  });

  it('preserves the response status when a provider error is not JSON', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token <')),
        ok: false,
        status: 502,
      })
    );

    await expect(
      tiktokEventsAPI.viewContent(
        'pixel-1',
        'token-1',
        {},
        { contentId: 'sku-1' }
      )
    ).resolves.toEqual({
      error: 'Invalid provider response',
      httpStatus: 502,
      success: false,
    });
  });
});
