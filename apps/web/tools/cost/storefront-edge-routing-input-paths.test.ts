import { describe, expect, it } from 'vitest';
import { STOREFRONT_EDGE_INVENTORY_POLICY } from './storefront-edge-inventory-policy';
import { STOREFRONT_EDGE_INVENTORY_ROUTING_INPUT_PATHS } from './storefront-edge-inventory-routing-input-paths';
import { STOREFRONT_EDGE_ROUTING_INPUT_PATHS } from './storefront-edge-routing-input-paths';

describe('storefront edge routing input paths', () => {
  it('keeps the reviewed proxy and analytics authority paths explicit', () => {
    expect(STOREFRONT_EDGE_ROUTING_INPUT_PATHS).toEqual([
      'apps/web/next.config.ts',
      'apps/web/src/proxy.ts',
      'apps/web/src/components/analytics/google-store-widget.tsx',
      'apps/web/src/components/analytics/google-customer-reviews.tsx',
      'apps/web/src/components/storefront/ogabassey/components/negotiation-evidence.ts',
    ]);
  });

  it('binds checkout payment logos and legal texture pages into the inventory digest', () => {
    expect(STOREFRONT_EDGE_INVENTORY_ROUTING_INPUT_PATHS).toEqual(
      expect.arrayContaining([
        'apps/web/src/components/storefront/ogabassey/components/PaymentLogos.tsx',
        'apps/web/src/components/storefront/ogabassey/pages/privacy-policy.tsx',
        'apps/web/src/components/storefront/ogabassey/pages/legal-dispute.tsx',
        'apps/web/src/components/analytics/google-analytics.tsx',
      ])
    );
  });

  it('matches the policy routing-input authority list exactly', () => {
    expect(STOREFRONT_EDGE_INVENTORY_POLICY.routingInputPaths).toEqual([
      ...STOREFRONT_EDGE_INVENTORY_ROUTING_INPUT_PATHS,
    ]);
  });
});
