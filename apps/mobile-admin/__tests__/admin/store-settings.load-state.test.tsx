import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetStoreSettingsMocks } from './store-settings.test-helpers';
import { mocks } from './store-settings.test-mocks';
import StoreSettingsScreen from './store-settings.test-subject';

describe('StoreSettingsScreen load states', () => {
  beforeEach(resetStoreSettingsMocks);

  it('renders loading state while merchant profile is resolving', () => {
    mocks.useMerchant.mockReturnValue({ merchant: null, isLoading: true });

    render(<StoreSettingsScreen />);

    expect(screen.queryByText('Store Settings')).not.toBeInTheDocument();
  });

  it('shows a retry state when merchant loading settles without a merchant', () => {
    mocks.useMerchant.mockReturnValue({ merchant: null, isLoading: false });

    render(<StoreSettingsScreen />);

    expect(
      screen.getByText(/couldn't load store settings/i)
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry loading store settings' })
    );
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['merchant'],
    });
  });
});
