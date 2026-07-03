import { describe, expect, it } from 'vitest';
import { createCustomerSchema, updateCustomerSchema } from './customers';

describe('customer schemas', () => {
  describe('createCustomerSchema', () => {
    it('accepts valid customer data', () => {
      const result = createCustomerSchema.safeParse({
        first_name: 'ada',
        last_name: 'LOVELACE',
        email: 'ada@example.com',
        phone: '+2348012345678',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.first_name).toBe('Ada');
        expect(result.data.last_name).toBe('Lovelace');
      }
    });

    it('accepts empty object (all fields optional)', () => {
      expect(createCustomerSchema.safeParse({}).success).toBe(true);
    });

    it('rejects invalid email', () => {
      const result = createCustomerSchema.safeParse({
        email: 'not-an-email',
      });
      expect(result.success).toBe(false);
    });

    it('accepts null for optional nullable fields', () => {
      const result = createCustomerSchema.safeParse({
        first_name: null,
        email: null,
        phone: null,
        store_credit: null,
      });
      expect(result.success).toBe(true);
    });

    it('normalizes empty and whitespace-only names to empty strings', () => {
      const result = createCustomerSchema.safeParse({
        first_name: '   ',
        last_name: '',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.first_name).toBe('');
        expect(result.data.last_name).toBe('');
      }
    });

    it('sanitizes borderline phone formats without failing validation', () => {
      const result = createCustomerSchema.safeParse({
        phone: 'phone: +234 (801) 234-5678 ext 9',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.phone).toBe('+234 (801) 234-5678  9');
      }
    });

    it('accepts non-negative store credit values', () => {
      const result = createCustomerSchema.safeParse({
        first_name: 'Ada',
        store_credit: '2500',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.store_credit).toBe(2500);
      }
    });

    it('rejects runaway store credit values', () => {
      expect(
        createCustomerSchema.safeParse({
          store_credit: '1000000001',
        }).success
      ).toBe(false);
    });

    it('accepts a company customer with a company name', () => {
      const result = createCustomerSchema.safeParse({
        customer_type: 'company',
        company_name: '  Acme Ltd  ',
        phone: '+2348012345678',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.customer_type).toBe('company');
        expect(result.data.company_name).toBe('Acme Ltd');
      }
    });

    it('rejects a company customer without a company name', () => {
      const result = createCustomerSchema.safeParse({
        customer_type: 'company',
        company_name: '   ',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((issue) =>
            issue.path.includes('company_name')
          )
        ).toBe(true);
      }
    });

    it('rejects an unknown customer type', () => {
      expect(
        createCustomerSchema.safeParse({ customer_type: 'vendor' }).success
      ).toBe(false);
    });

    it('rejects unsupported notes instead of accepting an unsaved field', () => {
      expect(
        createCustomerSchema.safeParse({
          first_name: 'Ada',
          notes: 'Call before delivery',
        }).success
      ).toBe(false);
    });
  });

  describe('updateCustomerSchema', () => {
    it('accepts valid update data', () => {
      const result = updateCustomerSchema.safeParse({
        full_name: 'aDa loVELACE',
        email: 'ada@example.com',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.full_name).toBe('Ada Lovelace');
      }
    });

    it('accepts empty object', () => {
      expect(updateCustomerSchema.safeParse({}).success).toBe(true);
    });

    it('rejects invalid email', () => {
      const result = updateCustomerSchema.safeParse({
        email: 'bad-email',
      });
      expect(result.success).toBe(false);
    });

    it('accepts null for nullable fields', () => {
      const result = updateCustomerSchema.safeParse({
        first_name: null,
        last_name: null,
        full_name: null,
        email: null,
        phone: null,
        address: null,
        store_credit: null,
      });
      expect(result.success).toBe(true);
    });

    it('normalizes empty and whitespace-only full names to empty strings', () => {
      const result = updateCustomerSchema.safeParse({
        full_name: '   ',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.full_name).toBe('');
      }
    });

    it('sanitizes invalid phone characters without failing validation', () => {
      const result = updateCustomerSchema.safeParse({
        phone: 'not-a-phone',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.phone).toBe('--');
      }
    });

    it('accepts non-negative store credit values', () => {
      const result = updateCustomerSchema.safeParse({
        store_credit: 1250,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.store_credit).toBe(1250);
      }
    });

    it('rejects negative store credit values', () => {
      expect(
        updateCustomerSchema.safeParse({
          store_credit: -1,
        }).success
      ).toBe(false);

      expect(
        createCustomerSchema.safeParse({
          first_name: 'Ada',
          store_credit: -1,
        }).success
      ).toBe(false);
    });

    it('accepts company_name/customer_type so company edits persist', () => {
      const result = updateCustomerSchema.safeParse({
        customer_type: 'company',
        company_name: '  Acme Ltd  ',
      });

      expect(result.success).toBe(true);
      expect(result.data?.company_name).toBe('Acme Ltd');
      expect(result.data?.customer_type).toBe('company');
    });

    it('requires company_name when switching a customer to company', () => {
      expect(
        updateCustomerSchema.safeParse({ customer_type: 'company' }).success
      ).toBe(false);
    });

    it('does not require company_name for individual edits', () => {
      expect(
        updateCustomerSchema.safeParse({ first_name: 'Ada' }).success
      ).toBe(true);
    });
  });

  it('treats cleared store credit input as unset instead of coercing it to zero', () => {
    const result = createCustomerSchema.safeParse({
      first_name: 'Ada',
      store_credit: '',
    });

    expect(result.success).toBe(true);
    expect(result.data?.store_credit).toBeUndefined();
  });
});
