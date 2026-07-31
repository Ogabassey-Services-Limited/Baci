import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  defaultMerchant,
  resetStoreSettingsMocks,
} from './store-settings.test-helpers';
import { mocks } from './store-settings.test-mocks';
import StoreSettingsScreen from './store-settings.test-subject';

describe('StoreSettingsScreen lifecycle', () => {
  beforeEach(resetStoreSettingsMocks);

  it('does not adopt an external refetch token while preserving dirty edits', async () => {
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
    fireEvent.click(
      screen.getByRole('button', { name: 'Save store settings' })
    );
    await waitFor(() =>
      expect(mocks.updateMerchantIdentitySettings).toHaveBeenCalledWith({
        expectedUpdatedAt: defaultMerchant.updated_at,
        merchantId: 'merchant-1',
        settings: { business_name: 'Unsaved local name' },
      })
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
});
