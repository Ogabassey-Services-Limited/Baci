/**
 * DEFAULT_FALLBACK_VAT_RATE_PERCENT is Nigeria's current VAT rate used when
 * merchant tax settings are unavailable in checkout. Treat it as a regulatory
 * fallback and review it whenever jurisdictional VAT rules or merchant tax
 * sourcing changes. A configured 0% rate is intentionally accepted for
 * tax-exempt jurisdictions; negative and non-finite values are ignored.
 */
export const DEFAULT_FALLBACK_VAT_RATE_PERCENT = 7.5;
export const FALLBACK_VAT_RATE_ENV = 'EXPO_PUBLIC_FALLBACK_VAT_RATE_PERCENT';

// Resolve lazily so checkout normalization observes Expo/test env setup that
// may happen after this module is imported.
export function resolveFallbackVatRate() {
  const rawConfiguredRate = process.env[FALLBACK_VAT_RATE_ENV];
  if (!rawConfiguredRate?.trim()) {
    return DEFAULT_FALLBACK_VAT_RATE_PERCENT;
  }
  const configuredRate = Number(rawConfiguredRate);
  if (Number.isFinite(configuredRate) && configuredRate >= 0) {
    return configuredRate;
  }
  console.warn(
    `[Tax] Ignoring invalid ${FALLBACK_VAT_RATE_ENV}: ${
      Number.isFinite(configuredRate) ? 'negative' : 'non-finite'
    }`,
    { value: rawConfiguredRate }
  );
  return DEFAULT_FALLBACK_VAT_RATE_PERCENT;
}
