import { describe, expect, it } from 'vitest';
import {
  ALWAYS_SAFE_STAFF_REDACTED_FIELDS,
  redactAlwaysSecretStaffFields,
} from './redact-always-secret-staff-fields';
import type { MerchantData } from './types';

function merchant(): MerchantData {
  return {
    id: 'm-1',
    business_name: 'Store',
    support_email: 'ops@example.com',
    bvn: '12345678901',
    nin: '98765432109',
    stripe_customer_id: 'cus_x',
    stripe_subscription_id: 'sub_x',
    virtual_terminal_code: 'VT-1',
    facebook_capi_token: 'fb',
    ga4_api_secret: 'ga4',
    tiktok_access_token: 'tt',
    snapchat_capi_token: 'snap',
    // permission-scoped fields intentionally left for the follow-up:
    bank_account_number: '1234567890',
    paystack_subaccount_code: 'ACCT_x',
    feature_settings: {
      pay_on_delivery_enabled: true,
      facebook_capi_token: 'nested-fb',
    },
  } as unknown as MerchantData;
}

describe('redactAlwaysSecretStaffFields', () => {
  it('strips every always-safe secret field', () => {
    const redacted = redactAlwaysSecretStaffFields(merchant());
    for (const field of ALWAYS_SAFE_STAFF_REDACTED_FIELDS) {
      expect(redacted[field]).toBeUndefined();
    }
  });

  it('leaves permission-scoped fields for the follow-up (bank/paystack/nested)', () => {
    const redacted = redactAlwaysSecretStaffFields(merchant());
    expect(redacted.bank_account_number).toBe('1234567890');
    expect(redacted.paystack_subaccount_code).toBe('ACCT_x');
    // nested feature_settings (read by the integrations page) is untouched
    expect(redacted.feature_settings?.facebook_capi_token).toBe('nested-fb');
    expect(redacted.feature_settings?.pay_on_delivery_enabled).toBe(true);
  });

  it('preserves non-secret fields and does not mutate the input', () => {
    const original = merchant();
    const redacted = redactAlwaysSecretStaffFields(original);
    expect(redacted.business_name).toBe('Store');
    expect(redacted.support_email).toBe('ops@example.com');
    expect(original.bvn).toBe('12345678901');
  });
});
