/**
 * Manual order sync cannot identify a Jumia business client. Every order
 * returned for the selected provider scope therefore belongs in the neutral
 * cache scope instead of whichever marketplace row started the request.
 */
export function getJumiaManualOrderCacheKey(
  marketplaceKey: string | null | undefined
): 'default' {
  void marketplaceKey;
  return 'default';
}
