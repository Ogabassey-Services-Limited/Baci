import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendGA4Event } from './ga4-measurement-protocol';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('sendGA4Event', () => {
  it('composes the caller abort signal with the provider timeout', async () => {
    const timeoutController = new AbortController();
    const timeoutSpy = vi
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(timeoutController.signal);
    const anySpy = vi.spyOn(AbortSignal, 'any');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal('fetch', fetchMock);
    const callerController = new AbortController();

    await sendGA4Event(
      'G-TEST',
      'secret',
      'page_view',
      { clientId: 'client-1' },
      {},
      false,
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

  it('encodes configured values as distinct query parameters', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal('fetch', fetchMock);
    const measurementId = 'G TEST/&';
    const apiSecret = 'api secret/?&="\\path';

    await sendGA4Event(measurementId, apiSecret, 'page_view', {
      clientId: 'client-1',
    });

    const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requestUrl.searchParams.get('measurement_id')).toBe(measurementId);
    expect(requestUrl.searchParams.get('api_secret')).toBe(apiSecret);
  });

  it('returns an HTTP failure without throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 503 })
    );

    const result = await sendGA4Event('G-TEST', 'secret', 'page_view', {
      clientId: 'client-1',
    });

    expect(result).toEqual({ error: 'HTTP 503', success: false });
  });

  it('redacts configured values from network errors and logs', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('G-SECRET api-secret'))
    );

    const result = await sendGA4Event('G-SECRET', 'api-secret', 'page_view', {
      clientId: 'client-1',
    });
    const observable = JSON.stringify({
      logs: consoleError.mock.calls,
      result,
    });

    expect(result).toEqual({
      error: '[redacted] [redacted]',
      success: false,
    });
    expect(observable).not.toContain('G-SECRET');
    expect(observable).not.toContain('api-secret');
  });

  it('projects a successful debug response to safe validation fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({
          api_secret: 'api-secret',
          measurement_id: 'G-SECRET',
          validationMessages: [],
          vendor_payload: { credential: 'api-secret' },
        }),
        ok: true,
        status: 200,
      })
    );

    const result = await sendGA4Event(
      'G-SECRET',
      'api-secret',
      'page_view',
      { clientId: 'client-1' },
      {},
      true
    );

    expect(result).toEqual({
      debugInfo: { validationMessages: [] },
      success: true,
    });
    expect(JSON.stringify(result)).not.toContain('G-SECRET');
    expect(JSON.stringify(result)).not.toContain('api-secret');
    expect(JSON.stringify(result)).not.toContain('vendor_payload');
  });

  it('sanitizes projected debug validation messages', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({
          api_secret: 'api-secret',
          validationMessages: [
            {
              api_secret: 'api-secret',
              description: 'Rejected G-SECRET api-secret',
              fieldPath: 'events[0].params.currency',
              validationCode: 'VALUE_INVALID',
            },
          ],
        }),
        ok: false,
        status: 400,
      })
    );

    const result = await sendGA4Event(
      'G-SECRET',
      'api-secret',
      'purchase',
      { clientId: 'client-1' },
      {},
      true
    );

    expect(result).toEqual({
      debugInfo: {
        validationMessages: [
          {
            description: 'Rejected [redacted] [redacted]',
            fieldPath: 'events[0].params.currency',
            validationCode: 'VALUE_INVALID',
          },
        ],
      },
      success: false,
    });
    expect(JSON.stringify(result)).not.toContain('G-SECRET');
    expect(JSON.stringify(result)).not.toContain('api-secret');
  });

  it('does not accept an HTTP failure with empty debug validation messages', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({ validationMessages: [] }),
        ok: false,
        status: 503,
      })
    );

    const result = await sendGA4Event(
      'G-TEST',
      'secret',
      'page_view',
      { clientId: 'client-1' },
      {},
      true
    );

    expect(result).toEqual({
      debugInfo: { validationMessages: [] },
      success: false,
    });
  });

  it('puts a durable event timestamp on the GA4 event envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal('fetch', fetchMock);

    await sendGA4Event(
      'G-TEST',
      'secret',
      'purchase',
      { clientId: 'client-1' },
      {},
      false,
      undefined,
      1_783_857_600_000_000
    );

    const payload = JSON.parse(fetchMock.mock.calls[0]?.[1].body as string);
    expect(payload.events[0].timestamp_micros).toBe(1_783_857_600_000_000);
    expect(payload.events[0].params).not.toHaveProperty('timestamp_micros');
  });

  it('serializes an IP override as GA4 request metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal('fetch', fetchMock);

    await sendGA4Event('G-TEST', 'secret', 'page_view', {
      clientId: 'client-1',
      ipAddress: '203.0.113.1',
    });

    const payload = JSON.parse(fetchMock.mock.calls[0]?.[1].body as string);
    expect(payload.ip_override).toBe('203.0.113.1');
    expect(payload).not.toHaveProperty('user_properties');
  });
});
