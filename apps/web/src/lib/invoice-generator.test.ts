// @vitest-environment node

import { describe, expect, it } from 'vitest';
import type { InvoiceData } from '@/lib/invoice-generator';
import { generateInvoicePDF } from '@/lib/invoice-generator';

function createInvoiceData(overrides: Partial<InvoiceData> = {}): InvoiceData {
  return {
    invoice_number: 'INV-2026-001',
    invoice_type_code: '380',
    issue_date: new Date('2026-05-30T00:00:00.000Z'),
    due_date: new Date('2026-06-06T00:00:00.000Z'),
    currency: 'NGN',
    merchant: {
      business_name: 'Ogabassey',
      legal_entity_name: 'Ogabassey Limited',
      tax_identification_number: 'TIN-123456',
      cac_rc_number: 'RC-123456',
      vat_registration_status: 'registered',
      vat_rate: 7.5,
      registered_address: {
        street: '12 Allen Avenue',
        city: 'Ikeja',
        state: 'Lagos',
        postal_code: '100271',
        country: 'NG',
      },
      support_email: 'support@example.com',
      support_phone: '+2348012345678',
    },
    customer: {
      name: 'Akinola Ogunniran',
      email: 'akin@example.com',
      phone: '+2348098765432',
      address: {
        street: '8 Marina Road',
        city: 'Lagos Island',
        state: 'Lagos',
        postal_code: '101001',
        country: 'NG',
      },
    },
    items: [
      {
        line_id: 1,
        name: 'Samsung Galaxy S24 Ultra',
        description: 'Unlocked 256GB device',
        quantity: 1,
        unit_code: 'EA',
        price: 500000,
        line_extension_amount: 500000,
        vat_category_code: 'S',
        vat_rate: 7.5,
        vat_amount: 37500,
        sellers_item_id: 'SKU-S24-256',
      },
    ],
    tax_subtotals: [
      {
        vat_category_code: 'S',
        vat_rate: 7.5,
        taxable_amount: 500000,
        tax_amount: 37500,
      },
    ],
    subtotal: 500000,
    tax_exclusive_amount: 500000,
    tax_amount: 37500,
    tax_inclusive_amount: 537500,
    shipping_fee: 5000,
    discount_amount: 0,
    total: 542500,
    notes: 'Thank you for shopping with us.',
    payment_terms: 'Due on receipt',
    ...overrides,
  };
}

describe('generateInvoicePDF', () => {
  it('creates a server-side PDF with the package jsPDF import', () => {
    const doc = generateInvoicePDF(createInvoiceData());
    const output = doc.output('arraybuffer');

    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    expect(output).toBeInstanceOf(ArrayBuffer);
    expect(output.byteLength).toBeGreaterThan(1000);
  });
});
