// Field governance for the generic `updateMerchant` write path.
//
// PR-D (V1 of the merchant-data-drift remediation): the generic
// `update(Partial<MerchantData>)` sink in `merchant-provider.tsx` previously had
// NO field allowlist, so any caller's stray/stale identity key (e.g. a stale
// `phone`/`social_media`/`business_address` carried in a products-page payload)
// landed straight in the `merchants` row and drifted real merchant identity to
// placeholders.
//
// Defense is two-layer (deny-list + allowlist), the modern over-posting/mass-
// assignment guard:
//   1. Fail-closed deny-list — throw if ANY payload key is an identity field.
//      Identity/contact/legal fields are NOT writable via the generic hook;
//      they must go through the dedicated `/api/merchant/settings` PATCH route
//      (allowlisted server-side) via the typed `updateSocial()` helper, etc.
//   2. Allowlist — `pick()` the remaining keys down to the explicit
//      `MERCHANT_GENERIC_WRITABLE` set before `.update()`, so even an unknown
//      future key can never reach the DB through this path.
//
// Both lists are typed `satisfies readonly (keyof MerchantData)[]`, so a typo or
// a removed `MerchantData` field is a compile error rather than a silent leak.

import { logger } from '@/lib/logger';
import type { MerchantData } from './types';

/**
 * Identity / contact / legal fields that must NEVER be written through the
 * generic `updateMerchant` hook. Writing these requires the dedicated,
 * server-allowlisted PATCH route (e.g. via `updateSocial()`).
 */
export const IDENTITY_FIELDS = [
  'business_address',
  'phone',
  'support_phone',
  'email',
  'support_email',
  'registered_address',
  'social_media',
  'legal_entity_name',
  'cac_rc_number',
  'tax_identification_number',
  'state_code',
] as const satisfies readonly (keyof MerchantData)[];

export type IdentityField = (typeof IDENTITY_FIELDS)[number];

const IDENTITY_FIELD_SET: ReadonlySet<string> = new Set(IDENTITY_FIELDS);

/**
 * The ONLY merchant columns the generic `updateMerchant` hook may write.
 * Anything not in this list is dropped before reaching the database.
 */
export const MERCHANT_GENERIC_WRITABLE = [
  'business_name',
  'business_type',
  'logo_url',
  'brand_colors',
  'country',
  'pages',
  'google_product_sheet_url',
  'payout_currency',
  'published_config',
  'favicon_svg_url',
  'favicon_png_32_url',
  'favicon_png_192_url',
  'favicon_apple_touch_url',
  'favicon_uploaded_at',
  'feature_settings',
  'template_id',
  'trust_profile',
  'hero_slides',
  'mobile_hero_slides',
  'about_page',
  'faq_items',
] as const satisfies readonly (keyof MerchantData)[];

export type MerchantGenericWritableField =
  (typeof MERCHANT_GENERIC_WRITABLE)[number];

const GENERIC_WRITABLE_SET: ReadonlySet<string> = new Set(
  MERCHANT_GENERIC_WRITABLE
);

/**
 * Thrown (fail-closed) when a caller tries to write an identity field through
 * the generic `updateMerchant` hook. The offending keys are attached for
 * diagnostics.
 */
export class IdentityFieldWriteError extends Error {
  readonly fields: string[];

  constructor(fields: string[]) {
    super(
      `updateMerchant may not write identity field(s): ${fields.join(', ')}. ` +
        'Use the dedicated /api/merchant/settings PATCH route (e.g. updateSocial).'
    );
    this.name = 'IdentityFieldWriteError';
    this.fields = fields;
  }
}

/**
 * Fail-closed guard: throws `IdentityFieldWriteError` if the payload carries any
 * identity field.
 */
export function assertNoIdentityFields(data: Partial<MerchantData>): void {
  const offending = Object.keys(data).filter((key) =>
    IDENTITY_FIELD_SET.has(key)
  );
  if (offending.length > 0) {
    throw new IdentityFieldWriteError(offending);
  }
}

/**
 * Picks the payload down to the `MERCHANT_GENERIC_WRITABLE` allowlist. Identity
 * fields must already have been rejected by `assertNoIdentityFields`; any other
 * non-allowlisted key is dropped (never reaches the DB). Keys that are on
 * NEITHER list are logged via `logger.warn` so a developer who adds a caller
 * passing a new, uncategorised field can discover the silent drop.
 */
export function pickGenericWritable(
  data: Partial<MerchantData>
): Partial<MerchantData> {
  const result: Partial<MerchantData> = {};
  const droppedUncategorised: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (GENERIC_WRITABLE_SET.has(key)) {
      // The allowlist is derived from keyof MerchantData, so this assignment is
      // sound; the index signature on Partial<MerchantData> is the only reason a
      // cast is needed here.
      (result as Record<string, unknown>)[key] = value;
    } else if (!IDENTITY_FIELD_SET.has(key)) {
      // The key is on NEITHER list: it is silently dropped here. Identity keys
      // are handled (and thrown on) by assertNoIdentityFields, so a key landing
      // here is an uncategorised field a developer likely expected to persist.
      // Warn so the silent drop is discoverable instead of a debugging mystery.
      droppedUncategorised.push(key);
    }
  }
  if (droppedUncategorised.length > 0) {
    logger.warn({
      message:
        'pickGenericWritable dropped uncategorised merchant field(s) ' +
        '(not identity, not generic-writable). Add them to ' +
        'MERCHANT_GENERIC_WRITABLE or persist via a dedicated route.',
      fields: droppedUncategorised,
    });
  }
  return result;
}
