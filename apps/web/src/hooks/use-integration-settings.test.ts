import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchant: vi.fn(() => ({ merchant: { id: 'merchant-1' } })),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));

import { useIntegrationSettings } from './use-integration-settings';

describe('useIntegrationSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('fetches settings on mount when merchant is available', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ facebook_pixel_id: 'px-123' }),
    } as Response);

    const { result } = renderHook(() =>
      useIntegrationSettings<{ facebook_pixel_id: string | null }>({
        keys: ['facebook_pixel_id'],
        platformName: 'Facebook',
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.settings?.facebook_pixel_id).toBe('px-123');
  });

  it('handles fetch failure gracefully', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() =>
      useIntegrationSettings<{ pixel_id: string | null }>({
        keys: ['pixel_id'],
        platformName: 'Test',
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.settings).toBeNull();
  });

  it('reports hasMerchant as true when merchant exists', () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    } as Response);

    const { result } = renderHook(() =>
      useIntegrationSettings({ keys: [], platformName: 'Test' })
    );
    expect(result.current.hasMerchant).toBe(true);
  });
});
