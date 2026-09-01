export function isCheckoutAddressContinueReady({
  hasContactIdentity,
  hasFreshShippingQuote,
  isAddressComplete,
  isLoadingQuotes,
  isPickupStation = false,
  requiresShippingQuote,
}: {
  hasContactIdentity: boolean;
  hasFreshShippingQuote: boolean;
  isAddressComplete: boolean;
  isLoadingQuotes: boolean;
  isPickupStation?: boolean;
  requiresShippingQuote: boolean;
}): boolean {
  if (!hasContactIdentity) return false;
  if (!isPickupStation && !isAddressComplete) return false;
  if (!requiresShippingQuote) return true;
  return !isLoadingQuotes && hasFreshShippingQuote;
}
