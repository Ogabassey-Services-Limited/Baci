import { describe, expect, it } from 'vitest';
import { createBuilderMutationCoordinator } from './builder-mutation-coordinator';

describe('createBuilderMutationCoordinator', () => {
  it('invalidates an old merchant request synchronously before passive effects run', () => {
    const coordinator = createBuilderMutationCoordinator('merchant-a');
    const oldMerchantRequest = coordinator.start('merchant-a');

    expect(oldMerchantRequest).not.toBeNull();
    if (!oldMerchantRequest) throw new Error('expected merchant A request');
    coordinator.synchronizeMerchant('merchant-b');

    expect(oldMerchantRequest()).toBe(false);
    const newMerchantRequest = coordinator.start('merchant-b');
    expect(newMerchantRequest?.()).toBe(true);
    if (!newMerchantRequest) throw new Error('expected merchant B request');

    coordinator.finish(oldMerchantRequest);
    expect(coordinator.start('merchant-b')).toBeNull();

    coordinator.finish(newMerchantRequest);
    expect(coordinator.start('merchant-b')?.()).toBe(true);
  });
});
