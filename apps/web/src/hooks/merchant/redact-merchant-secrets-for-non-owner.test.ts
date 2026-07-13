import { describe, expect, it } from 'vitest';
import {
  NON_OWNER_REDACTED_FIELDS,
  redactMerchantSecretsForNonOwner,
} from './redact-merchant-secrets-for-non-owner';
import type { MerchantData } from './types';

function merchantWithSecrets(): MerchantData {
  return {
    id: 'merchant-1',
    business_name: 'Store',
    slug: 'store',
    support_email: 'support@example.com',
    bvn: '12345678901',
    nin: '98765432109',
    bank_account_number: '1234567890',
    bank_account_name: 'Owner',
    bank_code: '044',
    bank_name: 'Access',
    paystack_subaccount_code: 'ACCT_x',
    stripe_customer_id: 'cus_x',
    stripe_subscription_id: 'sub_x',
    facebook_capi_token: 'fb-token',
    ga4_api_secret: 'ga4-secret',
    tiktok_access_token: 'tt-token',
    snapchat_capi_token: 'snap-token',
    virtual_terminal_code: 'VT-1',
  } as MerchantData;
}

describe('redactMerchantSecretsForNonOwner', () => {
  it('strips every owner-only secret field', () => {
    const redacted = redactMerchantSecretsForNonOwner(merchantWithSecrets());

    for (const field of NON_OWNER_REDACTED_FIELDS) {
      expect(redacted[field]).toBeUndefined();
    }
  });

  it('preserves non-secret fields', () => {
    const redacted = redactMerchantSecretsForNonOwner(merchantWithSecrets());

    expect(redacted.id).toBe('merchant-1');
    expect(redacted.business_name).toBe('Store');
    expect(redacted.slug).toBe('store');
    expect(redacted.support_email).toBe('support@example.com');
  });

  it('does not mutate the input', () => {
    const original = merchantWithSecrets();
    redactMerchantSecretsForNonOwner(original);

    expect(original.bvn).toBe('12345678901');
    expect(original.bank_account_number).toBe('1234567890');
  });

  it('serializes with no secret keys over JSON', () => {
    const redacted = redactMerchantSecretsForNonOwner(merchantWithSecrets());
    const roundTripped = JSON.parse(JSON.stringify(redacted));

    for (const field of NON_OWNER_REDACTED_FIELDS) {
      expect(field in roundTripped).toBe(false);
    }
  });
});
