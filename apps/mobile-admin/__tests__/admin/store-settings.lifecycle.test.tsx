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
  resetStoreSettingsMocks,
} from './store-settings.test-helpers';
import { mocks } from './store-settings.test-mocks';
import StoreSettingsScreen from './store-settings.test-subject';

describe('StoreSettingsScreen lifecycle', () => {
  beforeEach(resetStoreSettingsMocks);

  it('preserves dirty edits when an app-focus merchant refetch returns a new object', () => {
    const rendered = render(<StoreSettingsScreen />);
    fireEvent.change(screen.getByLabelText('Business Name'), {
      target: { value: 'Unsaved local name' },
    });
    mocks.useMerchant.mockReturnValue({
      merchant: {
        ...defaultMerchant,
        business_name: 'Refetched server name',
        updated_at: '2026-06-17T08:01:00.000Z',
      },
      isLoading: false,
    });
    rendered.rerender(<StoreSettingsScreen />);
    expect(screen.getByLabelText('Business Name')).toHaveValue(
      'Unsaved local name'
    );
  });

  it('reseeds the form when merchant identity changes despite prior dirty edits', async () => {
    const rendered = render(<StoreSettingsScreen />);
    fireEvent.change(screen.getByLabelText('Business Name'), {
      target: { value: 'Unsaved first merchant name' },
    });
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
    await waitFor(() =>
      expect(screen.getByLabelText('Business Name')).toHaveValue(
        'Second Merchant Store'
      )
    );
    fireEvent.change(screen.getByLabelText('Business Name'), {
      target: { value: 'Second Merchant Store Ltd' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save store settings' })
    );
    await waitFor(() =>
      expect(mocks.updateMerchantIdentitySettings).toHaveBeenCalledWith({
        expectedUpdatedAt: '2026-06-17T08:01:00.000Z',
        merchantId: 'merchant-2',
        settings: { business_name: 'Second Merchant Store Ltd' },
      })
    );
  });

  it('keeps an edit made while a settings save is in flight dirty after it succeeds', async () => {
    let completeSave!: () => void;
    mocks.updateMerchantIdentitySettings.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          completeSave = resolve;
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
    fireEvent.change(screen.getByLabelText('Business Name'), {
      target: { value: 'Typed while saving' },
    });
    completeSave();
    await waitFor(() =>
      expect(mocks.invalidateStoreReadiness).toHaveBeenCalledTimes(1)
    );
    expect(screen.queryByText('Success!')).toBeNull();
    mocks.useMerchant.mockReturnValue({
      merchant: { ...defaultMerchant, business_name: 'Saved server name' },
      isLoading: false,
    });
    rendered.rerender(<StoreSettingsScreen />);
    expect(screen.getByLabelText('Business Name')).toHaveValue(
      'Typed while saving'
    );
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
