import { describe, expect, it } from 'vitest';
import { STOREFRONT_EDGE_INVENTORY_POLICY } from './storefront-edge-inventory-policy';
import { STOREFRONT_EDGE_INVENTORY_ROUTING_INPUT_PATHS } from './storefront-edge-inventory-routing-input-paths';

describe('storefront edge inventory routing input paths', () => {
  it('binds checkout payment logos and legal texture pages into the inventory digest', () => {
    expect(STOREFRONT_EDGE_INVENTORY_ROUTING_INPUT_PATHS).toEqual(
      expect.arrayContaining([
        'apps/web/src/components/storefront/ogabassey/components/PaymentLogos.tsx',
        'apps/web/src/components/storefront/ogabassey/components/Footer.tsx',
        'apps/web/src/components/storefront/ogabassey/components/FooterAppPayments.tsx',
        'apps/web/src/components/storefront/ogabassey/components/utility-checkout.ts',
        'apps/web/src/config/platform.ts',
        'apps/web/src/lib/social.ts',
        'apps/web/src/components/storefront/ogabassey/pages/privacy-policy.tsx',
        'apps/web/src/components/storefront/ogabassey/pages/legal-dispute.tsx',
        'apps/web/src/components/storefront/ogabassey/pages/sustainability.tsx',
        'apps/web/src/components/storefront/ogabassey/pages/swap.tsx',
        'apps/web/src/components/analytics/google-analytics.tsx',
        'apps/web/src/components/storefront/new-template/footer.tsx',
        'apps/web/src/components/storefront/ogabassey/pages/cart-page-wrapper.tsx',
        'apps/web/src/components/storefront/ogabassey/pages/help-support.tsx',
        'apps/web/src/components/storefront/ogabassey/pages/checkout/hooks/checkout-shipping-quote-loader.ts',
        'apps/web/src/lib/credit-direct-client.ts',
        'apps/web/src/lib/credpal.ts',
        'apps/web/src/lib/klump-sdk.ts',
        'apps/web/src/components/storefront/blocks/header.tsx',
        'packages/shared/src/storefront/post-purchase-actions.ts',
      ])
    );
  });

  it('matches the policy routing-input authority list exactly', () => {
    expect(STOREFRONT_EDGE_INVENTORY_POLICY.routingInputPaths).toEqual([
      ...STOREFRONT_EDGE_INVENTORY_ROUTING_INPUT_PATHS,
    ]);
  });
});
