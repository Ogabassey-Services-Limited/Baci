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
      {
        decision: 'origin_dynamic',
        hostKind: 'configured_external_media_origin',
        methods: ['GET', 'HEAD'],
      },
      ...[
        'configured_google_tag_manager_origin',
        'configured_google_ad_manager_origin',
        'configured_google_store_widget_origin',
        'configured_google_store_badge_origin',
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
});
