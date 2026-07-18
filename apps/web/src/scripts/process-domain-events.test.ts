import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ServiceRoleClient } from '@/lib/supabase/service';

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  getActiveDestinations: vi.fn(() => []),
  getMaxReads: vi.fn(() => 5),
  getRoutingMode: vi.fn(),
  isCanaryMerchant: vi.fn(() => false),
  processBatch: vi.fn(),
  processMessage: vi.fn(),
  runWorker: vi.fn(),
}));

vi.mock('@/lib/events/event-pipeline-config', () => ({
  getEventIngressMaxReads: mocks.getMaxReads,
  getEventPipelineActiveDestinations: mocks.getActiveDestinations,
  getEventPipelineRoutingMode: mocks.getRoutingMode,
  isEventPipelineCanaryMerchant: mocks.isCanaryMerchant,
}));
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: mocks.createServiceClient,
}));
vi.mock('./domain-event-worker', () => ({
  runDomainEventWorker: mocks.runWorker,
}));
vi.mock('./domain-event-worker-batch', () => ({
  domainEventWorkerBatch: {
    processDomainEventBatch: mocks.processBatch,
    processDomainEventMessage: mocks.processMessage,
  },
}));

import {
  processDomainEventBatch,
  processDomainEventMessage,
  runDomainEventWorker,
} from './process-domain-events';

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('process-domain-events CLI facade', () => {
  it('returns while disabled before constructing a client or signals', async () => {
    mocks.getRoutingMode.mockReturnValue('disabled');
    const signal = vi.spyOn(process, 'once');

    await runDomainEventWorker({ once: true });

    expect(mocks.createServiceClient).not.toHaveBeenCalled();
    expect(mocks.runWorker).not.toHaveBeenCalled();
    expect(signal).not.toHaveBeenCalled();
  });

  it('constructs the authorized client and delegates the selected mode', async () => {
    mocks.getRoutingMode.mockReturnValue('shadow');
    const serviceClient = { rpc: vi.fn() } as unknown as ServiceRoleClient;
    mocks.createServiceClient.mockReturnValue(serviceClient);
    mocks.runWorker.mockResolvedValue(undefined);

    await runDomainEventWorker({ once: true });

    expect(mocks.createServiceClient).toHaveBeenCalledWith('event-pipeline');
    expect(mocks.runWorker).toHaveBeenCalledWith(serviceClient, {
      once: true,
      routingMode: 'shadow',
    });
  });

  it('propagates a delegated worker rejection', async () => {
    mocks.getRoutingMode.mockReturnValue('active');
    const serviceClient = { rpc: vi.fn() } as unknown as ServiceRoleClient;
    mocks.createServiceClient.mockReturnValue(serviceClient);
    mocks.runWorker.mockRejectedValue(new Error('domain_event_worker_failed'));

    await expect(runDomainEventWorker({ once: true })).rejects.toThrow(
      'domain_event_worker_failed'
    );
  });

  it('keeps the batch compatibility exports on the original path', () => {
    expect(processDomainEventBatch).toBe(mocks.processBatch);
    expect(processDomainEventMessage).toBe(mocks.processMessage);
  });
});
