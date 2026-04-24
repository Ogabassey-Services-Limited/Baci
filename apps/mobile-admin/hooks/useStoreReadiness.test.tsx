import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Minimal merchant shape that satisfies the hook's reads; fields the hook
// does not touch are safe to omit.
type MerchantStub = {
  id: string;
  user_id: string;
  is_published: boolean;
  country: string | null;
  support_email: string | null;
  support_phone: string | null;
  business_address: string | null;
  hero_slides: unknown[] | null;
  social_media: Record<string, string> | null;
  google_analytics_id: string | null;
  facebook_pixel_id: string | null;
  tiktok_pixel_id: string | null;
  snapchat_pixel_id: string | null;
  twitter_pixel_id: string | null;
  bank_code: string | null;
  bank_account_number: string | null;
  paystack_subaccount_code: string | null;
};

const mockRpc = vi.fn();
const mockProductsSelect = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (table: string) => {
      if (table !== 'products') {
        throw new Error(`unexpected table ${table}`);
      }
      return {
        select: () => ({
          eq: () => ({
            eq: () => mockProductsSelect(),
          }),
        }),
      };
    },
  },
}));

let mockMerchant: MerchantStub | null = null;
let mockAuthUserId: string | null = null;

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockAuthUserId ? { id: mockAuthUserId } : null,
  }),
}));

vi.mock('./useMerchant', () => ({
  useMerchant: () => ({
    merchant: mockMerchant,
    isLoading: false,
  }),
}));

// Import after mocks so the mocks apply.
const { useStoreReadiness } = await import('./useStoreReadiness');

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return React.createElement(QueryClientProvider, { client }, children);
}

function buildMerchant(overrides: Partial<MerchantStub> = {}): MerchantStub {
  return {
    id: 'merchant-1',
    user_id: 'owner-user',
    is_published: false,
    country: null,
    support_email: null,
    support_phone: null,
    business_address: null,
    hero_slides: null,
    social_media: null,
    google_analytics_id: null,
    facebook_pixel_id: null,
    tiktok_pixel_id: null,
    snapchat_pixel_id: null,
    twitter_pixel_id: null,
    bank_code: null,
    bank_account_number: null,
    paystack_subaccount_code: null,
    ...overrides,
  };
}

describe('useStoreReadiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMerchant = null;
    mockAuthUserId = null;
    mockProductsSelect.mockResolvedValue({ count: 0, error: null });
  });

  it('calls the owner-only verification RPC when the caller owns the merchant', async () => {
    mockMerchant = buildMerchant({ user_id: 'owner-user' });
    mockAuthUserId = 'owner-user';
    mockRpc.mockResolvedValueOnce({
      data: {
        nin_verified: true,
        bvn_verified: false,
        cac_verified: false,
      },
      error: null,
    });

    const { result } = renderHook(() => useStoreReadiness(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockRpc).toHaveBeenCalledWith('get_merchant_verification_status', {
      p_merchant_id: 'merchant-1',
    });
    const kyc = result.current.readiness?.items.find(
      (item) => item.id === 'verify_kyc'
    );
    expect(kyc?.completed).toBe(true);
  });

  it('skips the owner-only RPC for staff users and still returns readiness', async () => {
    mockMerchant = buildMerchant({ user_id: 'owner-user' });
    mockAuthUserId = 'staff-user';

    const { result } = renderHook(() => useStoreReadiness(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockRpc).not.toHaveBeenCalled();
    expect(result.current.readiness).not.toBeNull();
    const kyc = result.current.readiness?.items.find(
      (item) => item.id === 'verify_kyc'
    );
    expect(kyc?.completed).toBe(false);
  });

  it('defaults KYC to unverified when the owner RPC returns an authorization error', async () => {
    mockMerchant = buildMerchant({ user_id: 'owner-user' });
    mockAuthUserId = 'owner-user';
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'not authorized' },
    });

    const { result } = renderHook(() => useStoreReadiness(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Hook should not throw — it degrades gracefully.
    expect(result.current.readiness).not.toBeNull();
    const kyc = result.current.readiness?.items.find(
      (item) => item.id === 'verify_kyc'
    );
    expect(kyc?.completed).toBe(false);
  });
});
