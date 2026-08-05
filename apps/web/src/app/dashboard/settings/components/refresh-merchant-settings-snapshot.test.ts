import { describe, expect, it, vi } from 'vitest';

const getMerchantSettingsSnapshot = vi.hoisted(() => vi.fn());
const loggerError = vi.hoisted(() => vi.fn());

vi.mock('./get-merchant-settings-snapshot', () => ({
  getMerchantSettingsSnapshot: (...args: unknown[]) =>
    getMerchantSettingsSnapshot(...args),
}));
vi.mock('@/lib/logger', () => ({ logger: { error: loggerError } }));

import { refreshMerchantSettingsSnapshot } from './refresh-merchant-settings-snapshot';

describe('refreshMerchantSettingsSnapshot', () => {
  it('returns the refreshed canonical snapshot without mutating a form draft', async () => {
    getMerchantSettingsSnapshot.mockResolvedValue({
      business_name: 'Merchant A',
      country: 'NG',
      site_description: 'Canonical description',
      support_email: '',
      support_phone: '',
      updated_at: '2026-08-04T06:30:00.000Z',
    });

    await expect(
      refreshMerchantSettingsSnapshot('merchant-a')
    ).resolves.toEqual(
      expect.objectContaining({ updated_at: '2026-08-04T06:30:00.000Z' })
    );
  });

  it('keeps the current baseline usable when the refresh fails', async () => {
    getMerchantSettingsSnapshot.mockRejectedValue(new Error('network failed'));

    await expect(
      refreshMerchantSettingsSnapshot('merchant-a')
    ).resolves.toBeUndefined();
    expect(loggerError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Profile baseline refresh failed' })
    );
  });
});
