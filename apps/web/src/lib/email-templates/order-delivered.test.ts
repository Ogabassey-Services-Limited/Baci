import { describe, expect, it } from 'vitest';
import {
  generateOrderDeliveredEmail,
  generateOrderDeliveredText,
} from './order-delivered';

const basePayload = {
  orderNumber: 'ORD-005',
  customerName: 'Jane Doe',
  items: [{ name: 'Gadget', quantity: 1 }],
  merchantName: 'TestShop',
  merchantUrl: 'https://testshop.usebaci.com',
};

describe('Order delivered email', () => {
  describe('registration info in footer', () => {
    it('includes RC number when provided', () => {
      const html = generateOrderDeliveredEmail({
        ...basePayload,
        merchantRcNumber: 'RC-33333',
      });

      expect(html).toContain('RC: RC-33333');
    });
  });

  describe('plain text variant', () => {
    it('returns plain text with order details', () => {
      const text = generateOrderDeliveredText(basePayload);

      expect(text).toContain('Your Order Has Been Delivered');
      expect(text).toContain('ORD-005');
      expect(text).toContain('Jane Doe');
      expect(text).toContain('Gadget');
      expect(text).toContain('Shop again at https://testshop.usebaci.com');
    });

    it('includes a Google review link when a place id is provided', () => {
      const text = generateOrderDeliveredText({
        ...basePayload,
        googlePlaceId: 'place-123',
      });

      expect(text).toContain(
        'https://search.google.com/local/writereview?placeid=place-123'
      );
    });

    it('omits the review section when no place id is provided', () => {
      const text = generateOrderDeliveredText(basePayload);

      expect(text).not.toContain('writereview');
    });
  });

  describe('HTML escaping (XSS prevention)', () => {
    it('escapes user data and URL-encodes the review place id', () => {
      const XSS = '<script>alert(1)</script>';
      const html = generateOrderDeliveredEmail({
        ...basePayload,
        orderNumber: XSS,
        customerName: XSS,
        items: [{ name: XSS, quantity: 1 }],
        supportEmail: XSS,
        merchantName: XSS,
        merchantUrl: 'javascript:alert(1)',
        googlePlaceId: XSS,
      });

      expect(html).not.toContain('<script>alert(1)</script>');
      expect(html).not.toContain('javascript:alert(1)');
      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
      // Google review placeId is URL-encoded, not raw, in the review link.
      expect(html).toContain('placeid=%3Cscript%3E');
    });
  });
});
