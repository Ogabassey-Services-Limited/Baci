import { describe, expect, it } from 'vitest';
import { deriveTaxSubtotalsFromInvoiceItems } from '@/lib/invoice-tax-subtotals';

describe('deriveTaxSubtotalsFromInvoiceItems', () => {
  it('groups invoice lines by VAT category and rate', () => {
    expect(
      deriveTaxSubtotalsFromInvoiceItems([
        {
          line_id: 1,
          name: 'Standard item',
          quantity: 1,
          unit_code: 'EA',
          price: 1000,
          line_extension_amount: 1000,
          vat_category_code: 'S',
          vat_rate: 7.5,
          vat_amount: 75,
        },
        {
          line_id: 2,
          name: 'Another standard item',
          quantity: 2,
          unit_code: 'EA',
          price: 500,
          line_extension_amount: 1000,
          vat_category_code: 'S',
          vat_rate: 7.5,
          vat_amount: 75,
        },
        {
          line_id: 3,
          name: 'Zero-rated item',
          quantity: 1,
          unit_code: 'EA',
          price: 250,
          line_extension_amount: 250,
          vat_category_code: 'Z',
          vat_rate: 0,
          vat_amount: 0,
        },
      ])
    ).toEqual([
      {
        vat_category_code: 'S',
        vat_rate: 7.5,
        taxable_amount: 2000,
        tax_amount: 150,
        exemption_reason: undefined,
      },
      {
        vat_category_code: 'Z',
        vat_rate: 0,
        taxable_amount: 250,
        tax_amount: 0,
        exemption_reason: undefined,
      },
    ]);
  });

  it('does not synthesize a category when line VAT metadata is missing', () => {
    expect(
      deriveTaxSubtotalsFromInvoiceItems([
        {
          line_id: 1,
          name: 'Untaxed legacy item',
          quantity: 1,
          unit_code: 'EA',
          price: 1000,
          line_extension_amount: 1000,
        },
      ])
    ).toEqual([]);
  });
});
