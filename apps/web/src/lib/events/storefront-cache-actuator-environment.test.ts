import { describe, expect, it } from 'vitest';
import { storefrontCacheActuatorEnvironment } from './storefront-cache-actuator-environment';

const { schema } = storefrontCacheActuatorEnvironment;

describe('storefront cache actuator environment', () => {
  it('allows the all-false pre-rollout configuration', () => {
    expect(schema.safeParse({}).success).toBe(true);
  });

  it.each([
    { STOREFRONT_CACHE_ACTUATOR_URL: 'https://baci.example.com/actuator' },
    { STOREFRONT_CACHE_ACTUATOR_SECRET: 'cache-actuator-secret' },
  ])('requires both endpoint and secret', (value) => {
    expect(schema.safeParse(value).success).toBe(false);
  });

  it('requires HTTPS and validates an optional canary UUID', () => {
    expect(
      schema.safeParse({
        STOREFRONT_CACHE_ACTUATOR_SECRET: 'cache-actuator-secret',
        STOREFRONT_CACHE_ACTUATOR_URL: 'http://localhost:3000/actuator',
      }).success
    ).toBe(false);
    expect(
      schema.safeParse({
        STOREFRONT_CACHE_ACTUATOR_SECRET: 'cache-actuator-secret',
        STOREFRONT_CACHE_ACTUATOR_URL: 'https://baci.example.com/actuator',
        STOREFRONT_CACHE_CANARY_MERCHANT_ID:
          '00000000-0000-4000-8000-000000000001',
      }).success
    ).toBe(true);
  });
});
