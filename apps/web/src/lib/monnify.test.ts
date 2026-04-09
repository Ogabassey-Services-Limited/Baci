import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/env', () => ({
  getMonnifyApiKey: vi.fn(),
  getMonnifySecretKey: vi.fn(),
  getMonnifyBaseUrl: vi.fn(() => 'https://api.monnify.com'),
}));

vi.mock('@/ai/provider', () => ({
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
}));

import { getMonnifyApiKey, getMonnifySecretKey } from '@/env';
import * as MonnifyModule from '@/lib/monnify';

const { getMonnifyToken } = MonnifyModule;

const mockToken = 'mock-access-token-abc123';
const mockAuthResponse = {
  requestSuccessful: true,
  responseMessage: 'success',
  responseCode: '0',
  responseBody: {
    accessToken: mockToken,
    expiresIn: 3600,
  },
};

function mockFetchSuccess() {
  return vi.spyOn(global, 'fetch').mockResolvedValueOnce({
    ok: true,
    json: async () => mockAuthResponse,
  } as Response);
}

describe('getMonnifyToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MonnifyModule.clearMonnifyTokenCache();
    vi.mocked(getMonnifyApiKey).mockReturnValue('test-api-key');
    vi.mocked(getMonnifySecretKey).mockReturnValue('test-secret-key');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('throws when MONNIFY_API_KEY is not configured', async () => {
    vi.mocked(getMonnifyApiKey).mockReturnValue(undefined);

    await expect(getMonnifyToken()).rejects.toThrow(
      'Monnify credentials not configured'
    );
  });

  it('throws when MONNIFY_SECRET_KEY is not configured', async () => {
    vi.mocked(getMonnifySecretKey).mockReturnValue(undefined);

    await expect(getMonnifyToken()).rejects.toThrow(
      'Monnify credentials not configured'
    );
  });

  it('fetches a token and returns it', async () => {
    const fetchSpy = mockFetchSuccess();

    const token = await getMonnifyToken();

    expect(token).toBe(mockToken);
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.monnify.com/api/v1/auth/login',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: expect.stringContaining('Basic '),
        }),
      })
    );
  });

  it('throws when the API returns a 4xx error without retrying', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    } as Response);

    await expect(getMonnifyToken()).rejects.toThrow('invalid request');
  });

  it('throws when the API returns an error response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as Response);

    await expect(getMonnifyToken()).rejects.toThrow('Monnify auth failed: 500');
  });

  it('throws when the API returns requestSuccessful: false', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        requestSuccessful: false,
        responseMessage: 'Invalid credentials',
        responseCode: '401',
        responseBody: { accessToken: '', expiresIn: 0 },
      }),
    } as Response);

    await expect(getMonnifyToken()).rejects.toThrow('Invalid credentials');
  });

  it('returns cached token on second call without re-fetching', async () => {
    const fetchSpy = mockFetchSuccess();

    const token1 = await getMonnifyToken();
    const token2 = await getMonnifyToken();

    expect(token1).toBe(mockToken);
    expect(token2).toBe(mockToken);
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('fetches a new token when cached token has expired', async () => {
    vi.useFakeTimers();
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockAuthResponse,
          responseBody: { accessToken: 'token-1', expiresIn: 1 },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockAuthResponse,
          responseBody: { accessToken: 'token-2', expiresIn: 3600 },
        }),
      } as Response);

    const token1 = await getMonnifyToken();
    vi.advanceTimersByTime(4_000_000);
    const token2 = await getMonnifyToken();

    expect(token1).toBe('token-1');
    expect(token2).toBe('token-2');
  });
});
