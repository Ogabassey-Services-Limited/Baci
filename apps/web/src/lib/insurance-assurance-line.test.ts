import { describe, expect, it } from 'vitest';
import type { TaxSubtotal } from '@/lib/invoice-generator';
import {
  ASSURANCE_LINE_NAME,
  appendAssuranceTaxSubtotal,
  buildAssuranceInvoiceLineItem,
  buildAssuranceReceiptItem,
  sumAssuranceFees,
} from './insurance-assurance-line';

describe('sumAssuranceFees', () => {
  it('sums numeric and string fees, ignoring missing / non-positive', () => {
    expect(
      sumAssuranceFees([
        { assurance_fee: 1500 },
        { assurance_fee: '2500.5' },
        { assurance_fee: 0 },
        { assurance_fee: null },
        {},
      ])
    ).toBe(4000.5);
  });

  it('returns 0 when no item carries an assurance fee', () => {
    expect(sumAssuranceFees([{ assurance_fee: 0 }, {}])).toBe(0);
  });
});

describe('buildAssuranceInvoiceLineItem', () => {
  it('builds a zero-rated (O) line that reconciles to the fee total', () => {
    const line = buildAssuranceInvoiceLineItem(3, 4000);
    expect(line).toMatchObject({
      line_id: 3,
      name: ASSURANCE_LINE_NAME,
      quantity: 1,
      price: 4000,
      line_extension_amount: 4000,
      vat_category_code: 'O',
      vat_rate: 0,
      vat_amount: 0,
    });
  });
});

describe('buildAssuranceReceiptItem', () => {
  it('builds a receipt line item with the fee as the line total', () => {
    const item = buildAssuranceReceiptItem(4000);
    expect(item).toMatchObject({
      name: ASSURANCE_LINE_NAME,
      quantity: 1,
      price: 4000,
      line_extension_amount: 4000,
      vat_category_code: 'O',
      vat_amount: 0,
    });
  });
});

describe('appendAssuranceTaxSubtotal', () => {
  it('adds an O subtotal for VAT-registered sellers', () => {
    const subtotals: TaxSubtotal[] = [
      {
        vat_category_code: 'S',
        vat_rate: 7.5,
        taxable_amount: 100,
        tax_amount: 7.5,
      },
    ];
    appendAssuranceTaxSubtotal(subtotals, 4000, { vatRegistered: true });
    expect(subtotals).toHaveLength(2);
    expect(subtotals[1]).toMatchObject({
      vat_category_code: 'O',
      taxable_amount: 4000,
      tax_amount: 0,
    });
  });

  it('merges into an existing O subtotal for VAT-registered sellers', () => {
    const subtotals: TaxSubtotal[] = [
      {
        vat_category_code: 'O',
        vat_rate: 0,
        taxable_amount: 1000,
        tax_amount: 0,
      },
    ];
    appendAssuranceTaxSubtotal(subtotals, 4000, { vatRegistered: true });
    expect(subtotals).toHaveLength(1);
    expect(subtotals[0].taxable_amount).toBe(5000);
  });

  it('does nothing for non-registered sellers (already covered by the O row)', () => {
    const subtotals: TaxSubtotal[] = [
      {
        vat_category_code: 'O',
        vat_rate: 0,
        taxable_amount: 5000,
        tax_amount: 0,
        exemption_reason: 'Outside scope of VAT',
      },
    ];
    appendAssuranceTaxSubtotal(subtotals, 4000, { vatRegistered: false });
    expect(subtotals[0].taxable_amount).toBe(5000);
  });
});
