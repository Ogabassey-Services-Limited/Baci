import { beforeEach, describe, expect, it, vi } from 'vitest';

type CaptureClientEventModule = typeof import('./capture-client-event');

// Module state (queue + connected sink) must not leak between tests, so each
// test gets a fresh module instance — same pattern as server.test.ts.
async function loadModule(): Promise<CaptureClientEventModule> {
  return await import('./capture-client-event');
}

describe('captureClientEvent', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('delivers through the connected sink with app_surface stamped', async () => {
    const { captureClientEvent, connectClientEventSink } = await loadModule();
    const sink = vi.fn();
    connectClientEventSink(sink);

    captureClientEvent('wallet_funding_surface_opened', {
      surface: 'utility_modal',
      merchant_slug: 'ogabassey',
    });

    expect(sink).toHaveBeenCalledWith('wallet_funding_surface_opened', {
      app_surface: 'web',
      surface: 'utility_modal',
      merchant_slug: 'ogabassey',
    });
  });

  it('always stamps app_surface as web even when a caller supplies it', async () => {
    const { captureClientEvent, connectClientEventSink } = await loadModule();
    const sink = vi.fn();
    connectClientEventSink(sink);

    captureClientEvent('wallet_funding_surface_opened', {
      app_surface: 'native',
      surface: 'wallet_page',
    });

    expect(sink).toHaveBeenCalledWith('wallet_funding_surface_opened', {
      app_surface: 'web',
      surface: 'wallet_page',
    });
  });

  it('drops undefined property values so absent context is not reported', async () => {
    const { captureClientEvent, connectClientEventSink } = await loadModule();
    const sink = vi.fn();
    connectClientEventSink(sink);

    captureClientEvent('wallet_funding_account_created', {
      merchant_slug: undefined,
      customer_id: 'customer-1',
    });

    expect(sink).toHaveBeenCalledWith('wallet_funding_account_created', {
      app_surface: 'web',
      customer_id: 'customer-1',
    });
  });

  it('never throws when the sink fails', async () => {
    const { captureClientEvent, connectClientEventSink } = await loadModule();
    connectClientEventSink(() => {
      throw new Error('posthog capture failed');
    });

    expect(() =>
      captureClientEvent('wallet_funding_surface_opened', {
        surface: 'wallet_page',
      })
    ).not.toThrow();
  });

  it('queues pre-init events and drains them when the sink connects', async () => {
    const { captureClientEvent, connectClientEventSink } = await loadModule();
    const sink = vi.fn();

    captureClientEvent('wallet_funding_surface_opened', {
      surface: 'utility_modal',
    });
    expect(sink).not.toHaveBeenCalled();

    connectClientEventSink(sink);

    expect(sink).toHaveBeenCalledWith('wallet_funding_surface_opened', {
      app_surface: 'web',
      surface: 'utility_modal',
    });
  });

  it('drains each queued event exactly once', async () => {
    const { captureClientEvent, connectClientEventSink } = await loadModule();
    const sink = vi.fn();

    captureClientEvent('wallet_funding_surface_opened', {
      surface: 'wallet_page',
    });
    connectClientEventSink(sink);
    connectClientEventSink(sink);

    expect(sink).toHaveBeenCalledTimes(1);
  });

  it('bounds the pre-init queue to the most recent events', async () => {
    const { captureClientEvent, connectClientEventSink } = await loadModule();
    const sink = vi.fn();

    for (let index = 0; index < 25; index += 1) {
      captureClientEvent('wallet_funding_surface_opened', { index });
    }
    connectClientEventSink(sink);

    expect(sink).toHaveBeenCalledTimes(20);
    expect(sink).toHaveBeenLastCalledWith('wallet_funding_surface_opened', {
      app_surface: 'web',
      index: 24,
    });
  });

  it('keeps draining the rest of the queue when one delivery fails', async () => {
    const { captureClientEvent, connectClientEventSink } = await loadModule();
    const sink = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('first delivery failed');
      })
      .mockImplementation(() => {});

    captureClientEvent('wallet_funding_surface_opened', { index: 0 });
    captureClientEvent('wallet_funding_surface_opened', { index: 1 });
    connectClientEventSink(sink);

    expect(sink).toHaveBeenCalledTimes(2);
  });
});
