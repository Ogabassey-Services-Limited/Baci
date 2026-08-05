import { describe, expect, it } from 'vitest';
import { matchesVariantDiscriminatorTokens } from './matches-variant-discriminator-tokens';

describe('matchesVariantDiscriminatorTokens', () => {
  it('requires every discriminator in strict compare mode', () => {
    const result = matchesVariantDiscriminatorTokens(
      ['iphone', '15', '128gb'],
      ['128gb', 'esim']
    );

    expect(result).toBe(false);
  });

  it('matches named PDP groups while rejecting a conflicting storage group', () => {
    const exact = matchesVariantDiscriminatorTokens(
      ['ipad', '10', 'wifi', '256gb'],
      ['256gb', 'wifi'],
      true
    );
    const sibling = matchesVariantDiscriminatorTokens(
      ['ipad', '10', 'wifi', '128gb'],
      ['256gb', 'wifi'],
      true
    );

    expect(exact).toBe(true);
    expect(sibling).toBe(false);
  });

  it('rejects a conflicting SIM mode in partial PDP mode', () => {
    const result = matchesVariantDiscriminatorTokens(
      ['iphone', '15', 'physical', 'sim'],
      ['esim'],
      true
    );

    expect(result).toBe(false);
  });

  it('rejects a superset connectivity group in partial PDP mode', () => {
    const result = matchesVariantDiscriminatorTokens(
      ['ipad', '10', 'wifi', 'cellular'],
      ['wifi'],
      true
    );

    expect(result).toBe(false);
  });
});
