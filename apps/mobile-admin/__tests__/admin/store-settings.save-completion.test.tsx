import '@testing-library/jest-dom/vitest';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetStoreSettingsMocks } from './store-settings.test-helpers';
import { mocks } from './store-settings.test-mocks';
import StoreSettingsScreen from './store-settings.test-subject';

describe('StoreSettingsScreen save completion', () => {
  beforeEach(resetStoreSettingsMocks);

  it('shows saved settings when the post-save readiness refresh rejects', async () => {
    mocks.invalidateStoreReadiness.mockRejectedValueOnce(
      new Error('readiness unavailable')
    );
    render(<StoreSettingsScreen />);

    await act(async () => {
      await expect(
        mocks.mutationOptions?.onSuccess?.({
          merchantId: 'merchant-1',
          revision: 0,
        })
      ).resolves.toBeUndefined();
    });

    expect(screen.getByText('Success!')).toBeInTheDocument();
    expect(
      screen.getByText('Store settings updated successfully.')
    ).toBeInTheDocument();
  });

  it('returns to the checklist without a success popup after a checklist save', async () => {
    mocks.routeParams = { from: 'setup' };
    render(<StoreSettingsScreen />);

    await act(async () => {
      await expect(
        mocks.mutationOptions?.onSuccess?.({
          merchantId: 'merchant-1',
          revision: 0,
        })
      ).resolves.toBeUndefined();
    });

    expect(mocks.back).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Success!')).not.toBeInTheDocument();
  });
});
