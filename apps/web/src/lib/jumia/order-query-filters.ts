const JUMIA_OAUTH_SHOP_ID = 'oauth';

export function getJumiaOrderQueryFilters(integration: {
  shopId: string;
  countryCode?: string | null;
}): { country?: string; shopId?: string } {
  if (integration.shopId === JUMIA_OAUTH_SHOP_ID) {
    return {};
  }

  return {
    country: integration.countryCode ?? undefined,
    shopId: integration.shopId,
  };
}
