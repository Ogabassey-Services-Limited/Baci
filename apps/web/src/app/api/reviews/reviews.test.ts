import { describe, expect, it } from 'vitest';
import { reviewSubmissionSchema } from '@/schemas/reviews';

describe('Review Submission Schema', () => {
  it('should sanitize input fields', () => {
    const maliciousInput = {
      productId: '123e4567-e89b-12d3-a456-426614174000',
      merchantId: '123e4567-e89b-12d3-a456-426614174001',
      customerEmail: 'test@example.com',
      rating: 5,
      title: '<img src=x onerror=alert(1)>Good product',
      body: '<img src=x onerror=alert(1)>Really good!',
      customerName: 'John <script> Doe',
    };

    const result = reviewSubmissionSchema.safeParse(maliciousInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('Good product');
      expect(result.data.body).toBe('Really good!');
      // script tag is removed, but content might remain if it wasn't self-closing,
      // but here <script> is just a tag, so it should be removed.
      // "John <script> Doe" -> "John  Doe"
      expect(result.data.customerName).toBe('John  Doe');
    }
  });

  it('should validate rating range', () => {
    const invalidInput = {
      productId: '123e4567-e89b-12d3-a456-426614174000',
      merchantId: '123e4567-e89b-12d3-a456-426614174001',
      customerEmail: 'test@example.com',
      rating: 6,
    };

    const result = reviewSubmissionSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Rating must be at most 5');
    }
  });

  it('should validate email format', () => {
    const invalidInput = {
      productId: '123e4567-e89b-12d3-a456-426614174000',
      merchantId: '123e4567-e89b-12d3-a456-426614174001',
      customerEmail: 'invalid-email',
      rating: 5,
    };

    const result = reviewSubmissionSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Invalid email format');
    }
  });

  it('should validate UUIDs', () => {
    const invalidInput = {
      productId: 'invalid-uuid',
      merchantId: '123e4567-e89b-12d3-a456-426614174001',
      customerEmail: 'test@example.com',
      rating: 5,
    };

    const result = reviewSubmissionSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(
        /Invalid product ID|Invalid uuid/i
      );
    }
  });
});
