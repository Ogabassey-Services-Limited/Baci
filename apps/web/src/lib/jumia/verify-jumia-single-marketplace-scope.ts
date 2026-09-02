type JumiaMarketplaceScopeClient = {
  shopId: string;
  marketplaceKey: string;
  getShops?: () => Promise<
    Array<{
      id: string;
      businessClients: Array<{ code: string; status: string }>;
    }>
  >;
};

type JumiaMarketplaceScopeResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | 'marketplace_mismatch'
        | 'multiple_active_marketplaces'
        | 'provider_unavailable'
        | 'shop_not_found';
    };

export async function verifyJumiaSingleMarketplaceScope(
  client: JumiaMarketplaceScopeClient
): Promise<JumiaMarketplaceScopeResult> {
  const marketplaceKey = client.marketplaceKey?.trim();
  if (
    !marketplaceKey ||
    marketplaceKey === 'oauth' ||
    marketplaceKey === 'default'
  ) {
    return { ok: true };
  }

  if (typeof client.getShops !== 'function') {
    return { ok: false, reason: 'provider_unavailable' };
  }

  let shops: Awaited<
    ReturnType<NonNullable<JumiaMarketplaceScopeClient['getShops']>>
  >;
  try {
    shops = await client.getShops();
  } catch {
    return { ok: false, reason: 'provider_unavailable' };
  }

  const shop = shops.find((candidate) => candidate.id === client.shopId);
  if (!shop) return { ok: false, reason: 'shop_not_found' };

  const activeClients = shop.businessClients.filter(
    (businessClient) => businessClient.status === 'active'
  );
  if (activeClients.length !== 1) {
    return { ok: false, reason: 'multiple_active_marketplaces' };
  }

  return activeClients[0].code === marketplaceKey
    ? { ok: true }
    : { ok: false, reason: 'marketplace_mismatch' };
}
