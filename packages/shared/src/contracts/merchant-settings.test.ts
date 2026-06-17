import { describe, expect, it } from 'vitest';
import {
  formatMerchantAddress,
  type MerchantSettingsUpdatePayload,
  mergeSocialMediaValues,
  normalizeRegisteredAddress,
  normalizeSocialMediaValues,
  type RegisteredAddress,
} from './merchant-settings';

/**
 * Reference re-implementation of the SQL `public.format_merchant_address(jsonb)`
 * defined in
 * `supabase/migrations/20260617000200_derive_business_address_from_registered_address.sql`.
 *
 * It mirrors the SQL semantics exactly:
 *   - reads ONLY street, city, state, postal_code/postalCode (in that order),
 *   - regexp-trims each part, drops parts that are NULL or trim-to-empty,
 *   - `array_to_string(..., ', ')` joins the survivors,
 *   - `NULLIF(result, '')` collapses an all-empty result to NULL.
 *
 * The parity test below asserts the production TS helper produces byte-identical
 * output to this SQL reference for every fixture, so the trigger-derived
 * `business_address` can never diverge from what TS readers would compute.
 */
function trimSqlAddressPart(part: string | null | undefined): string | null {
  if (part == null) {
    return null;
  }
  const trimmed = part.trim();
  return trimmed === '' ? null : trimmed;
}

function sqlFormatMerchantAddress(
  address: RegisteredAddress | null | undefined
): string | null {
  if (address == null) {
    return null;
  }
  const postalCode =
    trimSqlAddressPart(address.postal_code) ??
    trimSqlAddressPart(address.postalCode);
  const parts = [address.street, address.city, address.state, postalCode];
  const kept: string[] = [];
  for (const part of parts) {
    // SQL: regexp-trim the part, then omit NULL or trim-to-empty values.
    const trimmed = trimSqlAddressPart(part);
    if (trimmed == null) {
      continue;
    }
    kept.push(trimmed);
  }
  const joined = kept.join(', ');
  return joined === '' ? null : joined;
}

const ADDRESS_PARITY_FIXTURES: Array<RegisteredAddress | null> = [
  null,
  {},
  {
    street: '12 Allen Avenue',
    city: 'Ikeja',
    state: 'Lagos',
    postal_code: '100271',
  },
  { street: '12 Allen Avenue', city: 'Ikeja', state: 'Lagos' },
  // country is intentionally ignored by both implementations
  { street: '12 Allen Avenue', country: 'Nigeria' },
  // empty / whitespace-only parts are skipped, not joined as blanks
  { street: '  ', city: 'Ikeja', state: '', postal_code: null },
  { city: 'Ikeja' },
  { postal_code: '100271' },
  // legacy camelCase stored key is accepted as a fallback
  { postalCode: '100271' },
  // canonical snake_case takes precedence when both postal keys are populated
  { postal_code: '100271', postalCode: '999999' },
  // whitespace-only snake_case falls back to legacy camelCase
  { postal_code: '   ', postalCode: '100271' },
  // surrounding whitespace is trimmed
  { street: '  7 Marina Road  ', city: '  Lagos Island  ' },
  // all-empty collapses to null (no stale empty string)
  { street: '', city: ' ', state: null, postal_code: undefined },
];

describe('merchant settings contracts', () => {
  it('drops empty social media handles', () => {
    expect(
      normalizeSocialMediaValues({
        instagram: ' @baci ',
        twitter: ' ',
      })
    ).toEqual({
      instagram: '@baci',
    });
  });

  it('returns null when a registered address is empty', () => {
    expect(
      normalizeRegisteredAddress({
        street: ' ',
        city: '',
        state: null,
      })
    ).toBeNull();
  });

  it('normalizes address fields when values are present', () => {
    expect(
      normalizeRegisteredAddress({
        street: ' 12 Allen Avenue ',
        city: ' Ikeja ',
        country: ' Nigeria ',
      })
    ).toEqual({
      street: '12 Allen Avenue',
      city: 'Ikeja',
      state: null,
      postal_code: null,
      country: 'Nigeria',
    });
  });

  it('merges a partial social payload over existing handles (untouched survive)', () => {
    expect(
      mergeSocialMediaValues(
        { twitter: '@oga', facebook: 'fb.com/oga', instagram: '@old' },
        { instagram: '@new' }
      )
    ).toEqual({
      twitter: '@oga',
      facebook: 'fb.com/oga',
      instagram: '@new',
    });
  });

  it('collapses to {} only when every merged handle is blank', () => {
    expect(
      mergeSocialMediaValues({ twitter: '@oga' }, { twitter: '  ' })
    ).toEqual({});
  });

  it('treats a null existing value as an empty base', () => {
    expect(mergeSocialMediaValues(null, { twitter: ' @baci ' })).toEqual({
      twitter: '@baci',
    });
  });

  it('ignores corrupt persisted non-string handles while applying valid incoming values', () => {
    expect(
      mergeSocialMediaValues(
        { twitter: true, facebook: { url: 'fb.com/bad' } },
        { instagram: ' @baci ' }
      )
    ).toEqual({ instagram: '@baci' });
  });

  it('accepts an explicit clear_social_media flag on the update payload', () => {
    const payload: MerchantSettingsUpdatePayload = {
      social_media: {},
      clear_social_media: true,
    };

    expect(payload.clear_social_media).toBe(true);
  });
});

describe('formatMerchantAddress', () => {
  it('comma-joins non-empty street/city/state/postal_code', () => {
    expect(
      formatMerchantAddress({
        street: '12 Allen Avenue',
        city: 'Ikeja',
        state: 'Lagos',
        postal_code: '100271',
      })
    ).toBe('12 Allen Avenue, Ikeja, Lagos, 100271');
  });

  it('falls back to legacy camelCase postalCode', () => {
    expect(
      formatMerchantAddress({
        street: '12 Allen Avenue',
        city: 'Ikeja',
        state: 'Lagos',
        postalCode: '100271',
      })
    ).toBe('12 Allen Avenue, Ikeja, Lagos, 100271');
  });

  it('skips missing and whitespace-only parts', () => {
    expect(
      formatMerchantAddress({
        street: '  ',
        city: 'Ikeja',
        state: '',
        postal_code: null,
      })
    ).toBe('Ikeja');
  });

  it('trims surrounding whitespace on each part', () => {
    expect(
      formatMerchantAddress({
        street: '  7 Marina Road  ',
        city: '  Lagos Island  ',
      })
    ).toBe('7 Marina Road, Lagos Island');
  });

  it('ignores the country part (matches SQL + invoice readers)', () => {
    expect(
      formatMerchantAddress({
        street: '12 Allen Avenue',
        country: 'Nigeria',
      })
    ).toBe('12 Allen Avenue');
  });

  it('returns null for a null address', () => {
    expect(formatMerchantAddress(null)).toBeNull();
    expect(formatMerchantAddress(undefined)).toBeNull();
  });

  it('returns null (never an empty string) for an all-empty address', () => {
    expect(
      formatMerchantAddress({
        street: '',
        city: ' ',
        state: null,
        postal_code: undefined,
      })
    ).toBeNull();
  });

  it('stays byte-identical to the SQL format_merchant_address reference', () => {
    for (const fixture of ADDRESS_PARITY_FIXTURES) {
      expect(formatMerchantAddress(fixture)).toBe(
        sqlFormatMerchantAddress(fixture)
      );
    }
  });
});
