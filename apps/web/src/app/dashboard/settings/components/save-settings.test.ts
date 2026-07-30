import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveSettings } from './save-settings';

const mockUpdateSocial = vi.fn();
vi.mock('@/hooks/merchant/update-social', () => ({
  updateSocial: (data: Record<string, string>) => mockUpdateSocial(data),
}));

describe('saveSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes edited social settings before generic settings', async () => {
    const updateMerchant = vi.fn().mockResolvedValue(undefined);
    const reloadMerchant = vi.fn();
    const toast = vi.fn();
    const setIsSaving = vi.fn();
    mockUpdateSocial.mockResolvedValue({ merchant: { id: 'merchant-1' } });

    await saveSettings({
      data: { business_name: 'Test Store', country: 'NG' },
      heroSlides: [],
      socialMedia: { twitter: '@test' },
      updateMerchant,
      reloadMerchant,
      toast,
      setIsSaving,
    });

    expect(mockUpdateSocial.mock.invocationCallOrder[0]).toBeLessThan(
      updateMerchant.mock.invocationCallOrder[0] ?? 0
    );
    expect(reloadMerchant).toHaveBeenCalledTimes(1);
  });

  it('stops before generic settings when the guarded social write fails', async () => {
    const updateMerchant = vi.fn();
    const reloadMerchant = vi.fn();
    const toast = vi.fn();
    const setIsSaving = vi.fn();
    mockUpdateSocial.mockRejectedValue(new Error('Sign in again'));

    await saveSettings({
      data: { business_name: 'Test Store', country: 'NG' },
      heroSlides: [],
      socialMedia: { twitter: '@test' },
      updateMerchant,
      reloadMerchant,
      toast,
      setIsSaving,
    });

    expect(updateMerchant).not.toHaveBeenCalled();
    expect(reloadMerchant).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith({
      title: 'Error Saving Settings',
      description: 'Sign in again',
      variant: 'destructive',
    });
  });
});
