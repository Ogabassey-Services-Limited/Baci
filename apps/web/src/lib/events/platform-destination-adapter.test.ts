import type { DomainEventV1 } from '@baci/shared/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEventPipelineServiceRoleTestClient } from './event-pipeline-service-role-test-client';

const mocks = vi.hoisted(() => ({
  sendFacebook: vi.fn(),
  sendGa4: vi.fn(),
}));

vi.mock('@/lib/facebook-capi', () => ({
  sendFacebookCAPIEvent: mocks.sendFacebook,
}));
vi.mock('@/lib/ga4-measurement-protocol', () => ({
  sendGA4Event: mocks.sendGa4,
}));

import { deliverPlatformEvent } from './platform-destination-adapter';

const event: DomainEventV1 = {
  data: { event_data: {}, event_type: 'landing_page_view' },
  domain_event_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a234',
  event_name: 'platform.landing_page_view.v1',
  external_event_id: 'event-1',
  idempotency_key: 'event-1',
  metadata: { environment: 'test' },
  occurred_at: '2026-07-12T12:00:00.000Z',
  producer: 'web',
  schema_version: 1,
  source: {},
  subject: { id: 'event-1', type: 'platform_event' },
  trust_level: 'tenant_verified_client',
};

function client(settings: unknown) {
  return createEventPipelineServiceRoleTestClient(
    vi.fn<typeof globalThis.fetch>(async () => Response.json(settings))
  );
}

describe('deliverPlatformEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendFacebook.mockResolvedValue({ success: true });
    mocks.sendGa4.mockResolvedValue({ success: true });
  });

  it('uses stable domain identity for GA4 delivery', async () => {
    const controller = new AbortController();
    const result = await deliverPlatformEvent(
      client({
        facebook_capi_token: null,
        facebook_pixel_id: null,
        ga4_api_secret: 'secret',
        google_analytics_id: 'G-1',
      }),
      event,
      'ga4',
      controller.signal
    );

    expect(result).toEqual({ success: true, terminalOutcome: 'delivered' });
    expect(mocks.sendGa4).toHaveBeenCalledWith(
      'G-1',
      'secret',
      'page_view',
      expect.any(Object),
      expect.objectContaining({ event_id: 'event-1' }),
      false,
      controller.signal,
      1783857600000000
    );
  });

  it('skips destinations without platform credentials', async () => {
    await expect(
      deliverPlatformEvent(client(null), event, 'facebook')
    ).resolves.toMatchObject({
      providerResponseId: 'not_configured',
      terminalOutcome: 'skipped',
    });
  });

  it('delivers first-sale events to Facebook as Purchase', async () => {
    const controller = new AbortController();
    const result = await deliverPlatformEvent(
      client({
        facebook_capi_token: 'token',
        facebook_pixel_id: 'pixel',
        ga4_api_secret: null,
        google_analytics_id: null,
      }),
      {
        ...event,
        data: {
          delivery_user_data: { ip: '203.0.113.1', ua: 'Baci test' },
          event_data: { currency: 'NGN', value: 100 },
        },
        event_name: 'platform.merchant_first_sale.v1',
      },
      'facebook',
      controller.signal
    );

    expect(result).toEqual({ success: true, terminalOutcome: 'delivered' });
    expect(mocks.sendFacebook).toHaveBeenCalledWith(
      'pixel',
      'token',
      'Purchase',
      { clientIpAddress: '203.0.113.1', clientUserAgent: 'Baci test' },
      { currency: 'NGN', value: 100 },
      undefined,
      'event-1',
      undefined,
      controller.signal,
      1783857600
    );
  });

  it('preserves a definite provider rejection', async () => {
    mocks.sendGa4.mockResolvedValue({ error: 'HTTP 503', success: false });

    const result = await deliverPlatformEvent(
      client({
        facebook_capi_token: null,
        facebook_pixel_id: null,
        ga4_api_secret: 'secret',
        google_analytics_id: 'G-1',
      }),
      event,
      'ga4'
    );

    expect(result).toMatchObject({
      errorCode: 'provider_rejected',
      httpStatus: 503,
      success: false,
    });
  });

  it('preserves Facebook status and stable match data', async () => {
    mocks.sendFacebook.mockResolvedValue({
      error: 'Invalid parameter',
      httpStatus: 400,
      success: false,
    });

    const result = await deliverPlatformEvent(
      client({
        facebook_capi_token: 'token',
        facebook_pixel_id: 'pixel',
        ga4_api_secret: null,
        google_analytics_id: null,
      }),
      {
        ...event,
        data: {
          delivery_user_data: { email: 'merchant@example.com' },
          event_data: {},
        },
        event_name: 'platform.merchant_signup_completed.v1',
      },
      'facebook'
    );

    expect(mocks.sendFacebook).toHaveBeenCalledWith(
      'pixel',
      'token',
      'CompleteRegistration',
      expect.objectContaining({ email: 'merchant@example.com' }),
      undefined,
      undefined,
      'event-1',
      undefined,
      undefined,
      1783857600
    );
    expect(result).toMatchObject({
      errorCode: 'provider_rejected',
      httpStatus: 400,
      success: false,
    });
  });
});
