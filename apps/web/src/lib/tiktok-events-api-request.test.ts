import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendTikTokEvent } from './tiktok-events-api-request';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('sendTikTokEvent credential safety', () => {
  it('composes the caller abort signal with the provider timeout', async () => {
    const callerController = new AbortController();
    const timeoutController = new AbortController();
    const timeoutSpy = vi
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(timeoutController.signal);
    const anySpy = vi.spyOn(AbortSignal, 'any');
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ code: 0, message: 'OK' }),
      ok: true,
      status: 200,
    });
    vi.stubGlobal('fetch', fetchMock);

    await sendTikTokEvent(
      'pixel-1',
      'token-1',
      'ViewContent',
      {},
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
          message: 'TikTok token-1 test-code',
        }),
        ok: false,
        status: 401,
      })
    );

    const result = await sendTikTokEvent(
      'TikTok',
      'token-1',
      'ViewContent',
      {},
      {},
      { testEventCode: 'test-code' }
    );
    const observable = JSON.stringify({
      logs: consoleError.mock.calls,
      result,
    });

    expect(result).toEqual({
      error: '[redacted] [redacted] [redacted]',
      httpStatus: 401,
      success: false,
    });
    expect(observable).not.toContain('TikTok');
    expect(observable).not.toContain('token-1');
    expect(observable).not.toContain('test-code');
  });

  it('redacts configured identifiers from network errors and logs', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('pixel-1 token-1 test-code'))
    );

    const result = await sendTikTokEvent(
      'pixel-1',
      'token-1',
      'ViewContent',
      {},
      {},
      { testEventCode: 'test-code' }
    );
    const observable = JSON.stringify({
      logs: consoleError.mock.calls,
      result,
    });

    expect(result).toEqual({
      error: '[redacted] [redacted] [redacted]',
      success: false,
    });
    expect(observable).not.toContain('pixel-1');
    expect(observable).not.toContain('token-1');
    expect(observable).not.toContain('test-code');
  });

  it('does not leak a JSON-escaped configured value in provider logs', async () => {
    const accessToken = 'token"\\segment';
    const escapedAccessToken = JSON.stringify(accessToken).slice(1, -1);
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({ message: accessToken }),
        ok: false,
        status: 401,
      })
    );

    const result = await sendTikTokEvent(
      'pixel-1',
      accessToken,
      'ViewContent',
      {}
    );
    const logged = consoleError.mock.calls.flat().join(' ');

    expect(result).toEqual({
      error: '[redacted]',
      httpStatus: 401,
      success: false,
    });
    expect(logged).not.toContain(accessToken);
    expect(logged).not.toContain(escapedAccessToken);
  });

  it('rejects an HTTP 2xx response with a nonzero provider code', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({
          code: 40_002,
          message: 'Invalid token-1',
        }),
        ok: true,
        status: 200,
      })
    );

    const result = await sendTikTokEvent(
      'pixel-1',
      'token-1',
      'ViewContent',
      {}
    );

    expect(result).toEqual({
      error: 'Invalid [redacted]',
      httpStatus: 200,
      success: false,
    });
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('token-1');
  });

  it('fails closed when an HTTP 2xx response is not valid JSON', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
        ok: true,
        status: 200,
      })
    );

    const result = await sendTikTokEvent(
      'pixel-1',
      'token-1',
      'ViewContent',
      {}
    );

    expect(result).toEqual({
      error: 'Invalid provider response',
      httpStatus: 200,
      success: false,
    });
  });

  it.each([
    {
      eventOptions: 'event-id',
      expected: 'standalone-code',
      name: 'string options',
      standaloneCode: 'standalone-code',
    },
    {
      eventOptions: { eventId: 'event-id' },
      expected: 'standalone-code',
      name: 'object options without an embedded value',
      standaloneCode: 'standalone-code',
    },
    {
      eventOptions: undefined,
      expected: 'standalone-code',
      name: 'undefined options',
      standaloneCode: 'standalone-code',
    },
    {
      eventOptions: { testEventCode: 'embedded-code' },
      expected: 'embedded-code',
      name: 'object options with an embedded value',
      standaloneCode: 'standalone-code',
    },
  ] as const)('uses the correct test event code for $name', async ({
    eventOptions,
    expected,
    standaloneCode,
  }) => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ code: 0, message: 'OK' }),
      ok: true,
      status: 200,
    });
    vi.stubGlobal('fetch', fetchMock);

    await sendTikTokEvent(
      'pixel-1',
      'token-1',
      'ViewContent',
      {},
      undefined,
      eventOptions,
      standaloneCode
    );

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.test_event_code).toBe(expected);
  });

  it('returns only the safe success projection', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        access_token: 'token-1',
        body: { secret: 'provider-secret' },
        json: vi.fn().mockResolvedValue({ code: 0, message: 'OK' }),
        ok: true,
        status: 200,
      })
    );

    const result = await sendTikTokEvent(
      'pixel-1',
      'token-1',
      'ViewContent',
      {}
    );

    expect(result).toEqual({ success: true });
    expect(JSON.stringify(result)).not.toContain('token-1');
    expect(JSON.stringify(result)).not.toContain('provider-secret');
  });
});
