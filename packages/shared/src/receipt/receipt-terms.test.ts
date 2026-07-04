import { describe, expect, it } from 'vitest';
import { renderTermsHtml } from './receipt-terms';
import type { ReceiptMerchant } from './types';

function createReceiptMerchant(
  overrides: Partial<ReceiptMerchant> = {}
): ReceiptMerchant {
  return {
    bank_account_number: null,
    bank_code: null,
    business_address: null,
    business_name: 'Ogabassey',
    cac_rc_number: null,
    email: 'merchant@example.com',
    legal_entity_name: null,
    logo_url: null,
    phone: '+2348012345678',
    support_email: null,
    support_phone: null,
    tax_identification_number: null,
    vat_rate: null,
    vat_registration_status: null,
    ...overrides,
  };
}

describe('renderTermsHtml', () => {
  it('normalizes storefront URLs to the public terms page', () => {
    const html = renderTermsHtml(createReceiptMerchant(), {
      storeUrl: 'https://shop.example.com/storefront?ref=receipt',
    });

    expect(html).toContain('href="https://shop.example.com/terms"');
    expect(html).not.toContain('/storefront?ref=receipt/terms');
  });

  it('rejects non-http store URLs', () => {
    expect(
      renderTermsHtml(createReceiptMerchant(), {
        storeUrl: 'javascript:alert(1)',
      })
    ).toBe('');
  });

  it('accepts bare host and port store URLs', () => {
    expect(
      renderTermsHtml(createReceiptMerchant(), {
        storeUrl: 'localhost:3000',
      })
    ).toContain('href="https://localhost:3000/terms"');

    expect(
      renderTermsHtml(createReceiptMerchant(), {
        storeUrl: 'shop.example.com:8080',
      })
    ).toContain('href="https://shop.example.com:8080/terms"');
  });

  it('returns empty string when there is no store URL and no saved terms', () => {
    expect(renderTermsHtml(createReceiptMerchant(), {})).toBe('');
  });

  it('sanitizes and truncates saved terms when no store URL is available', () => {
    const html = renderTermsHtml(
      createReceiptMerchant({
        pages: {
          terms: `<p>Returns&nbsp;&amp;&nbsp;${'x'.repeat(520)}</p>`,
        },
      }),
      {}
    );

    expect(html).toContain('Returns &amp;');
    expect(html).toContain(`${'x'.repeat(487)}...`);
    expect(html).not.toContain('<p>');
  });

  it('escapes decoded terms before rendering fallback HTML', () => {
    const html = renderTermsHtml(
      createReceiptMerchant({
        pages: { terms: '&lt;script&gt;alert(1)&lt;/script&gt;' },
      }),
      {}
    );

    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('omits saved terms when sanitization removes all content', () => {
    const html = renderTermsHtml(
      createReceiptMerchant({
        pages: { terms: '<p>&nbsp;</p>' },
      }),
      {}
    );

    expect(html).toBe('');
  });
});
