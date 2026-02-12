/**
 * XSS Prevention Test Suite for Order API
 *
 * Tests that malicious payloads are properly sanitized before storage.
 */

import { describe, expect, it } from 'vitest';
import { orderCreateSchema } from '@/schemas/orders';

describe('Order API XSS Prevention', () => {
  describe('orderCreateSchema sanitization', () => {
    it('should strip HTML tags from customer name', () => {
      const maliciousPayload = {
        merchant_id: '00000000-0000-0000-0000-000000000000',
        customer_email: 'test@example.com',
        customer_name: '<script>alert("xss")</script>John Doe',
        items: [
          {
            name: 'Test Product',
            quantity: 1,
            price: 100,
            product_id: '00000000-0000-0000-0000-000000000000',
          },
        ],
        subtotal: 100,
        payment_method: 'card',
      };

      const result = orderCreateSchema.safeParse(maliciousPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.customer_name).not.toContain('<script>');
        expect(result.data.customer_name).not.toContain('</script>');
        // sanitizeText strips HTML tags but preserves text content
        expect(result.data.customer_name).toContain('John Doe');
      }
    });

    it('should strip HTML tags from notes', () => {
      const maliciousPayload = {
        merchant_id: '00000000-0000-0000-0000-000000000000',
        customer_email: 'test@example.com',
        customer_name: 'John Doe',
        notes: '<img src=x onerror=alert(1)>Delivery instructions',
        items: [
          {
            name: 'Test Product',
            quantity: 1,
            price: 100,
            product_id: '00000000-0000-0000-0000-000000000000',
          },
        ],
        subtotal: 100,
        payment_method: 'card',
      };

      const result = orderCreateSchema.safeParse(maliciousPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.notes).not.toContain('<img');
        expect(result.data.notes).not.toContain('onerror');
        expect(result.data.notes).toBe('Delivery instructions');
      }
    });

    it('should strip HTML tags from shipping address', () => {
      const maliciousPayload = {
        merchant_id: '00000000-0000-0000-0000-000000000000',
        customer_email: 'test@example.com',
        customer_name: 'John Doe',
        shipping_address: {
          address: '<a href="javascript:alert(1)">123 Main St</a>',
          city: '<script>alert(1)</script>New York',
          state: 'NY',
        },
        items: [
          {
            name: 'Test Product',
            quantity: 1,
            price: 100,
            product_id: '00000000-0000-0000-0000-000000000000',
          },
        ],
        subtotal: 100,
        payment_method: 'card',
      };

      const result = orderCreateSchema.safeParse(maliciousPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.shipping_address?.address).not.toContain('<a');
        expect(result.data.shipping_address?.address).toContain('123 Main St');
        expect(result.data.shipping_address?.city).not.toContain('<script>');
        expect(result.data.shipping_address?.city).toContain('New York');
      }
    });
  });
});
