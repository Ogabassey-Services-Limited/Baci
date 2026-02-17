import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLoyalty } from './use-loyalty';

describe('useLoyalty', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('does not fetch without merchantId or customerId', async () => {
    const { result } = renderHook(() => useLoyalty());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });

  it('returns mock data for preview merchants', async () => {
    const { result } = renderHook(() =>
      useLoyalty('store-preview', 'customer-1')
    );
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.enrolled).toBe(true);
    expect(result.current.pointsBalance).toBe(150);
    expect(result.current.tier).toBe('silver');
  });

  it('returns mock data for demo merchants', async () => {
    const { result } = renderHook(() => useLoyalty('demo-store', 'customer-1'));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.enrolled).toBe(true);
  });

  it('handles 404 response (loyalty not available)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);

    const { result } = renderHook(() => useLoyalty('merchant-1', 'customer-1'));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('calculatePoints returns correct value', async () => {
    const { result } = renderHook(() =>
      useLoyalty('store-preview', 'customer-1')
    );
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.calculatePoints(500)).toBe(500);
  });

  it('getTierInfo returns colors and benefits', async () => {
    const { result } = renderHook(() =>
      useLoyalty('store-preview', 'customer-1')
    );
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    const info = result.current.getTierInfo('gold');
    expect(info.colors.bg).toBe('bg-yellow-100');
    expect(info.benefits.length).toBeGreaterThan(0);
  });
});
