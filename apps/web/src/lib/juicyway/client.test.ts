import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// Use dynamic import so we can manipulate env before each test
describe('juicywayRequest', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('JUICYWAY_BASE_URL', 'https://sandbox.spendjuice.com');
    vi.stubEnv('JUICYWAY_SECRET_KEY', 'sk_test_secret');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  async function loadClient() {
    const mod = await import('./client');
    return mod;
  }

  it('returns CONFIG_ERROR when secret key is empty', async () => {
    vi.stubEnv('JUICYWAY_SECRET_KEY', '');
    const { juicywayRequest } = await loadClient();

    const result = await juicywayRequest('/test');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('CONFIG_ERROR');
      expect(result.error).toContain('not configured');
    }
  });

  it('sends correct headers and returns data on success', async () => {
    const { juicywayRequest } = await loadClient();
    const mockResponse = { id: 'pay_123', status: 'pending' };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await juicywayRequest('/payment-sessions', {
      method: 'POST',
      body: JSON.stringify({ amount: 1000 }),
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(mockResponse);
    }

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://sandbox.spendjuice.com/payment-sessions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'sk_test_secret',
        }),
      })
    );
  });

  it('returns error with HTTP status code on non-ok response', async () => {
    const { juicywayRequest } = await loadClient();

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: () => Promise.resolve({ message: 'Validation failed' }),
    });

    const result = await juicywayRequest('/payment-sessions');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Validation failed');
      expect(result.code).toBe('HTTP_422');
    }
  });

  it('returns generic error message when API error has no message', async () => {
    const { juicywayRequest } = await loadClient();

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    });

    const result = await juicywayRequest('/payments/abc');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('API request failed: 500');
      expect(result.code).toBe('HTTP_500');
    }
  });

  it('returns NETWORK_ERROR on fetch exception', async () => {
    const { juicywayRequest } = await loadClient();

    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new Error('DNS resolution failed'));

    const result = await juicywayRequest('/payments/xyz');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('DNS resolution failed');
      expect(result.code).toBe('NETWORK_ERROR');
    }
  });

  it('returns generic network error for non-Error exceptions', async () => {
    const { juicywayRequest } = await loadClient();

    globalThis.fetch = vi.fn().mockRejectedValue('Connection refused');

    const result = await juicywayRequest('/payments/xyz');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Network error');
      expect(result.code).toBe('NETWORK_ERROR');
    }
  });

  it('merges custom headers with defaults', async () => {
    const { juicywayRequest } = await loadClient();

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true }),
    });

    await juicywayRequest('/test', {
      headers: { 'X-Custom': 'value' },
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'sk_test_secret',
          'X-Custom': 'value',
        }),
      })
    );
  });
});
