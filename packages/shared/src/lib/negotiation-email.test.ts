import { describe, expect, it } from 'vitest';
import { normalizeNegotiationCustomerEmail } from './negotiation-email';

describe('normalizeNegotiationCustomerEmail', () => {
  it('normalizes valid customer emails', () => {
    expect(normalizeNegotiationCustomerEmail('  Buyer@Example.COM  ')).toBe(
      'buyer@example.com'
    );
  });

  it('returns null for empty, malformed, or overlong emails', () => {
    expect(normalizeNegotiationCustomerEmail('')).toBeNull();
    expect(normalizeNegotiationCustomerEmail('a@b@c.com')).toBeNull();
    expect(
      normalizeNegotiationCustomerEmail(`${'a'.repeat(250)}@x.com`)
    ).toBeNull();
  });
});
