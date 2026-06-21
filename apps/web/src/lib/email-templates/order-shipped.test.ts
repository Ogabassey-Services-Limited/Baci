import { describe, expect, it } from 'vitest';
import {
  generateOrderShippedEmail,
  generateOrderShippedText,
} from './order-shipped';

describe('Order shipped email', () => {
  describe('registration info in footer', () => {
    it('includes TIN when provided', () => {
      const html = generateOrderShippedEmail({
        orderNumber: 'ORD-004',
        customerName: 'Jane Doe',
        items: [{ name: 'Gadget', quantity: 1 }],
        shippingAddress: {
          address: '456 Test Ave',
          city: 'Abuja',
          state: 'FCT',
          phone: '+2349012345678',
        },
        merchantName: 'TestShop',
        merchantUrl: 'https://testshop.usebaci.com',
        merchantTin: '2222222222',
      });

      expect(html).toContain('TIN: 2222222222');
    });
  });

  describe('tracking info', () => {
    it('includes tracking number and tracking link in HTML and text', () => {
      const shippedPayload = {
        orderNumber: 'ORD-004',
        customerName: 'Jane Doe',
        items: [{ name: 'Gadget', quantity: 1 }],
        shippingAddress: {
          address: '456 Test Ave',
          city: 'Abuja',
          state: 'FCT',
          phone: '+2349012345678',
        },
        trackingNumber: 'T222600389',
        trackingUrl:
          'https://testshop.usebaci.com/track-order?token=track-token-123',
        courierName: 'TOPSHIP',
        merchantName: 'TestShop',
        merchantUrl: 'https://testshop.usebaci.com',
      };
      const html = generateOrderShippedEmail(shippedPayload);
      const text = generateOrderShippedText(shippedPayload);

      expect(html).toContain(shippedPayload.trackingNumber);
      expect(html).toContain(shippedPayload.trackingUrl);
      expect(html).toContain('Track Package');
      expect(text).toContain(
        `Tracking Number: ${shippedPayload.trackingNumber}`
      );
      expect(text).toContain(`Tracking Link: ${shippedPayload.trackingUrl}`);
    });
  });

  describe('HTML escaping (XSS prevention)', () => {
    it('escapes user data and rejects unsafe tracking/merchant links', () => {
      const XSS = '<script>alert(1)</script>';
      const html = generateOrderShippedEmail({
        orderNumber: XSS,
        customerName: XSS,
        items: [{ name: XSS, quantity: 1 }],
        shippingAddress: { address: XSS, city: XSS, state: XSS, phone: XSS },
        trackingNumber: XSS,
        trackingUrl: 'javascript:alert(1)',
        courierName: XSS,
        estimatedDelivery: XSS,
        supportEmail: XSS,
        merchantName: XSS,
        merchantUrl: 'javascript:alert(1)',
      });

      expect(html).not.toContain('<script>alert(1)</script>');
      expect(html).not.toContain('javascript:alert(1)');
      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    });
  });
});
