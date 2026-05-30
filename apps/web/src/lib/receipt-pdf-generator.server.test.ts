// @vitest-environment node

import type { ReceiptMerchant, ReceiptOrder } from '@baci/shared';
import { describe, expect, it } from 'vitest';
import { generateReceiptPDF } from '@/lib/receipt-pdf-generator';

function createReceiptMerchant(
  overrides: Partial<ReceiptMerchant> = {}
): ReceiptMerchant {
  return {
    business_name: 'Ogabassey',
    logo_url: null,
    email: 'hello@example.com',
    phone: '+2348012345678',
    support_email: 'support@example.com',
    support_phone: null,
    business_address: '12 Allen Avenue, Ikeja, Lagos',
    cac_rc_number: 'RC-123456',
    tax_identification_number: 'TIN-123456',
    legal_entity_name: 'Ogabassey Limited',
    brand_colors: {
      primary: '#1d4ed8',
      background: '#ffffff',
      accent: '#f59e0b',
    },
    vat_registration_status: 'registered',
    vat_rate: 7.5,
    bank_code: '044',
    bank_account_number: '0123456789',
    bank_name: 'Access Bank',
    bank_account_name: 'Ogabassey Limited',
    ...overrides,
  };
}

function createReceiptOrder(
  overrides: Partial<ReceiptOrder> = {}
): ReceiptOrder {
  return {
    order_number: 'ORD-2026-001',
    created_at: '2026-05-30T09:00:00.000Z',
    currency: 'NGN',
    total: 542500,
    subtotal: 500000,
    shipping_fee: 5000,
    tax_amount: 37500,
    discount_amount: 0,
    amount_paid: 542500,
    balance: 0,
    payment_status: 'paid',
    payment_method: 'card',
    customer_name: 'Akinola Ogunniran',
    customer_email: 'akin@example.com',
    customer_phone: '+2348098765432',
    shipping_address: {
      address_line1: '8 Marina Road',
      city: 'Lagos Island',
      state: 'Lagos',
      postal_code: '101001',
      country: 'NG',
    },
    items: [
      {
        product_name: 'Samsung Galaxy S24 Ultra',
        variant_name: 'Black / 256GB',
        quantity: 1,
        price: 500000,
      },
    ],
    transactions: [
      {
        amount: 542500,
        created_at: '2026-05-30T09:05:00.000Z',
        description: 'Card payment',
        metadata: { payment_method: 'Card' },
      },
    ],
    ...overrides,
  };
}

describe('generateReceiptPDF server import', () => {
  it('creates a server-side PDF with the package jsPDF import', () => {
    const doc = generateReceiptPDF(
      createReceiptOrder(),
      createReceiptMerchant()
    );
    const output = doc.output('arraybuffer');

    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    expect(output).toBeInstanceOf(ArrayBuffer);
    expect(output.byteLength).toBeGreaterThan(1000);
  });
});
