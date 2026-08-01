import '@testing-library/jest-dom/vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  defaultMerchant,
  defaultStoreSettingsSaveReceipt,
  resetStoreSettingsMocks,
} from './store-settings.test-helpers';
import { mocks } from './store-settings.test-mocks';
import StoreSettingsScreen from './store-settings.test-subject';

describe('StoreSettingsScreen save receipt lifecycle', () => {
  beforeEach(resetStoreSettingsMocks);

  it('uses the default save receipt token for a second consecutive save', async () => {
    render(<StoreSettingsScreen />);
    fireEvent.change(screen.getByLabelText('Business Name'), {
      target: { value: 'Baci Foods Ltd' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save store settings' })
    );
    await waitFor(() =>
      expect(mocks.updateMerchantIdentitySettings).toHaveBeenCalledTimes(1)
    );

    fireEvent.change(screen.getByLabelText('Phone Number'), {
      target: { value: '+2348099999999' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save store settings' })
    );

    await waitFor(() =>
      expect(mocks.updateMerchantIdentitySettings).toHaveBeenLastCalledWith({
        expectedUpdatedAt: defaultStoreSettingsSaveReceipt.updatedAt,
        merchantId: 'merchant-1',
        settings: { phone: '+2348099999999' },
      })
    );
  });

  it('uses the refreshed token and saved baseline when saving an edit made during the prior save', async () => {
    let completeFirstSave!: () => void;
    let releaseMerchantRefresh!: () => void;
    mocks.invalidateQueries.mockReturnValue(
      new Promise<void>((resolve) => {
        releaseMerchantRefresh = resolve;
      })
    );
    mocks.updateMerchantIdentitySettings.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          completeFirstSave = () =>
            resolve({
              merchantId: 'merchant-1',
              savedValues: {
                business_address: '12 Allen Avenue',
                business_name: 'Saved server name',
                country: 'NG',
                payout_currency: 'NGN',
                phone: '+2348012345678',
                slug: 'baci-foods',
                support_email: 'support@usebaci.com',
                support_phone: '+2347000000000',
              },
              updatedAt: '2026-07-30T18:00:00.000Z',
            });
        })
    );
    const rendered = render(<StoreSettingsScreen />);
    fireEvent.change(screen.getByLabelText('Business Name'), {
      target: { value: 'Saved server name' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save store settings' })
    );
    await waitFor(() =>
      expect(mocks.updateMerchantIdentitySettings).toHaveBeenCalledTimes(1)
    );

    fireEvent.change(screen.getByLabelText('Phone Number'), {
      target: { value: '+2348099999999' },
    });
    act(completeFirstSave);
    await waitFor(() =>
      expect(mocks.invalidateQueries).toHaveBeenCalledTimes(2)
    );

    mocks.useMerchant.mockReturnValue({
      merchant: {
        ...defaultMerchant,
        business_name: 'Saved server name',
        updated_at: '2026-07-30T18:01:00.000Z',
      },
      isLoading: false,
    });
    rendered.rerender(<StoreSettingsScreen />);
    expect(screen.getByLabelText('Phone Number')).toHaveValue('+2348099999999');
    await act(async () => releaseMerchantRefresh());

    fireEvent.click(
      screen.getByRole('button', { name: 'Save store settings' })
    );
    await waitFor(() =>
      expect(mocks.updateMerchantIdentitySettings).toHaveBeenCalledTimes(2)
    );
    expect(mocks.updateMerchantIdentitySettings).toHaveBeenLastCalledWith({
      expectedUpdatedAt: '2026-07-30T18:00:00.000Z',
      merchantId: 'merchant-1',
      settings: { phone: '+2348099999999' },
    });
  });

  it('does not add an untouched auth-email prefill after rebasing a save receipt', async () => {
    mocks.useMerchant.mockReturnValue({
      merchant: {
        ...defaultMerchant,
        email: 'owner@usebaci.com',
        support_email: null,
      },
      isLoading: false,
    });
    mocks.updateMerchantIdentitySettings.mockResolvedValueOnce({
      merchantId: 'merchant-1',
      savedValues: {
        business_address: '12 Allen Avenue',
        business_name: 'Saved server name',
        country: 'NG',
        payout_currency: 'NGN',
        phone: '+2348012345678',
        slug: 'baci-foods',
        support_email: '',
        support_phone: '+2347000000000',
      },
      updatedAt: '2026-07-30T18:00:00.000Z',
    });
    const rendered = render(<StoreSettingsScreen />);

    fireEvent.change(screen.getByLabelText('Business Name'), {
      target: { value: 'Saved server name' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save store settings' })
    );
    await waitFor(() =>
      expect(mocks.updateMerchantIdentitySettings).toHaveBeenLastCalledWith({
        expectedUpdatedAt: defaultMerchant.updated_at,
        merchantId: 'merchant-1',
        settings: { business_name: 'Saved server name' },
      })
    );

    fireEvent.change(screen.getByLabelText('Phone Number'), {
      target: { value: '+2348099999999' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save store settings' })
    );
    await waitFor(() =>
      expect(mocks.updateMerchantIdentitySettings).toHaveBeenLastCalledWith({
        expectedUpdatedAt: '2026-07-30T18:00:00.000Z',
        merchantId: 'merchant-1',
        settings: { phone: '+2348099999999' },
      })
    );
    rendered.unmount();
  });

  it('stays on the setup form when another edit is made during its save', async () => {
    let completeSave!: () => void;
    let releaseInvalidation!: () => void;
    mocks.routeParams = { from: 'setup' };
    mocks.invalidateQueries.mockReturnValue(
      new Promise<void>((resolve) => {
        releaseInvalidation = resolve;
      })
    );
    mocks.updateMerchantIdentitySettings.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          completeSave = resolve;
        })
    );
    render(<StoreSettingsScreen />);
    fireEvent.change(screen.getByLabelText('Business Name'), {
      target: { value: 'Saved setup name' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save store settings' })
    );
    await waitFor(() =>
      expect(mocks.updateMerchantIdentitySettings).toHaveBeenCalledTimes(1)
    );
    fireEvent.change(screen.getByLabelText('Business Name'), {
      target: { value: 'Unsaved setup name' },
    });
    completeSave();
    await waitFor(() =>
      expect(mocks.invalidateQueries).toHaveBeenCalledTimes(2)
    );
    await act(async () => releaseInvalidation());
    expect(mocks.back).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Business Name')).toHaveValue(
      'Unsaved setup name'
    );
  });

  it('invalidates readiness for the merchant that started a save after switching merchants', async () => {
    let completeSave!: () => void;
    mocks.updateMerchantIdentitySettings.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          completeSave = resolve;
        })
    );
    const rendered = render(<StoreSettingsScreen />);
    fireEvent.change(screen.getByLabelText('Business Name'), {
      target: { value: 'First merchant saved name' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save store settings' })
    );
    await waitFor(() =>
      expect(mocks.updateMerchantIdentitySettings).toHaveBeenCalledTimes(1)
    );
    mocks.useMerchant.mockReturnValue({
      merchant: {
        ...defaultMerchant,
        business_name: 'Second Merchant Store',
        id: 'merchant-2',
        updated_at: '2026-06-17T08:01:00.000Z',
      },
      isLoading: false,
    });
    rendered.rerender(<StoreSettingsScreen />);
    completeSave();
    await waitFor(() =>
      expect(mocks.invalidateStoreReadiness).toHaveBeenCalledWith(
        expect.anything(),
        'merchant-1'
      )
    );
    expect(mocks.invalidateStoreReadiness).not.toHaveBeenCalledWith(
      expect.anything(),
      'merchant-2'
    );
  });

  it('does not show save success until merchant and readiness invalidations finish', async () => {
    let releaseReadiness!: () => void;
    mocks.invalidateStoreReadiness.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        releaseReadiness = resolve;
      })
    );
    render(<StoreSettingsScreen />);
    fireEvent.change(screen.getByLabelText('Business Name'), {
      target: { value: 'Baci Foods Ltd' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save store settings' })
    );
    await waitFor(() => {
      expect(mocks.updateMerchantIdentitySettings).toHaveBeenCalledTimes(1);
      expect(mocks.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['merchant'],
      });
      expect(mocks.invalidateStoreReadiness).toHaveBeenCalledWith(
        expect.anything(),
        'merchant-1'
      );
    });
    expect(screen.queryByText('Success!')).not.toBeInTheDocument();
    releaseReadiness();
    expect(await screen.findByText('Success!')).toBeInTheDocument();
  });
});
