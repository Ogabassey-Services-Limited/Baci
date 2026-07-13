import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  enqueueEnabled: false,
  fanoutDisabled: false,
  from: vi.fn(),
  record: vi.fn(),
  resolveContext: vi.fn(),
  send: vi.fn(),
}));
const FIXED_EVENT_TIME = 1_784_937_600;

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mocks.from }),
}));
vi.mock('@/lib/events/event-ingress-capability', () => ({
  createEventIngressClient: () => ({ from: mocks.from }),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ from: mocks.from }),
}));
vi.mock('@/lib/events/event-ingress-context', () => ({
  resolveEventIngressContext: mocks.resolveContext,
}));
vi.mock('@/lib/events/event-pipeline-config', () => ({
  isEventPipelineEnqueueEnabled: () => mocks.enqueueEnabled,
  isLegacyAnalyticsFanoutDisabled: () => mocks.fanoutDisabled,
  isUnverifiedEventTelemetryEnabled: () => false,
}));
vi.mock('@/lib/events/record-analytics-domain-event', () => ({
  recordAnalyticsDomainEvent: mocks.record,
}));
vi.mock('@/lib/analytics/send-to-ad-platforms', () => ({
  normalizeEventType: (name: string) =>
    name === 'START_CHECKOUT' ? 'begin_checkout' : undefined,
  sendToAdPlatforms: mocks.send,
}));
vi.mock('@/lib/facebook-capi', () => ({ generateEventId: () => 'event-1' }));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { POST } from './route';

function request(overrides: Record<string, unknown> = {}) {
  return new NextRequest('https://shop.usebaci.com/api/analytics/conversion', {
    body: JSON.stringify({
      custom_data: { currency: 'NGN', value: 100 },
      event_name: 'START_CHECKOUT',
      event_source: 'web',
      event_time: FIXED_EVENT_TIME,
      merchant_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
      user_data: {},
      ...overrides,
    }),
    headers: { 'x-merchant-slug': 'shop' },
    method: 'POST',
  });
}

describe('POST /api/analytics/conversion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(FIXED_EVENT_TIME * 1_000));
    mocks.enqueueEnabled = false;
    mocks.fanoutDisabled = false;
    const analytics = { upsert: vi.fn().mockResolvedValue({ error: null }) };
    const merchant = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235' },
        error: null,
      }),
      select: vi.fn().mockReturnThis(),
    };
    mocks.from.mockImplementation((table: string) =>
      table === 'analytics_events' ? analytics : merchant
    );
    mocks.send.mockResolvedValue({ facebook: { success: true } });
    mocks.record.mockResolvedValue({ queue_message_id: 1 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects caller-owned routing fields through strict validation', async () => {
    const response = await POST(request({ trust_level: 'server' }));
    expect(response.status).toBe(400);
    expect(mocks.record).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('atomically records a verified event when durable enqueue is enabled', async () => {
    mocks.enqueueEnabled = true;
    mocks.resolveContext.mockResolvedValue({
      merchantId: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
      ok: true,
      trustLevel: 'tenant_verified_client',
      verified: true,
    });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.record).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        deliveryData: expect.any(Object),
        eventData: expect.objectContaining({ search_string: undefined }),
        eventName: 'analytics.begin_checkout.v1',
        externalEventId: 'event-1',
      })
    );
  });

  it('accepts an empty pre-order checkout ID and persists requested targets', async () => {
    mocks.enqueueEnabled = true;
    mocks.resolveContext.mockResolvedValue({
      merchantId: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
      ok: true,
      trustLevel: 'tenant_verified_client',
      verified: true,
    });

    const response = await POST(
      request({
        custom_data: { order_id: '', value: 100 },
        targets: ['facebook'],
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.record).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        eventData: expect.objectContaining({
          order_id: undefined,
          targets: ['facebook'],
        }),
      })
    );
  });

  it('preserves the native-client merchant fallback when tenant identity is absent', async () => {
    mocks.enqueueEnabled = true;
    mocks.resolveContext.mockResolvedValue({
      merchantId: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
      ok: false,
    });

    const response = await POST(request({ merchant_id: undefined }));

    expect(response.status).toBe(200);
    expect(mocks.record).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        merchantId: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
      })
    );
  });

  it('resolves an origin storefront before the default merchant in pipeline mode', async () => {
    mocks.enqueueEnabled = true;
    mocks.resolveContext.mockResolvedValue({
      merchantId: 'origin-merchant-id',
      ok: true,
      trustLevel: 'tenant_verified_client',
      verified: true,
    });
    const merchant = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'origin-merchant-id' },
        error: null,
      }),
      select: vi.fn().mockReturnThis(),
    };
    mocks.from.mockImplementation((table: string) =>
      table === 'analytics_events'
        ? { upsert: vi.fn().mockResolvedValue({ error: null }) }
        : merchant
    );

    const response = await POST(
      new NextRequest('https://usebaci.com/api/analytics/conversion', {
        body: JSON.stringify({
          custom_data: { currency: 'NGN', value: 100 },
          event_name: 'START_CHECKOUT',
          event_source: 'web',
          event_time: FIXED_EVENT_TIME,
          user_data: {},
        }),
        headers: { origin: 'https://origin-store.usebaci.com' },
        method: 'POST',
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.resolveContext).toHaveBeenCalledWith(
      expect.objectContaining({ merchantId: 'origin-merchant-id' })
    );
    expect(mocks.record).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ merchantId: 'origin-merchant-id' })
    );
  });

  it('preserves the native-client merchant fallback while durable enqueue is disabled', async () => {
    const response = await POST(request({ merchant_id: undefined }));

    expect(response.status).toBe(200);
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        merchant_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
      })
    );
  });

  it('fails closed for unverified body-only merchant selection', async () => {
    mocks.enqueueEnabled = true;
    mocks.resolveContext.mockResolvedValue({
      merchantId: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
      ok: true,
      trustLevel: 'anonymous_client',
      verified: false,
    });

    const response = await POST(request());

    expect(response.status).toBe(403);
    expect(mocks.record).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('uses legacy fanout when durable persistence fails during shadow mode', async () => {
    mocks.enqueueEnabled = true;
    mocks.resolveContext.mockResolvedValue({
      merchantId: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
      ok: true,
      trustLevel: 'tenant_verified_client',
      verified: true,
    });
    mocks.record.mockRejectedValue(new Error('queue unavailable'));

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        event_id: 'event-1',
        merchant_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
      })
    );
  });
});
