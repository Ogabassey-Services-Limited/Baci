import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRepairCenterAddress } from './repair-center-address';

const mocks = vi.hoisted(() => ({
  maybeSingle: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: mocks.maybeSingle,
        }),
      }),
    }),
  }),
}));

const merchantId = '123e4567-e89b-12d3-a456-426614174000';

const completeSettings = {
  pickup_address: '3 Olayeni Street, Computer Village',
  contact_name: 'Ogabassey Repair Center',
  contact_phone: '09070007000',
  contact_email: 'repairs@ogabassey.com',
  city: 'Ikeja',
  state: 'Lagos',
  country: 'Nigeria',
};

describe('getRepairCenterAddress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when the merchant id is empty', async () => {
    const result = await getRepairCenterAddress('');
    expect(result).toBeNull();
    expect(mocks.maybeSingle).not.toHaveBeenCalled();
  });

  it('returns null when no settings row exists', async () => {
    mocks.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect(await getRepairCenterAddress(merchantId)).toBeNull();
  });

  it('returns null when repair_settings is missing', async () => {
    mocks.maybeSingle.mockResolvedValueOnce({
      data: { repair_settings: null },
      error: null,
    });
    expect(await getRepairCenterAddress(merchantId)).toBeNull();
  });

  it('returns null when the address is incomplete (no city/state)', async () => {
    mocks.maybeSingle.mockResolvedValueOnce({
      data: {
        repair_settings: {
          pickup_address: '3 Olayeni Street',
        },
      },
      error: null,
    });
    expect(await getRepairCenterAddress(merchantId)).toBeNull();
  });

  it('returns null when pickup is explicitly disabled', async () => {
    mocks.maybeSingle.mockResolvedValueOnce({
      data: { repair_settings: { ...completeSettings, pickup_enabled: false } },
      error: null,
    });
    expect(await getRepairCenterAddress(merchantId)).toBeNull();
  });

  it('maps a complete configuration into a receiver address', async () => {
    mocks.maybeSingle.mockResolvedValueOnce({
      data: { repair_settings: completeSettings },
      error: null,
    });

    const result = await getRepairCenterAddress(merchantId);

    expect(result).toEqual({
      name: 'Ogabassey Repair Center',
      phone: '09070007000',
      email: 'repairs@ogabassey.com',
      address: '3 Olayeni Street, Computer Village',
      city: 'Ikeja',
      state: 'Lagos',
      country: 'Nigeria',
      countryCode: 'NG',
    });
  });

  it('returns null when the query errors', async () => {
    mocks.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'boom' },
    });
    expect(await getRepairCenterAddress(merchantId)).toBeNull();
  });
});
