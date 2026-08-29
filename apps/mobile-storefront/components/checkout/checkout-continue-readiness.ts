import {
  type ShippingAddressInput,
  ShippingAddressSchema,
} from '@/lib/validation';

type CheckoutAddressFields = Pick<
  ShippingAddressInput,
  'email' | 'firstName' | 'lastName' | 'phone' | 'address' | 'city' | 'state'
>;

export function isCheckoutAddressComplete(
  fields: CheckoutAddressFields
): boolean {
  return ShippingAddressSchema.safeParse(fields).success;
}

export function isCheckoutAddressContinueReady({
  hasFreshShippingQuote,
  isAddressComplete,
  isLoadingQuotes,
  requiresShippingQuote,
}: {
  hasFreshShippingQuote: boolean;
  isAddressComplete: boolean;
  isLoadingQuotes: boolean;
  requiresShippingQuote: boolean;
}): boolean {
  if (!isAddressComplete) return false;
  if (!requiresShippingQuote) return true;
  return !isLoadingQuotes && hasFreshShippingQuote;
}
