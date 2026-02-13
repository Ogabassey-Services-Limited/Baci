import { describe, expect, it } from 'vitest';
import { orderCreateSchema } from './orders';

describe('orderCreateSchema Sanitization', () => {
  it('should sanitize XSS payloads', () => {
    const maliciousInput = {
      merchant_id: '123e4567-e89b-12d3-a456-426614174000',
      customer_email: 'test@example.com',
      customer_name: '<script>alert("XSS")</script>John Doe',
      customer_phone: '08012345678',
      items: [
        {
          product_id: '123e4567-e89b-12d3-a456-426614174001',
          name: '<img src=x onerror=alert(1)>Product',
          quantity: 1,
          price: 100,
        },
      ],
      subtotal: 100,
      shipping_fee: 10,
      payment_method: 'card<script>bad()</script>',
      notes: '<a href="javascript:alert(1)">Click me</a>',
      shipping_address: {
        address: '<iframe src="malicious.com"></iframe>123 Main St',
        city: 'Lagos<script>bad()</script>',
        state: 'Lagos',
      },
      shipping_provider: 'GIGL<script>',
      tracking_number: 'TRACK123<script>',
      source: 'web<script>',
      shipping_provider_legacy: 'FedEx<script>',
    };

    const result = orderCreateSchema.safeParse(maliciousInput);

    expect(result.success).toBe(true);
    if (result.success) {
      // It should NOT retain the tags
      expect(result.data.customer_name).not.toContain('<script>');
      // sanitizeText strips tags but keeps content
      expect(result.data.customer_name).toBe('alert("XSS")John Doe');

      expect(result.data.items[0].name).not.toContain('<img');
      expect(result.data.items[0].name).toBe('Product');

      expect(result.data.notes).not.toContain('<a href');
      expect(result.data.notes).toBe('Click me');

      expect(result.data.shipping_address?.address).not.toContain('<iframe');
      expect(result.data.shipping_address?.address).toBe('123 Main St');

      expect(result.data.shipping_address?.city).toBe('Lagosbad()');
      expect(result.data.shipping_provider).toBe('GIGL');
      expect(result.data.tracking_number).toBe('TRACK123');

      expect(result.data.payment_method).toBe('cardbad()');
      expect(result.data.source).toBe('web');
      expect(result.data.shipping_provider_legacy).toBe('FedEx');
    }
  });

  it('should accept valid input', () => {
    const validInput = {
      merchant_id: '123e4567-e89b-12d3-a456-426614174000',
      customer_email: 'test@example.com',
      customer_name: 'John Doe',
      customer_phone: '08012345678',
      items: [
        {
          product_id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Product 1',
          quantity: 1,
          price: 100,
        },
      ],
      subtotal: 100,
      shipping_fee: 10,
      payment_method: 'card',
      notes: 'Please deliver on time',
    };
    const result = orderCreateSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customer_name).toBe('John Doe');
      expect(result.data.notes).toBe('Please deliver on time');
    }
  });
});
