import { describe, expect, it } from 'vitest';
import { orderCreateSchema } from './orders';

describe('orderCreateSchema Sanitization', () => {
  it('should sanitize input to prevent XSS', () => {
    const maliciousInput = {
      merchant_id: '123e4567-e89b-12d3-a456-426614174000',
      customer_email: 'Test@Example.com', // Valid format, but mixed case. Should be lowercased.
      customer_name: '<script>alert("XSS")</script>John Doe', // Should strip tags
      customer_phone: '+1 (234) 567-890<script>', // Should strip <script> but keep phone chars
      items: [
        {
          name: '<img src=x onerror=alert(1)>Product',
          quantity: 1,
          price: 100,
          productId: 'product-1',
        },
      ],
      subtotal: 100,
      payment_method: 'card',
    };

    const result = orderCreateSchema.safeParse(maliciousInput);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customer_name).toBe('alert("XSS")John Doe');
      expect(result.data.customer_email).toBe('test@example.com');
      expect(result.data.customer_phone).toBe('+1 (234) 567-890');
      expect(result.data.items[0].name).toBe('Product');
    }
  });
});
