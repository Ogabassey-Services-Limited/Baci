interface GiglAdminShippingEligibilityInput {
  country?: string | null;
  payoutCurrency?: string | null;
  settingsReady: boolean;
  shippingProviders?: readonly string[] | null;
}

export function isGiglAdminShippingEligible({
  country,
  payoutCurrency,
  settingsReady,
  shippingProviders,
}: GiglAdminShippingEligibilityInput): boolean {
  if (!settingsReady) return false;

  return (
    country?.trim().toUpperCase() === 'NG' &&
    payoutCurrency?.trim().toUpperCase() === 'NGN' &&
    (shippingProviders ?? []).some(
      (provider) => provider.trim().toLowerCase() === 'gigl'
    )
  );
}
