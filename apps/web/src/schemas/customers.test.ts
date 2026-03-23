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
        email: null,
        phone: null,
        address: null,
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
  });
});
