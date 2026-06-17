export const SOCIAL_MEDIA_KEYS = [
  'twitter',
  'facebook',
  'instagram',
  'tiktok',
  'youtube',
  'pinterest',
  'linkedin',
  'snapchat',
] as const;

export type SocialMediaKey = (typeof SOCIAL_MEDIA_KEYS)[number];
export type SocialMediaValues = Partial<Record<SocialMediaKey, string>>;
type SocialMediaInputValues = Partial<
  Record<SocialMediaKey, string | null | undefined>
>;

export type MerchantVatRegistrationStatus =
  | 'not_registered'
  | 'registered'
  | 'exempt'
  | 'pending';

export interface RegisteredAddress {
  street?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
}

export interface MerchantSettingsUpdatePayload {
  social_media?: SocialMediaValues;
  vat_registration_status?: MerchantVatRegistrationStatus;
  tax_identification_number?: string | null;
  legal_entity_name?: string | null;
  registered_address?: RegisteredAddress | null;
  state_code?: string | null;
}

export interface MerchantSettingsRecord {
  id: string;
  social_media: SocialMediaValues | null;
  vat_registration_status: MerchantVatRegistrationStatus | null;
  tax_identification_number: string | null;
  legal_entity_name: string | null;
  registered_address: RegisteredAddress | null;
  state_code: string | null;
  updated_at: string;
}

export const MERCHANT_SETTINGS_COLUMNS =
  'id, social_media, vat_registration_status, tax_identification_number, legal_entity_name, registered_address, state_code, updated_at';

export const MERCHANT_TAX_SETTINGS_COLUMNS =
  'vat_registration_status, vat_rate, tax_identification_number, legal_entity_name, registered_address, state_code';

export const NIGERIAN_STATES = [
  { name: 'Abia', code: 'NG-AB' },
  { name: 'Adamawa', code: 'NG-AD' },
  { name: 'Akwa Ibom', code: 'NG-AK' },
  { name: 'Anambra', code: 'NG-AN' },
  { name: 'Bauchi', code: 'NG-BA' },
  { name: 'Bayelsa', code: 'NG-BY' },
  { name: 'Benue', code: 'NG-BE' },
  { name: 'Borno', code: 'NG-BO' },
  { name: 'Cross River', code: 'NG-CR' },
  { name: 'Delta', code: 'NG-DE' },
  { name: 'Ebonyi', code: 'NG-EB' },
  { name: 'Edo', code: 'NG-ED' },
  { name: 'Ekiti', code: 'NG-EK' },
  { name: 'Enugu', code: 'NG-EN' },
  { name: 'FCT', code: 'NG-FC' },
  { name: 'Gombe', code: 'NG-GO' },
  { name: 'Imo', code: 'NG-IM' },
  { name: 'Jigawa', code: 'NG-JI' },
  { name: 'Kaduna', code: 'NG-KD' },
  { name: 'Kano', code: 'NG-KN' },
  { name: 'Katsina', code: 'NG-KT' },
  { name: 'Kebbi', code: 'NG-KE' },
  { name: 'Kogi', code: 'NG-KO' },
  { name: 'Kwara', code: 'NG-KW' },
  { name: 'Lagos', code: 'NG-LA' },
  { name: 'Nasarawa', code: 'NG-NA' },
  { name: 'Niger', code: 'NG-NI' },
  { name: 'Ogun', code: 'NG-OG' },
  { name: 'Ondo', code: 'NG-ON' },
  { name: 'Osun', code: 'NG-OS' },
  { name: 'Oyo', code: 'NG-OY' },
  { name: 'Plateau', code: 'NG-PL' },
  { name: 'Rivers', code: 'NG-RI' },
  { name: 'Sokoto', code: 'NG-SO' },
  { name: 'Taraba', code: 'NG-TA' },
  { name: 'Yobe', code: 'NG-YO' },
  { name: 'Zamfara', code: 'NG-ZA' },
] as const;

export function normalizeSocialMediaValues(
  socialMedia: SocialMediaInputValues
): SocialMediaValues {
  return Object.fromEntries(
    Object.entries(socialMedia)
      .map(([key, value]) => [key, value?.trim() ?? ''])
      .filter(([, value]) => value.length > 0)
  ) as SocialMediaValues;
}

export function normalizeRegisteredAddress(
  address: RegisteredAddress | null | undefined
): RegisteredAddress | null {
  if (!address) {
    return null;
  }

  const normalizedAddress: RegisteredAddress = {
    street: address.street?.trim() || null,
    city: address.city?.trim() || null,
    state: address.state?.trim() || null,
    postal_code: address.postal_code?.trim() || null,
    country: address.country?.trim() || null,
  };

  const hasValue = Object.values(normalizedAddress).some(Boolean);
  return hasValue ? normalizedAddress : null;
}

/**
 * Formats a structured {@link RegisteredAddress} into the free-text address
 * shown in the storefront footer, JSON-LD, receipts and invoices.
 *
 * Comma-joins the non-empty `street`, `city`, `state` and `postal_code` parts.
 * Returns `null` (never an empty string) when the address is null/empty so a
 * cleared structured address never leaves a stale free-text value behind.
 *
 * This is the canonical source of truth for deriving `merchants.business_address`
 * from `merchants.registered_address`. It MUST stay in lock-step with the SQL
 * `public.format_merchant_address(jsonb)` (PR-F address unification) — the
 * parity test in `merchant-settings.test.ts` enforces identical output.
 */
export function formatMerchantAddress(
  address: RegisteredAddress | null | undefined
): string | null {
  if (!address) {
    return null;
  }

  const parts = [
    address.street,
    address.city,
    address.state,
    address.postal_code,
  ]
    .map((part) => part?.trim() ?? '')
    .filter((part) => part.length > 0);

  return parts.length > 0 ? parts.join(', ') : null;
}
