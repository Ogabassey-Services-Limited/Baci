import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  eq: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mocks.from,
  },
}));

import { fetchPaymentSettings } from './payment-settings-query';

describe('fetchPaymentSettings', () => {
  beforeEach(() => {
    mocks.eq.mockReset();
    mocks.from.mockReset();
    mocks.select.mockReset();
    mocks.single.mockReset();
    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ single: mocks.single });
  });

  it('drops missing provider columns and omits unavailable fields', async () => {
    mocks.single
      .mockResolvedValueOnce({
        data: null,
        error: {
          message:
            "Could not find the 'klump_enabled' column of 'merchant_feature_settings' in the schema cache",
        },
      })
      .mockResolvedValueOnce({
        data: {
          id: 'settings-1',
          merchant_id: 'merchant-1',
          paystack_enabled: true,
        },
        error: null,
      });

    const result = await fetchPaymentSettings(
      'merchant-1',
      'id, merchant_id, paystack_enabled, klump_enabled'
    );

    expect(result).toEqual({
      id: 'settings-1',
      merchant_id: 'merchant-1',
      paystack_enabled: true,
    });
    expect(result).not.toHaveProperty('klump_enabled');
    expect(mocks.select).toHaveBeenNthCalledWith(
      1,
      'id, merchant_id, paystack_enabled, klump_enabled'
    );
    expect(mocks.select).toHaveBeenNthCalledWith(
      2,
      'id, merchant_id, paystack_enabled'
    );
  });

  it('throws when a required base column is missing', async () => {
    const error = {
      message:
        "Could not find the 'merchant_id' column of 'merchant_feature_settings' in the schema cache",
    };
    mocks.single.mockResolvedValueOnce({ data: null, error });

    await expect(
      fetchPaymentSettings('merchant-1', 'id, merchant_id, paystack_enabled')
    ).rejects.toBe(error);
  });

  it('throws without retrying when the missing column cannot be determined', async () => {
    const error = {
      message: 'Unexpected PostgREST schema cache failure',
    };
    mocks.single.mockResolvedValueOnce({ data: null, error });

    await expect(
      fetchPaymentSettings('merchant-1', 'id, merchant_id, paystack_enabled')
    ).rejects.toBe(error);
    expect(mocks.select).toHaveBeenCalledTimes(1);
  });

  it('throws without retrying when the parsed column was not requested', async () => {
    const error = {
      message:
        "Could not find the 'klump_enabled' column of 'merchant_feature_settings' in the schema cache",
    };
    mocks.single.mockResolvedValueOnce({ data: null, error });

    await expect(
      fetchPaymentSettings('merchant-1', 'id, merchant_id, paystack_enabled')
    ).rejects.toBe(error);
    expect(mocks.select).toHaveBeenCalledTimes(1);
  });
});
