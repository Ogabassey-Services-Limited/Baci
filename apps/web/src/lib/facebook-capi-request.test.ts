import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendFacebookCAPIEvent } from './facebook-capi-request';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('sendFacebookCAPIEvent credential safety', () => {
  it('composes the caller abort signal with the provider timeout', async () => {
    const callerController = new AbortController();
    const timeoutController = new AbortController();
    const timeoutSpy = vi
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(timeoutController.signal);
    const anySpy = vi.spyOn(AbortSignal, 'any');
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ events_received: 1 }),
      ok: true,
      status: 200,
    });
    vi.stubGlobal('fetch', fetchMock);

    await sendFacebookCAPIEvent(
      'pixel-1',
      'token-1',
      'PageView',
      {},
      undefined,
      undefined,
      undefined,
      undefined,
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

  it('redacts configured identifiers from provider errors and logs', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({
          error: {
            message: 'pixel-1 token-1',
            type: 'token-1',
          },
        }),
        ok: false,
        status: 401,
      })
    );

    const result = await sendFacebookCAPIEvent(
      'pixel-1',
      'token-1',
      'PageView',
      {}
    );
    const observable = JSON.stringify({
      logs: consoleError.mock.calls,
      result,
    });

    expect(result).toEqual({
      error: '[redacted] [redacted]',
      httpStatus: 401,
      success: false,
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

    const result = await sendFacebookCAPIEvent(
      'pixel-1',
      'token-1',
      'PageView',
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

  it('does not read or send environment test event codes', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('FB_TEST_EVENT_CODE', 'test-code');
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ events_received: 1 }),
      ok: true,
    });
    vi.stubGlobal('fetch', fetchMock);

    await sendFacebookCAPIEvent('pixel-1', 'token-1', 'PageView', {});

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).not.toHaveProperty('test_event_code');
    expect(JSON.stringify(body)).not.toContain('test-code');
  });

  it('projects successful provider responses to known safe fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({
          access_token: 'token-1',
          events_received: 1,
          messages: ['token-1'],
          vendor_secret: 'do-not-return',
        }),
        ok: true,
      })
    );

    const result = await sendFacebookCAPIEvent(
      'pixel-1',
      'token-1',
      'PageView',
      {}
    );

    expect(result).toEqual({
      response: { events_received: 1 },
      success: true,
    });
    expect(JSON.stringify(result)).not.toContain('token-1');
    expect(JSON.stringify(result)).not.toContain('do-not-return');
  });

  it('retains the HTTP status and uses a safe fallback for non-JSON failures', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        text: vi.fn().mockResolvedValue('<html>token-1</html>'),
      })
    );

    const result = await sendFacebookCAPIEvent(
      'pixel-1',
      'token-1',
      'PageView',
      {}
    );

    expect(result).toEqual({
      error: 'Facebook CAPI returned HTTP 502',
      httpStatus: 502,
      success: false,
    });
    expect(JSON.stringify(result)).not.toContain('token-1');
  });

  it('fails closed when a successful HTTP response is malformed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(''),
      })
    );

    const result = await sendFacebookCAPIEvent(
      'pixel-1',
      'token-1',
      'PageView',
      {}
    );

    expect(result).toEqual({
      error: 'Malformed Facebook CAPI response',
      httpStatus: 200,
      success: false,
    });
  });
});
