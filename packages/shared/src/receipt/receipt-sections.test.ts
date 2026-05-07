import { describe, expect, it } from 'vitest';
import { renderLogoHtml } from './receipt-sections';
import type { ReceiptMerchant } from './types';

function createReceiptMerchant(
  overrides: Partial<ReceiptMerchant> = {}
): ReceiptMerchant {
  return {
    business_name: 'Ogabassey',
    logo_url: null,
    email: 'merchant@example.com',
    phone: '+2348012345678',
    support_email: null,
    support_phone: null,
    business_address: null,
    cac_rc_number: null,
    tax_identification_number: null,
    legal_entity_name: null,
    vat_registration_status: null,
    vat_rate: null,
    bank_code: null,
    bank_account_number: null,
    ...overrides,
  };
}

describe('renderLogoHtml', () => {
  it('escapes store names in fallback logo text', () => {
    const html = renderLogoHtml(
      createReceiptMerchant(),
      'Bad "><script>alert(1)</script>',
      undefined
    );

    expect(html).toContain(
      'Bad &quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;'
    );
    expect(html).not.toContain('<script>');
  });

  it('escapes store names in logo alt text', () => {
    const html = renderLogoHtml(
      createReceiptMerchant({
        logo_url: 'https://cdn.example.com/logo.png',
      }),
      'Bad "><script>alert(1)</script>',
      undefined
    );

    expect(html).toContain(
      'alt="Bad &quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"'
    );
    expect(html).not.toContain('alt="Bad "><script>');
  });
});
