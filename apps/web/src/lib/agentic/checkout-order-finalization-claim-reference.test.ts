import { describe, expect, it } from 'vitest';
import { isValidOrderFinalizationClaim } from './checkout-order-finalization-claim-reference';

describe('isValidOrderFinalizationClaim', () => {
  it('accepts only deterministic finalization claim references', () => {
    const validClaim = `agentic_order_${'a'.repeat(64)}`;

    expect(isValidOrderFinalizationClaim(validClaim)).toBe(true);
    expect(isValidOrderFinalizationClaim('agentic_order_invalid')).toBe(false);
    expect(
      isValidOrderFinalizationClaim(`agentic_order_${'a'.repeat(63)}`)
    ).toBe(false);
    expect(
      isValidOrderFinalizationClaim(`agentic_order_${'a'.repeat(65)}`)
    ).toBe(false);
    expect(
      isValidOrderFinalizationClaim(`agentic_order_${'A'.repeat(64)}`)
    ).toBe(false);
    expect(isValidOrderFinalizationClaim('a'.repeat(64))).toBe(false);
  });
});
