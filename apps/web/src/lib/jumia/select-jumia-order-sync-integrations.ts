import {
  type MarketplaceIntegrationRow,
  readOrderSyncEnabled,
} from './order-sync-mappers';

export function buildJumiaOrderSyncScope(
  integration: Pick<
    MarketplaceIntegrationRow,
    | 'merchant_id'
    | 'shop_id'
    | 'country_code'
    | 'marketplace_key'
    | 'jumia_authorization_id'
  >
): string {
  const marketplaceKey = integration.marketplace_key?.trim() || 'default';
  const authorizationId = integration.jumia_authorization_id?.trim() || 'oauth';
  return `${integration.merchant_id}:${integration.shop_id ?? 'oauth'}:${integration.country_code ?? ''}:${marketplaceKey}:${authorizationId}`;
}

/**
 * Pick one order-sync-enabled integration per merchant+shop+country+marketplace scope.
 * Disabled siblings must not claim the scope ahead of an enabled row.
 */
export function selectJumiaOrderSyncIntegrations(
  integrations: readonly MarketplaceIntegrationRow[]
): MarketplaceIntegrationRow[] {
  const selected: MarketplaceIntegrationRow[] = [];
  const claimedScopes = new Set<string>();

  for (const integration of integrations) {
    if (!readOrderSyncEnabled(integration.sync_config)) {
      continue;
    }
    const orderScope = buildJumiaOrderSyncScope(integration);
    if (claimedScopes.has(orderScope)) {
      continue;
    }
    claimedScopes.add(orderScope);
    selected.push(integration);
  }

  return selected;
}
