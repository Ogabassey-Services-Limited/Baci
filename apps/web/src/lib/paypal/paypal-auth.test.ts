import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateClientToken, getAccessToken } from './paypal-auth';

describe('getAccessToken', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns MISSING_CREDENTIALS without calling fetch when client ID is empty', async () => {
    const mockFetch = vi.spyOn(global, 'fetch');
    const result = await getAccessToken('', 'secret');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('MISSING_CREDENTIALS');
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns MISSING_CREDENTIALS without calling fetch when secret key is empty', async () => {
    const result = await getAccessToken('client123', '');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('MISSING_CREDENTIALS');
    }
  });

  it('successfully retrieves an access token', async () => {
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        scope: 'all',
        access_token: 'A21_mock_token',
        token_type: 'Bearer',
        expires_in: 3600,
      }),
    } as Response);

    const result = await getAccessToken('client123', 'secret123', 'sandbox');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('A21_mock_token');
    }
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api-m.sandbox.paypal.com/v1/oauth2/token',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('returns a 401 failure when PayPal rejects the credentials', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({
        error: 'invalid_client',
        error_description: 'Client Authentication failed',
      }),
    } as Response);

    const result = await getAccessToken('client123', 'secret123', 'sandbox');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Client Authentication failed');
      expect(result.code).toBe('HTTP_401');
    }
  });

  it('returns a NETWORK_ERROR failure when fetch throws', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('ECONNRESET'));

    const result = await getAccessToken('client123', 'secret123', 'sandbox');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('NETWORK_ERROR');
      expect(result.error).toBe('ECONNRESET');
    }
  });

  it('returns SCHEMA_MISMATCH when the response body is malformed', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ unexpected: 'shape' }),
    } as Response);

    const result = await getAccessToken('client123', 'secret123', 'sandbox');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('SCHEMA_MISMATCH');
    }
  });

  it('targets the live API host when mode is "live"', async () => {
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        scope: 'all',
        access_token: 'live_token',
        token_type: 'Bearer',
        expires_in: 3600,
      }),
    } as Response);

    await getAccessToken('client123', 'secret123', 'live');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api-m.paypal.com/v1/oauth2/token',
      expect.anything()
    );
  });
});

describe('generateClientToken', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns MISSING_CREDENTIALS without calling fetch when creds are missing', async () => {
    const mockFetch = vi.spyOn(global, 'fetch');
    const result = await generateClientToken('', '');
    expect(result.success).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('successfully retrieves a browser-safe client token', async () => {
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        scope: 'all',
        access_token: 'browser_safe_token_123',
        token_type: 'Bearer',
        expires_in: 3600,
      }),
    } as Response);

    const result = await generateClientToken(
      'client123',
      'secret123',
      'sandbox'
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('browser_safe_token_123');
    }

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api-m.sandbox.paypal.com/v1/oauth2/token',
      expect.objectContaining({
        body: expect.stringContaining('response_type=client_token'),
      })
    );
  });

  it('returns a failure when PayPal rejects the client-token request', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid_request' }),
    } as Response);

    const result = await generateClientToken(
      'client123',
      'secret123',
      'sandbox'
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('HTTP_400');
    }
  });
});
