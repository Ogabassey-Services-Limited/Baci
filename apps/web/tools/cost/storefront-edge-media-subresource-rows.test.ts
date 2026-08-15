import { describe, expect, it } from 'vitest';
import { STOREFRONT_EDGE_MEDIA_SUBRESOURCE_ROWS } from './storefront-edge-media-subresource-rows';

describe('external storefront media inventory', () => {
  it('keeps CDN and storage image requests destination-aware', () => {
    expect(
      STOREFRONT_EDGE_MEDIA_SUBRESOURCE_ROWS.map(
        ({ destinationCondition, decision, methods }) => ({
          decision,
          hostKind: destinationCondition?.hostKind,
          methods,
        })
      )
    ).toEqual([
      {
        decision: 'origin_dynamic',
        hostKind: 'configured_media_cdn_origin',
        methods: ['GET', 'HEAD'],
      },
      {
        decision: 'origin_dynamic',
        hostKind: 'configured_supabase_storage_origin',
        methods: ['GET', 'HEAD'],
      },
      ...Array.from({ length: 9 }, () => ({
        decision: 'origin_dynamic',
        hostKind: 'configured_external_media_origin',
        methods: ['GET', 'HEAD'],
      })),
      {
        decision: 'origin_dynamic',
        hostKind: 'configured_google_tag_manager_origin',
        methods: ['GET', 'HEAD'],
      },
      {
        decision: 'origin_dynamic',
        hostKind: 'configured_google_analytics_collection_origin',
        methods: ['GET', 'HEAD', 'POST'],
      },
      ...[
        'configured_google_ad_manager_origin',
        'configured_google_store_widget_origin',
        'configured_google_store_badge_origin',
        'configured_google_customer_reviews_origin',
      ].map((hostKind) => ({
        decision: 'origin_dynamic',
        hostKind,
        methods: ['GET', 'HEAD'],
      })),
      {
        decision: 'origin_dynamic',
        hostKind: 'configured_supabase_storage_upload_origin',
        methods: ['PUT', 'OPTIONS'],
      },
      ...Array.from({ length: 2 }, () => ({
        decision: 'origin_dynamic',
        hostKind: 'configured_external_media_origin',
        methods: ['GET', 'HEAD'],
      })),
      ...[
        'configured_klump_origin',
        'configured_paystack_asset_origin',
        'configured_korapay_origin',
        'configured_credpal_origin',
        'configured_credit_direct_origin',
        'configured_juicyway_origin',
        'configured_credpal_origin',
        'configured_credit_direct_origin',
        'configured_meta_origin',
        'configured_tiktok_origin',
        'configured_snapchat_origin',
        'configured_twitter_origin',
      ].map((hostKind) => ({
        decision: 'origin_dynamic',
        hostKind,
        methods: ['GET', 'HEAD'],
      })),
    ]);
  });

  it('binds checkout payment logos and legal texture pages to reviewed sources', () => {
    const byId = new Map(
      STOREFRONT_EDGE_MEDIA_SUBRESOURCE_ROWS.map((row) => [row.id, row])
    );

    expect(byId.get('automatic-subresource:checkout-payment-paystack')).toEqual(
      expect.objectContaining({
        sourcePath:
          'apps/web/src/components/storefront/ogabassey/components/PaymentLogos.tsx',
        destinationCondition: expect.objectContaining({
          hostKind: 'configured_paystack_asset_origin',
        }),
      })
    );
    expect(
      byId.get('automatic-subresource:transparent-textures-privacy')
    ).toEqual(
      expect.objectContaining({
        sourcePath:
          'apps/web/src/components/storefront/ogabassey/pages/privacy-policy.tsx',
      })
    );
    expect(
      byId.get('automatic-subresource:google-analytics-collection')
    ).toEqual(
      expect.objectContaining({
        methods: ['GET', 'HEAD', 'POST'],
        sourcePath: 'apps/web/src/components/analytics/google-analytics.tsx',
      })
    );
    expect(
      byId.get('automatic-subresource:new-template-checkout-mastercard')
    ).toEqual(
      expect.objectContaining({
        sourcePath:
          'apps/web/src/components/storefront/new-template/checkout-page.tsx',
      })
    );
    expect(byId.get('automatic-subresource:negotiation-evidence-upload')).toEqual(
      expect.objectContaining({
        methods: ['PUT', 'OPTIONS'],
      })
    );
  });
});
