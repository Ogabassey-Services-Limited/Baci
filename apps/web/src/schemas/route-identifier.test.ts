import { describe, expect, it } from 'vitest';
import {
  type RouteIdentifier,
  RouteIdentifierSchema,
} from './route-identifier';

describe('RouteIdentifierSchema', () => {
  it('accepts storefront slugs and hostnames', () => {
    expect(RouteIdentifierSchema.safeParse('a').success).toBe(true);
    expect(RouteIdentifierSchema.safeParse('ogabassey').success).toBe(true);
    expect(RouteIdentifierSchema.safeParse('ogabassey.com').success).toBe(true);
    expect(RouteIdentifierSchema.safeParse('store-1.usebaci.com').success).toBe(
      true
    );
    expect(RouteIdentifierSchema.safeParse('a'.repeat(255)).success).toBe(true);
  });

  it('rejects empty, oversized, and unsafe identifiers', () => {
    expect(RouteIdentifierSchema.safeParse('').success).toBe(false);
    expect(RouteIdentifierSchema.safeParse('a'.repeat(256)).success).toBe(
      false
    );
    expect(RouteIdentifierSchema.safeParse('<script>').success).toBe(false);
    expect(RouteIdentifierSchema.safeParse('store name').success).toBe(false);
    expect(RouteIdentifierSchema.safeParse('store@name').success).toBe(false);
    expect(RouteIdentifierSchema.safeParse('store..com').success).toBe(false);
    expect(RouteIdentifierSchema.safeParse('-ogabassey').success).toBe(false);
    expect(RouteIdentifierSchema.safeParse('ogabassey-').success).toBe(false);
  });

  it('returns typed route identifiers for valid values', () => {
    const result = RouteIdentifierSchema.parse('ogabassey.com');
    const identifier: RouteIdentifier = result;

    expect(identifier).toBe('ogabassey.com');
  });

  it('returns specific validation messages for each rule', () => {
    const emptyResult = RouteIdentifierSchema.safeParse('');
    expect(emptyResult.success).toBe(false);
    expect(emptyResult.error?.issues[0]?.message).toBe(
      'Route identifier cannot be empty'
    );

    const oversizedResult = RouteIdentifierSchema.safeParse('a'.repeat(256));
    expect(oversizedResult.success).toBe(false);
    expect(oversizedResult.error?.issues[0]?.message).toBe(
      'Route identifier cannot exceed 255 characters'
    );

    const unsafeResult = RouteIdentifierSchema.safeParse('Store Name');
    expect(unsafeResult.success).toBe(false);
    expect(unsafeResult.error?.issues[0]?.message).toBe(
      'Route identifier must start and end with a lowercase letter or digit and contain only lowercase letters, digits, hyphens, and dots'
    );
  });
});
