import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEventPipelineServiceRoleTestClient } from '@/lib/events/event-pipeline-service-role-test-client';

const mocks = vi.hoisted(() => ({ processBatch: vi.fn() }));
vi.mock('./domain-event-worker-batch', () => ({
  domainEventWorkerBatch: { processDomainEventBatch: mocks.processBatch },
}));

import { runDomainEventWorker } from './domain-event-worker';

type Rpc = (
  name: string,
  args: Record<string, unknown>
) => Promise<{ data: unknown; error: unknown }>;

function client(rpc: Rpc) {
  return createEventPipelineServiceRoleTestClient(
    vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const result = await rpc(
        new URL(String(input)).pathname.split('/').at(-1) ?? '',
        JSON.parse(String(init?.body ?? '{}'))
      );
      return result.error
        ? Response.json(result.error, { status: 500 })
        : Response.json(result.data);
    })
  );
}

const queuedMessage = {
  enqueued_at: '2026-07-12T12:00:00.000Z',
  message: {},
  msg_id: 1,
  read_ct: 1,
  visible_at: '2026-07-12T12:01:00.000Z',
};

function captureStopSignals() {
  const listeners = new Map<string | symbol, () => void>();
  vi.spyOn(process, 'once').mockImplementation(
    ((event: string | symbol, listener: () => void) => {
      listeners.set(event, listener);
      return process;
    }) as typeof process.once
  );
  vi.spyOn(process, 'removeListener').mockImplementation(
    ((event: string | symbol, listener: () => void) => {
      if (listeners.get(event) === listener) listeners.delete(event);
      return process;
    }) as typeof process.removeListener
  );
  return listeners;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('runDomainEventWorker', () => {
  it('reads one batch and records started and succeeded heartbeats', async () => {
    const rpc = vi.fn(async (name: string, _args: Record<string, unknown>) => ({
      data: name === 'read_domain_events_v1' ? [queuedMessage] : null,
      error: null,
    }));
    mocks.processBatch.mockResolvedValue({ failed: 0, processed: 1 });

    await runDomainEventWorker(client(rpc), {
      once: true,
      routingMode: 'active',
    });

    expect(mocks.processBatch).toHaveBeenCalledWith(
      expect.anything(),
      [queuedMessage],
      false,
      expect.any(Function)
    );
    expect(rpc).toHaveBeenCalledWith(
      'read_domain_events_v1',
      expect.objectContaining({ p_batch_size: 100 })
    );
    expect(rpc).toHaveBeenCalledWith(
      'record_event_worker_heartbeat_v1',
      expect.objectContaining({ p_status: 'started' })
    );
    expect(rpc).toHaveBeenCalledWith(
      'record_event_worker_heartbeat_v1',
      expect.objectContaining({ p_processed_count: 1, p_status: 'succeeded' })
    );
  });

  it('removes stop listeners after once-mode returns', async () => {
    const listeners = captureStopSignals();
    const rpc = vi.fn(async (name: string, _args: Record<string, unknown>) => ({
      data: name === 'read_domain_events_v1' ? [] : null,
      error: null,
    }));
    mocks.processBatch.mockResolvedValue({ failed: 0, processed: 0 });

    await runDomainEventWorker(client(rpc), {
      once: true,
      routingMode: 'active',
    });

    expect(listeners).toEqual(new Map());
  });

  it('records a once-mode partial failure only once', async () => {
    const rpc = vi.fn(async (name: string, _args: Record<string, unknown>) => ({
      data: name === 'read_domain_events_v1' ? [queuedMessage] : null,
      error: null,
    }));
    mocks.processBatch.mockResolvedValue({ failed: 1, processed: 0 });

    await expect(
      runDomainEventWorker(client(rpc), {
        once: true,
        routingMode: 'shadow',
      })
    ).rejects.toThrow('batch_partial_failure');

    const failedHeartbeats = rpc.mock.calls.filter(
      ([name, args]) =>
        name === 'record_event_worker_heartbeat_v1' &&
        args.p_status === 'failed'
    );
    expect(failedHeartbeats).toHaveLength(1);
    expect(failedHeartbeats[0]?.[1]).toEqual(
      expect.objectContaining({
        p_error_code: 'batch_partial_failure',
        p_processed_count: 0,
      })
    );
  });

  it('backs off after a continuous-mode partial failure', async () => {
    const listeners = captureStopSignals();
    let readCount = 0;
    const rpc = vi.fn(async (name: string, _args: Record<string, unknown>) => {
      if (name === 'read_domain_events_v1') {
        readCount += 1;
        if (readCount > 1) listeners.get('SIGTERM')?.();
        return { data: [queuedMessage], error: null };
      }
      return { data: null, error: null };
    });
    mocks.processBatch.mockResolvedValue({ failed: 1, processed: 0 });
    const wait = vi.fn(async () => {
      listeners.get('SIGTERM')?.();
    });

    await runDomainEventWorker(client(rpc), {
      routingMode: 'active',
      wait,
    });

    expect(wait).toHaveBeenCalledOnce();
    expect(wait).toHaveBeenCalledWith(5_000);
    expect(readCount).toBe(1);
  });

  it('paces read failures by five seconds and exits after a stop signal', async () => {
    const listeners = captureStopSignals();
    const rpc = vi.fn(async (name: string, _args: Record<string, unknown>) => ({
      data: null,
      error:
        name === 'read_domain_events_v1' ? { code: 'XX000' } : null,
    }));
    const wait = vi.fn(async () => {
      listeners.get('SIGTERM')?.();
    });

    await runDomainEventWorker(client(rpc), {
      routingMode: 'active',
      wait,
    });

    expect(wait).toHaveBeenCalledOnce();
    expect(wait).toHaveBeenCalledWith(5_000);
    expect(process.once).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(process.once).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
  });
});
