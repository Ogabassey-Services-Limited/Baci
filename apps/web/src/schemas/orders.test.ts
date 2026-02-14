import { describe, expect, it } from 'vitest';
import { orderCreateSchema } from './orders';

describe('orderCreateSchema', () => {
  const validOrder = {
    merchant_id: '12345678-1234-1234-1234-123456789012',
    customer_email: 'test@example.com',
    customer_name: 'John Doe',
    items: [
      {
        product_id: 'product-1',
        name: 'Product 1',
        quantity: 1,
        price: 100,
        subtotal: 100,
      },
    ],
    subtotal: 100,
    payment_method: 'card',
    shipping_address: {
      address: '123 Main St',
      city: 'New York',
      state: 'NY',
    },
    notes: 'Please deliver promptly.',
  };

  it('validates a correct order', () => {
    const result = orderCreateSchema.safeParse(validOrder);
    expect(result.success).toBe(true);
  });

  it('sanitizes customer name with HTML tags', () => {
    const maliciousOrder = {
      ...validOrder,
      customer_name: '<script>alert("XSS")</script>John Doe',
    };
    const result = orderCreateSchema.safeParse(maliciousOrder);
    expect(result.success).toBe(true);
    if (result.success) {
      // Before fix: contains script tags
      // After fix: should not contain script tags
      // We expect this test to fail/change behavior after we implement the fix
      expect(result.data.customer_name).not.toContain('<script>');
    }
  });

  it('sanitizes notes with HTML tags', () => {
    const maliciousOrder = {
      ...validOrder,
      notes: '<img src=x onerror=alert(1)>Delivery notes',
    };
    const result = orderCreateSchema.safeParse(maliciousOrder);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.notes).not.toContain('<img');
    }
  });

  it('sanitizes shipping address with HTML tags', () => {
    const maliciousOrder = {
      ...validOrder,
      shipping_address: {
        address: '123 <script>alert(1)</script> St',
        city: 'New <b>York</b>',
        state: 'NY',
      },
    };
    const result = orderCreateSchema.safeParse(maliciousOrder);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.shipping_address?.address).not.toContain('<script>');
      expect(result.data.shipping_address?.city).not.toContain('<b>');
    }
  });
});
