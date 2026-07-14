import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  createServerClient: vi.fn(),
  insert: vi.fn(),
  isConversionEvent: vi.fn(),
  isLegacyFanoutDisabled: vi.fn(),
  isPipelineEnabled: vi.fn(),
  record: vi.fn(),
  resolveContext: vi.fn(),
  rpc: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({ insert: mocks.insert, upsert: mocks.upsert }),
    rpc: mocks.rpc,
  }),
}));
vi.mock('@/lib/events/event-ingress-capability', () => ({
  createEventIngressClient: () => ({
    from: () => ({ insert: mocks.insert, upsert: mocks.upsert }),
    rpc: mocks.rpc,
  }),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createServerClient,
}));
vi.mock('next/server', async () => {
  const actual =
    await vi.importActual<typeof import('next/server')>('next/server');
  return { ...actual, after: mocks.after };
});
vi.mock('@/lib/analytics/send-to-ad-platforms', () => ({
  isConversionEvent: mocks.isConversionEvent,
  normalizeEventType: (name: string) => name,
  sendToAdPlatforms: vi.fn(),
}));
vi.mock('@/lib/events/event-pipeline-config', () => ({
  isEventPipelineEnqueueEnabled: mocks.isPipelineEnabled,
  isLegacyAnalyticsFanoutDisabled: mocks.isLegacyFanoutDisabled,
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
    headers: {
      cookie: '_fbc=fb.1.click; _fbp=fbp.1; _ttp=ttp.1; ScCid=snap.1',
      'user-agent': 'Baci test agent',
      'x-forwarded-for': '203.0.113.1',
      'x-merchant-slug': 'shop',
    },
    method: 'POST',
  });
}

describe('POST /api/events durable pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insert.mockResolvedValue({ error: null });
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.isConversionEvent.mockReturnValue(false);
    mocks.isLegacyFanoutDisabled.mockReturnValue(false);
    mocks.isPipelineEnabled.mockReturnValue(true);
    mocks.record.mockResolvedValue({ queue_message_id: 1 });
    mocks.createServerClient.mockResolvedValue({
      from: () => ({ insert: mocks.insert, upsert: mocks.upsert }),
      rpc: mocks.rpc,
    });
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
    expect(mocks.resolveContext).toHaveBeenCalledWith(
      expect.objectContaining({
        pageUrl: 'https://shop.usebaci.com/products?customer=private',
      })
    );
    expect(mocks.record).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        deliveryData: expect.objectContaining({
          fbc: 'fb.1.click',
          fbp: 'fbp.1',
          ip: '203.0.113.1',
          sccid: 'snap.1',
          ttp: 'ttp.1',
          ua: 'Baci test agent',
        }),
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

  it('uses legacy persistence and fanout when durable enqueue fails in shadow mode', async () => {
    mocks.isConversionEvent.mockReturnValue(true);
    mocks.record.mockRejectedValue(new Error('queue unavailable'));
    mocks.resolveContext.mockResolvedValue({
      merchantId: MERCHANT_ID,
      ok: true,
      trustLevel: 'tenant_verified_client',
      verified: true,
    });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ merchant_id: MERCHANT_ID }),
      expect.any(Object)
    );
    expect(mocks.after).toHaveBeenCalledTimes(1);
  });

  it('does not create a request-context client for the legacy path', async () => {
    mocks.isPipelineEnabled.mockReturnValue(false);

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });
});
