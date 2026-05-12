import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AD_SETTINGS } from './types';

// --- Module Mocks (hoisted before all imports) ---

const mockSupabaseClient = {
  from: vi.fn(),
  auth: {
    getUser: vi.fn(),
  },
};

const mockMerchant = {
  merchant: {
    id: 'merchant-123',
    business_name: 'Test Store',
  },
};

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabaseClient,
}));

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchantSafe: () => mockMerchant,
}));

// --- Import after all mocks ---
import {
  AdSettingsProvider,
  useAdSettings,
  useAdSettingsSafe,
} from './use-ad-settings';

describe('AdSettingsProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }, // Not found
      }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    });
  });

  it('renders children successfully', () => {
    const { result } = renderHook(() => <div>Test</div>, {
      wrapper: ({ children }) => (
        <AdSettingsProvider>{children}</AdSettingsProvider>
      ),
    });

    expect(result.current).toBeDefined();
  });

  it('loads default settings when no data exists', async () => {
    const { result } = renderHook(() => useAdSettings(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <AdSettingsProvider>{children}</AdSettingsProvider>
      ),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.settings).toEqual(DEFAULT_AD_SETTINGS);
    expect(result.current.tier).toBe('starter');
    expect(result.current.error).toBeNull();
  });

  it('loads settings from database when they exist', async () => {
    const mockSettings = {
      enabled: true,
      network_code: '123456',
      adsense_id: 'ca-pub-123',
      provider: 'adsense',
      revenue_share_percent: 30,
      test_mode: false,
      max_ads_per_page: 5,
      min_content_between_ads: 300,
      track_impressions: true,
      track_clicks: true,
      gdpr_compliant: true,
      ccpa_compliant: true,
      show_ad_labels: true,
      ad_tier: 'growth',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    const mockPlacements = [
      {
        placement_key: 'HEADER_LEADERBOARD',
        enabled: true,
        custom_ad_unit_id: null,
        custom_sizes: null,
        frequency: 1,
      },
    ];

    const mockRewardedSettings = {
      enabled: true,
      reward_type: 'discount_percent',
      reward_value: 10,
      reward_expiry_days: 30,
      min_order_value: null,
    };

    mockSupabaseClient.from.mockImplementation((table: string) => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(),
      };

      if (table === 'merchant_ad_settings') {
        chain.single.mockResolvedValue({
          data: mockSettings,
          error: null,
        });
      } else if (table === 'merchant_ad_placements') {
        chain.single.mockResolvedValue({
          data: mockPlacements,
          error: null,
        });
        return {
          ...chain,
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: mockPlacements,
            error: null,
          }),
        };
      } else if (table === 'merchant_rewarded_ad_settings') {
        chain.single.mockResolvedValue({
          data: mockRewardedSettings,
          error: null,
        });
      }

      return chain;
    });

    const { result } = renderHook(() => useAdSettings(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <AdSettingsProvider>{children}</AdSettingsProvider>
      ),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.settings?.enabled).toBe(true);
    expect(result.current.settings?.credentials.networkCode).toBe('123456');
    expect(result.current.tier).toBe('growth');
  });

  it('updates main settings successfully', async () => {
    const { result } = renderHook(() => useAdSettings(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <AdSettingsProvider>{children}</AdSettingsProvider>
      ),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    mockSupabaseClient.from.mockReturnValue({
      upsert: upsertMock,
    });

    await result.current.updateSettings({ enabled: true });

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        merchant_id: 'merchant-123',
        enabled: true,
      }),
      expect.any(Object)
    );
  });

  it('updates placement settings successfully', async () => {
    const { result } = renderHook(() => useAdSettings(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <AdSettingsProvider>{children}</AdSettingsProvider>
      ),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    mockSupabaseClient.from.mockReturnValue({
      upsert: upsertMock,
    });

    await result.current.updatePlacement('HEADER_LEADERBOARD', {
      enabled: true,
    });

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        merchant_id: 'merchant-123',
        placement_key: 'HEADER_LEADERBOARD',
        enabled: true,
      }),
      expect.any(Object)
    );
  });

  it('updates rewarded ad settings successfully', async () => {
    const { result } = renderHook(() => useAdSettings(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <AdSettingsProvider>{children}</AdSettingsProvider>
      ),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    mockSupabaseClient.from.mockReturnValue({
      upsert: upsertMock,
    });

    await result.current.updateRewardedAd({ enabled: true, rewardValue: 15 });

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        merchant_id: 'merchant-123',
        enabled: true,
        reward_value: 15,
      }),
      expect.any(Object)
    );
  });

  it('handles database errors gracefully', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      }),
    });

    const { result } = renderHook(() => useAdSettings(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <AdSettingsProvider>{children}</AdSettingsProvider>
      ),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to load ad settings');
    expect(result.current.settings).toEqual(DEFAULT_AD_SETTINGS);

    consoleErrorSpy.mockRestore();
  });

  it('checks if placement is enabled correctly', async () => {
    const mockPlacements = [
      {
        placement_key: 'HEADER_LEADERBOARD',
        enabled: true,
        custom_ad_unit_id: null,
        custom_sizes: null,
        frequency: 1,
      },
    ];

    const mockMainSettings = {
      enabled: true,
      network_code: null,
      adsense_id: null,
      provider: 'adsense',
      revenue_share_percent: 30,
      test_mode: false,
      max_ads_per_page: 5,
      min_content_between_ads: 300,
      track_impressions: true,
      track_clicks: true,
      gdpr_compliant: true,
      ccpa_compliant: true,
      show_ad_labels: true,
      ad_tier: 'starter',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'merchant_ad_placements') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: mockPlacements,
              error: null,
            }),
          }),
        };
      }
      if (table === 'merchant_ad_settings') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockMainSettings,
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      };
    });

    const { result } = renderHook(() => useAdSettings(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <AdSettingsProvider>{children}</AdSettingsProvider>
      ),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await waitFor(() => {
      expect(result.current.settings?.placements).toBeDefined();
    });

    expect(result.current.isPlacementEnabled('HEADER_LEADERBOARD')).toBe(true);
    expect(result.current.isPlacementEnabled('FOOTER_BANNER')).toBe(false);
  });

  it('counts enabled placements correctly', async () => {
    const mockPlacements = [
      {
        placement_key: 'HEADER_LEADERBOARD',
        enabled: true,
        custom_ad_unit_id: null,
        custom_sizes: null,
        frequency: 1,
      },
      {
        placement_key: 'FOOTER_BANNER',
        enabled: true,
        custom_ad_unit_id: null,
        custom_sizes: null,
        frequency: 1,
      },
      {
        placement_key: 'SIDEBAR_HALF_PAGE',
        enabled: false,
        custom_ad_unit_id: null,
        custom_sizes: null,
        frequency: 1,
      },
    ];

    const mockMainSettings = {
      enabled: true,
      network_code: null,
      adsense_id: null,
      provider: 'adsense',
      revenue_share_percent: 30,
      test_mode: false,
      max_ads_per_page: 5,
      min_content_between_ads: 300,
      track_impressions: true,
      track_clicks: true,
      gdpr_compliant: true,
      ccpa_compliant: true,
      show_ad_labels: true,
      ad_tier: 'starter',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'merchant_ad_placements') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: mockPlacements,
              error: null,
            }),
          }),
        };
      }
      if (table === 'merchant_ad_settings') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockMainSettings,
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      };
    });

    const { result } = renderHook(() => useAdSettings(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <AdSettingsProvider>{children}</AdSettingsProvider>
      ),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await waitFor(() => {
      expect(result.current.getEnabledPlacementCount()).toBe(2);
    });
  });

  it('prevents enabling more placements than tier allows', async () => {
    const mockPlacements = [
      {
        placement_key: 'HEADER_LEADERBOARD',
        enabled: true,
        custom_ad_unit_id: null,
        custom_sizes: null,
        frequency: 1,
      },
      {
        placement_key: 'FOOTER_BANNER',
        enabled: true,
        custom_ad_unit_id: null,
        custom_sizes: null,
        frequency: 1,
      },
      {
        placement_key: 'SIDEBAR_HALF_PAGE',
        enabled: true,
        custom_ad_unit_id: null,
        custom_sizes: null,
        frequency: 1,
      },
    ];

    const mockMainSettings = {
      enabled: true,
      network_code: null,
      adsense_id: null,
      provider: 'adsense',
      revenue_share_percent: 30,
      test_mode: false,
      max_ads_per_page: 5,
      min_content_between_ads: 300,
      track_impressions: true,
      track_clicks: true,
      gdpr_compliant: true,
      ccpa_compliant: true,
      show_ad_labels: true,
      ad_tier: 'starter',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'merchant_ad_placements') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: mockPlacements,
              error: null,
            }),
          }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      if (table === 'merchant_ad_settings') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockMainSettings,
                error: null,
              }),
            }),
          }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
        upsert: vi.fn().mockResolvedValue({ error: null }),
      };
    });

    const { result } = renderHook(() => useAdSettings(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <AdSettingsProvider>{children}</AdSettingsProvider>
      ),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await waitFor(() => {
      expect(result.current.getEnabledPlacementCount()).toBe(3);
    });

    // Starter tier allows max 3 placements
    expect(result.current.tier).toBe('starter');
    expect(result.current.canEnableMorePlacements()).toBe(false);

    // Try to enable another placement - should throw error
    await expect(
      result.current.updatePlacement('CART_MPU', { enabled: true })
    ).rejects.toThrow('Cannot enable more placements on current tier');
  });

  it('reloads settings successfully', async () => {
    const { result } = renderHook(() => useAdSettings(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <AdSettingsProvider>{children}</AdSettingsProvider>
      ),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Change the mock to return different data
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'merchant_ad_settings') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { enabled: true, ad_tier: 'pro' },
            error: null,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      };
    });

    await result.current.reloadSettings();

    await waitFor(() => {
      expect(result.current.tier).toBe('pro');
    });
  });
});

describe('useAdSettings hook', () => {
  it('throws error when used outside provider', () => {
    expect(() => {
      renderHook(() => useAdSettings());
    }).toThrow('useAdSettings must be used within an AdSettingsProvider');
  });
});

describe('useAdSettingsSafe hook', () => {
  it('returns null when used outside provider', () => {
    const { result } = renderHook(() => useAdSettingsSafe());
    expect(result.current).toBeNull();
  });

  it('returns context when used inside provider', async () => {
    const { result } = renderHook(() => useAdSettingsSafe(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <AdSettingsProvider>{children}</AdSettingsProvider>
      ),
    });

    await waitFor(() => {
      expect(result.current?.loading).toBe(false);
    });

    expect(result.current).not.toBeNull();
    expect(result.current?.settings).toBeDefined();
  });
});
