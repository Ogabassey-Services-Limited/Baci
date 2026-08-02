import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockInvalidateStoreReadiness = vi.hoisted(() => vi.fn());
vi.mock('./invalidate-store-readiness', () => ({
  invalidateStoreReadiness: mockInvalidateStoreReadiness,
}));

import { invalidateStoreSettingsAfterSave } from './store-settings-save-readiness';

describe('invalidateStoreSettingsAfterSave', () => {
  beforeEach(() => {
    mockInvalidateStoreReadiness.mockReset();
    mockInvalidateStoreReadiness.mockResolvedValue(undefined);
  });

  it('refreshes merchant data and best-effort readiness after a successful save', async () => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockResolvedValue(undefined);
    mockInvalidateStoreReadiness.mockRejectedValueOnce(
      new Error('readiness unavailable')
    );

    await expect(
      invalidateStoreSettingsAfterSave(queryClient, 'merchant-1')
    ).resolves.toBeUndefined();

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['merchant'],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['merchant-settings'],
    });
    expect(mockInvalidateStoreReadiness).toHaveBeenCalledWith(
      queryClient,
      'merchant-1'
    );
  });

  it.each([
    undefined,
    '   ',
  ])('skips readiness refresh when the merchant id is absent or whitespace only (%j)', async (merchantId) => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockResolvedValue(undefined);

    await expect(
      invalidateStoreSettingsAfterSave(queryClient, merchantId)
    ).resolves.toBeUndefined();

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['merchant'],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['merchant-settings'],
    });
    expect(mockInvalidateStoreReadiness).not.toHaveBeenCalled();
  });
});
