import { describe, expect, it } from 'vitest';
import { generateReceiptHtml } from './generate-receipt-html';
import { receiptTestFactory } from './receipt-test-factory';

const { createReceiptMerchant, createReceiptOrder } = receiptTestFactory;

describe('generateReceiptHtml', () => {
  it('includes the variant label in receipt item rows', () => {
    const html = generateReceiptHtml(
      createReceiptOrder(),
      createReceiptMerchant()
    );

    expect(html).toContain('Samsung Galaxy S22 Ultra (Black / 256GB)');
  });

  it('does not double-escape merchant names in the logo fallback', () => {
    const html = generateReceiptHtml(
      createReceiptOrder(),
      createReceiptMerchant({
        business_name: "A&B's Phones",
      })
    );

    expect(html).toContain('A&amp;B&#039;s Phones');
    expect(html).not.toContain('A&amp;amp;B');
    expect(html).not.toContain('&amp;#039;');
  });

  it('includes saved IMEI and serial number details on the receipt', () => {
    const html = generateReceiptHtml(
      createReceiptOrder({
        fulfillment_details: {
          imei: '353456789012345',
          serialNumber: 'SN-123',
        },
      }),
      createReceiptMerchant()
    );

    expect(html).toContain('Fulfillment Details');
    expect(html).toContain('IMEI');
    expect(html).toContain('353456789012345');
    expect(html).toContain('S/N');
    expect(html).toContain('SN-123');
  });

  it('falls back to legacy serial_number when serialNumber is blank', () => {
    const html = generateReceiptHtml(
      createReceiptOrder({
        fulfillment_details: {
          serialNumber: ' ',
          serial_number: 'SN-LEGACY-123',
        },
      }),
      createReceiptMerchant()
    );

    expect(html).toContain('S/N');
    expect(html).toContain('SN-LEGACY-123');
    expect(html.match(/S\/N/g) ?? []).toHaveLength(2);
  });

  it('attaches order-level fulfillment details to the first device item', () => {
    const html = generateReceiptHtml(
      createReceiptOrder({
        fulfillment_details: {
          imei: '353456789012345',
          serialNumber: 'SN-123',
        },
        items: [
          {
            product_name: 'Leather Case',
            quantity: 1,
            price: 25000,
          },
          {
            product_name: 'iPhone 15 Pro',
            quantity: 1,
            price: 500000,
          },
        ],
      }),
      createReceiptMerchant()
    );

    expect(html).not.toMatch(
      /Leather Case[\s\S]*IMEI: 353456789012345[\s\S]*iPhone 15 Pro/
    );
    expect(html).toMatch(/iPhone 15 Pro[\s\S]*IMEI: 353456789012345/);
  });

  it('does not emit unsafe brand colors into receipt styles', () => {
    const html = generateReceiptHtml(
      createReceiptOrder(),
      createReceiptMerchant({
        brand_colors: {
          accent: 'rgb(12, 34, 56);}</style><script>alert(2)</script><style>',
          background: '#ffffff',
          primary: '#111827;}</style><script>alert(1)</script><style>',
        },
      })
    );

    expect(html).not.toContain('</style><script>');
    expect(html).not.toContain('alert(1)');
    expect(html).not.toContain('alert(2)');
  });

  it('escapes QR image data URIs before rendering', () => {
    const html = generateReceiptHtml(
      createReceiptOrder(),
      createReceiptMerchant(),
      {
        qrCodeDataUri: 'data:image/png;base64,abc" onerror="alert(1)',
      }
    );

    expect(html).not.toContain(
      'src="data:image/png;base64,abc" onerror="alert(1)"'
    );
    expect(html).toContain(
      'src="data:image/png;base64,abc&quot; onerror=&quot;alert(1)"'
    );
  });
});
