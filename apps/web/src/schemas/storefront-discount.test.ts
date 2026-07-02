import { describe, expect, it } from 'vitest';
import {
  storefrontDiscountCodeRowSchema,
  storefrontDiscountValidateSchema,
} from './storefront-discount';

describe('storefront-discount schemas', () => {
  describe('storefrontDiscountValidateSchema', () => {
    it('validates a valid payload', () => {
      const payload = {
        merchant_id: '123e4567-e89b-12d3-a456-426614174000',
        code: 'SUMMER2024',
        cart_total: 150.5,
      };

      const result = storefrontDiscountValidateSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('rejects a negative cart total', () => {
      const payload = {
        merchant_id: '123e4567-e89b-12d3-a456-426614174000',
        code: 'SUMMER2024',
        cart_total: -10,
      };

      const result = storefrontDiscountValidateSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]).toMatchObject({
          code: 'too_small',
          path: ['cart_total'],
        });
      }
    });

    it('rejects an empty code', () => {
      const payload = {
        merchant_id: '123e4567-e89b-12d3-a456-426614174000',
        code: '   ',
        cart_total: 100,
      };

      const result = storefrontDiscountValidateSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]).toMatchObject({
          code: 'too_small',
          path: ['code'],
        });
      }
    });

    it('validates a payload with optional targeting arrays', () => {
      const payload = {
        merchant_id: '123e4567-e89b-12d3-a456-426614174000',
        code: 'SUMMER2024',
        cart_total: 150.5,
        product_ids: ['prod-1', 'prod-2'],
        category_ids: ['cat-1'],
      };

      const result = storefrontDiscountValidateSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });

  describe('storefrontDiscountCodeRowSchema', () => {
    it('validates a valid row payload', () => {
      const payload = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        code: 'WINTER_SALE',
        discount_type: 'percentage',
        discount_value: 20,
        starts_at: '2024-12-01T00:00:00Z',
        expires_at: '2024-12-31T23:59:59Z',
        usage_limit: 100,
        usage_count: 5,
        minimum_purchase_amount: 50,
        maximum_discount_amount: null,
        description: 'Winter holiday sale',
        applies_to: 'specific_products',
        product_ids: ['prod-x'],
        category_ids: [],
        usage_limit_per_customer: 1,
      };

      const result = storefrontDiscountCodeRowSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('transforms nullish arrays to empty arrays', () => {
      const payload = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        code: 'WINTER_SALE',
        discount_type: 'fixed_amount',
        discount_value: '10', // coerced
        starts_at: null,
        expires_at: null,
        usage_limit: null,
        usage_count: '0', // coerced
        minimum_purchase_amount: null,
        maximum_discount_amount: null,
        description: null,
        applies_to: 'all',
        product_ids: null,
        category_ids: undefined,
        usage_limit_per_customer: null,
      };

      const result = storefrontDiscountCodeRowSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.product_ids).toEqual([]);
        expect(result.data.category_ids).toEqual([]);
      }
    });

    it('catches invalid applies_to enum and defaults to all', () => {
      const payload = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        code: 'WINTER_SALE',
        discount_type: 'fixed_amount',
        discount_value: 10,
        starts_at: null,
        expires_at: null,
        usage_limit: null,
        usage_count: 0,
        minimum_purchase_amount: null,
        maximum_discount_amount: null,
        description: null,
        applies_to: 'invalid_type_here', // should catch to 'all'
        product_ids: [],
        category_ids: [],
        usage_limit_per_customer: null,
      };

      const result = storefrontDiscountCodeRowSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.applies_to).toBe('all');
      }
    });

    it('rejects an invalid discount_type', () => {
      const payload = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        code: 'WINTER_SALE',
        discount_type: 'invalid_discount',
        discount_value: 10,
        starts_at: null,
        expires_at: null,
        usage_limit: null,
        usage_count: 0,
        minimum_purchase_amount: null,
        maximum_discount_amount: null,
        description: null,
        applies_to: 'all',
        product_ids: [],
        category_ids: [],
        usage_limit_per_customer: null,
      };

      const result = storefrontDiscountCodeRowSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });
});
