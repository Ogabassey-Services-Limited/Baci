import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: vi.fn((url: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers);
    if (options.body && typeof options.body === 'string') {
      headers.set('Content-Type', 'application/json');
    }
    headers.set('x-csrf-token', 'mock-csrf');

    return fetch(url, {
      ...options,
      headers: Object.fromEntries(headers.entries()),
      credentials: 'include',
    });
  }),
}));

import {
  connectWithToken,
  disconnectIntegration,
  syncOrders,
  useJumiaIntegrations,
} from './use-jumia-integrations';

describe('useJumiaIntegrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('fetches integrations on mount and sets loading to false', async () => {
    const mockIntegrations = [
      {
        id: 'int-1',
        shop_id: 'shop-1',
        shop_name: 'Test Shop',
        country_code: 'NG',
        is_active: true,
        last_sync_at: null,
        sync_error: null,
      },
    ];

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ integrations: mockIntegrations }),
    } as Response);

    const { result } = renderHook(() => useJumiaIntegrations());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.integrations).toEqual(mockIntegrations);
    expect(result.current.error).toBeNull();
  });

  it('sets error when fetch response is not ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    } as Response);

    const { result } = renderHook(() => useJumiaIntegrations());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.integrations).toEqual([]);
    expect(result.current.error).toBe('Failed to load integrations (500)');
  });

  it('sets error when fetch throws a network error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useJumiaIntegrations());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.integrations).toEqual([]);
    expect(result.current.error).toBe(
      'Failed to load integrations — please try again'
    );
  });

  it('defaults to empty array when response has no integrations key', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    } as Response);

    const { result } = renderHook(() => useJumiaIntegrations());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.integrations).toEqual([]);
  });

  it('refetch re-fetches data and clears previous error', async () => {
    // Initial fetch fails
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: () => Promise.resolve({}),
    } as Response);

    const { result } = renderHook(() => useJumiaIntegrations());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to load integrations (503)');

    // Refetch succeeds
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ integrations: [] }),
    } as Response);

    await result.current.refetch();

    await waitFor(() => {
      expect(result.current.error).toBeNull();
    });
    expect(result.current.integrations).toEqual([]);
  });
});

describe('connectWithToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns ok true on successful connection', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'new-int' }),
    } as Response);

    const result = await connectWithToken('my-token', 'My Shop');

    expect(result).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith(
      '/api/marketplace/jumia/connect',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: {
          'x-csrf-token': 'mock-csrf',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          connectionType: 'self_authorization',
          refreshToken: 'my-token',
          shopName: 'My Shop',
          countryCode: 'NG',
        }),
      })
    );
  });

  it('trims token and shop name', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    } as Response);

    await connectWithToken('  token-with-spaces  ', '  Shop Name  ');

    const callBody = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string
    );
    expect(callBody.refreshToken).toBe('token-with-spaces');
    expect(callBody.shopName).toBe('Shop Name');
  });

  it('uses default shop name when empty string is provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    } as Response);

    await connectWithToken('token', '   ');

    const callBody = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string
    );
    expect(callBody.shopName).toBe('My Jumia Shop');
  });

  it('returns error from response body on failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Invalid token' }),
    } as Response);

    const result = await connectWithToken('bad-token', 'Shop');

    expect(result).toEqual({ ok: false, error: 'Invalid token' });
  });

  it('returns fallback error when response body has no error field', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({}),
    } as Response);

    const result = await connectWithToken('bad-token', 'Shop');

    expect(result).toEqual({ ok: false, error: 'Connection failed' });
  });

  it('returns error on network failure', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

    const result = await connectWithToken('token', 'Shop');

    expect(result).toEqual({
      ok: false,
      error: 'Connection failed — please try again',
    });
  });
});

describe('disconnectIntegration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns ok true on successful disconnect', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    } as Response);

    const result = await disconnectIntegration('id with spaces');

    expect(result).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith(
      '/api/marketplace/jumia/connect?id=id%20with%20spaces',
      {
        method: 'DELETE',
        headers: { 'x-csrf-token': 'mock-csrf' },
        credentials: 'include',
      }
    );
  });

  it('returns error when response is not ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
    } as Response);

    const result = await disconnectIntegration('int-1');

    expect(result).toEqual({ ok: false, error: 'Failed to disconnect' });
  });

  it('returns error on network failure', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

    const result = await disconnectIntegration('int-1');

    expect(result).toEqual({ ok: false, error: 'Failed to disconnect' });
  });
});

describe('syncOrders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns ok true with sync message on success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ synced: 10, newOrders: 3 }),
    } as Response);

    const result = await syncOrders('int-1');

    expect(result).toEqual({
      ok: true,
      message: 'Synced 10 orders (3 new)',
    });
  });

  it('encodes the integration ID in the URL', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ synced: 0, newOrders: 0 }),
    } as Response);

    await syncOrders('id with spaces');

    expect(fetch).toHaveBeenCalledWith(
      '/api/marketplace/jumia/orders?integrationId=id%20with%20spaces',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('returns error with details when response includes details', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () =>
        Promise.resolve({
          error: 'Token expired',
          details: 'Refresh token is no longer valid',
        }),
    } as Response);

    const result = await syncOrders('int-1');

    expect(result).toEqual({
      ok: false,
      error: 'Token expired\nDetails: Refresh token is no longer valid',
    });
  });

  it('returns error without details when response has no details', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Rate limited' }),
    } as Response);

    const result = await syncOrders('int-1');

    expect(result).toEqual({ ok: false, error: 'Rate limited' });
  });

  it('returns fallback error when response has no error field', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({}),
    } as Response);

    const result = await syncOrders('int-1');

    expect(result).toEqual({ ok: false, error: 'Sync failed' });
  });

  it('returns error on network failure', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

    const result = await syncOrders('int-1');

    expect(result).toEqual({
      ok: false,
      error: 'Sync failed — please try again',
    });
  });
});
