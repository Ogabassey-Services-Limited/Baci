import { describe, expect, it } from 'vitest';
import type { TaxSubtotal } from '@/lib/invoice-generator';
import {
  ASSURANCE_LINE_NAME,
  buildAssuranceInvoiceLineItem,
  buildAssuranceReceiptItem,
  nextInvoiceLineId,
  reconcileAssuranceTaxSubtotal,
  sumAssuranceFees,
  sumLineExtensionAmounts,
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

describe('nextInvoiceLineId', () => {
  it('returns one above the max existing line_id (handles sparse ids)', () => {
    expect(nextInvoiceLineId([{ line_id: 1 }, { line_id: 3 }])).toBe(4);
    expect(nextInvoiceLineId([{ line_id: 2 }])).toBe(3);
    expect(nextInvoiceLineId([{}, { line_id: null }])).toBe(1);
    expect(nextInvoiceLineId([])).toBe(1);
  });
});

describe('reconcileAssuranceTaxSubtotal', () => {
  it('adds an O subtotal covering the gap (VAT-registered: products in S)', () => {
    const subtotals: TaxSubtotal[] = [
      {
        vat_category_code: 'S',
        vat_rate: 7.5,
        taxable_amount: 100,
        tax_amount: 7.5,
      },
    ];
    // line total = products(100) + assurance(4000)
    reconcileAssuranceTaxSubtotal(subtotals, 4100);
    expect(subtotals).toHaveLength(2);
    expect(subtotals[1]).toMatchObject({
      vat_category_code: 'O',
      taxable_amount: 4000,
      tax_amount: 0,
    });
  });

  it('folds the gap into an existing O subtotal that excludes assurance', () => {
    // non-registered with O taxable derived from tax_exclusive (products only)
    const subtotals: TaxSubtotal[] = [
      {
        vat_category_code: 'O',
        vat_rate: 0,
        taxable_amount: 1000,
        tax_amount: 0,
      },
    ];
    reconcileAssuranceTaxSubtotal(subtotals, 5000);
    expect(subtotals).toHaveLength(1);
    expect(subtotals[0].taxable_amount).toBe(5000);
  });

  it('does nothing when subtotals already span the line total', () => {
    const subtotals: TaxSubtotal[] = [
      {
        vat_category_code: 'O',
        vat_rate: 0,
        taxable_amount: 5000,
        tax_amount: 0,
        exemption_reason: 'Outside scope of VAT',
      },
    ];
    reconcileAssuranceTaxSubtotal(subtotals, 5000);
    expect(subtotals).toHaveLength(1);
    expect(subtotals[0].taxable_amount).toBe(5000);
  });
});

describe('sumLineExtensionAmounts', () => {
  it('sums line extension amounts, ignoring missing', () => {
    expect(
      sumLineExtensionAmounts([
        { line_extension_amount: 100 },
        { line_extension_amount: 4000 },
        {},
      ])
    ).toBe(4100);
  });
});
