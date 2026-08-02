export function hasCartMerchantContext(
  cartMerchantSlug: string | null,
  storefrontMerchantSlug: string | null | undefined
): boolean {
  return !cartMerchantSlug || cartMerchantSlug === storefrontMerchantSlug;
}
