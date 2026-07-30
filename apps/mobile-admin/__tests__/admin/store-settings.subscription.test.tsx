import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetStoreSettingsMocks } from './store-settings.test-helpers';
import './store-settings.test-mocks';
import { SubscriptionManagement } from '@/utils/SubscriptionManagement';
import StoreSettingsScreen from './store-settings.test-subject';

describe('StoreSettingsScreen subscription management', () => {
  beforeEach(resetStoreSettingsMocks);

  it('does not show the status modal when native subscription management returns false', async () => {
    vi.mocked(
      SubscriptionManagement.openNativeManagement
    ).mockResolvedValueOnce(false);
    render(<StoreSettingsScreen />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Manage in App Store' })
    );
    await waitFor(() =>
      expect(SubscriptionManagement.openNativeManagement).toHaveBeenCalledTimes(
        1
      )
    );
    expect(
      screen.queryByText(
        'Could not open subscription management. Please try again.'
      )
    ).not.toBeInTheDocument();
  });

  it('shows an error modal when native subscription management rejects', async () => {
    vi.mocked(
      SubscriptionManagement.openNativeManagement
    ).mockRejectedValueOnce(new Error('fail'));
    render(<StoreSettingsScreen />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Manage in App Store' })
    );
    expect(await screen.findByText('Unable to Open')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Could not open subscription management. Please try again.'
      )
    ).toBeInTheDocument();
  });
});
