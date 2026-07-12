import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  enqueueEnabled: false,
  fanoutDisabled: false,
  from: vi.fn(),
  record: vi.fn(),
  resolveContext: vi.fn(),
  send: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
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
      event_time: Math.floor(Date.now() / 1_000),
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
        eventName: 'analytics.begin_checkout.v1',
        externalEventId: 'event-1',
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

  it('returns 500 when durable persistence fails', async () => {
    mocks.enqueueEnabled = true;
    mocks.resolveContext.mockResolvedValue({
      merchantId: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
      ok: true,
      trustLevel: 'tenant_verified_client',
      verified: true,
    });
    mocks.record.mockRejectedValue(new Error('queue unavailable'));

    const response = await POST(request());

    expect(response.status).toBe(500);
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
