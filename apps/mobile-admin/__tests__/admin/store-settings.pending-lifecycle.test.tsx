import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  defaultMerchant,
  resetStoreSettingsMocks,
} from './store-settings.test-helpers';
import { mocks } from './store-settings.test-mocks';
import StoreSettingsScreen from './store-settings.test-subject';

describe('StoreSettingsScreen merchant-scoped save lifecycle', () => {
  beforeEach(resetStoreSettingsMocks);

  it('keeps a pending save on merchant A out of merchant B header', async () => {
    mocks.updateMerchantIdentitySettings.mockImplementationOnce(
      () => new Promise<void>(() => undefined)
    );
    const rendered = render(<StoreSettingsScreen />);
    fireEvent.change(screen.getByLabelText('Business Name'), {
      target: { value: 'Merchant A saved name' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save store settings' })
    );
    await waitFor(() =>
      expect(mocks.updateMerchantIdentitySettings).toHaveBeenCalledTimes(1)
    );

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Save store settings' })
      ).toBeDisabled()
    );
    expect(screen.getByLabelText('loading')).toBeInTheDocument();

    mocks.useMerchant.mockReturnValue({
      merchant: {
        ...defaultMerchant,
        business_name: 'Merchant B Store',
        id: 'merchant-2',
        updated_at: '2026-07-31T09:00:00.000Z',
      },
      isLoading: false,
    });
    rendered.rerender(<StoreSettingsScreen />);

    expect(
      screen.getByRole('button', { name: 'Save store settings' })
    ).toBeEnabled();
    expect(screen.getByText('Save')).toBeInTheDocument();
    expect(screen.queryByLabelText('loading')).toBeNull();

    mocks.useMerchant.mockReturnValue({
      merchant: defaultMerchant,
      isLoading: false,
    });
    rendered.rerender(<StoreSettingsScreen />);

    expect(
      screen.getByRole('button', { name: 'Save store settings' })
    ).toBeDisabled();
    expect(screen.getByLabelText('loading')).toBeInTheDocument();
  });
});
