import { describe, expect, it } from 'vitest';
import {
  NON_OWNER_ALWAYS_REDACTED_FIELDS,
  NON_OWNER_PAYMENT_FIELDS,
  NON_OWNER_REDACTED_FEATURE_SETTINGS_KEYS,
  redactMerchantSecretsForNonOwner,
} from './redact-merchant-secrets-for-non-owner';
import type { MerchantData, StaffAccess } from './types';

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
    legal_entity_name: 'Owner Ltd',
    registered_address: { street: '1 Main', city: 'Lagos' },
    tax_identification_number: 'TIN-1',
    cac_rc_number: 'RC-1',
    kyc_status: 'verified',
    google_product_sheet_url: 'https://docs.google.com/spreadsheets/private',
    feature_settings: {
      pay_on_delivery_enabled: true,
      facebook_capi_token: 'nested-fb',
      ga4_api_secret: 'nested-ga4',
      tiktok_access_token: 'nested-tt',
      snapchat_capi_token: 'nested-snap',
      credit_direct_public_key: 'nested-cd-key',
      custom_settings: {
        google_merchant_id: 'GMC-1',
        zohoCampaigns: {
          accessToken: 'zoho-access',
          refreshToken: 'zoho-refresh',
          clientSecret: 'zoho-secret',
        },
      },
    },
  } as unknown as MerchantData;
}

function staff(permissions: StaffAccess['permissions']): StaffAccess {
  return { isStaff: true, isOwner: false, role: 'manager', permissions };
}

describe('redactMerchantSecretsForNonOwner', () => {
  it('always strips identity/billing/marketing secrets regardless of permission', () => {
    const redacted = redactMerchantSecretsForNonOwner(
      merchantWithSecrets(),
      staff({ '*': { '*': true } }) // even a full wildcard staffer
    );

    for (const field of NON_OWNER_ALWAYS_REDACTED_FIELDS) {
      expect(redacted[field]).toBeUndefined();
    }
  });

  it('strips payout fields for staff WITHOUT settings access', () => {
    const redacted = redactMerchantSecretsForNonOwner(
      merchantWithSecrets(),
      staff({ orders: { view: true } })
    );

    for (const field of NON_OWNER_PAYMENT_FIELDS) {
      expect(redacted[field]).toBeUndefined();
    }
  });

  it('keeps payout fields for staff WITH settings access (payment settings page)', () => {
    const redacted = redactMerchantSecretsForNonOwner(
      merchantWithSecrets(),
      staff({ settings: { view: true } })
    );

    expect(redacted.paystack_subaccount_code).toBe('ACCT_x');
    expect(redacted.bank_account_number).toBe('1234567890');
    expect(redacted.bank_code).toBe('044');
  });

  it('honors settings wildcard grants for payout fields', () => {
    const redacted = redactMerchantSecretsForNonOwner(
      merchantWithSecrets(),
      staff({ settings: { '*': true } })
    );
    expect(redacted.paystack_subaccount_code).toBe('ACCT_x');
  });

  it('gates google_product_sheet_url on products access', () => {
    const withoutProducts = redactMerchantSecretsForNonOwner(
      merchantWithSecrets(),
      staff({ settings: { view: true } })
    );
    expect(withoutProducts.google_product_sheet_url).toBeUndefined();

    const withProducts = redactMerchantSecretsForNonOwner(
      merchantWithSecrets(),
      staff({ products: { view: true } })
    );
    expect(withProducts.google_product_sheet_url).toBe(
      'https://docs.google.com/spreadsheets/private'
    );
  });

  it('scrubs nested feature_settings credentials and drops custom_settings', () => {
    const redacted = redactMerchantSecretsForNonOwner(
      merchantWithSecrets(),
      staff({ settings: { view: true } })
    );

    for (const key of NON_OWNER_REDACTED_FEATURE_SETTINGS_KEYS) {
      expect(redacted.feature_settings?.[key]).toBeUndefined();
    }
    expect(redacted.feature_settings?.custom_settings).toBeUndefined();
    // non-secret flags preserved
    expect(redacted.feature_settings?.pay_on_delivery_enabled).toBe(true);
  });

  it('preserves non-secret presentation fields', () => {
    const redacted = redactMerchantSecretsForNonOwner(
      merchantWithSecrets(),
      staff({})
    );
    expect(redacted.id).toBe('merchant-1');
    expect(redacted.business_name).toBe('Store');
    expect(redacted.support_email).toBe('support@example.com');
  });

  it('does not mutate the input', () => {
    const original = merchantWithSecrets();
    redactMerchantSecretsForNonOwner(original, staff({}));

    expect(original.bvn).toBe('12345678901');
    expect(original.bank_account_number).toBe('1234567890');
    expect(original.feature_settings?.custom_settings).toBeDefined();
  });
});
