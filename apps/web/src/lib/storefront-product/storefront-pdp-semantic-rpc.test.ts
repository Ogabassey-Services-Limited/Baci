import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runStorefrontPdpSemanticRpc } from './storefront-pdp-semantic-rpc';

const loggerMocks = vi.hoisted(() => ({ warn: vi.fn() }));

vi.mock('@/lib/logger', () => ({ logger: loggerMocks }));

describe('runStorefrontPdpSemanticRpc', () => {
  beforeEach(() => {
    loggerMocks.warn.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('marks an aborted request at the client boundary without logging query inputs', async () => {
    const timeoutController = new AbortController();
    const timeoutError = new DOMException(
      'The operation timed out',
      'TimeoutError'
    );
    timeoutController.abort(timeoutError);
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeoutController.signal);
    const query = {
      abortSignal: vi.fn().mockRejectedValue(timeoutError),
    } as never;

    await expect(
      runStorefrontPdpSemanticRpc(query, {
        deadlineMs: 5_000,
        traceThresholdMs: 4_000,
      })
    ).rejects.toBe(timeoutError);

    expect(loggerMocks.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'throw',
        deadlineMs: 5_000,
        timeoutSignalAborted: true,
        errorName: 'TimeoutError',
      })
    );
    expect(JSON.stringify(loggerMocks.warn.mock.calls[0]?.[0])).not.toContain(
      'query-input'
    );
  });

  it('traces a slow successful response without changing its value', async () => {
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(4_001)
      .mockReturnValueOnce(4_001);
    const response = { data: [], error: null, status: 200 };
    const query = {
      abortSignal: vi.fn().mockResolvedValue(response),
    } as never;

    await expect(
      runStorefrontPdpSemanticRpc(query, {
        deadlineMs: 5_000,
        traceThresholdMs: 4_000,
      })
    ).resolves.toMatchObject({ response });

    expect(loggerMocks.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'slow_response',
        responseStatus: 200,
        elapsedMs: 4_001,
      })
    );
  });
});
