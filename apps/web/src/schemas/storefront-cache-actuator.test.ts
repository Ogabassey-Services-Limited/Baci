import { describe, expect, it } from 'vitest';
import { storefrontCacheActuatorSchema } from './storefront-cache-actuator';

const validRequest = {
  generation: 3,
  merchantId: '11111111-1111-4111-8111-111111111111',
  nextSlug: 'smartphones',
  obligationId: '22222222-2222-4222-8222-222222222222',
  previousSlug: 'phones',
  relatedSlugs: ['audio'],
  schemaVersion: 1,
};

describe('storefrontCacheActuatorSchema', () => {
  it('accepts only the flat v1 cache-transition contract', () => {
    expect(storefrontCacheActuatorSchema.parse(validRequest)).toEqual(
      validRequest
    );
  });

  it('rejects caller-selected hosts, operations, and identity arrays', () => {
    for (const extra of [
      { hosts: ['attacker.example'] },
      { operation: 'purge_everything' },
      { identities: ['attacker.example'] },
      { url: 'https://attacker.example' },
    ]) {
      expect(
        storefrontCacheActuatorSchema.safeParse({ ...validRequest, ...extra })
          .success
      ).toBe(false);
    }
  });

  it('normalizes and deduplicates related category slugs', () => {
    const result = storefrontCacheActuatorSchema.parse({
      ...validRequest,
      nextSlug: null,
      previousSlug: null,
      relatedSlugs: ['audio', ' audio ', 'smartphones'],
    });

    expect(result.relatedSlugs).toEqual(['audio', 'smartphones']);
  });

  it('requires at least one category target', () => {
    expect(
      storefrontCacheActuatorSchema.safeParse({
        ...validRequest,
        nextSlug: null,
        previousSlug: null,
        relatedSlugs: [],
      }).success
    ).toBe(false);
  });
});
