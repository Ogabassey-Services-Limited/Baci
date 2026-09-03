import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRepairCenterAddress } from './repair-center-address';

const merchantId = '123e4567-e89b-12d3-a456-426614174000';

function makeClient(result: { data: unknown; error: unknown }) {
  return {
    rpc: vi.fn().mockResolvedValue(result),
  };
}

const completeProjection = {
  name: 'Ogabassey Repair Center',
  phone: '09070007000',
  email: 'repairs@ogabassey.com',
  address: '3 Olayeni Street, Computer Village',
  city: 'Ikeja',
  state: 'Lagos',
  country: 'Nigeria',
  countryCode: 'NG',
};

describe('getRepairCenterAddress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when the merchant id is empty', async () => {
    const supabase = makeClient({ data: completeProjection, error: null });
    const result = await getRepairCenterAddress(supabase as never, '');
    expect(result).toBeNull();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('returns null when the projection is empty', async () => {
    const supabase = makeClient({ data: {}, error: null });
    expect(
      await getRepairCenterAddress(supabase as never, merchantId)
    ).toBeNull();
    expect(supabase.rpc).toHaveBeenCalledWith('get_repair_pickup_receiver', {
      p_merchant_id: merchantId,
    });
  });

  it('returns null when the projection is not an object', async () => {
    const supabase = makeClient({ data: 'not-an-object', error: null });
    expect(
      await getRepairCenterAddress(supabase as never, merchantId)
    ).toBeNull();
  });

  it('returns null when the address is incomplete', async () => {
    const supabase = makeClient({
      data: { address: '3 Olayeni Street' },
      error: null,
    });
    expect(
      await getRepairCenterAddress(supabase as never, merchantId)
    ).toBeNull();
  });

  it('returns null when the projection omits a contact phone', async () => {
    const supabase = makeClient({
      data: { ...completeProjection, phone: '' },
      error: null,
    });
    expect(
      await getRepairCenterAddress(supabase as never, merchantId)
    ).toBeNull();
  });

  it('maps a complete projection into a receiver address', async () => {
    const supabase = makeClient({ data: completeProjection, error: null });

    const result = await getRepairCenterAddress(supabase as never, merchantId);

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

  it('returns null and logs when the query errors', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const supabase = makeClient({
      data: null,
      error: { message: 'boom' },
    });
    try {
      expect(
        await getRepairCenterAddress(supabase as never, merchantId)
      ).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'getRepairCenterAddress: query failed',
        { message: 'boom' }
      );
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
