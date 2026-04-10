import { describe, expect, it } from 'vitest';
import {
  generateOrderCancellationEmail,
  generateOrderConfirmationEmail,
  generateOrderConfirmationText,
  generateOrderDeliveredEmail,
  generateOrderShippedEmail,
  generateOrderShippedText,
  generatePaymentReceiptEmail,
  generatePaymentReminderEmail,
} from './email-templates';

const baseOrderData = {
  orderNumber: 'ORD-001',
  customerName: 'John Doe',
  items: [{ name: 'Widget', quantity: 2, price: 5000 }],
  subtotal: 10000,
  shippingFee: 1500,
  total: 11500,
  shippingAddress: {
    address: '123 Test St',
    city: 'Lagos',
    state: 'Lagos',
    phone: '+2348012345678',
  },
  merchantName: 'TestShop',
  merchantUrl: 'https://testshop.usebaci.com',
};

describe('Email Templates', () => {
  describe('Registration Info in Footers', () => {
    it('includes TIN and RC number in order confirmation email when provided', () => {
      const html = generateOrderConfirmationEmail({
        ...baseOrderData,
        merchantTin: '1234567890',
        merchantRcNumber: 'RC-12345',
      });

      expect(html).toContain('TIN: 1234567890');
      expect(html).toContain('RC: RC-12345');
    });

    it('omits TIN and RC when not provided', () => {
      const html = generateOrderConfirmationEmail(baseOrderData);

      expect(html).not.toContain('TIN:');
      expect(html).not.toContain('RC:');
    });

    it('shows only TIN when RC is not provided', () => {
      const html = generateOrderConfirmationEmail({
        ...baseOrderData,
        merchantTin: '1234567890',
      });

      expect(html).toContain('TIN: 1234567890');
      expect(html).not.toContain('RC:');
    });

    it('shows only RC when TIN is not provided', () => {
      const html = generateOrderConfirmationEmail({
        ...baseOrderData,
        merchantRcNumber: 'RC-99999',
      });

      expect(html).toContain('RC: RC-99999');
      expect(html).not.toContain('TIN:');
    });

    it('includes registration info in payment reminder email', () => {
      const html = generatePaymentReminderEmail({
        orderNumber: 'ORD-002',
        customerName: 'Jane Doe',
        items: [{ name: 'Gadget', quantity: 1, price: 20000 }],
        totalAmount: 20000,
        amountPaid: 0,
        balanceDue: 20000,
        paymentLink: 'https://pay.test/link',
        merchantName: 'TestShop',
        merchantUrl: 'https://testshop.usebaci.com',
        merchantTin: '9876543210',
        merchantRcNumber: 'RC-54321',
      });

      expect(html).toContain('TIN: 9876543210');
      expect(html).toContain('RC: RC-54321');
    });

    it('includes registration info in payment receipt email', () => {
      const html = generatePaymentReceiptEmail({
        orderNumber: 'ORD-003',
        customerName: 'Jane Doe',
        items: [{ name: 'Gadget', quantity: 1, price: 20000 }],
        totalAmount: 20000,
        amountPaidNow: 10000,
        totalPaidSoFar: 10000,
        balanceDue: 10000,
        merchantName: 'TestShop',
        merchantUrl: 'https://testshop.usebaci.com',
        merchantTin: '1111111111',
        merchantRcNumber: 'RC-11111',
      });

      expect(html).toContain('TIN: 1111111111');
      expect(html).toContain('RC: RC-11111');
    });

    it('includes registration info in shipped email', () => {
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

    it('includes registration info in delivered email', () => {
      const html = generateOrderDeliveredEmail({
        orderNumber: 'ORD-005',
        customerName: 'Jane Doe',
        items: [{ name: 'Gadget', quantity: 1 }],
        merchantName: 'TestShop',
        merchantUrl: 'https://testshop.usebaci.com',
        merchantRcNumber: 'RC-33333',
      });

      expect(html).toContain('RC: RC-33333');
    });

    it('includes registration info in cancellation email', () => {
      const html = generateOrderCancellationEmail({
        orderNumber: 'ORD-006',
        customerName: 'Jane Doe',
        items: [{ name: 'Gadget', quantity: 1, price: 5000 }],
        totalAmount: 5000,
        amountPaid: 5000,
        refundAmount: 5000,
        cancelledBy: 'merchant',
        merchantName: 'TestShop',
        merchantUrl: 'https://testshop.usebaci.com',
        merchantTin: '4444444444',
        merchantRcNumber: 'RC-44444',
      });

      expect(html).toContain('TIN: 4444444444');
      expect(html).toContain('RC: RC-44444');
    });
  });

  describe('Tracking Info in Shipped Emails', () => {
    it('includes tracking number and tracking link in shipped email', () => {
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

  describe('Order Confirmation Email', () => {
    it('returns valid HTML with merchant name and order number', () => {
      const html = generateOrderConfirmationEmail(baseOrderData);

      expect(html).toContain('TestShop');
      expect(html).toContain('ORD-001');
      expect(html).toContain('John Doe');
      expect(html).toContain('Widget');
    });

    it('includes order total and shipping fee', () => {
      const html = generateOrderConfirmationEmail(baseOrderData);

      expect(html).toContain('11,500');
      expect(html).toContain('1,500');
    });
  });

  describe('Order Confirmation Text', () => {
    it('returns plain text with order details', () => {
      const text = generateOrderConfirmationText(baseOrderData);

      expect(text).toContain('ORD-001');
      expect(text).toContain('John Doe');
      expect(text).toContain('Widget');
      expect(text).toContain('11,500');
    });
  });
});
