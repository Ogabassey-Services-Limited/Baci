import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONVERSION_EVENT_TIME,
  conversionRouteRequest,
} from './conversion-route.test-support';

const merchantId = '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235';
const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  fanout: vi.fn(),
  loggerError: vi.fn(),
  storeLegacy: vi.fn(),
}));

vi.mock('@/lib/analytics/send-to-ad-platforms', () => ({
  normalizeEventType: () => 'begin_checkout',
}));
vi.mock('@/lib/analytics/trusted-server-ad-platform-fanout', () => ({
  trustedServerAdPlatformFanout: mocks.fanout,
}));
vi.mock('@/lib/events/event-ingress-capability', () => ({
  createEventIngressClient: () => ({}),
}));
vi.mock('@/lib/events/event-pipeline-config', () => ({
  isEventPipelineEnqueueEnabled: () => false,
  isLegacyAnalyticsFanoutDisabled: () => false,
  isUnverifiedEventTelemetryEnabled: () => false,
}));
vi.mock('@/lib/facebook-capi', () => ({ generateEventId: () => 'event-1' }));
vi.mock('@/lib/logger', () => ({
  logger: { error: mocks.loggerError, info: vi.fn(), warn: vi.fn() },
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: mocks.createServiceClient,
}));
vi.mock('./conversion-route-merchant-context', () => ({
  resolveConversionRouteMerchantContext: () => ({
    context: {
      merchantId,
      ok: true,
      trustLevel: 'tenant_verified_client',
      verified: true,
    },
    persistenceMerchantId: merchantId,
    verifiedMerchantId: merchantId,
  }),
}));
vi.mock('./store-legacy-conversion-event', () => ({
  storeLegacyConversionEvent: mocks.storeLegacy,
}));

import { POST } from './route';

describe('POST /api/analytics/conversion privileged logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(CONVERSION_EVENT_TIME * 1_000));
    mocks.createServiceClient.mockReturnValue({ authority: 'service' });
    mocks.storeLegacy.mockResolvedValue(undefined);
  });
  afterEach(() => vi.useRealTimers());

  it('does not log credential-bearing fanout exceptions', async () => {
    const sentinel = 'merchant-provider-credential-sentinel';
    mocks.fanout.mockRejectedValue(
      new Error(`provider credential=${sentinel}`)
    );

    const response = await POST(conversionRouteRequest());

    expect(response.status).toBe(500);
    expect(JSON.stringify(mocks.loggerError.mock.calls)).not.toContain(
      sentinel
    );
    expect(mocks.loggerError).toHaveBeenLastCalledWith({
      message: 'Conversion endpoint internal error',
    });
  });
});
