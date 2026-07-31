import { describe, expect, it, vi } from 'vitest';
import { createBuilderMerchantMutationAction } from './createBuilderMerchantMutationAction';

describe('createBuilderMerchantMutationAction', () => {
  it('captures the selected merchant before starting a mutation', () => {
    const mutate = vi.fn();
    const activeRequestRef = {
      current: { merchantId: 'merchant-a', revision: 1 },
    };

    createBuilderMerchantMutationAction({ mutate }, activeRequestRef)();
    activeRequestRef.current = { merchantId: 'merchant-b', revision: 2 };

    expect(mutate).toHaveBeenCalledWith(
      { merchantId: 'merchant-a' },
      undefined
    );
  });
});
