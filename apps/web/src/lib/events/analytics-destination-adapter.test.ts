import type { DomainEventV1 } from '@baci/shared/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchConfig: vi.fn(),
  loadPaidOrderDeliveryEvent: vi.fn(),
  sendGA4Event: vi.fn(),
  sendToAdPlatforms: vi.fn(),
}));

vi.mock('@/lib/analytics/analytics-platform-config', () => ({
  fetchAnalyticsPlatformConfig: mocks.fetchConfig,
}));

vi.mock('@/lib/analytics/send-to-ad-platforms', () => ({
  sendToAdPlatforms: mocks.sendToAdPlatforms,
}));

vi.mock('@/lib/ga4-measurement-protocol', () => ({
  sendGA4Event: mocks.sendGA4Event,
}));

vi.mock('./paid-order-delivery-event', () => ({
  loadPaidOrderDeliveryEvent: mocks.loadPaidOrderDeliveryEvent,
}));

import { deliverAnalyticsEvent } from './analytics-destination-adapter';

const event: DomainEventV1 = {
  data: {
    delivery_user_data: { fbc: 'fb.1.1.click', ip: '203.0.113.1' },
    event_data: {
      product_id: 'sku-1',
      product_price: 100,
      quantity: 1,
      search_string: 'phone',
    },
    event_type: 'add_to_cart',
    source: 'web',
  },
  domain_event_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a234',
  event_name: 'analytics.add_to_cart.v1',
  external_event_id: 'event-1',
  idempotency_key: 'event-1',
  merchant_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
  metadata: { environment: 'test' },
  occurred_at: '2026-07-12T12:00:00.000Z',
  producer: 'web',
  schema_version: 1,
  source: {},
  subject: { id: 'event-1', type: 'analytics_event' },
  trust_level: 'tenant_verified_client',
};

describe('deliverAnalyticsEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchConfig.mockResolvedValue({
      facebook_capi_token: 'token',
      facebook_pixel_id: 'pixel',
      ga4_api_secret: null,
      google_analytics_id: null,
      offline_conversions_enabled: true,
      snapchat_capi_token: null,
      snapchat_pixel_id: null,
      tiktok_access_token: null,
      tiktok_pixel_id: null,
    });
  });

  it('delivers one independent destination with the stable event ID', async () => {
    const controller = new AbortController();
    mocks.sendToAdPlatforms.mockResolvedValue({
      facebook: { success: true },
    });

    await expect(
      deliverAnalyticsEvent({} as never, event, 'facebook', controller.signal)
    ).resolves.toEqual({ success: true, terminalOutcome: 'delivered' });
    expect(mocks.sendToAdPlatforms).toHaveBeenCalledWith(
      expect.objectContaining({
        custom_data: expect.objectContaining({
          contents: [
            expect.objectContaining({ id: 'sku-1', price: 100, quantity: 1 }),
          ],
          search_string: 'phone',
        }),
        event_id: 'event-1',
        occurred_at: '2026-07-12T12:00:00.000Z',
        targets: ['facebook'],
        user_data: { fbc: 'fb.1.1.click', ip: '203.0.113.1' },
      }),
      { signal: controller.signal }
    );
  });

  it('records an unconfigured destination as a terminal skip', async () => {
    await expect(
      deliverAnalyticsEvent({} as never, event, 'tiktok')
    ).resolves.toEqual({
      providerResponseId: 'not_configured',
      success: true,
      terminalOutcome: 'skipped',
    });
    expect(mocks.sendToAdPlatforms).not.toHaveBeenCalled();
  });

  it('retries configuration reads that fail instead of silently skipping', async () => {
    mocks.fetchConfig.mockResolvedValue(null);

    await expect(
      deliverAnalyticsEvent({} as never, event, 'facebook')
    ).resolves.toMatchObject({
      errorCode: 'analytics_config_unavailable',
      success: false,
    });
  });

  it('retries when the provider helper returns no destination result', async () => {
    mocks.sendToAdPlatforms.mockResolvedValue({});

    await expect(
      deliverAnalyticsEvent({} as never, event, 'facebook')
    ).resolves.toMatchObject({
      errorCode: 'analytics_config_unavailable',
      success: false,
    });
  });

  it('preserves a provider rejection HTTP status for delivery classification', async () => {
    mocks.sendToAdPlatforms.mockResolvedValue({
      facebook: {
        error: 'Request rejected',
        httpStatus: 400,
        success: false,
      },
    });

    await expect(
      deliverAnalyticsEvent({} as never, event, 'facebook')
    ).resolves.toMatchObject({
      errorCode: 'provider_rejected',
      httpStatus: 400,
      success: false,
    });
  });

  it('uses the paid-order occurrence time for GA4 purchases', async () => {
    const paidEvent: DomainEventV1 = {
      ...event,
      data: {
        ...event.data,
        event_data: { order_id: 'order-1' },
        event_type: 'purchase',
      },
      event_name: 'analytics.purchase.completed.v1',
      subject: { id: 'order-1', type: 'order' },
    };
    mocks.fetchConfig.mockResolvedValue({
      facebook_capi_token: null,
      facebook_pixel_id: null,
      ga4_api_secret: 'ga-secret',
      google_analytics_id: 'G-TEST',
      offline_conversions_enabled: true,
      snapchat_capi_token: null,
      snapchat_pixel_id: null,
      tiktok_access_token: null,
      tiktok_pixel_id: null,
    });
    mocks.loadPaidOrderDeliveryEvent.mockResolvedValue({
      conversion: {
        custom_data: { currency: 'NGN', value: 100 },
        event_id: 'event-1',
        event_type: 'purchase',
        merchant_id: event.merchant_id,
        occurred_at: event.occurred_at,
        source: 'server',
        user_data: {},
      },
      gaClientId: '123.456',
      orderNumber: 'ORDER-1',
    });
    mocks.sendGA4Event.mockResolvedValue({ success: true });

    await expect(
      deliverAnalyticsEvent({} as never, paidEvent, 'ga4')
    ).resolves.toEqual({ success: true, terminalOutcome: 'delivered' });

    expect(mocks.sendGA4Event).toHaveBeenCalledWith(
      'G-TEST',
      'ga-secret',
      'purchase',
      expect.objectContaining({ clientId: '123.456' }),
      expect.objectContaining({ transaction_id: 'ORDER-1' }),
      false,
      undefined,
      Date.parse(event.occurred_at) * 1_000
    );
  });
});
