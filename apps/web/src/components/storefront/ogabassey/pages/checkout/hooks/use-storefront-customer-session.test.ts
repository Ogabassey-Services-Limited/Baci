import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useStorefrontCustomerSession } from './use-storefront-customer-session';

function stubFetch(response: { body: unknown; ok?: boolean }) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: response.ok ?? true,
    json: async () => response.body,
  } as Response);
}

describe('useStorefrontCustomerSession', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports a signed-in customer when the session endpoint says authenticated', async () => {
    const fetchMock = stubFetch({ body: { authenticated: true } });

    const { result } = renderHook(() =>
      useStorefrontCustomerSession('test-store')
    );

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/storefront/auth/session?merchantSlug=test-store',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('stays unauthenticated for a guest session', async () => {
    stubFetch({ body: { authenticated: false } });

    const { result } = renderHook(() =>
      useStorefrontCustomerSession('test-store')
    );

    // Give the effect a tick to resolve; the default and result are both false.
    await Promise.resolve();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('treats a non-OK response as unauthenticated without throwing', async () => {
    stubFetch({ body: {}, ok: false });

    const { result } = renderHook(() =>
      useStorefrontCustomerSession('test-store')
    );

    await Promise.resolve();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('does not fetch and stays unauthenticated without a merchant slug', () => {
    const fetchMock = stubFetch({ body: { authenticated: true } });

    const { result } = renderHook(() =>
      useStorefrontCustomerSession(undefined)
    );

    expect(result.current.isAuthenticated).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
