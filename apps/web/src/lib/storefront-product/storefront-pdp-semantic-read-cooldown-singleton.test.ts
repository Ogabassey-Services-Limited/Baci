import { expect, it } from 'vitest';
import { storefrontPdpSemanticReadCooldown } from './storefront-pdp-semantic-read-cooldown-singleton';

it('provides a shared cooldown store that can be reset', () => {
  storefrontPdpSemanticReadCooldown.markFailure('singleton-test', 100);
  expect(
    storefrontPdpSemanticReadCooldown.isCoolingDown('singleton-test', 101)
  ).toBe(true);
  storefrontPdpSemanticReadCooldown.clear('singleton-test');
  expect(
    storefrontPdpSemanticReadCooldown.isCoolingDown('singleton-test', 101)
  ).toBe(false);
});
