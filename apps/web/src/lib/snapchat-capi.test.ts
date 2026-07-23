import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendSnapchatEvent } from './snapchat-capi';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('sendSnapchatEvent', () => {
  it('composes the caller abort signal with the provider timeout', async () => {
    const timeoutController = new AbortController();
    const timeoutSpy = vi
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(timeoutController.signal);
    const anySpy = vi.spyOn(AbortSignal, 'any');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const callerController = new AbortController();

    await sendSnapchatEvent(
      'pixel-1',
      'token-1',
      'VIEW_CONTENT',
      {},
      {},
      'event-1',
      callerController.signal
    );

    const requestSignal = fetchMock.mock.calls[0]?.[1]?.signal as AbortSignal;
    expect(timeoutSpy).toHaveBeenCalledWith(10_000);
    expect(anySpy).toHaveBeenCalledWith([
      callerController.signal,
      timeoutController.signal,
    ]);
    expect(requestSignal).not.toBe(callerController.signal);

    callerController.abort('caller-abort');

    expect(requestSignal.aborted).toBe(true);
    expect(requestSignal.reason).toBe('caller-abort');
  });

  it('returns a deterministic provider rejection', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue('pixel-1 token-1'),
      })
    );

    const result = await sendSnapchatEvent(
      'pixel-1',
      'token-1',
      'VIEW_CONTENT',
      {}
    );

    expect(result).toEqual({
      error: '[redacted] [redacted]',
      httpStatus: 400,
      success: false,
    });
    const observable = JSON.stringify({
      logs: consoleError.mock.calls,
      result,
    });
    expect(observable).not.toContain('pixel-1');
    expect(observable).not.toContain('token-1');
  });

  it('redacts configured identifiers from network errors and logs', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('pixel-1 token-1'))
    );

    const result = await sendSnapchatEvent(
      'pixel-1',
      'token-1',
      'VIEW_CONTENT',
      {}
    );
    const observable = JSON.stringify({
      logs: consoleError.mock.calls,
      result,
    });

    expect(result).toEqual({
      error: '[redacted] [redacted]',
      success: false,
    });
    expect(observable).not.toContain('pixel-1');
    expect(observable).not.toContain('token-1');
  });
});
