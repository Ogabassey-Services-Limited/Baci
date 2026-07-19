import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEventPipelineServiceRoleTestClient } from '@/lib/events/event-pipeline-service-role-test-client';

const mocks = vi.hoisted(() => ({ processDelivery: vi.fn() }));
vi.mock('./process-claimed-event-delivery', () => ({
  processClaimedEventDelivery: mocks.processDelivery,
}));

import { runEventDeliveryWorker } from './event-delivery-worker';

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

const claimedDelivery = {
  attempt_number: 1,
  claim_token: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a230',
  claimed_at: '2026-07-12T12:00:00.000Z',
  destination: 'facebook' as const,
  domain_event_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a234',
  id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a231',
  payload: {},
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

describe('runEventDeliveryWorker', () => {
  it('records one succeeded heartbeat for an all-success claimed batch', async () => {
    const batch = [
      claimedDelivery,
      { ...claimedDelivery, id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a232' },
      { ...claimedDelivery, id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a233' },
    ];
    const rpc = vi.fn(async (name: string, _args: Record<string, unknown>) => ({
      data: name === 'claim_event_deliveries_v1' ? batch : null,
      error: null,
    }));
    mocks.processDelivery.mockResolvedValue(undefined);

    await runEventDeliveryWorker(client(rpc), {
      concurrency: 2,
      once: true,
    });

    expect(mocks.processDelivery).toHaveBeenCalledTimes(3);
    const heartbeats = rpc.mock.calls.filter(
      ([name]) => name === 'record_event_worker_heartbeat_v1'
    );
    expect(heartbeats).toEqual([
      [
        'record_event_worker_heartbeat_v1',
        expect.objectContaining({ p_status: 'started' }),
      ],
      [
        'record_event_worker_heartbeat_v1',
        expect.objectContaining({
          p_processed_count: 3,
          p_status: 'succeeded',
        }),
      ],
    ]);
  });

  it('settles the whole claimed batch and records its partial failure once', async () => {
    const batch = [
      claimedDelivery,
      { ...claimedDelivery, id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a232' },
      { ...claimedDelivery, id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a233' },
    ];
    const rpc = vi.fn(async (name: string, _args: Record<string, unknown>) => ({
      data: name === 'claim_event_deliveries_v1' ? batch : null,
      error: null,
    }));
    mocks.processDelivery.mockImplementation(async (_client, delivery) => {
      if (delivery.id === claimedDelivery.id) throw new Error('provider_failed');
    });

    await expect(
      runEventDeliveryWorker(client(rpc), {
        concurrency: 2,
        once: true,
      })
    ).rejects.toThrow('batch_partial_failure');

    expect(mocks.processDelivery).toHaveBeenCalledTimes(3);
    const failedHeartbeats = rpc.mock.calls.filter(
      ([name, args]) =>
        name === 'record_event_worker_heartbeat_v1' &&
        args.p_status === 'failed'
    );
    expect(failedHeartbeats).toHaveLength(1);
    expect(failedHeartbeats[0]?.[1]).toEqual(
      expect.objectContaining({
        p_error_code: 'batch_partial_failure',
        p_processed_count: 2,
      })
    );
  });

  it('removes stop listeners after once-mode returns', async () => {
    const listeners = captureStopSignals();
    const rpc = vi.fn(async (name: string, _args: Record<string, unknown>) => ({
      data: name === 'claim_event_deliveries_v1' ? [] : null,
      error: null,
    }));

    await runEventDeliveryWorker(client(rpc), {
      concurrency: 2,
      once: true,
    });

    expect(listeners).toEqual(new Map());
  });

  it('normalizes invalid concurrency once before claiming and settling', async () => {
    const rpc = vi.fn(async (name: string, _args: Record<string, unknown>) => ({
      data: name === 'claim_event_deliveries_v1' ? [claimedDelivery] : null,
      error: null,
    }));
    mocks.processDelivery.mockResolvedValue(undefined);

    await runEventDeliveryWorker(client(rpc), {
      concurrency: Number.NaN,
      once: true,
    });

    expect(rpc).toHaveBeenCalledWith(
      'claim_event_deliveries_v1',
      expect.objectContaining({ p_batch_size: 2, p_lease_seconds: 60 })
    );
    expect(mocks.processDelivery).toHaveBeenCalledOnce();
  });

  it('backs off after a continuous-mode partial failure', async () => {
    const listeners = captureStopSignals();
    let claimCount = 0;
    const rpc = vi.fn(async (name: string, _args: Record<string, unknown>) => {
      if (name === 'claim_event_deliveries_v1') {
        claimCount += 1;
        if (claimCount > 1) listeners.get('SIGTERM')?.();
        return {
          data: claimCount === 1 ? [claimedDelivery] : [],
          error: null,
        };
      }
      return { data: null, error: null };
    });
    mocks.processDelivery.mockRejectedValue(new Error('provider_failed'));
    const wait = vi.fn(async () => {
      listeners.get('SIGTERM')?.();
    });

    await runEventDeliveryWorker(client(rpc), {
      concurrency: 2,
      wait,
    });

    expect(wait).toHaveBeenCalledOnce();
    expect(wait).toHaveBeenCalledWith(5_000);
    expect(claimCount).toBe(1);
  });

  it.each([
    ['SIGINT', 'claim'],
    ['SIGTERM', 'claim'],
    ['SIGINT', 'partial'],
    ['SIGTERM', 'partial'],
  ] as const)(
    'skips failure backoff when %s stops a %s failure',
    async (signal, failure) => {
      const listeners = captureStopSignals();
      const rpc = vi.fn(async (name: string, _args: Record<string, unknown>) => {
        if (name !== 'claim_event_deliveries_v1') {
          return { data: null, error: null };
        }
        if (failure === 'claim') {
          listeners.get(signal)?.();
          return { data: null, error: { code: 'XX000' } };
        }
        return { data: [claimedDelivery], error: null };
      });
      mocks.processDelivery.mockImplementation(async () => {
        listeners.get(signal)?.();
        throw new Error('provider_failed');
      });
      const wait = vi.fn(async () => {});

      await runEventDeliveryWorker(client(rpc), { concurrency: 2, wait });

      expect(wait).not.toHaveBeenCalled();
    }
  );

  it('paces an empty queue by one second', async () => {
    const listeners = captureStopSignals();
    const rpc = vi.fn(async (name: string, _args: Record<string, unknown>) => ({
      data: name === 'claim_event_deliveries_v1' ? [] : null,
      error: null,
    }));
    const wait = vi.fn(async () => {
      listeners.get('SIGINT')?.();
    });

    await runEventDeliveryWorker(client(rpc), { concurrency: 2, wait });

    expect(wait).toHaveBeenCalledOnce();
    expect(wait).toHaveBeenCalledWith(1_000);
  });

  it('paces claim failures by five seconds', async () => {
    const listeners = captureStopSignals();
    const rpc = vi.fn(async (name: string, _args: Record<string, unknown>) => ({
      data: null,
      error:
        name === 'claim_event_deliveries_v1' ? { code: 'XX000' } : null,
    }));
    const wait = vi.fn(async () => {
      listeners.get('SIGTERM')?.();
    });

    await runEventDeliveryWorker(client(rpc), { concurrency: 2, wait });

    expect(wait).toHaveBeenCalledOnce();
    expect(wait).toHaveBeenCalledWith(5_000);
  });
});
