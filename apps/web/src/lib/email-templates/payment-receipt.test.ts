import { describe, expect, it } from 'vitest';
import {
  generatePaymentReceiptEmail,
  generatePaymentReceiptText,
} from './payment-receipt';

const basePayload = {
  orderNumber: 'ORD-003',
  customerName: 'Jane Doe',
  items: [{ name: 'Gadget', quantity: 1, price: 20000 }],
  totalAmount: 20000,
  amountPaidNow: 5000,
  totalPaidSoFar: 5000,
  balanceDue: 15000,
  merchantName: 'TestShop',
  currency: 'NGN',
};

describe('Payment receipt email', () => {
  describe('registration info in footer', () => {
    it('includes TIN and RC number when provided', () => {
      const html = generatePaymentReceiptEmail({
        ...basePayload,
        amountPaidNow: 10000,
        totalPaidSoFar: 10000,
        balanceDue: 10000,
        merchantTin: '1111111111',
        merchantRcNumber: 'RC-11111',
      });

      expect(html).toContain('TIN: 1111111111');
      expect(html).toContain('RC: RC-11111');
    });
  });

  describe('currency formatting', () => {
    it('renders NGN orders identically to the pre-multi-country baseline', () => {
      const output = [
        generatePaymentReceiptEmail(basePayload),
        generatePaymentReceiptText(basePayload),
      ].join('\n');

      expect(output).toContain('₦20,000');
      expect(output).toContain('₦5,000');
      expect(output).toContain('₦15,000');
      expect(output).not.toMatch(/₹|INR/);
    });

    it('uses the provided currency for email and text', () => {
      const payload = { ...basePayload, currency: 'INR' };
      const output = [
        generatePaymentReceiptEmail(payload),
        generatePaymentReceiptText(payload),
      ].join('\n');

      expect(output).toContain('₹20,000');
      expect(output).toContain('₹15,000');
      expect(output).toContain('₹5,000');
      expect(output).not.toContain('₦');
    });

    it('preserves decimal amounts for currencies with minor units', () => {
      const payload = {
        ...basePayload,
        currency: 'USD',
        items: [{ name: 'Gadget', quantity: 1, price: 1234.56 }],
        totalAmount: 1234.56,
        amountPaidNow: 1234.56,
        totalPaidSoFar: 1234.56,
        balanceDue: 0,
      };
      const output = [
        generatePaymentReceiptEmail(payload),
        generatePaymentReceiptText(payload),
      ].join('\n');

      expect(output).toContain('$1,234.56');
      expect(output).not.toContain('$1,235');
    });
  });

  describe('HTML escaping (XSS prevention)', () => {
    it('escapes user data', () => {
      const XSS = '<script>alert(1)</script>';
      const html = generatePaymentReceiptEmail({
        orderNumber: XSS,
        customerName: XSS,
        items: [{ name: XSS, quantity: 1, price: 1000 }],
        totalAmount: 1000,
        amountPaidNow: 1000,
        totalPaidSoFar: 1000,
        balanceDue: 0,
        merchantName: XSS,
        currency: 'NGN',
      });

      expect(html).not.toContain('<script>alert(1)</script>');
      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    });
  });
});
