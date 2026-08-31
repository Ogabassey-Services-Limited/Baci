import { describe, expect, it } from 'vitest';
import {
  createStorefrontPdpSemanticCooldownResult,
  createStorefrontPdpSemanticReadCooldown,
  STOREFRONT_PDP_SEMANTIC_FAILURE_COOLDOWN_MS,
} from './storefront-pdp-semantic-read-cooldown';

describe('storefront PDP semantic read cooldown', () => {
  it('expires a retryable failure without affecting another scope', () => {
    const cooldown = createStorefrontPdpSemanticReadCooldown({
      cooldownMs: 30,
    });

    cooldown.markFailure('merchant-1', 100);

    expect(cooldown.isCoolingDown('merchant-1', 129)).toBe(true);
    expect(cooldown.isCoolingDown('merchant-1', 130)).toBe(false);
    expect(cooldown.isCoolingDown('merchant-2', 100)).toBe(false);
  });

  it('bounds scopes and can be reset after a test or runtime lifecycle', () => {
    const cooldown = createStorefrontPdpSemanticReadCooldown({
      maxEntries: 1,
      cooldownMs: 30,
    });

    cooldown.markFailure('merchant-1', 100);
    cooldown.markFailure('merchant-2', 101);

    expect(cooldown.isCoolingDown('merchant-1', 101)).toBe(false);
    expect(cooldown.isCoolingDown('merchant-2', 101)).toBe(true);

    cooldown.reset();
    expect(cooldown.isCoolingDown('merchant-2', 101)).toBe(false);
  });

  it('creates an optional timeout result for suppressed reads', () => {
    expect(createStorefrontPdpSemanticCooldownResult()).toEqual({
      status: 'unavailable',
      error: {
        kind: 'timeout',
        operation: 'pdp_semantic_enrichment',
        retryable: true,
      },
    });
    expect(STOREFRONT_PDP_SEMANTIC_FAILURE_COOLDOWN_MS).toBe(30_000);
  });
});
