import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ServiceRoleClient } from '@/lib/supabase/service';

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  getClaimBatchSize: vi.fn(),
  getConcurrency: vi.fn(() => 4),
  getMaxAttempts: vi.fn(() => 8),
  isCacheDeliveryEnabled: vi.fn(),
  isEnabled: vi.fn(),
  processDelivery: vi.fn(),
  runWorker: vi.fn(),
}));

vi.mock('@/lib/events/event-pipeline-config', () => ({
  getEventDeliveryConcurrency: mocks.getConcurrency,
  getEventDeliveryMaxAttempts: mocks.getMaxAttempts,
  isStorefrontCacheTransitionDeliveryEnabled: mocks.isCacheDeliveryEnabled,
  isEventPipelineDeliveryEnabled: mocks.isEnabled,
}));
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: mocks.createServiceClient,
}));
vi.mock('./event-delivery-claim-batch-size', () => ({
  getEventDeliveryClaimBatchSize: mocks.getClaimBatchSize,
}));
vi.mock('./event-delivery-worker', () => ({
  runEventDeliveryWorker: mocks.runWorker,
}));
vi.mock('./process-claimed-event-delivery', () => ({
  processClaimedEventDelivery: mocks.processDelivery,
}));

import {
  getEventDeliveryClaimBatchSize,
  processClaimedEventDelivery,
  runEventDeliveryWorker,
} from './process-event-deliveries';

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('process-event-deliveries CLI facade', () => {
  it('returns while disabled before constructing a client or signals', async () => {
    mocks.isEnabled.mockReturnValue(false);
    const signal = vi.spyOn(process, 'once');

    await runEventDeliveryWorker({ once: true });

    expect(mocks.createServiceClient).not.toHaveBeenCalled();
    expect(mocks.runWorker).not.toHaveBeenCalled();
    expect(signal).not.toHaveBeenCalled();
  });

  it('constructs the authorized client and delegates configured concurrency', async () => {
    mocks.isEnabled.mockReturnValue(true);
    mocks.isCacheDeliveryEnabled.mockReturnValue(false);
    const serviceClient = { rpc: vi.fn() } as unknown as ServiceRoleClient;
    mocks.createServiceClient.mockReturnValue(serviceClient);
    mocks.runWorker.mockResolvedValue(undefined);

    await runEventDeliveryWorker({ once: true });

    expect(mocks.createServiceClient).toHaveBeenCalledWith('event-pipeline');
    expect(mocks.runWorker).toHaveBeenCalledWith(serviceClient, {
      analyticsDeliveryEnabled: true,
      cacheTransitionDeliveryEnabled: false,
      concurrency: 4,
      once: true,
    });
  });

  it('propagates a delegated worker rejection', async () => {
    mocks.isEnabled.mockReturnValue(true);
    mocks.isCacheDeliveryEnabled.mockReturnValue(false);
    const serviceClient = { rpc: vi.fn() } as unknown as ServiceRoleClient;
    mocks.createServiceClient.mockReturnValue(serviceClient);
    mocks.runWorker.mockRejectedValue(new Error('event_delivery_worker_failed'));

    await expect(runEventDeliveryWorker({ once: true })).rejects.toThrow(
      'event_delivery_worker_failed'
    );
  });

  it('keeps delivery compatibility exports on the original path', () => {
    expect(getEventDeliveryClaimBatchSize).toBe(mocks.getClaimBatchSize);
    expect(processClaimedEventDelivery).toBe(mocks.processDelivery);
  });

  it('runs only the specialized cache lane when its independent flag is enabled', async () => {
    mocks.isEnabled.mockReturnValue(false);
    mocks.isCacheDeliveryEnabled.mockReturnValue(true);
    const serviceClient = { rpc: vi.fn() } as unknown as ServiceRoleClient;
    mocks.createServiceClient.mockReturnValue(serviceClient);
    mocks.runWorker.mockResolvedValue(undefined);

    await runEventDeliveryWorker({ once: true });

    expect(mocks.runWorker).toHaveBeenCalledWith(serviceClient, {
      analyticsDeliveryEnabled: false,
      cacheTransitionDeliveryEnabled: true,
      concurrency: 4,
      once: true,
    });
  });

  it('starts both lanes without using the analytics flag as cache authority', async () => {
    mocks.isEnabled.mockReturnValue(true);
    mocks.isCacheDeliveryEnabled.mockReturnValue(true);
    const serviceClient = { rpc: vi.fn() } as unknown as ServiceRoleClient;
    mocks.createServiceClient.mockReturnValue(serviceClient);
    mocks.runWorker.mockResolvedValue(undefined);

    await runEventDeliveryWorker({ once: true });

    expect(mocks.runWorker).toHaveBeenCalledWith(serviceClient, {
      analyticsDeliveryEnabled: true,
      cacheTransitionDeliveryEnabled: true,
      concurrency: 4,
      once: true,
    });
  });
});
