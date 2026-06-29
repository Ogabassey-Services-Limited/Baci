import { describe, expect, it } from 'vitest';
import {
  registerEmailDomainSchema,
  setEmailDomainEnabledSchema,
} from './merchant-email-domain';

describe('registerEmailDomainSchema', () => {
  it('accepts and normalizes a valid domain', () => {
    const result = registerEmailDomainSchema.safeParse({
      domain: '  MyStore.com ',
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.domain).toBe('mystore.com');
  });

  it('accepts a subdomain', () => {
    expect(
      registerEmailDomainSchema.safeParse({ domain: 'mail.mystore.com' })
        .success
    ).toBe(true);
  });

  it.each([
    'notadomain',
    'has space.com',
    'http://mystore.com',
    '-bad.com',
    'bad-.com',
    'good.-bad.com',
    'good.bad-.com',
    '',
  ])('rejects %p', (domain) => {
    expect(registerEmailDomainSchema.safeParse({ domain }).success).toBe(false);
  });
});

describe('setEmailDomainEnabledSchema', () => {
  it('accepts a boolean', () => {
    expect(
      setEmailDomainEnabledSchema.safeParse({ enabled: true }).success
    ).toBe(true);
  });

  it('rejects a non-boolean', () => {
    expect(
      setEmailDomainEnabledSchema.safeParse({ enabled: 'yes' }).success
    ).toBe(false);
  });
});
