import { describe, expect, it } from 'vitest';
import { generateReceiptBlob } from '@/lib/receipt-pdf-generator';

const baseMerchant = {
  business_name: 'Ogabassey',
  logo_url: null,
  email: 'hello@ogabassey.com',
  phone: '+2348011111111',
  support_email: 'support@ogabassey.com',
  support_phone: '+2348022222222',
  business_address: '12 Allen Avenue, Ikeja',
  cac_rc_number: null,
  tax_identification_number: null,
  legal_entity_name: null,
  brand_colors: {
    primary: '#111827',
    background: '#ffffff',
    accent: '#ef4444',
  },
  vat_registration_status: null,
  vat_rate: null,
  bank_code: null,
  bank_account_number: null,
};

const baseOrder = {
  order_number: 'ORD-1001',
  created_at: '2026-03-22T10:00:00.000Z',
  currency: 'NGN',
  total: 150000,
  subtotal: 145000,
  shipping_fee: 5000,
  tax_amount: 0,
  discount_amount: 0,
  amount_paid: 150000,
  balance: 0,
  payment_status: 'paid' as const,
  payment_method: 'card',
  customer_name: 'Oga Bassey',
  customer_email: 'oga@example.com',
  customer_phone: '+2348012345678',
};

describe('generateReceiptBlob', () => {
  it('returns a non-empty PDF blob', () => {
    const blob = generateReceiptBlob(
      {
        ...baseOrder,
        items: [
          {
            product_name: 'MacBook Pro',
            quantity: 1,
            price: 150000,
          },
        ],
        transactions: [],
      },
      baseMerchant
    );

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toBe('application/pdf');
  });

  it('supports unpaid invoices with empty items and missing optional merchant fields', () => {
    const blob = generateReceiptBlob(
      {
        ...baseOrder,
        order_number: 'ORD-1002',
        total: 50000,
        subtotal: 50000,
        shipping_fee: 0,
        tax_amount: 0,
        discount_amount: 0,
        amount_paid: 0,
        balance: 50000,
        payment_status: 'unpaid',
        payment_method: null,
        customer_name: 'Unpaid Customer',
        customer_email: 'unpaid@example.com',
        customer_phone: null,
        items: [],
        transactions: [],
      },
      {
        ...baseMerchant,
        phone: null,
        support_email: null,
        support_phone: null,
        business_address: null,
        vat_registration_status: null,
        vat_rate: null,
        bank_account_number: null,
      }
    );

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toBe('application/pdf');
  });

  it('handles long names and multiple items without failing', () => {
    const blob = generateReceiptBlob(
      {
        ...baseOrder,
        order_number: 'ORD-1003',
        total: 310000,
        subtotal: 300000,
        shipping_fee: 10000,
        tax_amount: 0,
        discount_amount: 0,
        amount_paid: 310000,
        balance: 0,
        payment_status: 'paid',
        payment_method: 'transfer',
        customer_name:
          'A very long customer name that should still be renderable inside the PDF generator without throwing',
        customer_email: 'long@example.com',
        customer_phone: '+2348099999999',
        items: [
          {
            product_name:
              'An exceptionally long product name designed to wrap across the PDF table correctly',
            quantity: 1,
            price: 200000,
          },
          {
            product_name:
              'A second long product title to validate multiple row rendering',
            quantity: 2,
            price: 55000,
          },
        ],
        transactions: [],
      },
      {
        ...baseMerchant,
        business_name:
          'Ogabassey Electronics and Premium Devices Superstore Limited',
      }
    );

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toBe('application/pdf');
  });

  it('renders payment history when transactions are present', () => {
    const blob = generateReceiptBlob(
      {
        ...baseOrder,
        items: [
          {
            product_name: 'MacBook Pro',
            quantity: 1,
            price: 150000,
          },
        ],
        transactions: [
          {
            amount: 75000,
            created_at: '2026-03-20T14:00:00.000Z',
            description: 'Card payment',
            metadata: { payment_method: 'card' },
          },
          {
            amount: 75000,
            created_at: '2026-03-21T09:00:00.000Z',
            description: 'Transfer payment',
            metadata: { payment_method: 'transfer' },
          },
        ],
      },
      baseMerchant
    );

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toBe('application/pdf');
  });

  it('handles invalid receipt dates without failing', () => {
    const blob = generateReceiptBlob(
      {
        ...baseOrder,
        created_at: 'not-a-date',
        items: [
          {
            product_name: 'MacBook Pro',
            quantity: 1,
            price: 150000,
          },
        ],
        transactions: [],
      },
      baseMerchant
    );

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toBe('application/pdf');
  });
});
