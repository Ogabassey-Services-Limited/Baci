import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ServiceRoleClient } from '@/lib/supabase/service';

const mocks = vi.hoisted(() => ({
  claimCacheDelivery: vi.fn(),
  processCacheDelivery: vi.fn(),
  processDelivery: vi.fn(),
}));
vi.mock('./process-claimed-event-delivery', () => ({
  processClaimedEventDelivery: mocks.processDelivery,
}));
vi.mock('./process-storefront-cache-transition', () => ({
  claimStorefrontCacheTransitionBatch: mocks.claimCacheDelivery,
  processStorefrontCacheTransition: mocks.processCacheDelivery,
}));

import { runEventDeliveryWorker } from './event-delivery-worker';

const genericDelivery = {
  attempt_number: 1,
  claim_token: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a230',
  claimed_at: '2026-07-12T12:00:00.000Z',
  destination: 'facebook' as const,
  domain_event_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a234',
  id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a231',
  payload: {},
};
const cacheDelivery = {
  attempt_number: 1,
  claim_token: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a230',
  domain_event_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a234',
  generation: 1,
  id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a231',
  obligation_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a232',
  payload: {},
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('event delivery worker cache lane', () => {
  it('processes cache work before generic delivery work in the same worker loop', async () => {
    const rpc = vi.fn(async (name: string) => ({
      data: name === 'claim_event_deliveries_v1' ? [genericDelivery] : null,
      error: null,
    }));
    mocks.claimCacheDelivery.mockResolvedValue([cacheDelivery]);
    mocks.processCacheDelivery.mockResolvedValue(undefined);
    mocks.processDelivery.mockResolvedValue(undefined);

    await runEventDeliveryWorker({ rpc } as unknown as ServiceRoleClient, {
      analyticsDeliveryEnabled: true,
      cacheTransitionDeliveryEnabled: true,
      concurrency: 1,
      once: true,
    });

    expect(mocks.claimCacheDelivery).toHaveBeenCalledBefore(
      mocks.processDelivery
    );
    expect(mocks.processCacheDelivery).toHaveBeenCalledWith(
      expect.anything(),
      cacheDelivery
    );
    expect(mocks.processDelivery).toHaveBeenCalledWith(
      expect.anything(),
      genericDelivery
    );
  });

  it('does not claim generic deliveries when only the cache lane is enabled', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    mocks.claimCacheDelivery.mockResolvedValue([]);

    await runEventDeliveryWorker({ rpc } as unknown as ServiceRoleClient, {
      analyticsDeliveryEnabled: false,
      cacheTransitionDeliveryEnabled: true,
      concurrency: 1,
      once: true,
    });

    expect(mocks.claimCacheDelivery).toHaveBeenCalledOnce();
    expect(rpc).not.toHaveBeenCalledWith(
      'claim_event_deliveries_v1',
      expect.anything()
    );
    expect(mocks.processDelivery).not.toHaveBeenCalled();
  });
});
