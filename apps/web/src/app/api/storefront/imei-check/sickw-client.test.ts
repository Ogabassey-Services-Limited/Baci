import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sickwClient } from './sickw-client';

describe('sickwClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('reads a configured API key from the environment', () => {
    vi.stubEnv('SICKW_API_KEY', ' test-key ');

    expect(sickwClient.getApiKey()).toBe('test-key');
  });

  it('normalizes provider result payloads for the parser', () => {
    expect(sickwClient.normalizeResult('Model Name: iPhone')).toBe(
      'Model Name: iPhone'
    );
    expect(sickwClient.normalizeResult({ 'Model Name': 'iPhone' })).toEqual({
      'Model Name': 'iPhone',
    });
    expect(sickwClient.normalizeResult(null)).toBe('');
  });

  it('requests the selected service through SICKW', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({ result: 'Model Name: Xiaomi 14', status: 'success' })
        ),
    } as Response);

    const result = await sickwClient.requestCheck({
      apiKey: 'test-key',
      imei: '354442067957452',
      serviceId: '206',
    });

    expect(result).toMatchObject({
      ok: true,
      payload: { result: 'Model Name: Xiaomi 14', status: 'success' },
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('service=206'),
      expect.objectContaining({
        headers: { 'User-Agent': 'Baci-IMEI-Checker/1.0' },
        method: 'GET',
      })
    );
  });

  it('maps provider invalid-imei errors to a safe response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({ result: 'Error: invalid imei', status: 'error' })
        ),
    } as Response);

    const result = await sickwClient.requestCheck({
      apiKey: 'test-key',
      imei: '354442067957452',
      serviceId: '61',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      await expect(result.response.json()).resolves.toEqual({
        error: 'Invalid IMEI number',
        success: false,
      });
    }
  });

  it('maps provider balance errors to service unavailable', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            result: 'Error: Insufficient balance',
            status: 'error',
          })
        ),
    } as Response);

    const result = await sickwClient.requestCheck({
      apiKey: 'test-key',
      imei: '354442067957452',
      serviceId: '61',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(503);
      await expect(result.response.json()).resolves.toEqual({
        error: 'Service temporarily unavailable',
        success: false,
      });
    }
  });

  it('maps upstream request failures to service unavailable', async () => {
    const timeoutError = new Error('Request timed out');
    timeoutError.name = 'TimeoutError';
    vi.mocked(fetch).mockRejectedValueOnce(timeoutError);

    const result = await sickwClient.requestCheck({
      apiKey: 'test-key',
      imei: '354442067957452',
      serviceId: '61',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(503);
      await expect(result.response.json()).resolves.toEqual({
        error: 'IMEI check service unavailable',
        success: false,
      });
    }
  });

  it('maps non-OK upstream responses to service unavailable', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
    } as Response);

    const result = await sickwClient.requestCheck({
      apiKey: 'test-key',
      imei: '354442067957452',
      serviceId: '61',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(503);
      await expect(result.response.json()).resolves.toEqual({
        error: 'IMEI check service unavailable',
        success: false,
      });
    }
  });
});
