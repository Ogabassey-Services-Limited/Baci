import { describe, expect, it, vi } from 'vitest';
import { preparePendingVtuTransaction } from '@/lib/vtu-pending-transaction';

const {
  mockFormatPhoneNumber,
  mockIsValidPhoneNumber,
  mockGenerateRequestRef,
  mockCalculateCommerce,
} = vi.hoisted(() => ({
  mockFormatPhoneNumber: vi.fn((value: string) => value),
  mockIsValidPhoneNumber: vi.fn(() => true),
  mockGenerateRequestRef: vi.fn(() => 'VTU-REF-123'),
  mockCalculateCommerce: vi.fn(() =>
    Promise.resolve({
      merchantEarning: 10,
      platformEarning: 5,
    })
  ),
}));

vi.mock('@/lib/kuda', () => ({
  formatPhoneNumber: mockFormatPhoneNumber,
  isValidPhoneNumber: mockIsValidPhoneNumber,
  generateRequestRef: () => mockGenerateRequestRef(),
}));

vi.mock('@/lib/supabase/client', () => ({
  calculateCommerce: mockCalculateCommerce,
}));

describe('preparePendingVtuTransaction', () => {
  it('creates a pending VTU row with computed commissions', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'merchant-1',
        slug: 'ogabassey',
        business_name: 'OgaBassey',
        paystack_subaccount_code: null,
      },
      error: null,
    });
    const settingsSingle = vi.fn().mockResolvedValue({
      data: {
        vtu_enabled: true,
        vtu_airtime_enabled: true,
        vtu_customer_cashback_enabled: true,
        vtu_customer_cashback_rate: 50,
        paystack_enabled: true,
        korapay_enabled: true,
      },
      error: null,
    });
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'customer-1',
        email: 'customer@example.com',
        first_name: 'Ada',
        last_name: 'Lovelace',
        phone: '08012345678',
        user_id: 'user-1',
      },
      error: null,
    });
    const insertSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'vtu-1',
        amount: 1000,
        customer_identifier: null,
        metadata: {},
        request_reference: 'VTU-REF-123',
        status: 'pending',
        type: 'airtime',
      },
      error: null,
    });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'merchants') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({ single }),
            }),
          };
        }

        if (table === 'merchant_feature_settings') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({ single: settingsSingle }),
            }),
          };
        }

        if (table === 'customers') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({ maybeSingle }),
              }),
            }),
          };
        }

        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({ single: insertSingle }),
          }),
        };
      }),
    } as unknown as Parameters<
      typeof preparePendingVtuTransaction
    >[0]['supabase'];

    const result = await preparePendingVtuTransaction({
      supabase,
      user: { id: 'user-1', email: 'customer@example.com' } as never,
      input: {
        merchantSlug: 'ogabassey',
        type: 'airtime',
        amount: 1000,
        phoneNumber: '08012345678',
        networkProvider: 'MTN',
        source: 'checkout',
      },
      source: 'checkout',
      requireCustomer: true,
    });

    expect(result.requestReference).toBe('VTU-REF-123');
    expect(result.customerCashback).toBe(5);
    expect(result.effectiveMerchantEarning).toBe(5);
    expect(mockCalculateCommerce).toHaveBeenCalled();
  });

  it('throws when VTU is disabled for the merchant', async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'merchants') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'merchant-1',
                    slug: 'ogabassey',
                    business_name: 'OgaBassey',
                    paystack_subaccount_code: null,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }

        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { vtu_enabled: false },
                error: null,
              }),
            }),
          }),
        };
      }),
    } as unknown as Parameters<
      typeof preparePendingVtuTransaction
    >[0]['supabase'];

    await expect(
      preparePendingVtuTransaction({
        supabase,
        user: { id: 'user-1', email: 'customer@example.com' } as never,
        input: {
          merchantSlug: 'ogabassey',
          type: 'airtime',
          amount: 1000,
          phoneNumber: '08012345678',
          networkProvider: 'MTN',
          source: 'checkout',
        },
        source: 'checkout',
      })
    ).rejects.toThrow('VTU is not enabled for this merchant');
  });
});
