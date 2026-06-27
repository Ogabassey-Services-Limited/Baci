import { describe, expect, it } from 'vitest';
import {
  generateOrderUpdatedEmail,
  generateOrderUpdatedText,
} from './order-updated';

const payload = {
  changedFields: ['Items', 'Total'],
  customerName: 'Ada Buyer',
  merchantName: 'Baci Store',
  merchantUrl: 'https://store.usebaci.com',
  orderNumber: 'ORD-123',
  supportEmail: 'support@example.com',
  totalAmount: 125000,
};

describe('Order updated email', () => {
  it('includes changed fields and the updated total in HTML and text', () => {
    const html = generateOrderUpdatedEmail(payload);
    const text = generateOrderUpdatedText(payload);

    expect(html).toContain('Items');
    expect(html).toContain('Total');
    expect(html).toContain('₦125,000');
    expect(text).toContain('Changed: Items, Total');
    expect(text).toContain('Updated Total: ₦125,000');
  });

  it('maps raw changed field keys to customer-facing labels', () => {
    const html = generateOrderUpdatedEmail({
      ...payload,
      changedFields: ['shipping_address', 'discount_amount', 'custom_field'],
    });
    const text = generateOrderUpdatedText({
      ...payload,
      changedFields: ['shipping_address', 'discount_amount', 'custom_field'],
    });

    expect(html).toContain('Shipping address');
    expect(html).toContain('Discount');
    expect(html).toContain('Custom Field');
    expect(html).not.toContain('shipping_address');
    expect(text).toContain('Changed: Shipping address, Discount, Custom Field');
  });

  it('escapes user content and rejects unsafe merchant links', () => {
    const xss = '<script>alert(1)</script>';
    const text = generateOrderUpdatedText({
      changedFields: [xss],
      customerName: xss,
      merchantName: xss,
      merchantUrl: 'javascript:alert(1)',
      orderNumber: xss,
      totalAmount: 1000,
    });
    const html = generateOrderUpdatedEmail({
      changedFields: [xss],
      customerName: xss,
      merchantName: xss,
      merchantUrl: 'javascript:alert(1)',
      orderNumber: xss,
      totalAmount: 1000,
    });

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('javascript:alert(1)');
    expect(html).not.toContain('View Store');
    expect(text).not.toContain('javascript:alert(1)');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('uses fallback copy when changed fields and support email are omitted', () => {
    const fallbackPayload = {
      ...payload,
      changedFields: [],
      supportEmail: undefined,
    };
    const html = generateOrderUpdatedEmail(fallbackPayload);
    const text = generateOrderUpdatedText(fallbackPayload);

    expect(html).toContain('Order details');
    expect(html).not.toContain('Questions? Contact us at');
    expect(text).toContain('Changed: Order details');
    expect(text).toContain('Questions? Contact us.');
  });
});
