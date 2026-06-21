import { describe, expect, it } from 'vitest';
import {
  generateOrderCancellationEmail,
  generateOrderCancellationText,
  generateOrderConfirmationEmail,
  generateOrderConfirmationText,
  generateOrderDeliveredEmail,
  generateOrderShippedEmail,
  generateOrderShippedText,
  generatePaymentReceiptEmail,
  generatePaymentReceiptText,
  generatePaymentReminderEmail,
  generatePaymentReminderText,
  generateVtuTokenReceiptEmail,
  generateVtuTokenReceiptText,
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

  describe('Currency Formatting', () => {
    const paymentReminderPayload = {
      orderNumber: 'ORD-002',
      customerName: 'Jane Doe',
      items: [{ name: 'Gadget', quantity: 1, price: 20000 }],
      totalAmount: 20000,
      amountPaid: 5000,
      balanceDue: 15000,
      paymentLink: 'https://pay.test/link',
      merchantName: 'TestShop',
      merchantUrl: 'https://testshop.usebaci.com',
    };
    const paymentReceiptPayload = {
      orderNumber: 'ORD-003',
      customerName: 'Jane Doe',
      items: [{ name: 'Gadget', quantity: 1, price: 20000 }],
      totalAmount: 20000,
      amountPaidNow: 5000,
      totalPaidSoFar: 5000,
      balanceDue: 15000,
      merchantName: 'TestShop',
      merchantUrl: 'https://testshop.usebaci.com',
    };
    const cancellationPayload = {
      orderNumber: 'ORD-004',
      customerName: 'Jane Doe',
      items: [{ name: 'Gadget', quantity: 1, price: 5000 }],
      totalAmount: 5000,
      amountPaid: 5000,
      refundAmount: 5000,
      cancelledBy: 'merchant' as const,
      merchantName: 'TestShop',
      merchantUrl: 'https://testshop.usebaci.com',
    };

    it('defaults to NGN when no currency is provided', () => {
      const confirmationOutput = [
        generateOrderConfirmationEmail(baseOrderData),
        generateOrderConfirmationText(baseOrderData),
      ].join('\n');
      const lifecycleOutput = [
        generatePaymentReminderEmail(paymentReminderPayload),
        generatePaymentReminderText(paymentReminderPayload),
        generatePaymentReceiptEmail(paymentReceiptPayload),
        generatePaymentReceiptText(paymentReceiptPayload),
        generateOrderCancellationEmail(cancellationPayload),
        generateOrderCancellationText(cancellationPayload),
      ].join('\n');
      const output = `${confirmationOutput}\n${lifecycleOutput}`;

      expect(confirmationOutput).toContain('₦11,500');
      expect(lifecycleOutput).toContain('₦20,000');
      expect(lifecycleOutput).toContain('₦15,000');
      expect(lifecycleOutput).toContain('₦5,000');
      expect(output).not.toMatch(/₹|INR/);
    });

    it('uses the provided currency for order confirmation emails and text', () => {
      const payload = { ...baseOrderData, currency: 'INR' };
      const html = generateOrderConfirmationEmail(payload);
      const text = generateOrderConfirmationText(payload);
      const output = `${html}\n${text}`;

      expect(output).toContain('₹5,000');
      expect(output).toContain('₹10,000');
      expect(output).toContain('₹1,500');
      expect(output).toContain('₹11,500');
      expect(text).toContain('Total: ₹11,500');
      expect(output).not.toContain('₦');
    });

    it('uses the provided currency across payment lifecycle emails', () => {
      const output = [
        generatePaymentReminderEmail({
          ...paymentReminderPayload,
          currency: 'INR',
        }),
        generatePaymentReminderText({
          ...paymentReminderPayload,
          currency: 'INR',
        }),
        generatePaymentReceiptEmail({
          ...paymentReceiptPayload,
          currency: 'INR',
        }),
        generatePaymentReceiptText({
          ...paymentReceiptPayload,
          currency: 'INR',
        }),
        generateOrderCancellationEmail({
          ...cancellationPayload,
          currency: 'INR',
        }),
        generateOrderCancellationText({
          ...cancellationPayload,
          currency: 'INR',
        }),
      ].join('\n');

      expect(output).toContain('₹20,000');
      expect(output).toContain('₹15,000');
      expect(output).toContain('₹5,000');
      expect(output).toContain('Refund Amount: ₹5,000');
      expect(output).not.toContain('₦');
    });

    it('preserves decimal amounts for currencies with minor units', () => {
      const decimalOrderPayload = {
        ...baseOrderData,
        currency: 'USD',
        items: [{ name: 'Widget', quantity: 1, price: 1234.56 }],
        subtotal: 1234.56,
        shippingFee: 10.25,
        total: 1244.81,
      };
      const decimalReceiptPayload = {
        ...paymentReceiptPayload,
        currency: 'USD',
        items: [{ name: 'Gadget', quantity: 1, price: 1234.56 }],
        totalAmount: 1234.56,
        amountPaidNow: 1234.56,
        totalPaidSoFar: 1234.56,
        balanceDue: 0,
      };
      const output = [
        generateOrderConfirmationEmail(decimalOrderPayload),
        generateOrderConfirmationText(decimalOrderPayload),
        generatePaymentReceiptEmail(decimalReceiptPayload),
        generatePaymentReceiptText(decimalReceiptPayload),
      ].join('\n');

      expect(output).toContain('$1,234.56');
      expect(output).toContain('$1,244.81');
      expect(output).not.toContain('$1,235');
    });
  });

  describe('VTU token receipt email', () => {
    it('escapes receipt fields and rejects unsafe merchant links', () => {
      const html = generateVtuTokenReceiptEmail({
        transactionId: 'tx-1',
        reference: 'REF-<script>alert(1)</script>',
        customerName: 'Ada <img src=x onerror=alert(1)>',
        amount: 2500,
        type: 'electricity',
        providerLabel: 'EKEDC <b>bad</b>',
        customerIdentifier: 'METER-<script>meter()</script>',
        voucherPin: 'PIN-<script>token()</script>',
        phone_number: '080<script>phone()</script>',
        merchantName: 'Shop <script>brand()</script>',
        merchantUrl: 'javascript:alert(1)',
        supportEmail: 'help@example.com<script>alert(1)</script>',
        merchantTin: 'TIN-<script>tin()</script>',
        merchantRcNumber: 'RC-<script>rc()</script>',
      });

      expect(html).toContain('Ada &lt;img src=x onerror=alert(1)&gt;');
      expect(html).toContain('EKEDC &lt;b&gt;bad&lt;/b&gt;');
      expect(html).toContain('METER-&lt;script&gt;meter()&lt;/script&gt;');
      expect(html).toContain('PIN-&lt;script&gt;token()&lt;/script&gt;');
      expect(html).toContain('href="#"');
      expect(html).toContain('RC: RC-&lt;script&gt;rc()&lt;/script&gt;');
      expect(html).toContain('TIN: TIN-&lt;script&gt;tin()&lt;/script&gt;');
      expect(html).not.toContain('<script>');
      expect(html).not.toContain('javascript:alert(1)');
    });

    it('does not label token-based receipts without a PIN as directly active', () => {
      const payload = {
        transactionId: 'tx-1',
        reference: 'REF-123',
        customerName: 'Ada',
        amount: 2500,
        type: 'electricity' as const,
        providerLabel: 'EKEDC',
        customerIdentifier: '43901766923',
        voucherPin: null,
        phone_number: '08012345678',
        merchantName: 'Shop',
        merchantUrl: 'https://shop.example.com',
      };

      const html = generateVtuTokenReceiptEmail(payload);
      const text = generateVtuTokenReceiptText(payload);

      expect(html).toContain('TOKEN FULFILLMENT IN PROGRESS');
      expect(html).toContain('Payment Received');
      expect(html).toContain('token fulfillment is still in progress');
      expect(html).not.toContain('Directly Successful &amp; Active');
      expect(html).not.toContain('No PIN entry required');
      expect(html).not.toContain('is ready');
      expect(html).not.toContain('vend request has been fulfilled');
      expect(text).toContain('Token fulfillment is still in progress');
      expect(text).toContain("we're still retrieving the service token");
      expect(text).not.toContain('verified and fulfilled');
      expect(text).not.toContain('No PIN entry required');
    });

    it('escapes direct-success receipt fields in HTML and text variants', () => {
      const payload = {
        transactionId: 'tx-1',
        reference: 'REF-<script>alert(1)</script>',
        customerName: 'Ada <img src=x onerror=alert(1)>',
        amount: 2500,
        type: 'airtime' as const,
        providerLabel: 'MTN <b>bad</b>',
        customerIdentifier: '080<script>target()</script>',
        voucherPin: null,
        phone_number: '080<script>phone()</script>',
        merchantName: 'Shop <script>brand()</script>',
        merchantUrl: 'javascript:alert(1)',
        supportEmail: 'help@example.com<script>alert(1)</script>',
        merchantTin: 'TIN-<script>tin()</script>',
        merchantRcNumber: 'RC-<script>rc()</script>',
      };

      const html = generateVtuTokenReceiptEmail(payload);
      const text = generateVtuTokenReceiptText(payload);
      const output = `${html}\n${text}`;

      expect(html).toContain('Directly Successful & Active');
      expect(html).toContain('href="#"');
      expect(output).toContain('RC: RC-&lt;script&gt;rc()&lt;/script&gt;');
      expect(output).toContain('TIN: TIN-&lt;script&gt;tin()&lt;/script&gt;');
      expect(output).not.toContain('<script>');
      expect(output).not.toContain('javascript:alert(1)');
    });
  });

  describe('HTML escaping (XSS prevention)', () => {
    const XSS = '<script>alert(1)</script>';
    const ESCAPED = '&lt;script&gt;alert(1)&lt;/script&gt;';

    it('escapes user data in order confirmation email', () => {
      const html = generateOrderConfirmationEmail({
        ...baseOrderData,
        customerName: XSS,
        merchantName: XSS,
        items: [{ name: XSS, quantity: 1, price: 1000 }],
        shippingAddress: {
          address: XSS,
          city: XSS,
          state: XSS,
          phone: XSS,
        },
        merchantUrl: 'javascript:alert(1)',
      });

      expect(html).not.toContain('<script>alert(1)</script>');
      expect(html).not.toContain('javascript:alert(1)');
      expect(html).toContain(ESCAPED);
    });

    it('escapes user data in payment reminder email', () => {
      const html = generatePaymentReminderEmail({
        orderNumber: XSS,
        customerName: XSS,
        items: [{ name: XSS, quantity: 1, price: 1000 }],
        totalAmount: 1000,
        amountPaid: 0,
        balanceDue: 1000,
        paymentLink: 'javascript:alert(1)',
        merchantName: XSS,
        merchantUrl: 'javascript:alert(1)',
        supportEmail: XSS,
        // Bank-transfer block: only renders when virtualAccount is present.
        virtualAccount: {
          bankName: XSS,
          accountNumber: XSS,
          accountName: XSS,
        },
      });

      expect(html).not.toContain('<script>alert(1)</script>');
      expect(html).not.toContain('javascript:alert(1)');
      expect(html).toContain(ESCAPED);
    });

    it('escapes user data in payment receipt email', () => {
      const html = generatePaymentReceiptEmail({
        orderNumber: XSS,
        customerName: XSS,
        items: [{ name: XSS, quantity: 1, price: 1000 }],
        totalAmount: 1000,
        amountPaidNow: 1000,
        totalPaidSoFar: 1000,
        balanceDue: 0,
        merchantName: XSS,
      });

      expect(html).not.toContain('<script>alert(1)</script>');
      expect(html).toContain(ESCAPED);
    });

    it('escapes user data in shipped email', () => {
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
      expect(html).toContain(ESCAPED);
    });

    it('escapes user data in delivered email', () => {
      const html = generateOrderDeliveredEmail({
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
      expect(html).toContain(ESCAPED);
      // Google review placeId is URL-encoded, not raw, in the review link.
      expect(html).toContain('placeid=%3Cscript%3E');
    });

    it('escapes user data in cancellation email', () => {
      const html = generateOrderCancellationEmail({
        orderNumber: XSS,
        customerName: XSS,
        items: [{ name: XSS, quantity: 1, price: 1000 }],
        totalAmount: 1000,
        amountPaid: 1000,
        refundAmount: 1000,
        cancelledBy: 'merchant',
        cancellationReason: XSS,
        supportEmail: XSS,
        merchantName: XSS,
        merchantUrl: 'javascript:alert(1)',
      });

      expect(html).not.toContain('<script>alert(1)</script>');
      expect(html).not.toContain('javascript:alert(1)');
      expect(html).toContain(ESCAPED);
    });
  });

  describe('Payment reminder mailto fallback', () => {
    it('derives a clean host (no protocol/path) when supportEmail is absent', () => {
      const html = generatePaymentReminderEmail({
        orderNumber: 'ORD-X',
        customerName: 'Jane Doe',
        items: [{ name: 'Gadget', quantity: 1, price: 1000 }],
        totalAmount: 1000,
        amountPaid: 0,
        balanceDue: 1000,
        paymentLink: 'https://pay.test/link',
        merchantName: 'TestShop',
        merchantUrl: 'http://shop.example.com/store?ref=1',
      });

      expect(html).toContain('mailto:support@shop.example.com"');
      expect(html).not.toContain('support@http');
      expect(html).not.toContain('shop.example.com/store');
    });
  });
});
