import { expect, it, vi } from 'vitest';
import { runStorefrontPdpSemanticRpcWithCooldown } from './run-storefront-pdp-semantic-rpc-with-cooldown';
import { storefrontPdpSemanticReadCooldown } from './storefront-pdp-semantic-read-cooldown-singleton';

it('marks the shared scope when the bounded RPC times out', async () => {
  storefrontPdpSemanticReadCooldown.clear('wrapper-test');
  const query = Promise.reject(new Error('request timed out'));
  await expect(
    runStorefrontPdpSemanticRpcWithCooldown(
      query,
      {
        deadlineMs: 1000,
        traceThresholdMs: 100,
      },
      'wrapper-test'
    )
  ).rejects.toThrow('timed out');
  expect(storefrontPdpSemanticReadCooldown.isCoolingDown('wrapper-test')).toBe(
    true
  );
  storefrontPdpSemanticReadCooldown.clear('wrapper-test');
  vi.restoreAllMocks();
});
