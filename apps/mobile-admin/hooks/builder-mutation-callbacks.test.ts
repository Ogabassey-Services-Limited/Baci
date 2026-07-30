import { describe, expect, it, vi } from 'vitest';
import type { BuilderMutationVariables } from './builder-ai-request';
import {
  type BuilderMerchantRequest,
  guardBuilderMutationCallbacks,
} from './builder-mutation-callbacks';

const merchantARequest: BuilderMerchantRequest = {
  merchantId: 'merchant-a',
  revision: 3,
};

const variables: BuilderMutationVariables = { merchantId: 'merchant-a' };

describe('guardBuilderMutationCallbacks', () => {
  it('forwards success, error, and settled callbacks for the active request', () => {
    const onError = vi.fn();
    const onSettled = vi.fn();
    const onSuccess = vi.fn();
    const guarded = guardBuilderMutationCallbacks(
      { onError, onSettled, onSuccess },
      merchantARequest,
      { current: merchantARequest }
    );

    guarded?.onSuccess?.(undefined, variables, undefined, undefined as never);
    guarded?.onError?.(
      new Error('save failed'),
      variables,
      undefined,
      undefined as never
    );
    guarded?.onSettled?.(
      undefined,
      null,
      variables,
      undefined,
      undefined as never
    );

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it('suppresses all callbacks after the active merchant request changes', () => {
    const onError = vi.fn();
    const onSettled = vi.fn();
    const onSuccess = vi.fn();
    const activeRequestRef = { current: merchantARequest };
    const guarded = guardBuilderMutationCallbacks(
      { onError, onSettled, onSuccess },
      merchantARequest,
      activeRequestRef
    );
    activeRequestRef.current = { merchantId: 'merchant-b', revision: 4 };

    guarded?.onSuccess?.(undefined, variables, undefined, undefined as never);
    guarded?.onError?.(
      new Error('save failed'),
      variables,
      undefined,
      undefined as never
    );
    guarded?.onSettled?.(
      undefined,
      new Error('save failed'),
      variables,
      undefined,
      undefined as never
    );

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(onSettled).not.toHaveBeenCalled();
  });
});
