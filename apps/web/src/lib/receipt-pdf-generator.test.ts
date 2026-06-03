import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  generateReceiptBlob,
  generateReceiptPDF,
  resolveReceiptLogoDataUri,
} from '@/lib/receipt-pdf-generator';

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

function getPdfText(
  order: Parameters<typeof generateReceiptBlob>[0],
  merchant: Parameters<typeof generateReceiptBlob>[1]
) {
  return generateReceiptPDF(order, merchant)
    .output()
    .replaceAll(String.fromCharCode(0), '');
}

describe('generateReceiptBlob', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

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
    const order = {
      ...baseOrder,
      order_number: 'ORD-1002',
      total: 50000,
      subtotal: 50000,
      shipping_fee: 0,
      tax_amount: 0,
      discount_amount: 0,
      amount_paid: 0,
      balance: 50000,
      payment_status: 'unpaid' as const,
      payment_method: null,
      customer_name: 'Unpaid Customer',
      customer_email: 'unpaid@example.com',
      customer_phone: null,
      items: [],
      transactions: [],
    };
    const merchant = {
      ...baseMerchant,
      phone: null,
      support_email: null,
      support_phone: null,
      business_address: null,
      vat_registration_status: null,
      vat_rate: null,
      bank_account_number: null,
    };
    const blob = generateReceiptBlob(order, merchant);
    const pdfText = getPdfText(order, merchant);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toBe('application/pdf');
    expect(pdfText).toContain('INVOICE');
    expect(pdfText).toContain('ORD-1002');
    expect(pdfText).toContain('Unpaid Customer');
    expect(pdfText).toContain('Item');
    expect(pdfText).toContain('Line Total');
  });

  it('can render a paid order as an invoice document when requested', () => {
    const order = {
      ...baseOrder,
      items: [
        {
          product_name: 'MacBook Pro',
          quantity: 1,
          price: 150000,
        },
      ],
      transactions: [],
    };
    const pdfText = generateReceiptPDF(order, baseMerchant, {
      documentKind: 'invoice',
    })
      .output()
      .replaceAll(String.fromCharCode(0), '');

    expect(pdfText).toContain('INVOICE');
    expect(pdfText).not.toContain('RECEIPT');
  });

  it('prints a compliance note when the invoice XML artifact has been generated', () => {
    const order = {
      ...baseOrder,
      payment_status: 'unpaid' as const,
      amount_paid: 0,
      balance: 150000,
      items: [
        {
          product_name: 'MacBook Pro',
          quantity: 1,
          price: 150000,
        },
      ],
      transactions: [],
    };
    const pdfText = generateReceiptPDF(order, baseMerchant, {
      complianceNote:
        'This invoice complies with Peppol BIS Billing 3.0 through a generated UBL XML invoice artifact created from this order.',
      documentKind: 'invoice',
    })
      .output()
      .replaceAll(String.fromCharCode(0), '');

    expect(pdfText).toContain('Peppol BIS Billing 3.0');
    expect(pdfText).toContain('generated UBL XML invoice artifact');
  });

  it('handles long names and multiple items without failing', () => {
    const order = {
      ...baseOrder,
      order_number: 'ORD-1003',
      total: 310000,
      subtotal: 300000,
      shipping_fee: 10000,
      tax_amount: 0,
      discount_amount: 0,
      amount_paid: 310000,
      balance: 0,
      payment_status: 'paid' as const,
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
    };
    const merchant = {
      ...baseMerchant,
      business_name:
        'Ogabassey Electronics and Premium Devices Superstore Limited',
    };
    const blob = generateReceiptBlob(order, merchant);
    const pdfText = getPdfText(order, merchant);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toBe('application/pdf');
    expect(pdfText).toContain('A very long customer name');
    expect(pdfText).toContain('An exceptionally long product name');
    expect(pdfText).toContain('A second long product title');
  });

  it('includes variant labels in receipt line items when present', () => {
    const order = {
      ...baseOrder,
      items: [
        {
          product_name: 'iPhone 16',
          variant_name: 'Blue / 128GB',
          quantity: 1,
          price: 150000,
        },
      ],
      transactions: [],
    };

    const pdfText = getPdfText(order, baseMerchant);

    expect(pdfText).toContain('Blue / 128GB');
  });

  it('ignores whitespace-only variant labels', () => {
    const order = {
      ...baseOrder,
      items: [
        {
          product_name: 'iPhone 16',
          variant_name: '   ',
          quantity: 1,
          price: 150000,
        },
      ],
      transactions: [],
    };

    const pdfText = getPdfText(order, baseMerchant);

    expect(pdfText).toContain('iPhone 16');
    expect(pdfText).not.toContain('(   )');
    expect(pdfText).not.toContain('()');
  });

  it('renders payment history when transactions are present', () => {
    const order = {
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
    };
    const blob = generateReceiptBlob(order, baseMerchant);
    const pdfText = getPdfText(order, baseMerchant);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toBe('application/pdf');
    expect(pdfText).toContain('Payment Date');
    expect(pdfText).toContain('20 Mar 2026');
    expect(pdfText).toContain('21 Mar 2026');
    expect(pdfText).toContain('card');
    expect(pdfText).toContain('transfer');
    expect(pdfText).toContain('75,000.00');
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

  it('omits the amount paid row for fully paid free orders', () => {
    const output = generateReceiptPDF(
      {
        ...baseOrder,
        order_number: 'ORD-1004',
        total: 0,
        subtotal: 0,
        shipping_fee: 0,
        tax_amount: 0,
        discount_amount: 0,
        amount_paid: 0,
        balance: 0,
        payment_status: 'paid',
        items: [
          {
            product_name: 'Free Gift',
            quantity: 1,
            price: 0,
          },
        ],
        transactions: [],
      },
      baseMerchant
    ).output();

    expect(output).toContain('Subtotal');
    expect(output).toContain('Shipping');
    expect(output).toContain('Total');
    expect(output).not.toContain('Amount Paid');
    expect(output).not.toContain('Balance Due');
  });

  it('resolves safe HTTPS receipt logos as data URIs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(Uint8Array.from([1, 2, 3]), {
            headers: { 'content-type': 'image/png' },
            status: 200,
          })
        )
      )
    );

    await expect(
      resolveReceiptLogoDataUri({
        ...baseMerchant,
        logo_url: 'https://res.cloudinary.com/demo/image/upload/logo.png',
      })
    ).resolves.toBe('data:image/png;base64,AQID');
  });

  it('rejects non-HTTPS or internal receipt logo URLs', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      resolveReceiptLogoDataUri({
        ...baseMerchant,
        logo_url: 'http://res.cloudinary.com/demo/logo.png',
      })
    ).resolves.toBeNull();
    await expect(
      resolveReceiptLogoDataUri({
        ...baseMerchant,
        logo_url: 'https://127.0.0.1/logo.png',
      })
    ).resolves.toBeNull();
    await expect(
      resolveReceiptLogoDataUri({
        ...baseMerchant,
        logo_url: 'https://localhost/logo.png',
      })
    ).resolves.toBeNull();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects oversized receipt logos before reading the body', async () => {
    const arrayBuffer = vi.fn(async () => Uint8Array.from([1, 2, 3]).buffer);
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          arrayBuffer,
          body: null,
          headers: new Headers({
            'content-length': '2000001',
            'content-type': 'image/png',
          }),
          ok: true,
        } as unknown as Response)
      )
    );

    await expect(
      resolveReceiptLogoDataUri({
        ...baseMerchant,
        logo_url: 'https://res.cloudinary.com/demo/image/upload/logo.png',
      })
    ).resolves.toBeNull();
    expect(arrayBuffer).not.toHaveBeenCalled();
  });
});
