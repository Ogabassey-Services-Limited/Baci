import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  record: vi.fn(),
  resolveContext: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({ insert: mocks.insert }),
    rpc: mocks.rpc,
  }),
}));
vi.mock('next/server', async () => {
  const actual =
    await vi.importActual<typeof import('next/server')>('next/server');
  return { ...actual, after: vi.fn() };
});
vi.mock('@/lib/analytics/send-to-ad-platforms', () => ({
  isConversionEvent: () => false,
  normalizeEventType: (name: string) => name,
  sendToAdPlatforms: vi.fn(),
}));
vi.mock('@/lib/events/event-pipeline-config', () => ({
  isEventPipelineEnqueueEnabled: () => true,
  isLegacyAnalyticsFanoutDisabled: () => false,
  isUnverifiedEventTelemetryEnabled: () => false,
}));
vi.mock('@/lib/events/event-ingress-context', () => ({
  resolveEventIngressContext: mocks.resolveContext,
}));
vi.mock('@/lib/events/record-analytics-domain-event', () => ({
  recordAnalyticsDomainEvent: mocks.record,
}));

import { POST } from './route';

const MERCHANT_ID = '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235';
const OTHER_MERCHANT_ID = '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a236';

function request(merchantId = MERCHANT_ID) {
  return new NextRequest('https://shop.usebaci.com/api/events', {
    body: JSON.stringify({
      event_type: 'page_view',
      merchant_id: merchantId,
      page_url: 'https://shop.usebaci.com/products?customer=private',
    }),
    headers: { 'x-merchant-slug': 'shop' },
    method: 'POST',
  });
}

describe('POST /api/events durable pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.record.mockResolvedValue({ queue_message_id: 1 });
  });

  it('returns only after the atomic analytics and queue RPC succeeds', async () => {
    let resolveRecord: (value: { queue_message_id: number }) => void = () => {
      throw new Error('record promise resolver was not initialized');
    };
    mocks.record.mockReturnValue(
      new Promise((resolve) => {
        resolveRecord = resolve;
      })
    );
    mocks.resolveContext.mockResolvedValue({
      merchantId: MERCHANT_ID,
      ok: true,
      trustLevel: 'tenant_verified_client',
      verified: true,
    });

    let settled = false;
    const responsePromise = POST(request()).then((response) => {
      settled = true;
      return response;
    });
    await vi.waitFor(() => expect(mocks.record).toHaveBeenCalledTimes(1));
    expect(settled).toBe(false);

    resolveRecord({ queue_message_id: 1 });
    const response = await responsePromise;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.event_id).toMatch(/^evt_/);
    expect(mocks.record).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        eventName: 'analytics.page_view.v1',
        trustLevel: 'tenant_verified_client',
      })
    );
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('rejects a host and body merchant mismatch', async () => {
    mocks.resolveContext.mockResolvedValue({
      code: 'merchant_mismatch',
      ok: false,
    });

    const response = await POST(request(OTHER_MERCHANT_ID));

    expect(response.status).toBe(403);
    expect(mocks.record).not.toHaveBeenCalled();
  });
});
