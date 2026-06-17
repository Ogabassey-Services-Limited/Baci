import { describe, expect, it } from 'vitest';
import {
  assertNoIdentityFields,
  IDENTITY_FIELDS,
  IdentityFieldWriteError,
  MERCHANT_GENERIC_WRITABLE,
  pickGenericWritable,
} from './merchant-writable-fields';
import type { MerchantData } from './types';

describe('assertNoIdentityFields (fail-closed deny-list)', () => {
  it('throws when payload contains phone', () => {
    // Arrange
    const data: Partial<MerchantData> = { phone: '08000000000' };

    // Act & Assert
    expect(() => assertNoIdentityFields(data)).toThrow(IdentityFieldWriteError);
  });

  it('throws when payload contains social_media', () => {
    // Arrange
    const data: Partial<MerchantData> = {
      social_media: { twitter: '@oga' },
    };

    // Act & Assert
    expect(() => assertNoIdentityFields(data)).toThrow(IdentityFieldWriteError);
  });

  it('throws when payload contains business_address', () => {
    // Arrange
    const data: Partial<MerchantData> = {
      business_address: '123 Main Street',
    };

    // Act & Assert
    expect(() => assertNoIdentityFields(data)).toThrow(IdentityFieldWriteError);
  });

  it('throws when a products-page-style payload carries a stray identity key', () => {
    // Arrange — a legitimate generic field plus a stale identity key.
    const data: Partial<MerchantData> = {
      google_product_sheet_url: 'https://sheet',
      phone: '1234567890',
    };

    // Act & Assert
    let caught: unknown;
    try {
      assertNoIdentityFields(data);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(IdentityFieldWriteError);
    expect((caught as IdentityFieldWriteError).fields).toEqual(['phone']);
  });

  it('reports every offending identity key', () => {
    // Arrange
    const data: Partial<MerchantData> = {
      phone: '1',
      support_email: 'x@y.z',
      state_code: 'NG-LA',
    };

    // Act
    let caught: IdentityFieldWriteError | undefined;
    try {
      assertNoIdentityFields(data);
    } catch (error) {
      caught = error as IdentityFieldWriteError;
    }

    // Assert
    expect(caught?.fields).toEqual(['phone', 'support_email', 'state_code']);
  });

  it('does not throw for a non-identity payload', () => {
    // Arrange
    const data: Partial<MerchantData> = {
      brand_colors: { primary: '#000', background: '#fff', accent: '#f00' },
      country: 'NG',
    };

    // Act & Assert
    expect(() => assertNoIdentityFields(data)).not.toThrow();
  });

  it('covers the full IDENTITY_FIELDS list', () => {
    // Arrange & Act & Assert — every declared identity field is rejected.
    for (const field of IDENTITY_FIELDS) {
      expect(() =>
        assertNoIdentityFields({ [field]: 'x' } as Partial<MerchantData>)
      ).toThrow(IdentityFieldWriteError);
    }
  });
});

describe('pickGenericWritable (allowlist)', () => {
  it('passes non-identity generic fields through unchanged', () => {
    // Arrange
    const brandColors = { primary: '#000', background: '#fff', accent: '#f00' };
    const data: Partial<MerchantData> = {
      brand_colors: brandColors,
      country: 'NG',
    };

    // Act
    const result = pickGenericWritable(data);

    // Assert
    expect(result).toEqual({ brand_colors: brandColors, country: 'NG' });
  });

  it('drops keys that are neither identity nor allowlisted', () => {
    // Arrange — `id`/`user_id` are columns but not generic-writable.
    const data = {
      template_id: 'ogabassey',
      id: 'merchant-1',
      user_id: 'user-1',
    } as Partial<MerchantData>;

    // Act
    const result = pickGenericWritable(data);

    // Assert
    expect(result).toEqual({ template_id: 'ogabassey' });
  });

  it('keeps every allowlisted field when all are present', () => {
    // Arrange
    const data = Object.fromEntries(
      MERCHANT_GENERIC_WRITABLE.map((key) => [key, 'value'])
    ) as Partial<MerchantData>;

    // Act
    const result = pickGenericWritable(data);

    // Assert
    expect(Object.keys(result).sort()).toEqual(
      [...MERCHANT_GENERIC_WRITABLE].sort()
    );
  });
});

describe('field-list integrity', () => {
  it('keeps identity and generic-writable lists disjoint', () => {
    // Arrange
    const identity = new Set<string>(IDENTITY_FIELDS);

    // Act
    const overlap = MERCHANT_GENERIC_WRITABLE.filter((field) =>
      identity.has(field)
    );

    // Assert
    expect(overlap).toEqual([]);
  });
});
