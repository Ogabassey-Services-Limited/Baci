import { COUNTRIES } from '@/constants/countries';
import type { Merchant } from '@/hooks/useMerchant';

/** Editable merchant columns owned by the store-settings form. */
export type EditableMerchantColumns = Pick<
  Merchant,
  | 'business_name'
  | 'phone'
  | 'support_phone'
  | 'support_email'
  | 'business_address'
  | 'country'
  | 'payout_currency'
  | 'slug'
>;

/** Form values for the editable columns (always strings — empty when blank). */
export type StoreSettingsFormValues = {
  [K in keyof EditableMerchantColumns]: string;
};

export function hasNonEmptyTrimmedValue(
  value: string | null | undefined
): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Build the persisted baseline for the store-settings diff.
 *
 * The baseline MUST reflect the merchant's real persisted columns — a missing
 * (null) value baselines to an empty string, never a UI fallback. Otherwise a
 * merchant with `country = null` would baseline to the visible default (e.g.
 * `NG`); saving that visible default would produce an empty diff and the column
 * would never be written, leaving readiness incomplete. The sole exception is
 * support email: its editable display prefill is the auth email when no public
 * support email exists, so the baseline matches that display value until the
 * merchant changes it.
 */
export function buildBaselineFromMerchant(
  merchant: Merchant
): StoreSettingsFormValues {
  return {
    business_name: merchant.business_name || '',
    phone: merchant.phone || '',
    support_phone: merchant.support_phone || '',
    support_email: merchant.support_email || merchant.email || '',
    business_address: merchant.business_address || '',
    country: merchant.country || '',
    payout_currency: merchant.payout_currency || '',
    slug: merchant.slug || '',
  };
}

/** Initial form display values, applying UI fallbacks for the country picker. */
export type StoreSettingsInitialForm = {
  businessName: string;
  phone: string;
  supportPhone: string;
  email: string;
  address: string;
  country: string;
  currency: string;
  slug: string;
};

/**
 * Build the initial form display values from a loaded merchant.
 *
 * Unlike the persisted baseline, the display values apply UI fallbacks (e.g. the
 * default country/currency) so the form never paints an empty country picker.
 * Because the baseline keeps the real persisted value, saving the displayed
 * fallback still produces a non-empty diff and writes the column.
 */
export function buildInitialFormValues(
  merchant: Merchant
): StoreSettingsInitialForm {
  const country = merchant.country || COUNTRIES[0].code;
  const defaultCurrencyForCountry = COUNTRIES.find(
    (c) => c.code === country || c.name === country
  )?.currency;

  return {
    businessName: merchant.business_name || '',
    phone: merchant.phone || '',
    supportPhone: merchant.support_phone || '',
    email: merchant.support_email || merchant.email || '',
    address: merchant.business_address || '',
    country,
    currency:
      merchant.payout_currency ||
      defaultCurrencyForCountry ||
      COUNTRIES[0].currency,
    slug: merchant.slug || '',
  };
}

/**
 * Build a changed-only update payload by diffing the current form values against
 * the baseline values captured when the merchant was loaded. Only columns whose
 * value actually changed are included, so a stale full-form snapshot can never
 * revert an untouched column. Returns an empty object when nothing changed.
 */
export function buildMerchantUpdatePayload(
  baseline: StoreSettingsFormValues,
  formValues: StoreSettingsFormValues
): Partial<EditableMerchantColumns> {
  const payload: Partial<EditableMerchantColumns> = {};

  for (const key of Object.keys(
    formValues
  ) as (keyof StoreSettingsFormValues)[]) {
    if (formValues[key] !== baseline[key]) {
      payload[key] = formValues[key];
    }
  }

  // Established storefront slugs are immutable at the database layer. Keep the
  // mobile settings diff from submitting a stale or manually edited slug while
  // still allowing first-time slug creation for merchants that do not have one.
  if (hasNonEmptyTrimmedValue(baseline.slug)) {
    delete payload.slug;
  }

  // Store readiness accepts public support contact only. Until the mobile UI
  // migrates to structured contact input, a merchant that only edits the
  // visible primary phone should still complete contact readiness when no
  // support email/phone exists yet.
  if (
    !baseline.support_email &&
    !baseline.support_phone &&
    !formValues.support_email &&
    !formValues.support_phone &&
    formValues.phone.trim().length > 0 &&
    formValues.phone !== baseline.phone
  ) {
    payload.support_phone = formValues.phone;
  }

  return payload;
}

/**
 * Applies an accepted settings receipt to the local diff baseline.
 *
 * The receipt contains the persisted support email, which remains blank when
 * the user saves another field without touching the auth-email display prefill.
 * Keep that unchanged prefill in the comparison baseline so the next unrelated
 * save does not convert it into a support-email write.
 */
export function rebaseStoreSettingsBaseline({
  authEmailPrefill,
  baseline,
  displayedSupportEmail,
  savedValues,
}: {
  authEmailPrefill: string;
  baseline: StoreSettingsFormValues;
  displayedSupportEmail: string;
  savedValues: StoreSettingsFormValues;
}): StoreSettingsFormValues {
  return {
    ...baseline,
    ...savedValues,
    support_email:
      savedValues.support_email ||
      (authEmailPrefill && displayedSupportEmail === authEmailPrefill
        ? authEmailPrefill
        : ''),
  };
}
