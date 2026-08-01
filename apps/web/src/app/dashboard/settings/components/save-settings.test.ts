import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveSettings } from './save-settings';

const mockUpdateSocial = vi.fn();
vi.mock('@/hooks/merchant/update-social', () => ({
  updateSocial: (...args: unknown[]) => mockUpdateSocial(...args),
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
      merchantId: '11111111-1111-4111-8111-111111111111',
      socialMedia: { twitter: '@test' },
      updateMerchant,
      reloadMerchant,
      isCurrentSave: () => true,
      toast,
      setIsSaving,
    });

    expect(mockUpdateSocial.mock.invocationCallOrder[0]).toBeLessThan(
      updateMerchant.mock.invocationCallOrder[0] ?? 0
    );
    expect(updateMerchant).toHaveBeenCalledWith(
      expect.objectContaining({
        business_name: 'Test Store',
        country: 'NG',
        hero_slides: [],
      }),
      { merchantId: '11111111-1111-4111-8111-111111111111', skipReload: true }
    );
    expect(reloadMerchant).not.toHaveBeenCalled();
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
      merchantId: '11111111-1111-4111-8111-111111111111',
      socialMedia: { twitter: '@test' },
      updateMerchant,
      reloadMerchant,
      isCurrentSave: () => true,
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

  it('continues the captured merchant save after a store switch during social save', async () => {
    const updateMerchant = vi.fn().mockResolvedValue(undefined);
    const toast = vi.fn();
    const setIsSaving = vi.fn();
    let current = true;
    mockUpdateSocial.mockImplementationOnce(async () => {
      current = false;
    });

    await saveSettings({
      data: { business_name: 'First Store', country: 'NG' },
      heroSlides: [],
      merchantId: '11111111-1111-4111-8111-111111111111',
      socialMedia: { twitter: '@first-store' },
      updateMerchant,
      reloadMerchant: vi.fn(),
      isCurrentSave: () => current,
      toast,
      setIsSaving,
    });

    expect(updateMerchant).toHaveBeenCalledWith(
      expect.objectContaining({ business_name: 'First Store' }),
      { merchantId: '11111111-1111-4111-8111-111111111111', skipReload: true }
    );
    expect(toast).not.toHaveBeenCalled();
    expect(setIsSaving).toHaveBeenCalledWith(true);
    expect(setIsSaving).not.toHaveBeenCalledWith(false);
  });
});
