import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
  formatMerchantSettingsErrors,
  updateMerchantSettingsSchema,
} from '@/schemas/merchant-settings';

describe('updateMerchantSettingsSchema', () => {
  it('rejects an empty object (refine requires at least one field)', () => {
    const result = updateMerchantSettingsSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        'At least one merchant setting must be provided'
      );
    }
  });

  it('parses a valid vat_registration_status', () => {
    for (const status of [
      'not_registered',
      'registered',
      'exempt',
      'pending',
    ] as const) {
      const result = updateMerchantSettingsSchema.safeParse({
        vat_registration_status: status,
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects an invalid vat_registration_status enum value', () => {
    const result = updateMerchantSettingsSchema.safeParse({
      vat_registration_status: 'invalid_status',
    });
    expect(result.success).toBe(false);
  });

  it('parses tax_identification_number and sanitizes it', () => {
    const result = updateMerchantSettingsSchema.safeParse({
      tax_identification_number: '  12345678  ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tax_identification_number).toBe('12345678');
    }
  });

  it('accepts null for tax_identification_number', () => {
    const result = updateMerchantSettingsSchema.safeParse({
      tax_identification_number: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tax_identification_number).toBeNull();
    }
  });

  it('parses legal_entity_name and strips HTML tags', () => {
    const result = updateMerchantSettingsSchema.safeParse({
      legal_entity_name: '<b>Acme Ltd</b>',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.legal_entity_name).toBe('Acme Ltd');
    }
  });

  it('parses state_code and trims whitespace', () => {
    const result = updateMerchantSettingsSchema.safeParse({
      state_code: ' LA ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.state_code).toBe('LA');
    }
  });

  it('accepts null for state_code', () => {
    const result = updateMerchantSettingsSchema.safeParse({
      state_code: null,
    });
    expect(result.success).toBe(true);
  });

  it('parses social_media with optional nullable fields', () => {
    const result = updateMerchantSettingsSchema.safeParse({
      social_media: {
        twitter: 'https://twitter.com/test',
        facebook: null,
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.social_media?.twitter).toBe(
        'https://twitter.com/test'
      );
      expect(result.data.social_media?.facebook).toBeNull();
    }
  });

  it('sanitizes social_media values by stripping HTML', () => {
    const result = updateMerchantSettingsSchema.safeParse({
      social_media: {
        instagram: '<script>alert("xss")</script>@handle',
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.social_media?.instagram).toBe('alert("xss")@handle');
    }
  });

  it('parses registered_address with all optional fields', () => {
    const result = updateMerchantSettingsSchema.safeParse({
      registered_address: {
        street: '123 Main St',
        city: 'Lagos',
        state: 'Lagos',
        postal_code: '100001',
        country: 'Nigeria',
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.registered_address?.city).toBe('Lagos');
    }
  });

  it('accepts null for registered_address', () => {
    const result = updateMerchantSettingsSchema.safeParse({
      registered_address: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.registered_address).toBeNull();
    }
  });

  it('parses a full valid payload with all fields', () => {
    const result = updateMerchantSettingsSchema.safeParse({
      social_media: { twitter: '@baci' },
      vat_registration_status: 'registered',
      tax_identification_number: 'TIN-001',
      legal_entity_name: 'Baci Inc',
      registered_address: { street: '1 Tech Dr', city: 'Abuja' },
      state_code: 'FC',
    });
    expect(result.success).toBe(true);
  });
});

describe('formatMerchantSettingsErrors', () => {
  it('groups errors by dotted path', () => {
    const result = updateMerchantSettingsSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const formatted = formatMerchantSettingsErrors(result.error);
      // The refine error has an empty path, mapped to _root
      expect(formatted._root).toBeDefined();
      expect(formatted._root[0]).toBe(
        'At least one merchant setting must be provided'
      );
    }
  });

  it('returns error messages for nested paths', () => {
    // Construct a ZodError manually with a nested path
    const zodError = new ZodError([
      {
        code: 'custom',
        path: ['social_media', 'twitter'],
        message: 'Expected string, received number',
      },
    ]);
    const formatted = formatMerchantSettingsErrors(zodError);
    expect(formatted['social_media.twitter']).toEqual([
      'Expected string, received number',
    ]);
  });

  it('collects multiple errors for the same path', () => {
    const zodError = new ZodError([
      {
        code: 'custom',
        path: ['legal_entity_name'],
        message: 'Too short',
      },
      {
        code: 'custom',
        path: ['legal_entity_name'],
        message: 'Required',
      },
    ]);
    const formatted = formatMerchantSettingsErrors(zodError);
    expect(formatted.legal_entity_name).toHaveLength(2);
    expect(formatted.legal_entity_name).toContain('Too short');
    expect(formatted.legal_entity_name).toContain('Required');
  });
});
