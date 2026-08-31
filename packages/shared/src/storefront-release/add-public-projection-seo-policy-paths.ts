interface SeoPolicies {
  privacy?: string;
  returns?: string;
  returnPolicy?: unknown;
  shipping?: string;
  shippingPolicy?: unknown;
  terms?: string;
}

/** Adds policy-backed paths to the released storefront SEO route set. */
export function addPublicProjectionSeoPolicyPaths(
  knownPaths: Set<string>,
  policies: SeoPolicies | undefined
): void {
  if (policies?.privacy?.trim()) {
    knownPaths.add('/privacy');
    knownPaths.add('/privacy-policy');
  }
  if (policies?.terms?.trim()) {
    knownPaths.add('/terms');
    knownPaths.add('/terms-and-conditions');
    knownPaths.add('/terms-of-service');
  }
  if (policies?.returns?.trim() || policies?.returnPolicy)
    knownPaths.add('/returns');
  if (policies?.shipping?.trim() || policies?.shippingPolicy)
    knownPaths.add('/shipping');
}
